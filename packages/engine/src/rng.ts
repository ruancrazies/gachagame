/**
 * Bộ sinh số ngẫu nhiên có seed cho engine trận đấu.
 *
 * Nguyên tắc kiến trúc #2: mọi yếu tố ngẫu nhiên trong trận (chí mạng, né tránh, trúng hiệu ứng,
 * chọn mục tiêu ngẫu nhiên) phải đi qua bộ này, không bao giờ dùng Math.random().
 * Cùng seed và cùng thứ tự gọi thì ra cùng dãy số, trên mọi máy.
 *
 * Quy ước quan trọng: MỖI lần gọi next/int/chance tiêu đúng một số ngẫu nhiên,
 * kể cả chance(1) hay chance(0). Nhờ vậy đổi một xác suất thành 100% không làm lệch
 * các lần rút phía sau, và nhật ký trận cũ vẫn tái hiện đúng.
 */

export type Seed = string | number;

export interface Rng {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [min, max], gồm cả hai đầu. */
  int(min: number, max: number): number;
  /** true với xác suất p; p >= 1 luôn true, p <= 0 luôn false (vẫn tiêu một số). */
  chance(p: number): boolean;
}

/** Băm seed (chuỗi hoặc số) thành số nguyên 32 bit không dấu. Số 42 và chuỗi "42" cho cùng kết quả. */
function hashSeed(seed: Seed): number {
  const text = String(seed);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: nhỏ, nhanh, chỉ dùng phép toán số nguyên 32 bit nên kết quả giống nhau trên mọi nền tảng. */
export function createRng(seed: Seed): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`int(${min}, ${max}): cần hai số nguyên với min <= max`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      const roll = next();
      return roll < p;
    },
  };
}
