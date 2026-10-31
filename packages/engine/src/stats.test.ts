import { describe, expect, it } from 'vitest';
import { levelFactor, statAtLevel, unitFromHero } from './stats';
import { realConfig } from './testkit';

const config = realConfig();

describe('levelFactor = Σ kᵢ·nᵢ(L)', () => {
  // Tính tay với k = (1, 1.2, 1.5, 2, 3), giai đoạn 1-150, 151-350, 351-700, 701-880, 881-1000; cấp 1 → n = 0 (đề xuất #16).
  const cases: Array<[number, number]> = [
    [1, 0],
    [2, 1],
    [150, 149],
    [151, 149 + 1.2],
    [350, 149 + 1.2 * 200],
    [351, 149 + 240 + 1.5],
    [700, 149 + 240 + 1.5 * 350],
    [701, 149 + 240 + 525 + 2],
    [880, 149 + 240 + 525 + 2 * 180],
    [881, 149 + 240 + 525 + 360 + 3],
    [1000, 1634],
  ];
  for (const [level, expected] of cases) {
    it(`cấp ${level} → ${expected}`, () => {
      expect(levelFactor(level, config.rules)).toBeCloseTo(expected, 9);
    });
  }

  it('báo lỗi khi cấp không hợp lệ', () => {
    expect(() => levelFactor(0, config.rules)).toThrow(RangeError);
    expect(() => levelFactor(1.5, config.rules)).toThrow(RangeError);
    expect(() => levelFactor(1001, config.rules)).toThrow(RangeError);
  });
});

describe('statAtLevel và unitFromHero', () => {
  it('T(L) = a + b·Σ: cấp 1 đúng a, cấp 1000 = a + 1634·b', () => {
    expect(statAtLevel({ a: 120, b: 5.5 }, 1, config.rules)).toBe(120);
    expect(statAtLevel({ a: 120, b: 5.5 }, 1000, config.rules)).toBeCloseTo(120 + 5.5 * 1634, 9);
  });

  it('khớp số liệu mẫu trong rules-decisions: Chiến binh bậc A cấp 1000 có ATK ≈ 9100', () => {
    const hero = config.heroes.heroes.find((h) => h.id === 'xich_diem')!;
    const u = unitFromHero(hero, { level: 1000, star: 20, slot: { row: 0, col: 0 } }, config);
    expect(u.stats.atk).toBe(Math.round(120 + 5.5 * 1634));
    expect(u.stats.atk).toBeGreaterThan(9000);
    expect(u.stats.atk).toBeLessThan(9200);
  });

  it('chỉ giữ kỹ năng đã mở khóa ở sao hiện tại (bị động UR mở ở ★15)', () => {
    const hero = config.heroes.heroes.find((h) => h.id === 'hoa_vu')!;
    const at = (star: number) => unitFromHero(hero, { level: 10, star, slot: { row: 0, col: 0 } }, config).skills;
    expect(at(14)).toEqual(['mage_basic', 'mage_ultimate']);
    expect(at(15)).toContain('passive_sample_ur');
  });
});
