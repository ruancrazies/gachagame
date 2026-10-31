import { z } from 'zod';

/**
 * Hợp đồng nhật ký trận: server ghi, client (web, sau này Unity) chỉ phát lại.
 * Dạng một dòng cho mỗi hành động, theo ví dụ ở Giai đoạn 1 của tài liệu thiết kế.
 * Tập giá trị của `action` và cấu trúc `effects` sẽ chốt khi viết engine (Giai đoạn 1);
 * client nên bỏ qua trường lạ nên schema này không strict.
 */
export const BATTLE_LOG_VERSION = 1;

export const battleTargetResultSchema = z.object({
  id: z.string().min(1),
  dmg: z.number().int().min(0),
  crit: z.boolean(),
  hpAfter: z.number().int().min(0),
});

export const battleEventSchema = z.object({
  round: z.number().int().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  skill: z.string().min(1),
  targets: z.array(battleTargetResultSchema),
  effects: z.array(z.unknown()),
});

export type BattleTargetResult = z.infer<typeof battleTargetResultSchema>;
export type BattleEvent = z.infer<typeof battleEventSchema>;
