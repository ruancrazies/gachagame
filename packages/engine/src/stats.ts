import type { GameConfig, Hero, Rules } from '@gacha/shared';
import type { BattleUnitInput, GridSlot, UnitStats } from './types';

/**
 * Chỉ số cơ bản tại cấp L: T(L) = a + b · Σ kᵢ · nᵢ(L)   (mục 5 của tài liệu thiết kế).
 * Theo đề xuất #16: cấp 1 cho đúng `a`; mỗi lần lên cấp được tính vào giai đoạn chứa cấp mới,
 * nên nᵢ(L) là số cấp trong giai đoạn i nằm trong khoảng (1, L].
 */
export function levelFactor(level: number, rules: Pick<Rules, 'levelCurve'>): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`cấp phải là số nguyên >= 1, nhận ${level}`);
  const stages = rules.levelCurve.stages;
  const last = stages[stages.length - 1];
  if (!last || level > last.toLevel) throw new RangeError(`cấp ${level} vượt đường cong cấp`);
  let sum = 0;
  for (const stage of stages) {
    const from = Math.max(stage.fromLevel, 2);
    const to = Math.min(stage.toLevel, level);
    if (to >= from) sum += stage.multiplier * (to - from + 1);
  }
  return sum;
}

export function statAtLevel(curve: { a: number; b: number }, level: number, rules: Pick<Rules, 'levelCurve'>): number {
  return curve.a + curve.b * levelFactor(level, rules);
}

/**
 * Dựng đơn vị vào trận từ mẫu nhân vật, chỉ tính cấp và sao (chưa có trang bị; việc đó ở Giai đoạn 2).
 * Chỉ giữ các kỹ năng đã mở khóa ở sao hiện tại. Dùng cho công cụ chạy hàng loạt và kiểm thử.
 */
export function unitFromHero(hero: Hero, opts: { level: number; star: number; slot: GridSlot }, config: GameConfig): BattleUnitInput {
  const skillById = new Map(config.skills.skills.map((s) => [s.id, s]));
  const stats: UnitStats = {
    atk: Math.round(statAtLevel(hero.stats.atk, opts.level, config.rules)),
    def: Math.round(statAtLevel(hero.stats.def, opts.level, config.rules)),
    hp: Math.round(statAtLevel(hero.stats.hp, opts.level, config.rules)),
    spd: Math.round(statAtLevel(hero.stats.spd, opts.level, config.rules)),
  };
  const skills = hero.skills.filter((id) => (skillById.get(id)?.unlockStar ?? Infinity) <= opts.star);
  return { heroId: hero.id, element: hero.element, role: hero.role, slot: opts.slot, stats, skills };
}
