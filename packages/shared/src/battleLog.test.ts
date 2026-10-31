import { describe, expect, it } from 'vitest';
import { BATTLE_LOG_VERSION, battleEventSchema } from './battleLog';

describe('nhật ký trận', () => {
  it('có số phiên bản', () => {
    expect(BATTLE_LOG_VERSION).toBe(1);
  });

  it('nhận đúng dòng nhật ký mẫu trong tài liệu thiết kế', () => {
    const line =
      '{"round": 3, "actor": "A2", "action": "skill", "skill": "fire_burst", "targets": [{"id": "B1", "dmg": 1240, "crit": true, "hpAfter": 3100}], "effects": []}';
    const event = battleEventSchema.parse(JSON.parse(line));
    expect(event.targets[0]).toEqual({ id: 'B1', dmg: 1240, crit: true, hpAfter: 3100 });
  });

  it('từ chối sát thương âm hoặc hiệp 0', () => {
    const base = { round: 1, actor: 'A1', action: 'basic', skill: 'x', targets: [], effects: [] };
    expect(battleEventSchema.safeParse(base).success).toBe(true);
    expect(battleEventSchema.safeParse({ ...base, round: 0 }).success).toBe(false);
    expect(
      battleEventSchema.safeParse({ ...base, targets: [{ id: 'B1', dmg: -5, crit: false, hpAfter: 10 }] }).success,
    ).toBe(false);
  });

  it('bỏ qua trường lạ để client cũ vẫn đọc được nhật ký mới', () => {
    const base = { round: 1, actor: 'A1', action: 'basic', skill: 'x', targets: [], effects: [], newField: 1 };
    expect(battleEventSchema.safeParse(base).success).toBe(true);
  });
});
