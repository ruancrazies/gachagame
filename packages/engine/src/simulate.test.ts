import { describe, expect, it } from 'vitest';
import { battleResultSchema, type BattleEvent, type BattleResult } from '@gacha/shared';
import { simulate } from './simulate';
import { realConfig, testConfig, unit, type UnitOpts } from './testkit';
import { BattleInputError, type BattleUnitInput } from './types';
import { unitFromHero } from './stats';

const HUGE = 1_000_000_000;
const run = (a: BattleUnitInput[], b: BattleUnitInput[], config = testConfig(), seed = 's') => simulate(a, b, config, seed);
const by = (r: BattleResult, actor: string) => r.events.filter((e) => e.actor === actor);
const actions = (events: BattleEvent[]) => events.map((e) => e.action);
const dmgs = (events: BattleEvent[]) => events.map((e) => e.targets[0]?.dmg);
/** Đội một người, máu rất lớn để trận không kết thúc sớm. */
const tank = (o: UnitOpts = {}) => unit({ ...o, stats: { hp: HUGE, ...o.stats } });

describe('vòng lặp trận, hàng đợi và năng lượng', () => {
  it('dòng nhật ký đầu tiên khớp hợp đồng: ATK 1000, DEF 0 → 1000 sát thương, không chí mạng', () => {
    const r = run([unit()], [unit()]);
    expect(r.events[0]).toEqual({
      round: 1,
      actor: 'A1',
      action: 'basic',
      skill: 't_basic',
      targets: [{ id: 'B1', dmg: 1000, crit: false, hpAfter: 9000 }],
      effects: [],
    });
  });

  it('A thắng ở hiệp 9: 4 đòn thường + tuyệt kỹ (đầy năng lượng ở hành động thứ 5) + 4 đòn thường = 10 000', () => {
    const r = run([unit()], [unit()]);
    expect(r.winner).toBe('A');
    expect(r.endReason).toBe('elimination');
    expect(r.rounds).toBe(9);
    const a = by(r, 'A1');
    expect(actions(a)).toEqual(['basic', 'basic', 'basic', 'basic', 'ultimate', 'basic', 'basic', 'basic', 'basic']);
    expect(dmgs(a)).toEqual([1000, 1000, 1000, 1000, 2000, 1000, 1000, 1000, 1000]);
    expect(r.events.at(-1)?.defeated).toEqual(['B1']);
    expect(by(r, 'B1')).toHaveLength(8);
  });

  it('bản tóm tắt cuối trận: máu còn lại, còn sống, tổng sát thương gây ra', () => {
    const r = run([unit()], [unit()]);
    expect(r.units).toEqual([
      { id: 'A1', heroId: 'xich_diem', side: 'A', maxHp: 10000, hp: 1000, alive: true, damageDealt: 10000 },
      { id: 'B1', heroId: 'xich_diem', side: 'B', maxHp: 10000, hp: 0, alive: false, damageDealt: 9000 },
    ]);
    expect(r.initial.map((u) => [u.id, u.hp, u.element, u.slot])).toEqual([
      ['A1', 10000, 'fire', { row: 0, col: 0 }],
      ['B1', 10000, 'fire', { row: 0, col: 0 }],
    ]);
  });

  it('năng lượng: tuyệt kỹ ở hành động 5 và 10, về 0 sau khi tung', () => {
    const r = run([tank()], [tank()]);
    const a = actions(by(r, 'A1')).slice(0, 11);
    expect(a).toEqual(['basic', 'basic', 'basic', 'basic', 'ultimate', 'basic', 'basic', 'basic', 'basic', 'ultimate', 'basic']);
  });

  it('rules.energy.initial = 100 thì tung tuyệt kỹ ngay hành động đầu', () => {
    const r = run([tank()], [tank()], testConfig({ energy: { initial: 100 } }));
    expect(actions(by(r, 'A1')).slice(0, 2)).toEqual(['ultimate', 'basic']);
  });

  it('SPD cao đi trước; bằng nhau thì bên A trước', () => {
    expect(run([tank()], [tank({ stats: { spd: 150 } })]).events[0]?.actor).toBe('B1');
    expect(run([tank({ stats: { spd: 150 } })], [tank()]).events[0]?.actor).toBe('A1');
    expect(run([tank()], [tank()]).events[0]?.actor).toBe('A1');
  });

  it('SPD bằng nhau trong cùng đội thì theo thứ tự ô (hàng trước, trái sang phải); A trước B', () => {
    const r = run([tank({ col: 1 }), tank({ col: 0 })], [tank()]);
    expect(r.events.slice(0, 3).map((e) => e.actor)).toEqual(['A2', 'A1', 'B1']);
  });

  it('hết 20 hiệp mà chưa phân thắng bại: phòng thủ (B) thắng; không có sự kiện nào ở hiệp 21', () => {
    const r = run([tank({ stats: { atk: 0 } })], [tank({ stats: { atk: 0 } })]);
    expect(r.endReason).toBe('timeout');
    expect(r.winner).toBe('B');
    expect(r.rounds).toBe(20);
    expect(Math.max(...r.events.map((e) => e.round))).toBe(20);
  });

  it('timeoutRule = higher_damage: bên gây nhiều sát thương hơn thắng, hòa thì phòng thủ thắng', () => {
    const config = testConfig({ battle: { timeoutRule: 'higher_damage' } });
    expect(run([tank({ stats: { atk: 10 } })], [tank({ stats: { atk: 0 } })], config).winner).toBe('A');
    expect(run([tank({ stats: { atk: 0 } })], [tank({ stats: { atk: 10 } })], config).winner).toBe('B');
    expect(run([tank({ stats: { atk: 0 } })], [tank({ stats: { atk: 0 } })], config).winner).toBe('B');
  });

  it('tuyệt kỹ diện rộng ghi từng mục tiêu theo thứ tự ô', () => {
    const r = run(
      [tank({ skills: ['t_basic', 't_ult_all'] })],
      [tank({ row: 2, col: 2 }), tank({ row: 0, col: 1 }), tank({ row: 1, col: 0 })],
      testConfig({ energy: { initial: 100 } }),
    );
    expect(r.events[0]?.targets.map((t) => t.id)).toEqual(['B2', 'B3', 'B1']);
  });
});

describe('công thức sát thương trong trận', () => {
  it('ví dụ tính tay của tài liệu (phụ lục A): 16 723 thường, 33 446 khi chí mạng', () => {
    const attacker = (critRate: number) =>
      unit({
        element: 'fire',
        stats: { atk: 10000, penetration: 0.2, damageBonus: 0.25, critRate, critDamage: 0.5, hp: HUGE },
      });
    const defender = tank({ element: 'wind', stats: { atk: 0, def: 6000, damageReduction: 0.1 } });
    const config = testConfig({ energy: { initial: 100 } }); // hành động đầu là t_ult, hệ số kỹ năng 2.0
    const normal = run([attacker(0)], [defender], config).events[0]?.targets[0];
    const crit = run([attacker(1)], [defender], config).events[0]?.targets[0];
    expect(normal).toMatchObject({ dmg: 16723, crit: false });
    expect(crit).toMatchObject({ dmg: 33446, crit: true });
  });

  it('chí mạng gốc +50%: Crit Rate 100% → 1500', () => {
    const r = run([tank({ stats: { critRate: 1 } })], [tank()]);
    expect(r.events[0]?.targets[0]).toMatchObject({ dmg: 1500, crit: true });
  });

  it('rules.damage.baseCritRate được cộng với Crit Rate của nhân vật', () => {
    const config = testConfig({ damage: { baseCritRate: 1 } });
    expect(run([tank()], [tank()], config).events[0]?.targets[0]?.crit).toBe(true);
  });

  it('giới hạn crit đặt trong cấu hình thì áp dụng; null thì không giới hạn', () => {
    const capped = testConfig({ damage: { caps: { critRate: 0.0001 } } });
    const crits = Array.from({ length: 200 }, (_, i) => run([tank({ stats: { critRate: 1 } })], [tank()], capped, `c${i}`)).filter(
      (r) => r.events[0]?.targets[0]?.crit,
    );
    expect(crits.length).toBeLessThan(5);
  });

  it('khắc hệ trong trận: Hỏa đánh Phong +10%, Phong đánh Hỏa −10%, Quang đánh Ám +15%', () => {
    expect(run([tank({ element: 'fire' })], [tank({ element: 'wind' })]).events[0]?.targets[0]?.dmg).toBe(1100);
    expect(run([tank({ element: 'wind' })], [tank({ element: 'fire' })]).events[0]?.targets[0]?.dmg).toBe(900);
    expect(run([tank({ element: 'light' })], [tank({ element: 'dark' })]).events[0]?.targets[0]?.dmg).toBe(1150);
  });

  it('né tránh 100%: không sát thương, không hiệu ứng, ghi evaded', () => {
    const r = run([tank({ skills: ['t_basic_def_down', 't_ult'] })], [tank({ stats: { evasion: 1 } })]);
    expect(r.events[0]?.targets[0]).toEqual({ id: 'B1', dmg: 0, crit: false, hpAfter: HUGE, evaded: true });
    expect(r.events[0]?.effects).toEqual([]);
  });

  it('hút máu: hồi theo phần sát thương gây ra, không vượt máu tối đa', () => {
    const r = run([unit({ stats: { lifesteal: 0.5 } })], [unit({ stats: { atk: 2000, spd: 150 } })]);
    expect(r.events[0]).toMatchObject({ actor: 'B1', targets: [{ id: 'A1', hpAfter: 8000 }] });
    expect(r.events[1]?.heals).toEqual([{ id: 'A1', amount: 500, hpAfter: 8500, source: 'lifesteal' }]);

    const full = run([tank({ stats: { lifesteal: 1 } })], [tank({ stats: { atk: 0 } })]);
    expect(full.events[0]?.heals).toEqual([{ id: 'A1', amount: 0, hpAfter: HUGE, source: 'lifesteal' }]);
  });
});

describe('hiệu ứng trạng thái', () => {
  const initial100 = () => testConfig({ energy: { initial: 100 } });

  it('choáng: mất đúng một lượt, rồi hành động lại', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_stun'] })], [tank()], initial100());
    expect(r.events[0]?.effects).toEqual([{ target: 'B1', effect: 't_stun', applied: true }]);
    expect(by(r, 'B1').slice(0, 2).map((e) => [e.round, e.action, e.skill])).toEqual([
      [1, 'skip', 'stunned'],
      [2, 'ultimate', 't_ult'],
    ]);
  });

  it('câm lặng 2 lượt: có đủ năng lượng vẫn chỉ đánh thường, hết 2 lượt mới tung tuyệt kỹ', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_silence'] })], [tank()], initial100());
    expect(actions(by(r, 'B1')).slice(0, 4)).toEqual(['basic', 'basic', 'ultimate', 'basic']);
  });

  it('khiên 100% ATK: hấp thụ sát thương trước máu, hết hạn sau 2 lượt của chủ khiên', () => {
    const r = run(
      [unit({ skills: ['t_basic', 't_ult_shield_self'], stats: { hp: 10000 } })],
      [tank({ stats: { atk: 300 } })],
      initial100(),
    );
    expect(r.events[0]).toMatchObject({ actor: 'A1', action: 'ultimate', effects: [{ target: 'A1', effect: 't_shield', applied: true }] });
    // B đánh vào lượt 1, 2 (khiên còn) rồi lượt 3 (khiên đã hết hạn ở cuối lượt thứ 3 của A, trước khi B ra đòn)
    expect(by(r, 'B1').slice(0, 3).map((e) => e.targets[0])).toEqual([
      { id: 'A1', dmg: 600, crit: false, hpAfter: 10000, absorbed: 600 },
      { id: 'A1', dmg: 300, crit: false, hpAfter: 10000, absorbed: 300 },
      { id: 'A1', dmg: 300, crit: false, hpAfter: 9700 },
    ]);
  });

  it('khiên chỉ hấp thụ một phần khi sát thương lớn hơn khiên', () => {
    const r = run(
      [unit({ skills: ['t_basic', 't_ult_shield_self'], stats: { hp: 10000, spd: 50 } })],
      [tank({ stats: { atk: 1500, spd: 150 } })],
      initial100(),
    );
    // B ra trước: ult 3000 vào A chưa có khiên; A rồi tạo khiên 1000; lượt 2 của B: 1500 → khiên hấp thụ 1000, mất 500 máu
    const hits = by(r, 'B1').slice(0, 2).map((e) => e.targets[0]);
    expect(hits[0]).toMatchObject({ dmg: 3000, hpAfter: 7000 });
    expect(hits[0]?.absorbed).toBeUndefined();
    expect(hits[1]).toMatchObject({ dmg: 1500, absorbed: 1000, hpAfter: 6500 });
  });

  it('hồi máu 50% ATK nhân (1 + Healing Bonus); ghi vào heals', () => {
    const r = run(
      [unit({ skills: ['t_basic', 't_ult_heal_self'], stats: { healingBonus: 0.2 } })],
      [tank({ stats: { atk: 2000, spd: 150 } })],
      initial100(),
    );
    expect(r.events[0]).toMatchObject({ actor: 'B1', targets: [{ id: 'A1', dmg: 4000, hpAfter: 6000 }] });
    expect(r.events[1]?.heals).toEqual([{ id: 'A1', amount: 600, hpAfter: 6600, source: 'effect' }]);
  });

  it('hồi máu không vượt máu tối đa', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_heal_self'] })], [tank({ stats: { atk: 0, spd: 50 } })], initial100());
    expect(r.events[0]?.heals).toEqual([{ id: 'A1', amount: 0, hpAfter: HUGE, source: 'effect' }]);
  });

  it('thiêu đốt: mỗi đầu lượt của kẻ chịu mất 50% ATK của người gây, đúng 2 lượt', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_burn_weak'] })], [tank()], testConfig({ energy: { initial: 100 }, battle: { maxRounds: 4 } })); // tuyệt kỹ mới ở hành động 6, ngoài 4 hiệp
    const dots = by(r, 'B1').filter((e) => e.action === 'dot');
    expect(dots).toHaveLength(2);
    expect(dots.map((e) => [e.round, e.skill, e.targets[0]?.dmg])).toEqual([
      [1, 't_burn', 500],
      [2, 't_burn', 500],
    ]);
    // thứ tự: A ult (100) → dot 500 trước khi B hành động
    expect(r.events.slice(0, 3).map((e) => e.action)).toEqual(['ultimate', 'dot', 'ultimate']);
    expect(dots[0]?.targets[0]?.hpAfter).toBe(HUGE - 600);
  });

  it('thiêu đốt có thể hạ mục tiêu ngay đầu lượt (mục tiêu chưa kịp hành động)', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_burn_weak'] })], [unit({ stats: { hp: 400 } })], initial100());
    expect(r.events.map((e) => e.action)).toEqual(['ultimate', 'dot']);
    expect(r.events[1]?.defeated).toEqual(['B1']);
    expect(r.winner).toBe('A');
    expect(r.rounds).toBe(1);
  });

  it('buff ATK +50% 2 lượt: hiệu lực ở hai hành động kế tiếp của chủ, rồi hết', () => {
    const r = run([tank({ skills: ['t_basic', 't_ult_buff_self'] })], [tank({ stats: { atk: 0 } })], initial100());
    expect(dmgs(by(r, 'A1').slice(0, 4))).toEqual([0, 1500, 1500, 1000]);
  });

  it('debuff DEF −50%: đòn sau mạnh hơn; đánh lại thì làm mới chứ không cộng dồn', () => {
    const r = run([tank({ skills: ['t_basic_def_down', 't_ult'] })], [tank({ stats: { def: 1000, atk: 0 } })]);
    expect(dmgs(by(r, 'A1').slice(0, 4))).toEqual([500, 667, 667, 667]);
  });

  it('Kháng hiệu ứng 100% chặn hoàn toàn hiệu ứng có hại; hiệu ứng vẫn được ghi là không trúng', () => {
    const r = run([tank({ skills: ['t_basic_def_down', 't_ult'] })], [tank({ stats: { def: 1000, atk: 0, effectResistance: 1 } })]);
    expect(r.events[0]?.effects).toEqual([{ target: 'B1', effect: 't_def_down', applied: false }]);
    expect(dmgs(by(r, 'A1').slice(0, 3))).toEqual([500, 500, 500]);
  });

  it('xác suất trúng = gốc × (1 + Chính xác) × (1 − Kháng): 0.5 × 1.5 × 0.5 = 37.5%', () => {
    const config = testConfig({ battle: { maxRounds: 1 } });
    let applied = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const r = run(
        [tank({ skills: ['t_basic_half_stun', 't_ult'], stats: { effectAccuracy: 0.5 } })],
        [tank({ stats: { effectResistance: 0.5 } })],
        config,
        `p${i}`,
      );
      if (r.events[0]?.effects[0]?.applied) applied++;
    }
    expect(applied / n).toBeGreaterThan(0.345);
    expect(applied / n).toBeLessThan(0.405);
  });

  it('hiệu ứng có lợi (hồi máu, khiên, buff) không bị Kháng hiệu ứng của chính mình cản', () => {
    const r = run(
      [tank({ skills: ['t_basic', 't_ult_buff_self'], stats: { effectResistance: 1 } })],
      [tank({ stats: { atk: 0 } })],
      initial100(),
    );
    expect(r.events[0]?.effects).toEqual([{ target: 'A1', effect: 't_atk_up', applied: true }]);
  });
});

describe('hành động đặc biệt', () => {
  const withPassive = (id: string, o: UnitOpts = {}) => tank({ ...o, skills: ['t_basic', 't_ult', id] });
  const brief = (events: BattleEvent[]) => events.map((e) => `${e.actor}:${e.trigger ?? e.action}`);

  it('phản kích: kẻ bị đánh đánh trả; phản kích không gây phản kích tiếp; giới hạn 1 lần mỗi hiệp', () => {
    const r = run([withPassive('p_counter')], [withPassive('p_counter')], testConfig({ battle: { maxRounds: 2 } }));
    expect(brief(r.events)).toEqual([
      'A1:basic', 'B1:counter', 'B1:basic', 'A1:counter',
      'A1:basic', 'B1:counter', 'B1:basic', 'A1:counter',
    ]);
    expect(r.events[1]).toMatchObject({ trigger: 'counter', action: 'basic', targets: [{ id: 'A1' }] });
  });

  it('phản kích không cộng năng lượng; kẻ đang choáng không phản kích được', () => {
    const r = run([withPassive('p_counter')], [withPassive('p_counter')]);
    expect(actions(by(r, 'A1').filter((e) => !e.trigger)).slice(0, 5)).toEqual(['basic', 'basic', 'basic', 'basic', 'ultimate']);

    const stunned = run(
      [tank({ skills: ['t_basic', 't_ult_stun'] })],
      [withPassive('p_counter')],
      testConfig({ energy: { initial: 100 } }),
    );
    expect(brief(stunned.events.slice(0, 2))).toEqual(['A1:ultimate', 'B1:skip']);
  });

  it('liên kích: đánh thêm ngay sau đòn của mình, không cộng năng lượng', () => {
    const r = run([withPassive('p_follow_up')], [tank()], testConfig({ battle: { maxRounds: 5 } }));
    expect(brief(r.events.slice(0, 3))).toEqual(['A1:basic', 'A1:follow_up', 'B1:basic']);
    expect(actions(by(r, 'A1').filter((e) => !e.trigger))).toEqual(['basic', 'basic', 'basic', 'basic', 'ultimate']);
  });

  it('truy kích: đồng đội đánh thêm vào mục tiêu vừa trúng', () => {
    const r = run(
      [tank({ stats: { spd: 120 } }), withPassive('p_pursuit', { col: 1 })],
      [tank({ stats: { spd: 50 } })],
    );
    expect(brief(r.events.slice(0, 4))).toEqual(['A1:basic', 'A2:pursuit', 'A2:basic', 'B1:basic']);
    expect(r.events[1]?.targets[0]?.id).toBe('B1');
  });

  it('truy kích: mục tiêu đã chết thì chọn lại theo luật của kỹ năng thường trong số kẻ còn sống', () => {
    const r = run(
      [tank({ stats: { spd: 120 } }), withPassive('p_pursuit', { col: 1 })],
      [unit({ stats: { hp: 500, spd: 50 } }), tank({ col: 1, stats: { spd: 50 } })],
    );
    expect(r.events[0]).toMatchObject({ actor: 'A1', defeated: ['B1'] });
    expect(r.events[1]).toMatchObject({ actor: 'A2', trigger: 'pursuit', targets: [{ id: 'B2' }] });
  });

  it('không còn kẻ địch thì không có đòn phản ứng nào (hành động hụt, không ghi sự kiện)', () => {
    const r = run(
      [tank({ stats: { spd: 120 } }), withPassive('p_pursuit', { col: 1 })],
      [unit({ stats: { hp: 500, spd: 50 } })],
    );
    expect(r.events).toHaveLength(1);
    expect(r.winner).toBe('A');
  });

  it('hành động ngay: hành động thêm một lượt đầy đủ liền sau; không nối tiếp vô hạn', () => {
    const r = run([withPassive('p_extra_turn')], [tank({ stats: { spd: 50 } })], testConfig({ battle: { maxRounds: 3 } }));
    const perRound = (n: number) => actions(by(r, 'A1').filter((e) => e.round === n));
    expect(perRound(1)).toEqual(['basic', 'basic']);
    expect(perRound(2)).toEqual(['basic', 'basic']);
    // 4 hành động đã cộng đủ năng lượng: đầu hiệp 3 là tuyệt kỹ, rồi hành động thêm là đánh thường
    expect(perRound(3)).toEqual(['ultimate', 'basic']);
  });

  it('hồi sinh: sống lại với tỉ lệ máu cấu hình, đúng một lần mỗi trận, trận không kết thúc ở lần chết đầu', () => {
    const r = run([tank()], [unit({ skills: ['t_basic', 't_ult', 'p_revive'], stats: { hp: 1000, atk: 0, spd: 50 } })]);
    expect(r.events[0]).toMatchObject({ actor: 'A1', defeated: ['B1'] });
    expect(r.events[1]).toEqual({
      round: 1,
      actor: 'B1',
      action: 'revive',
      skill: 'p_revive',
      targets: [{ id: 'B1', dmg: 0, crit: false, hpAfter: 500 }],
      effects: [],
    });
    expect(r.events.filter((e) => e.action === 'revive')).toHaveLength(1);
    expect(r.winner).toBe('A');
    expect(r.rounds).toBe(2);
    expect(r.units[1]).toMatchObject({ alive: false, hp: 0 });
  });
});

describe('điểm móc (hook) cho bị động', () => {
  const withPassive = (id: string, o: UnitOpts = {}) => tank({ ...o, skills: ['t_basic', 't_ult', id] });
  const dummy = () => tank({ stats: { atk: 0, spd: 50 } });

  it('turn_start: áp hiệu ứng trước khi hành động nên đòn đó đã được tăng', () => {
    const r = run([withPassive('p_turn_start_buff')], [dummy()]);
    expect(r.events[0]).toMatchObject({ action: 'passive', skill: 'p_turn_start_buff', effects: [{ target: 'A1', effect: 't_atk_up', applied: true }] });
    expect(r.events[1]).toMatchObject({ action: 'basic' });
    expect(r.events[1]?.targets[0]?.dmg).toBe(1500);
  });

  it('before_damage: chạy trước khi tính sát thương; không chạy với kỹ năng không gây sát thương', () => {
    const r = run([withPassive('p_before_damage_buff')], [dummy()]);
    expect(r.events.slice(0, 2).map((e) => e.action)).toEqual(['passive', 'basic']);
    expect(r.events[1]?.targets[0]?.dmg).toBe(1500);

    const none = run(
      [tank({ skills: ['t_basic', 't_ult_buff_self', 'p_before_damage_buff'] })],
      [dummy()],
      testConfig({ energy: { initial: 100 } }),
    );
    expect(none.events[0]?.action).toBe('ultimate');
  });

  it('after_damage: chạy sau đòn của chủ; hiệu ứng có tác dụng từ đòn sau', () => {
    const r = run([withPassive('p_after_damage_buff')], [dummy()]);
    expect(r.events.slice(0, 2).map((e) => e.action)).toEqual(['basic', 'passive']);
    expect(dmgs(by(r, 'A1').filter((e) => e.action === 'basic').slice(0, 2))).toEqual([1000, 1500]);
  });

  it('round_end: chạy sau khi mọi đơn vị đã hành động, mỗi hiệp một lần', () => {
    const r = run([tank()], [withPassive('p_round_end_buff')], testConfig({ battle: { maxRounds: 2 } }));
    const passives = r.events.filter((e) => e.action === 'passive');
    expect(passives.map((e) => e.round)).toEqual([1, 2]);
    for (const p of passives) {
      const last = r.events.filter((e) => e.round === p.round).at(-1);
      expect(last).toBe(p);
    }
  });

  it('on_death: bị động của đơn vị vừa chết áp hiệu ứng lên đồng đội còn sống', () => {
    const r = run(
      [tank()],
      [
        unit({ skills: ['t_basic', 't_ult', 'p_on_death_ally_buff'], row: 0, col: 0, stats: { hp: 500 } }),
        tank({ row: 1, col: 1, stats: { atk: 400, spd: 50 } }),
      ],
    );
    expect(r.events[0]).toMatchObject({ actor: 'A1', defeated: ['B1'] });
    expect(r.events[1]).toMatchObject({
      actor: 'B1',
      action: 'passive',
      skill: 'p_on_death_ally_buff',
      targets: [{ id: 'B2' }],
      effects: [{ target: 'B2', effect: 't_atk_up', applied: true }],
    });
    expect(by(r, 'B2')[0]?.targets[0]?.dmg).toBe(600); // 400 × 1.5
  });
});

describe('đầu vào không hợp lệ', () => {
  const bad = (a: BattleUnitInput[], b: BattleUnitInput[] = [unit()]) => () => run(a, b);

  it('đội rỗng hoặc quá 5 người', () => {
    expect(bad([])).toThrow(BattleInputError);
    expect(bad(Array.from({ length: 6 }, (_, i) => unit({ row: Math.floor(i / 3), col: i % 3 })))).toThrow(/1 đến 5/);
  });

  it('ô ngoài lưới 3x3 hoặc trùng ô', () => {
    expect(bad([unit({ row: 3 })])).toThrow(/ngoài lưới/);
    expect(bad([unit({ col: -1 })])).toThrow(/ngoài lưới/);
    expect(bad([unit(), unit()])).toThrow(/đã có người/);
  });

  it('kỹ năng không tồn tại, thiếu tuyệt kỹ, hoặc có hai đánh thường', () => {
    expect(bad([unit({ skills: ['khong_co', 't_ult'] })])).toThrow(/không có trong cấu hình/);
    expect(bad([unit({ skills: ['t_basic'] })])).toThrow(/1 kỹ năng thường và 1 tuyệt kỹ/);
    expect(bad([unit({ skills: ['t_basic', 't_basic_def_down', 't_ult'] })])).toThrow(/1 kỹ năng thường và 1 tuyệt kỹ/);
  });

  it('chỉ số cơ bản sai', () => {
    expect(bad([unit({ stats: { hp: 0 } })])).toThrow(/chỉ số cơ bản/);
    expect(bad([unit({ stats: { atk: -1 } })])).toThrow(/chỉ số cơ bản/);
    expect(bad([unit({ stats: { spd: Number.NaN } })])).toThrow(/chỉ số cơ bản/);
  });

  it('không sửa dữ liệu đầu vào hay cấu hình', () => {
    const a = [unit({ skills: ['t_basic', 't_ult', 'p_counter'] })];
    const b = [unit({ stats: { critRate: 0.5, evasion: 0.2 } })];
    const config = testConfig();
    const snapshot = JSON.stringify([a, b, config]);
    run(a, b, config);
    expect(JSON.stringify([a, b, config])).toBe(snapshot);
  });
});

describe('deterministic: cùng đầu vào và seed thì nhật ký giống nhau từng byte', () => {
  /** Trận nhiều ngẫu nhiên: chí mạng, né tránh, hiệu ứng theo xác suất, nhắm mục tiêu ngẫu nhiên, bị động đặc biệt. */
  function randomHeavy(seed: string): string {
    const config = realConfig();
    config.rules.damage.baseCritRate = 0.3;
    const squad = (ids: string[]) =>
      ids.map((id, i) => {
        const hero = config.heroes.heroes.find((h) => h.id === id)!;
        const u = unitFromHero(hero, { level: 400, star: 15, slot: { row: Math.floor(i / 3), col: i % 3 } }, config);
        u.stats = { ...u.stats, evasion: 0.15, effectAccuracy: 0.3, effectResistance: 0.1, lifesteal: 0.1 };
        return u;
      });
    const a = squad(['hoa_vu', 'phong_anh', 'hai_thuan', 'loi_ho', 'quang_minh']);
    const b = squad(['am_nguyet', 'thuy_linh', 'loi_dinh', 'u_minh', 'thanh_phong']);
    return JSON.stringify(simulate(a, b, config, seed));
  }

  it('50 trận: chạy hai lần cho kết quả giống hệt', () => {
    for (let i = 0; i < 50; i++) expect(randomHeavy(`det-${i}`)).toBe(randomHeavy(`det-${i}`));
  });

  it('có thật sự ngẫu nhiên theo seed: các seed khác nhau cho nhật ký khác nhau', () => {
    const logs = new Set(Array.from({ length: 30 }, (_, i) => randomHeavy(`var-${i}`)));
    expect(logs.size).toBe(30);
  });

  it('nhật ký qua được schema hợp đồng của @gacha/shared', () => {
    for (let i = 0; i < 20; i++) expect(() => battleResultSchema.parse(JSON.parse(randomHeavy(`schema-${i}`)))).not.toThrow();
  });

  it('seed số 7 và chuỗi "7" là cùng một trận', () => {
    const config = testConfig();
    const x = JSON.stringify(simulate([tank()], [tank()], config, 7)).replace('"seed":7', '"seed":"7"');
    expect(x).toBe(JSON.stringify(simulate([tank()], [tank()], config, '7')));
  });

  it('ghim một trận mẫu: đổi luật hay thứ tự rút số sẽ làm hỏng việc phát lại các trận đã lưu', () => {
    const json = randomHeavy('golden');
    let h = 2166136261; // FNV-1a 32 bit
    for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 16777619) >>> 0;
    expect(h).toBe(GOLDEN_HASH);
  });
});

/** Giá trị này chỉ đổi khi cố ý đổi luật của engine; khi đó cập nhật cùng docs/engine-rules.md và tăng configVersion. */
const GOLDEN_HASH = 2847758146;
