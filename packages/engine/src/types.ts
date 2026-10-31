import type { Element, SecondaryStat } from '@gacha/shared';

export interface GridSlot {
  /** 0 là hàng đầu (gần kẻ địch nhất), tăng dần về phía sau. */
  row: number;
  /** 0 là cột trái. */
  col: number;
}

/** Chỉ số cuối của một đơn vị (đã gồm cấp, sao, trang bị...; việc dựng chỉ số nằm ngoài engine). */
export type UnitStats = { atk: number; def: number; hp: number; spd: number } & Partial<Record<SecondaryStat, number>>;

/** Một nhân vật vào trận. Engine không biết gì về tài khoản, trang bị hay cấp: chỉ nhận chỉ số cuối. */
export interface BattleUnitInput {
  heroId: string;
  element: Element;
  role: string;
  slot: GridSlot;
  stats: UnitStats;
  /** id kỹ năng đang dùng được (đã lọc theo sao mở khóa). Cần đúng 1 basic và 1 ultimate; có thể kèm bị động. */
  skills: string[];
}

export type TeamInput = BattleUnitInput[];

export class BattleInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleInputError';
  }
}
