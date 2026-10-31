import {
  BATTLE_LOG_VERSION,
  type BattleEvent,
  type BattleResult,
  type BattleTrigger,
  type BattleUnitSummary,
  type Effect,
  type GameConfig,
  type Hook,
  type SecondaryStat,
  type Skill,
} from '@gacha/shared';
import { computeDamage, elementMultiplier } from './damage';
import { createRng, type Seed } from './rng';
import { byGridOrder, selectTargets, type Targetable } from './targeting';
import { BattleInputError, type BattleUnitInput, type TeamInput } from './types';

/**
 * Bộ mô phỏng trận: hàm thuần túy, deterministic.
 *   simulate(đội A, đội B, cấu hình, seed) → nhật ký sự kiện
 * Đội A là bên tấn công, đội B là bên phòng thủ. Mọi yếu tố ngẫu nhiên đi qua rng có seed theo thứ tự cố định:
 *   chọn mục tiêu ngẫu nhiên → né tránh → chí mạng → từng hiệu ứng theo thứ tự khai báo
 * (rồi tới các lần rút của hành động đặc biệt, theo thứ tự chúng xảy ra). Các luật chưa được chốt trong
 * docs/rules-decisions.md dùng đề xuất mặc định; chỗ nào engine tự quyết thì ghi trong docs/engine-rules.md.
 */

type Side = 'A' | 'B';
type StatName = 'atk' | 'def' | 'spd';

interface ActiveEffect {
  effect: Effect;
  /** Số lượt (của chủ sở hữu) còn lại. */
  remaining: number;
  /** Khiên: lượng khiên còn lại. Dot: sát thương mỗi lượt (chốt lúc áp). */
  amount: number;
  sourceId: string;
  /** Số thứ tự lượt của chủ sở hữu lúc áp hiệu ứng, nếu áp ngay trong lượt của chính nó; -1 nếu không. */
  appliedOnTurn: number;
}

class Unit implements Targetable {
  hp: number;
  readonly maxHp: number;
  alive = true;
  energy: number;
  effects: ActiveEffect[] = [];
  damageDealt = 0;
  turnCount = 0;
  revived = false;
  readonly usedThisRound = new Map<string, number>();

  constructor(
    readonly id: string,
    readonly side: Side,
    readonly index: number,
    readonly input: BattleUnitInput,
    readonly basic: Skill,
    readonly ultimate: Skill,
    readonly passives: Skill[],
    initialEnergy: number,
    private readonly statOf: (unit: Unit, stat: StatName) => number,
  ) {
    this.maxHp = Math.round(input.stats.hp);
    this.hp = this.maxHp;
    this.energy = initialEnergy;
  }

  get slot() {
    return this.input.slot;
  }

  /** ATK hiện tại (đã tính buff, debuff); dùng cho luật chọn mục tiêu highest_atk. */
  get atk(): number {
    return this.statOf(this, 'atk');
  }
}

export function simulate(teamA: TeamInput, teamB: TeamInput, config: GameConfig, seed: Seed): BattleResult {
  const { rules } = config;
  const rng = createRng(seed);
  const effectById = new Map(config.effects.effects.map((e) => [e.id, e]));
  const skillById = new Map(config.skills.skills.map((s) => [s.id, s]));

  // ------------------------------------------------------------ chỉ số hiện tại

  const modifier = (unit: Unit, stat: string): number => {
    let sum = 0;
    for (const active of unit.effects) {
      if (active.effect.stat !== stat) continue;
      if (active.effect.kind === 'buff') sum += active.effect.value ?? 0;
      else if (active.effect.kind === 'debuff') sum -= active.effect.value ?? 0;
    }
    return sum;
  };

  /** ATK, DEF, SPD: chỉ số gốc nhân (1 + tổng buff − tổng debuff). Buff lên hp không có tác dụng (HP tối đa cố định trong trận). */
  const baseStat = (unit: Unit, stat: StatName): number =>
    unit.input.stats[stat] * Math.max(0, 1 + modifier(unit, stat));

  /** Chỉ số phụ: giá trị gốc cộng (buff − debuff), không âm, rồi áp giới hạn trên nếu cấu hình có đặt. */
  const secondary = (unit: Unit, stat: SecondaryStat, base = 0): number => {
    const value = Math.max(0, base + (unit.input.stats[stat] ?? 0) + modifier(unit, stat));
    const cap = (rules.damage.caps as Record<string, number | null | undefined>)[stat];
    return cap == null ? value : Math.min(value, cap);
  };

  // ------------------------------------------------------------ dựng đơn vị

  const makeTeam = (team: TeamInput, side: Side): Unit[] => {
    if (team.length < 1 || team.length > rules.battle.maxTeamSize) {
      throw new BattleInputError(`đội ${side} cần từ 1 đến ${rules.battle.maxTeamSize} nhân vật, nhận ${team.length}`);
    }
    const seen = new Set<string>();
    return team.map((input, index) => {
      const id = `${side}${index + 1}`;
      const { row, col } = input.slot;
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= rules.battle.grid.rows || col >= rules.battle.grid.cols) {
        throw new BattleInputError(`${id}: ô (${row}, ${col}) nằm ngoài lưới ${rules.battle.grid.rows}x${rules.battle.grid.cols}`);
      }
      const key = `${row},${col}`;
      if (seen.has(key)) throw new BattleInputError(`${id}: ô (${row}, ${col}) đã có người`);
      seen.add(key);

      const { stats } = input;
      if (!(stats.hp >= 1) || !(stats.atk >= 0) || !(stats.def >= 0) || !(stats.spd >= 0) || ![stats.hp, stats.atk, stats.def, stats.spd].every(Number.isFinite)) {
        throw new BattleInputError(`${id}: chỉ số cơ bản không hợp lệ (hp >= 1, các chỉ số khác >= 0)`);
      }

      const skills = input.skills.map((skillId) => {
        const skill = skillById.get(skillId);
        if (!skill) throw new BattleInputError(`${id}: kỹ năng "${skillId}" không có trong cấu hình`);
        return skill;
      });
      const basics = skills.filter((s) => s.kind === 'basic');
      const ultimates = skills.filter((s) => s.kind === 'ultimate');
      const basic = basics[0];
      const ultimate = ultimates[0];
      if (basics.length !== 1 || ultimates.length !== 1 || !basic || !ultimate) {
        throw new BattleInputError(`${id}: cần đúng 1 kỹ năng thường và 1 tuyệt kỹ`);
      }
      return new Unit(id, side, index, input, basic, ultimate, skills.filter((s) => s.kind === 'passive'), Math.min(rules.energy.initial, rules.energy.max), baseStat);
    });
  };

  const unitsA = makeTeam(teamA, 'A');
  const unitsB = makeTeam(teamB, 'B');
  const all = [...unitsA, ...unitsB];
  const unitById = new Map(all.map((u) => [u.id, u]));
  const initial: BattleResult['initial'] = all.map((u) => ({
    ...summarize(u),
    element: u.input.element,
    role: u.input.role,
    slot: { row: u.slot.row, col: u.slot.col },
  }));

  // ------------------------------------------------------------ trạng thái trận

  const events: BattleEvent[] = [];
  let round = 0;
  let currentActor: Unit | null = null;

  const alliesOf = (u: Unit) => (u.side === 'A' ? unitsA : unitsB);
  const enemiesOf = (u: Unit) => (u.side === 'A' ? unitsB : unitsA);
  const hasEffect = (u: Unit, kind: Effect['kind']) => u.effects.some((a) => a.effect.kind === kind);

  const critRate = (u: Unit) => secondary(u, 'critRate', rules.damage.baseCritRate);
  const critDamage = (u: Unit) => secondary(u, 'critDamage', rules.damage.baseCritDamage);

  const newEvent = (actor: Unit, action: BattleEvent['action'], skill: string, trigger?: BattleTrigger): BattleEvent => {
    const ev: BattleEvent = { round, actor: actor.id, action, skill, targets: [], effects: [] };
    if (trigger) ev.trigger = trigger;
    return ev;
  };

  /** Ghi sự kiện vào nhật ký, rồi xử lý những đơn vị vừa bị hạ trong sự kiện đó (bị động on_death, hồi sinh). */
  const finishEvent = (ev: BattleEvent): void => {
    events.push(ev);
    for (const id of ev.defeated ?? []) handleDeath(unitById.get(id) as Unit);
  };

  const kill = (unit: Unit, ev: BattleEvent): void => {
    unit.alive = false;
    unit.hp = 0;
    unit.effects = [];
    (ev.defeated ??= []).push(unit.id);
  };

  /** Trừ máu (khiên hấp thụ trước). Trả về phần khiên hấp thụ và phần máu mất thật. */
  const takeDamage = (target: Unit, dmg: number): { absorbed: number; hpLoss: number } => {
    let left = dmg;
    let absorbed = 0;
    for (const active of target.effects) {
      if (active.effect.kind !== 'shield' || active.amount <= 0 || left <= 0) continue;
      const used = Math.min(active.amount, left);
      active.amount -= used;
      left -= used;
      absorbed += used;
    }
    target.effects = target.effects.filter((a) => a.effect.kind !== 'shield' || a.amount > 0);
    const hpLoss = Math.min(target.hp, left);
    target.hp -= hpLoss;
    return { absorbed, hpLoss };
  };

  const heal = (target: Unit, amount: number, source: 'effect' | 'lifesteal', ev: BattleEvent): void => {
    const gained = Math.max(0, Math.min(target.maxHp - target.hp, amount));
    target.hp += gained;
    (ev.heals ??= []).push({ id: target.id, amount: gained, hpAfter: target.hp, source });
  };

  const handleDeath = (unit: Unit): void => {
    for (const passive of unit.passives) {
      if (passive.trigger === 'on_death' && !passive.special) runPassive(unit, passive);
    }
    for (const passive of unit.passives) {
      const sp = passive.special;
      if (sp?.kind !== 'revive' || unit.revived || unit.alive) continue;
      if (!rng.chance(sp.chance)) continue;
      unit.revived = true;
      unit.alive = true;
      unit.hp = Math.min(unit.maxHp, Math.max(1, Math.round(unit.maxHp * (sp.reviveHpRatio ?? 0.3))));
      unit.energy = 0;
      const ev = newEvent(unit, 'revive', passive.id);
      ev.targets.push({ id: unit.id, dmg: 0, crit: false, hpAfter: unit.hp });
      events.push(ev);
      break;
    }
  };

  // ------------------------------------------------------------ hiệu ứng

  const addEffect = (target: Unit, effect: Effect, source: Unit, amount: number): void => {
    const appliedOnTurn = currentActor === target ? target.turnCount : -1;
    const fresh: ActiveEffect = { effect, remaining: effect.duration, amount, sourceId: source.id, appliedOnTurn };
    const i = target.effects.findIndex((a) => a.effect.id === effect.id);
    if (i >= 0) target.effects[i] = fresh; // cùng id thì làm mới, không cộng dồn
    else target.effects.push(fresh);
  };

  const applyEffect = (effect: Effect, caster: Unit, target: Unit, hostile: boolean, ev: BattleEvent): void => {
    let p = effect.chance;
    if (hostile) {
      const accuracy = secondary(caster, 'effectAccuracy');
      const resistance = Math.min(1, secondary(target, 'effectResistance'));
      p = p * (1 + accuracy) * (1 - resistance);
    }
    const hit = rng.chance(p); // luôn tiêu đúng một số ngẫu nhiên
    ev.effects.push({ target: target.id, effect: effect.id, applied: hit });
    if (!hit) return;

    const scaled = (effect.value ?? 0) * (effect.scaling === 'targetMaxHp' ? target.maxHp : baseStat(caster, 'atk'));
    switch (effect.kind) {
      case 'heal':
        heal(target, Math.round(scaled * (1 + secondary(caster, 'healingBonus'))), 'effect', ev);
        break;
      case 'shield':
        addEffect(target, effect, caster, Math.round(scaled));
        break;
      case 'dot':
        addEffect(target, effect, caster, Math.max(1, Math.round(scaled)));
        break;
      case 'stun':
      case 'silence':
      case 'buff':
      case 'debuff':
        addEffect(target, effect, caster, 0);
        break;
    }
  };

  // ------------------------------------------------------------ chọn mục tiêu

  const resolveTargets = (actor: Unit, skill: Skill): Unit[] => {
    const t = skill.targeting;
    if (t.side === 'self') return [actor];
    const pool = (t.side === 'enemy' ? enemiesOf(actor) : alliesOf(actor)).filter((u) => u.alive);
    return selectTargets(pool, t.rule, t.count, rules.battle.grid, rng);
  };

  // ------------------------------------------------------------ bị động

  const runPassive = (holder: Unit, skill: Skill): void => {
    if (skill.effects.length === 0) return;
    const targets = resolveTargets(holder, skill);
    if (targets.length === 0) return;
    const ev = newEvent(holder, 'passive', skill.id);
    const hostile = skill.targeting.side === 'enemy';
    for (const target of targets) {
      ev.targets.push({ id: target.id, dmg: 0, crit: false, hpAfter: target.hp });
      for (const effectId of skill.effects) applyEffect(effectById.get(effectId) as Effect, holder, target, hostile, ev);
    }
    finishEvent(ev);
  };

  const fireHook = (holder: Unit, hook: Hook): void => {
    for (const passive of holder.passives) {
      if (passive.trigger === hook && !passive.special) runPassive(holder, passive);
    }
  };

  // ------------------------------------------------------------ một đòn đánh

  /**
   * Thực hiện một kỹ năng: ghi một sự kiện. `trigger` có mặt nghĩa là đòn phản ứng (phản kích, liên kích, truy kích):
   * chỉ đánh đúng `preselected` (chọn lại theo luật của kỹ năng thường nếu nó đã chết), không nhận năng lượng,
   * không kích hoạt bị động nào khác. Trả về các mục tiêu thực sự bị trúng đòn.
   */
  const performSkill = (
    actor: Unit,
    skill: Skill,
    action: 'basic' | 'ultimate',
    opts: { trigger?: BattleTrigger; preselected?: Unit } = {},
  ): Unit[] => {
    const reactive = opts.trigger !== undefined;
    const dealsDamage = skill.damageCoef > 0 && skill.targeting.side === 'enemy';
    if (!reactive && dealsDamage) fireHook(actor, 'before_damage');

    let targets: Unit[];
    if (reactive) {
      targets = opts.preselected?.alive ? [opts.preselected] : resolveTargets(actor, skill).slice(0, 1);
    } else {
      targets = resolveTargets(actor, skill);
    }
    if (targets.length === 0) return [];

    const ev = newEvent(actor, action, skill.id, opts.trigger);
    const hostile = skill.targeting.side === 'enemy';
    const hits: Unit[] = [];

    for (const target of targets) {
      const result: BattleEvent['targets'][number] = { id: target.id, dmg: 0, crit: false, hpAfter: target.hp };
      ev.targets.push(result);

      if (dealsDamage) {
        const evaded = rng.chance(secondary(target, 'evasion'));
        if (evaded) {
          result.evaded = true;
          continue;
        }
        const crit = rng.chance(critRate(actor));
        const dmg = computeDamage(
          {
            atk: baseStat(actor, 'atk'),
            skillCoef: skill.damageCoef,
            def: baseStat(target, 'def'),
            penetration: secondary(actor, 'penetration'),
            damageBonus: secondary(actor, 'damageBonus'),
            element: elementMultiplier(actor.input.element, target.input.element, rules.damage),
            damageReduction: secondary(target, 'damageReduction'),
            crit,
            critDamage: critDamage(actor),
          },
          rules.damage,
        );
        const { absorbed, hpLoss } = takeDamage(target, dmg);
        actor.damageDealt += dmg;
        result.dmg = dmg;
        result.crit = crit;
        result.hpAfter = target.hp;
        if (absorbed > 0) result.absorbed = absorbed;
        hits.push(target);

        const lifesteal = secondary(actor, 'lifesteal');
        if (lifesteal > 0 && hpLoss > 0 && actor.alive) heal(actor, Math.round(lifesteal * hpLoss), 'lifesteal', ev);
        if (target.hp <= 0) kill(target, ev);
      }

      if (target.alive) {
        for (const effectId of skill.effects) applyEffect(effectById.get(effectId) as Effect, actor, target, hostile, ev);
      }
    }
    finishEvent(ev);
    return hits;
  };

  // ------------------------------------------------------------ hành động đặc biệt

  const canReact = (unit: Unit, passive: Skill): boolean => {
    const sp = passive.special;
    if (!sp || !unit.alive || hasEffect(unit, 'stun')) return false;
    if (unit.basic.targeting.side !== 'enemy' || unit.basic.damageCoef <= 0) return false;
    return (unit.usedThisRound.get(passive.id) ?? 0) < (sp.maxPerRound ?? 1);
  };

  const tryReact = (unit: Unit, kind: 'counter' | 'follow_up' | 'pursuit', preselected: Unit | undefined, guard: () => boolean): void => {
    for (const passive of unit.passives) {
      if (passive.special?.kind !== kind || !guard() || !canReact(unit, passive)) continue;
      if (!rng.chance(passive.special.chance)) continue;
      unit.usedThisRound.set(passive.id, (unit.usedThisRound.get(passive.id) ?? 0) + 1);
      performSkill(unit, unit.basic, 'basic', { trigger: kind as BattleTrigger, preselected });
    }
  };

  /**
   * Sau khi `actor` gây sát thương: bị động after_damage, rồi phản kích (của kẻ bị đánh), liên kích (của actor),
   * truy kích (của đồng đội), cuối cùng là hành động ngay. Trả về true nếu actor được hành động thêm.
   */
  const reactAfterDamage = (actor: Unit, hits: Unit[], allowExtra: boolean): boolean => {
    fireHook(actor, 'after_damage');
    const firstAliveHit = () => hits.find((h) => h.alive);

    for (const target of hits) tryReact(target, 'counter', actor, () => actor.alive);
    tryReact(actor, 'follow_up', firstAliveHit(), () => actor.alive);
    for (const ally of alliesOf(actor).filter((u) => u !== actor).sort(byGridOrder)) {
      tryReact(ally, 'pursuit', firstAliveHit(), () => enemiesOf(actor).some((u) => u.alive));
    }

    if (!allowExtra || !actor.alive || !enemiesOf(actor).some((u) => u.alive)) return false;
    for (const passive of actor.passives) {
      if (passive.special?.kind !== 'extra_turn' || !canReact(actor, passive)) continue;
      if (!rng.chance(passive.special.chance)) continue;
      actor.usedThisRound.set(passive.id, (actor.usedThisRound.get(passive.id) ?? 0) + 1);
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------ một lượt

  const tickDots = (unit: Unit): void => {
    for (const active of [...unit.effects]) {
      if (!unit.alive) return;
      if (active.effect.kind !== 'dot') continue;
      const { absorbed } = takeDamage(unit, active.amount);
      const source = unitById.get(active.sourceId);
      if (source) source.damageDealt += active.amount;
      const ev = newEvent(unit, 'dot', active.effect.id);
      const result: BattleEvent['targets'][number] = { id: unit.id, dmg: active.amount, crit: false, hpAfter: unit.hp };
      if (absorbed > 0) result.absorbed = absorbed;
      ev.targets.push(result);
      if (unit.hp <= 0) kill(unit, ev);
      finishEvent(ev);
    }
  };

  const endTurn = (unit: Unit): void => {
    if (!unit.alive) return;
    for (const active of unit.effects) {
      if (active.appliedOnTurn === unit.turnCount) continue; // vừa áp trong chính lượt này: chưa tính là đã trôi qua một lượt
      active.remaining -= 1;
    }
    unit.effects = unit.effects.filter((a) => a.remaining > 0);
  };

  const takeAction = (unit: Unit, extra: boolean): void => {
    if (!extra) {
      unit.turnCount += 1;
      tickDots(unit);
      if (!unit.alive) return;
      if (hasEffect(unit, 'stun')) {
        const ev = newEvent(unit, 'skip', 'stunned');
        finishEvent(ev);
        endTurn(unit);
        return;
      }
      fireHook(unit, 'turn_start');
    }

    const silenced = hasEffect(unit, 'silence');
    const ultimateReady = !silenced && unit.energy >= rules.energy.max;
    const skill = ultimateReady ? unit.ultimate : unit.basic;
    const hits = performSkill(unit, skill, ultimateReady ? 'ultimate' : 'basic');
    if (ultimateReady) unit.energy = 0;
    else unit.energy = Math.min(rules.energy.max, unit.energy + skill.energyGain);

    if (hits.length > 0 && unit.alive) {
      const again = reactAfterDamage(unit, hits, !extra);
      if (again && unit.alive) takeAction(unit, true);
    }
    if (!extra) endTurn(unit);
  };

  // ------------------------------------------------------------ vòng lặp trận

  const winnerNow = (): Side | 'draw' | null => {
    const a = unitsA.some((u) => u.alive);
    const b = unitsB.some((u) => u.alive);
    if (a && b) return null;
    if (!a && !b) return 'draw';
    return a ? 'A' : 'B';
  };

  const turnOrder = (): Unit[] =>
    all
      .filter((u) => u.alive)
      .sort((x, y) => baseStat(y, 'spd') - baseStat(x, 'spd') || (x.side === y.side ? byGridOrder(x, y) : x.side === 'A' ? -1 : 1));

  let winner: Side | 'draw' | null = null;
  for (round = 1; round <= rules.battle.maxRounds && winner === null; round++) {
    for (const u of all) u.usedThisRound.clear();
    for (const unit of turnOrder()) {
      if (!unit.alive) continue;
      currentActor = unit;
      takeAction(unit, false);
      currentActor = null;
      winner = winnerNow();
      if (winner !== null) break;
    }
    if (winner === null) {
      for (const unit of [...all].sort(byGridOrder)) {
        if (unit.alive) fireHook(unit, 'round_end');
      }
      winner = winnerNow();
    }
    if (winner !== null) break;
  }

  let endReason: BattleResult['endReason'] = 'elimination';
  let rounds = Math.min(round, rules.battle.maxRounds);
  if (winner === null) {
    endReason = 'timeout';
    rounds = rules.battle.maxRounds;
    const dealt = (units: Unit[]) => units.reduce((sum, u) => sum + u.damageDealt, 0);
    winner = rules.battle.timeoutRule === 'higher_damage' && dealt(unitsA) > dealt(unitsB) ? 'A' : 'B';
  }

  return {
    version: BATTLE_LOG_VERSION,
    seed,
    winner,
    endReason,
    rounds: Math.max(1, rounds),
    initial,
    events,
    units: all.map(summarize),
  };
}

function summarize(u: Unit): BattleUnitSummary {
  return { id: u.id, heroId: u.input.heroId, side: u.side, maxHp: u.maxHp, hp: u.hp, alive: u.alive, damageDealt: u.damageDealt };
}
