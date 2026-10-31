import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

function draw(seed: string | number, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
}

describe('createRng', () => {
  it('cùng seed thì ra cùng dãy số', () => {
    expect(draw('trận-1', 100)).toEqual(draw('trận-1', 100));
  });

  it('khác seed thì ra dãy khác', () => {
    expect(draw('trận-1', 10)).not.toEqual(draw('trận-2', 10));
  });

  it('số 42 và chuỗi "42" là cùng một seed', () => {
    expect(draw(42, 5)).toEqual(draw('42', 5));
  });

  it('ghim giá trị đầu của vài seed: đổi thuật toán sẽ làm hỏng việc phát lại các trận đã lưu', () => {
    expect(draw('gacha', 3)).toEqual([0.4779308629222214, 0.6885873605497181, 0.7588798850774765]);
    expect(draw(42, 2)).toEqual([0.1682699858210981, 0.2886446751654148]);
  });

  it('next() luôn nằm trong [0, 1)', () => {
    for (const v of draw('range', 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) nằm trong khoảng, gồm cả hai đầu, và phủ hết các giá trị', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('int báo lỗi khi tham số sai', () => {
    const rng = createRng('x');
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(1.5, 3)).toThrow(RangeError);
  });

  it('chance: p >= 1 luôn đúng, p <= 0 luôn sai', () => {
    const rng = createRng('chance');
    for (let i = 0; i < 1000; i++) {
      expect(rng.chance(1)).toBe(true);
      expect(rng.chance(1.5)).toBe(true);
      expect(rng.chance(0)).toBe(false);
    }
  });

  it('chance(0.3) cho tỉ lệ gần 30% (seed cố định nên kết quả không đổi)', () => {
    const rng = createRng('rate');
    let hits = 0;
    const trials = 20_000;
    for (let i = 0; i < trials; i++) if (rng.chance(0.3)) hits++;
    expect(hits / trials).toBeGreaterThan(0.28);
    expect(hits / trials).toBeLessThan(0.32);
  });

  it('mỗi lần gọi chance/int/next tiêu đúng một số, kể cả chance(1) và chance(0)', () => {
    const reference = createRng('consume');
    const expected = Array.from({ length: 4 }, () => reference.next());

    const rng = createRng('consume');
    rng.chance(1);
    rng.chance(0);
    rng.int(1, 10);
    expect(rng.next()).toBe(expected[3]);
  });
});
