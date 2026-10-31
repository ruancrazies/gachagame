/** Đồ dùng cho kiểm thử: dựng cấu hình nhỏ và đơn vị với số liệu tính tay được. Không xuất ra từ index. */
import { loadGameConfig } from '@gacha/shared/node';
import type { Effect, GameConfig, Skill } from '@gacha/shared';
import type { BattleUnitInput, UnitStats } from './types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function realConfig(): GameConfig {
  return structuredClone(loadGameConfig().config);
}

/** Bộ kỹ năng và hiệu ứng mẫu cho kiểm thử, cộng thêm vào cấu hình thật. */
const TEST_EFFECTS: Effect[] = [
  { id: 't_stun', name: 'stun', kind: 'stun', duration: 1, chance: 1 },
  { id: 't_silence', name: 'silence', kind: 'silence', duration: 2, chance: 1 },
  { id: 't_shield', name: 'shield', kind: 'shield', duration: 2, value: 1, scaling: 'casterAtk', chance: 1 },
  { id: 't_heal', name: 'heal', kind: 'heal', duration: 0, value: 0.5, scaling: 'casterAtk', chance: 1 },
  { id: 't_burn', name: 'burn', kind: 'dot', duration: 2, value: 0.5, scaling: 'casterAtk', chance: 1 },
  { id: 't_atk_up', name: 'atk up', kind: 'buff', duration: 2, value: 0.5, stat: 'atk', chance: 1 },
  { id: 't_def_down', name: 'def down', kind: 'debuff', duration: 2, value: 0.5, stat: 'def', chance: 1 },
  { id: 't_half_stun', name: 'half stun', kind: 'stun', duration: 1, chance: 0.5 },
];

const attack = (id: string, kind: 'basic' | 'ultimate', coef: number, rule: Skill['targeting'] = { side: 'enemy', rule: 'front_row', count: 1 }, effects: string[] = []): Skill => ({
  id,
  name: id,
  kind,
  targeting: rule,
  damageCoef: coef,
  effects,
  energyGain: kind === 'basic' ? 30 : 0,
  unlockStar: 1,
});

const passive = (id: string, trigger: Skill['trigger'], extra: Partial<Skill> = {}): Skill => ({
  id,
  name: id,
  kind: 'passive',
  targeting: { side: 'self' },
  damageCoef: 0,
  effects: [],
  energyGain: 0,
  unlockStar: 1,
  trigger,
  ...extra,
});

const TEST_SKILLS: Skill[] = [
  attack('t_basic', 'basic', 1),
  attack('t_ult', 'ultimate', 2),
  attack('t_basic_def_down', 'basic', 1, undefined, ['t_def_down']),
  attack('t_basic_half_stun', 'basic', 1, undefined, ['t_half_stun']),
  attack('t_ult_stun', 'ultimate', 1, undefined, ['t_stun']),
  attack('t_ult_silence', 'ultimate', 1, undefined, ['t_silence']),
  attack('t_ult_shield_self', 'ultimate', 0, { side: 'self' }, ['t_shield']),
  attack('t_ult_heal_self', 'ultimate', 0, { side: 'self' }, ['t_heal']),
  attack('t_ult_buff_self', 'ultimate', 0, { side: 'self' }, ['t_atk_up']),
  attack('t_ult_burn_weak', 'ultimate', 0.1, undefined, ['t_burn']),
  attack('t_ult_all', 'ultimate', 1, { side: 'enemy', rule: 'all', count: 5 }),
  passive('p_counter', 'after_damage', { special: { kind: 'counter', chance: 1 } }),
  passive('p_follow_up', 'after_damage', { special: { kind: 'follow_up', chance: 1 } }),
  passive('p_pursuit', 'after_damage', { special: { kind: 'pursuit', chance: 1 } }),
  passive('p_extra_turn', 'after_damage', { special: { kind: 'extra_turn', chance: 1 } }),
  passive('p_revive', 'on_death', { special: { kind: 'revive', chance: 1, reviveHpRatio: 0.5 } }),
  passive('p_turn_start_buff', 'turn_start', { effects: ['t_atk_up'] }),
  passive('p_before_damage_buff', 'before_damage', { effects: ['t_atk_up'] }),
  passive('p_after_damage_buff', 'after_damage', { effects: ['t_atk_up'] }),
  passive('p_round_end_buff', 'round_end', { effects: ['t_atk_up'] }),
  passive('p_on_death_ally_buff', 'on_death', { targeting: { side: 'ally', rule: 'all', count: 5 }, effects: ['t_atk_up'] }),
];

/** Cấu hình thật + kỹ năng/hiệu ứng kiểm thử; mặc định tắt chí mạng gốc để số tính tay không bị lệch. */
export function testConfig(rules: DeepPartial<GameConfig['rules']> = {}): GameConfig {
  const config = realConfig();
  config.effects.effects.push(...TEST_EFFECTS);
  config.skills.skills.push(...TEST_SKILLS);
  config.rules.damage.baseCritRate = 0;
  merge(config.rules as unknown as Record<string, unknown>, rules as Record<string, unknown>);
  return config;
}

function merge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      merge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

export interface UnitOpts {
  heroId?: string;
  element?: BattleUnitInput['element'];
  role?: string;
  row?: number;
  col?: number;
  stats?: Partial<UnitStats>;
  skills?: string[];
}

/** Mặc định: ATK 1000, DEF 0, HP 10000, SPD 100, đánh thường t_basic + tuyệt kỹ t_ult, ô (0,0). */
export function unit(opts: UnitOpts = {}): BattleUnitInput {
  return {
    heroId: opts.heroId ?? 'xich_diem',
    element: opts.element ?? 'fire',
    role: opts.role ?? 'warrior',
    slot: { row: opts.row ?? 0, col: opts.col ?? 0 },
    stats: { atk: 1000, def: 0, hp: 10000, spd: 100, ...opts.stats },
    skills: opts.skills ?? ['t_basic', 't_ult'],
  };
}
