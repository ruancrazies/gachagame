/**
 * Engine mô phỏng trận đấu: hàm thuần túy, deterministic.
 * `simulate(đội A, đội B, cấu hình, seed)` trả về nhật ký sự kiện (hợp đồng nằm ở @gacha/shared/battleLog).
 */
export { createRng, type Rng, type Seed } from './rng';
export { simulate } from './simulate';
export { computeDamage, elementMultiplier, type DamageInput } from './damage';
export { selectTargets, byGridOrder, type Targetable, type GridSize } from './targeting';
export { levelFactor, statAtLevel, unitFromHero } from './stats';
export { BattleInputError, type BattleUnitInput, type GridSlot, type TeamInput, type UnitStats } from './types';
export { runBatch, formatBatchReport, type BatchOptions, type BatchReport, type WinRateRow } from './batch';
