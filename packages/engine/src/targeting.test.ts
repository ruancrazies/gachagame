import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { selectTargets, type Targetable } from './targeting';

const grid = { rows: 3, cols: 3 };
const u = (name: string, row: number, col: number, hp: number, atk: number, index = 0): Targetable & { name: string } => ({
  name,
  hp,
  atk,
  slot: { row, col },
  index,
});

//  hàng 0:  p(0,0) hp 500 atk 90     q(0,2) hp 900 atk 50
//  hàng 1:  r(1,1) hp 900 atk 70
//  hàng 2:  s(2,0) hp 100 atk 90     t(2,2) hp 700 atk 10
const pool = [u('t', 2, 2, 700, 10, 4), u('p', 0, 0, 500, 90, 0), u('s', 2, 0, 100, 90, 3), u('q', 0, 2, 900, 50, 1), u('r', 1, 1, 900, 70, 2)];
const names = (list: Array<{ name: string }>) => list.map((x) => x.name);
const pick = (rule: Parameters<typeof selectTargets>[1], count: number, seed = 'x') =>
  names(selectTargets(pool, rule, count, grid, createRng(seed)) as Array<{ name: string }>);

describe('selectTargets', () => {
  it('highest_hp: máu cao nhất, hòa thì theo thứ tự ô (hàng trước, trái sang phải)', () => {
    expect(pick('highest_hp', 1)).toEqual(['q']);
    expect(pick('highest_hp', 3)).toEqual(['q', 'r', 't']);
  });

  it('lowest_hp: máu thấp nhất', () => {
    expect(pick('lowest_hp', 2)).toEqual(['s', 'p']);
  });

  it('highest_atk: ATK cao nhất, hòa thì theo thứ tự ô', () => {
    expect(pick('highest_atk', 1)).toEqual(['p']);
    expect(pick('highest_atk', 2)).toEqual(['p', 's']);
  });

  it('front_row: hàng còn người gần nhất, trái sang phải, tối đa count', () => {
    expect(pick('front_row', 5)).toEqual(['p', 'q']);
    expect(pick('front_row', 1)).toEqual(['p']);
  });

  it('front_row khi hàng đầu đã chết hết thì lùi về hàng sau', () => {
    const rest = pool.filter((x) => x.slot.row > 0);
    expect(names(selectTargets(rest, 'front_row', 3, grid, createRng('x')) as Array<{ name: string }>)).toEqual(['r']);
  });

  it('center: gần tâm (1,1) nhất, rồi xa dần', () => {
    expect(pick('center', 1)).toEqual(['r']);
    expect(pick('center', 3)).toEqual(['r', 'p', 'q']);
  });

  it('column: cột có nhiều đơn vị nhất (hòa thì cột trái), từ hàng trước ra sau', () => {
    // cột 0: p, s; cột 1: r; cột 2: q, t → hòa 2-2, chọn cột trái hơn
    expect(pick('column', 3)).toEqual(['p', 's']);
    expect(pick('column', 1)).toEqual(['p']);
  });

  it('all: mọi đơn vị theo thứ tự ô, cắt ở count', () => {
    expect(pick('all', 5)).toEqual(['p', 'q', 'r', 's', 't']);
    expect(pick('all', 2)).toEqual(['p', 'q']);
  });

  it('random: không trùng, tối đa bằng số đơn vị, cùng seed cùng kết quả, khác seed thì (thường) khác', () => {
    const a = pick('random', 3, 'seed-1');
    expect(new Set(a).size).toBe(3);
    expect(pick('random', 3, 'seed-1')).toEqual(a);
    expect(pick('random', 9, 'seed-1')).toHaveLength(5);
    const variety = new Set(Array.from({ length: 30 }, (_, i) => pick('random', 2, `s${i}`).join()));
    expect(variety.size).toBeGreaterThan(5);
  });

  it('chỉ random mới tiêu số ngẫu nhiên', () => {
    const rng = createRng('consume');
    const ref = createRng('consume');
    for (const rule of ['highest_hp', 'lowest_hp', 'highest_atk', 'front_row', 'center', 'column', 'all'] as const) {
      selectTargets(pool, rule, 2, grid, rng);
    }
    expect(rng.next()).toBe(ref.next());
  });

  it('nhóm rỗng thì trả về rỗng; không sửa mảng đầu vào', () => {
    expect(selectTargets([], 'all', 5, grid, createRng('x'))).toEqual([]);
    const copy = [...pool];
    selectTargets(pool, 'highest_hp', 2, grid, createRng('x'));
    expect(pool).toEqual(copy);
  });
});
