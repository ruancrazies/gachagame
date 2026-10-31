/**
 * Engine mô phỏng trận đấu: hàm thuần túy, deterministic.
 * Giai đoạn 0 chỉ có bộ sinh số ngẫu nhiên có seed; `simulate(đội A, đội B, cấu hình, seed)`
 * được viết ở Giai đoạn 1 sau khi các luật còn thiếu (docs/rules-decisions.md) đã chốt.
 */
export { createRng, type Rng, type Seed } from './rng';
