import { describe, expect, it } from 'vitest';
import { computeDamage, elementMultiplier, type DamageInput } from './damage';
import { realConfig } from './testkit';

const { damage } = realConfig().rules;

const base: DamageInput = {
  atk: 1000,
  skillCoef: 1,
  def: 0,
  penetration: 0,
  damageBonus: 0,
  element: 1,
  damageReduction: 0,
  crit: false,
  critDamage: 0.5,
};

describe('computeDamage (phụ lục A)', () => {
  it('ví dụ tính tay của tài liệu: ≈ 16 723 thường, ≈ 33 446 khi chí mạng Crit DMG +100%', () => {
    const example: DamageInput = {
      atk: 10000,
      skillCoef: 2,
      def: 6000,
      penetration: 0.2,
      damageBonus: 0.25,
      element: 1.1,
      damageReduction: 0.1,
      crit: false,
      critDamage: 1,
    };
    expect(computeDamage(example, damage)).toBe(16723);
    expect(computeDamage({ ...example, crit: true }, damage)).toBe(33446);
  });

  it('bảng sát thương còn lại theo DEF/ATK với k = 1: 100%, 80%, 66.7%, 50%, 33.3%, 20%', () => {
    const table: Array<[number, number]> = [
      [0, 1000],
      [250, 800],
      [500, 667],
      [1000, 500],
      [2000, 333],
      [4000, 200],
    ];
    for (const [def, expected] of table) {
      expect(computeDamage({ ...base, def }, damage), `DEF ${def}`).toBe(expected);
    }
  });

  it('tỉ số DEF/ATK như nhau thì sát thương còn lại như nhau, bất kể cấp (ATK 100 hay 100 000)', () => {
    expect(computeDamage({ ...base, atk: 100, def: 100 }, damage) / 100).toBeCloseTo(0.5, 5);
    expect(computeDamage({ ...base, atk: 100_000, def: 100_000 }, damage) / 100_000).toBeCloseTo(0.5, 5);
  });

  it('từng nhân tố một: hệ số kỹ năng, Damage Bonus, khắc hệ, giảm sát thương, chí mạng', () => {
    expect(computeDamage({ ...base, skillCoef: 2 }, damage)).toBe(2000);
    expect(computeDamage({ ...base, damageBonus: 0.25 }, damage)).toBe(1250);
    expect(computeDamage({ ...base, element: 1.1 }, damage)).toBe(1100);
    expect(computeDamage({ ...base, damageReduction: 0.3 }, damage)).toBe(700);
    expect(computeDamage({ ...base, crit: true }, damage)).toBe(1500);
    expect(computeDamage({ ...base, crit: true, critDamage: 1.5 }, damage)).toBe(2500);
  });

  it('xuyên giáp làm giảm DEF hiệu dụng; xuyên giáp 100% bỏ qua hoàn toàn DEF', () => {
    expect(computeDamage({ ...base, def: 1000, penetration: 0.5 }, damage)).toBe(667);
    expect(computeDamage({ ...base, def: 1000, penetration: 1 }, damage)).toBe(1000);
    expect(computeDamage({ ...base, def: 1000, penetration: 3 }, damage)).toBe(1000);
  });

  it('giảm sát thương được kẹp trong [0, 1]; sát thương tối thiểu là 1', () => {
    expect(computeDamage({ ...base, damageReduction: 2 }, damage)).toBe(1);
    expect(computeDamage({ ...base, atk: 0 }, damage)).toBe(1);
    expect(computeDamage({ ...base, skillCoef: 0.0001 }, damage)).toBe(1);
  });
});

describe('elementMultiplier', () => {
  it('vòng Hỏa → Phong → Lôi → Thủy → Hỏa: khắc +10%, bị khắc −10%', () => {
    const cycle = ['fire', 'wind', 'lightning', 'water'] as const;
    cycle.forEach((el, i) => {
      const beaten = cycle[(i + 1) % 4]!;
      expect(elementMultiplier(el, beaten, damage), `${el} đánh ${beaten}`).toBeCloseTo(1.1, 10);
      expect(elementMultiplier(beaten, el, damage), `${beaten} đánh ${el}`).toBeCloseTo(0.9, 10);
    });
  });

  it('hai hệ đối diện trong vòng (Hỏa-Lôi, Phong-Thủy) và cùng hệ thì trung tính', () => {
    expect(elementMultiplier('fire', 'lightning', damage)).toBe(1);
    expect(elementMultiplier('wind', 'water', damage)).toBe(1);
    expect(elementMultiplier('fire', 'fire', damage)).toBe(1);
  });

  it('Quang và Ám đánh nhau +15% cả hai chiều; với bốn hệ cơ bản thì trung tính', () => {
    expect(elementMultiplier('light', 'dark', damage)).toBe(1.15);
    expect(elementMultiplier('dark', 'light', damage)).toBe(1.15);
    expect(elementMultiplier('light', 'light', damage)).toBe(1);
    for (const el of ['fire', 'water', 'wind', 'lightning'] as const) {
      expect(elementMultiplier('light', el, damage)).toBe(1);
      expect(elementMultiplier(el, 'dark', damage)).toBe(1);
    }
  });
});
