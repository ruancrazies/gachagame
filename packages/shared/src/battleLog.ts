import { z } from 'zod';

/**
 * Hợp đồng nhật ký trận: server ghi, client (web, sau này Unity) chỉ phát lại.
 * Dạng một dòng cho mỗi hành động, theo ví dụ ở Giai đoạn 1 của tài liệu thiết kế.
 * Client nên bỏ qua trường lạ nên các schema này không strict; thêm trường mới là thay đổi tương thích.
 *
 * Quy ước id đơn vị: "A1".."A5" là đội A (bên tấn công), "B1".."B5" là đội B (bên phòng thủ),
 * số thứ tự theo vị trí trong mảng đội hình truyền vào `simulate`.
 */
export const BATTLE_LOG_VERSION = 1;

/**
 * Loại hành động:
 * - basic / ultimate: đánh thường / tuyệt kỹ;
 * - passive: kỹ năng bị động chỉ áp hiệu ứng (turn_start, round_end...);
 * - skip: mất lượt vì choáng (skill = "stunned");
 * - dot: sát thương theo thời gian chạy đầu lượt (actor là kẻ chịu, skill là id hiệu ứng);
 * - revive: hồi sinh.
 */
export const BATTLE_ACTIONS = ['basic', 'ultimate', 'passive', 'skip', 'dot', 'revive'] as const;
export type BattleAction = (typeof BATTLE_ACTIONS)[number];

/** Đòn đánh phát sinh từ kỹ năng bị động (không phải lượt thường của hàng đợi). */
export const BATTLE_TRIGGERS = ['counter', 'follow_up', 'pursuit', 'extra_turn'] as const;
export type BattleTrigger = (typeof BATTLE_TRIGGERS)[number];

export const battleTargetResultSchema = z.object({
  id: z.string().min(1),
  /** Sát thương cuối cùng của đòn (đã gồm phần khiên hấp thụ). */
  dmg: z.number().int().min(0),
  crit: z.boolean(),
  hpAfter: z.number().int().min(0),
  /** true nếu mục tiêu né được: đòn đó không gây sát thương lẫn hiệu ứng. */
  evaded: z.boolean().optional(),
  /** Phần sát thương bị khiên hấp thụ. */
  absorbed: z.number().int().min(0).optional(),
});

export const battleEffectResultSchema = z.object({
  target: z.string().min(1),
  effect: z.string().min(1),
  /** false nghĩa là trượt xác suất (hoặc bị Kháng hiệu ứng chặn). */
  applied: z.boolean(),
});

export const battleHealSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().min(0),
  hpAfter: z.number().int().min(0),
  source: z.enum(['effect', 'lifesteal']),
});

export const battleEventSchema = z.object({
  round: z.number().int().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  skill: z.string().min(1),
  trigger: z.string().optional(),
  targets: z.array(battleTargetResultSchema),
  effects: z.array(battleEffectResultSchema),
  heals: z.array(battleHealSchema).optional(),
  /** id các đơn vị bị hạ trong hành động này. */
  defeated: z.array(z.string().min(1)).optional(),
});

export const battleUnitSummarySchema = z.object({
  id: z.string().min(1),
  heroId: z.string().min(1),
  side: z.enum(['A', 'B']),
  maxHp: z.number().int().min(1),
  hp: z.number().int().min(0),
  alive: z.boolean(),
  damageDealt: z.number().int().min(0),
});

export const battleResultSchema = z.object({
  version: z.literal(BATTLE_LOG_VERSION),
  seed: z.union([z.string(), z.number()]),
  /** "draw" chỉ xảy ra khi hai bên cùng bị hạ hết trong một hành động. */
  winner: z.enum(['A', 'B', 'draw']),
  endReason: z.enum(['elimination', 'timeout']),
  rounds: z.number().int().min(1),
  /** Trạng thái đầu trận để client dựng sân khấu trước khi phát lại. */
  initial: z.array(
    battleUnitSummarySchema.extend({
      element: z.string(),
      role: z.string(),
      slot: z.object({ row: z.number().int(), col: z.number().int() }),
    }),
  ),
  events: z.array(battleEventSchema),
  units: z.array(battleUnitSummarySchema),
});

export type BattleTargetResult = z.infer<typeof battleTargetResultSchema>;
export type BattleEffectResult = z.infer<typeof battleEffectResultSchema>;
export type BattleHeal = z.infer<typeof battleHealSchema>;
export type BattleEvent = z.infer<typeof battleEventSchema>;
export type BattleUnitSummary = z.infer<typeof battleUnitSummarySchema>;
export type BattleResult = z.infer<typeof battleResultSchema>;
