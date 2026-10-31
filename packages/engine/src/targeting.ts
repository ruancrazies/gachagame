import type { TargetRule } from '@gacha/shared';
import type { Rng } from './rng';

/** Phần tối thiểu của một đơn vị mà bộ chọn mục tiêu cần biết. */
export interface Targetable {
  hp: number;
  atk: number;
  slot: { row: number; col: number };
  /** Thứ tự trong đội, dùng để phân định khi hai đơn vị cùng ô (không xảy ra với đội hợp lệ). */
  index: number;
}

export interface GridSize {
  rows: number;
  cols: number;
}

/** Thứ tự ô trong lưới: hàng trước rồi trái sang phải. Mọi luật bằng điểm đều phân định theo thứ tự này. */
export function byGridOrder(a: Targetable, b: Targetable): number {
  return a.slot.row - b.slot.row || a.slot.col - b.slot.col || a.index - b.index;
}

/**
 * Chọn tối đa `count` mục tiêu trong `pool` (chỉ gồm đơn vị còn sống) theo luật dữ liệu.
 * Chỉ luật `random` rút số ngẫu nhiên (qua rng): mỗi mục tiêu một lần rút, theo thứ tự chọn.
 *
 * - highest_hp / highest_atk / lowest_hp: xếp theo máu hiện tại hoặc ATK hiện tại.
 * - front_row: hàng còn người ở gần nhất, theo thứ tự ô.
 * - center: gần tâm lưới nhất (khoảng cách Manhattan), hòa thì theo thứ tự ô.
 * - column: cột có nhiều đơn vị nhất (hòa thì cột trái hơn), từ hàng trước ra sau.
 * - all: mọi đơn vị theo thứ tự ô.
 */
export function selectTargets<T extends Targetable>(
  pool: readonly T[],
  rule: TargetRule,
  count: number,
  grid: GridSize,
  rng: Rng,
): T[] {
  if (pool.length === 0) return [];
  const ordered = [...pool].sort(byGridOrder);
  const take = (list: T[]) => list.slice(0, count);

  switch (rule) {
    case 'highest_hp':
      return take([...ordered].sort((a, b) => b.hp - a.hp));
    case 'lowest_hp':
      return take([...ordered].sort((a, b) => a.hp - b.hp));
    case 'highest_atk':
      return take([...ordered].sort((a, b) => b.atk - a.atk));
    case 'front_row': {
      const frontRow = Math.min(...ordered.map((u) => u.slot.row));
      return take(ordered.filter((u) => u.slot.row === frontRow));
    }
    case 'center': {
      const cr = (grid.rows - 1) / 2;
      const cc = (grid.cols - 1) / 2;
      const dist = (u: T) => Math.abs(u.slot.row - cr) + Math.abs(u.slot.col - cc);
      return take([...ordered].sort((a, b) => dist(a) - dist(b)));
    }
    case 'column': {
      const perCol = new Map<number, T[]>();
      for (const u of ordered) perCol.set(u.slot.col, [...(perCol.get(u.slot.col) ?? []), u]);
      let best: T[] = [];
      let bestCol = Infinity;
      for (const [col, units] of perCol) {
        if (units.length > best.length || (units.length === best.length && col < bestCol)) {
          best = units;
          bestCol = col;
        }
      }
      return take(best);
    }
    case 'all':
      return take(ordered);
    case 'random': {
      const remaining = [...ordered];
      const picked: T[] = [];
      while (picked.length < count && remaining.length > 0) {
        const i = rng.int(0, remaining.length - 1);
        picked.push(remaining[i] as T);
        remaining.splice(i, 1);
      }
      return picked;
    }
  }
}
