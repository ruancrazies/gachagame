import { describe, expect, it } from 'vitest';
import { BASE_ELEMENTS, ELEMENTS, RARITIES } from './constants';
import { validateGameConfig, type GameConfig } from './config';
import { defaultConfigDir, loadGameConfig, readRawConfig } from './node';

/** Dạng lỏng của cấu hình thô, chỉ để các ca kiểm thử sửa dữ liệu cho dễ. */
interface RawConfig {
  manifest: Record<string, unknown>;
  taxonomy: { roles: Array<Record<string, unknown>> };
  rules: {
    levelCurve: { stages: Array<Record<string, number>> };
    damage: { elementBeats: Record<string, string> };
    heroSkillSlots: Record<string, number>;
  };
  effects: { effects: Array<Record<string, unknown>> };
  skills: { skills: Array<Record<string, unknown>> };
  heroes: { heroes: Array<Record<string, unknown>> };
  evolution: { steps: Array<Record<string, unknown>> };
}

function freshRaw(): RawConfig {
  return structuredClone(readRawConfig(defaultConfigDir())) as unknown as RawConfig;
}

function errorsAfter(mutate: (raw: RawConfig) => void): string[] {
  const raw = freshRaw();
  mutate(raw);
  const result = validateGameConfig(raw);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe('bộ cấu hình mẫu', () => {
  const { config, warnings } = loadGameConfig();

  it('qua được kiểm tra schema và tham chiếu chéo', () => {
    expect(config.manifest.configVersion).toBe('0.2.0');
  });

  it('cảnh báo các phần chưa chốt thay vì im lặng', () => {
    expect(warnings.length).toBe(6);
    expect(warnings.join('\n')).toContain('heroes: đang là placeholder');
    expect(warnings.join('\n')).toContain('rules: đang là draft');
  });

  it('có 12 nhân vật phủ đủ 6 hệ (mỗi hệ 2 người) và đủ 5 vai trò', () => {
    const heroes = config.heroes.heroes;
    expect(heroes).toHaveLength(12);
    for (const element of ELEMENTS) {
      expect(heroes.filter((h) => h.element === element), element).toHaveLength(2);
    }
    for (const role of config.taxonomy.roles) {
      expect(heroes.filter((h) => h.role === role.id).length, role.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('Quang và Ám có ở mọi bậc hiếm', () => {
    const lightDark = new Set(
      config.heroes.heroes.filter((h) => h.element === 'light' || h.element === 'dark').map((h) => h.rarity),
    );
    expect(lightDark).toEqual(new Set(RARITIES));
  });

  it('chỉ UR có kỹ năng bị động #5, mở khóa ở ★15', () => {
    const passive = config.skills.skills.find((s) => s.id === 'passive_sample_ur');
    expect(passive?.unlockStar).toBe(15);
    for (const hero of config.heroes.heroes) {
      expect(hero.skills.includes('passive_sample_ur'), hero.id).toBe(hero.rarity === 'UR');
    }
  });

  it('đường cong cấp theo tài liệu: 5 giai đoạn, hệ số 1 / 1.2 / 1.5 / 2 / 3, kết thúc ở cấp 1000', () => {
    const stages = config.rules.levelCurve.stages;
    expect(stages.map((s) => s.multiplier)).toEqual([1, 1.2, 1.5, 2, 3]);
    expect(stages.map((s) => [s.fromLevel, s.toLevel])).toEqual([
      [1, 150],
      [151, 350],
      [351, 700],
      [701, 880],
      [881, 1000],
    ]);
  });

  it('vòng khắc hệ: mỗi hệ cơ bản khắc đúng một hệ và bị đúng một hệ khắc', () => {
    const beats = config.rules.damage.elementBeats;
    const targets = BASE_ELEMENTS.map((e) => beats[e]);
    expect(new Set(targets).size).toBe(4);
    for (const e of BASE_ELEMENTS) expect(beats[beats[e]]).not.toBe(e);
  });

  it('khớp các quyết định đã chốt ngày 2026-10-31', () => {
    expect(config.rules.economy.refundRate).toBe(0.8);
    expect(config.rules.battle).toMatchObject({ maxRounds: 20, maxTeamSize: 5, grid: { rows: 3, cols: 3 } });
    expect(config.rules.damage.caps).toEqual({ critRate: null, evasion: null, effectAccuracy: null });
    expect(config.rules.heroSkillSlots).toEqual({ A: 4, S: 4, SS: 4, UR: 5 });
  });

  it('bảng tiến hóa đủ ★1 đến ★20 và cấp tối đa không giảm', () => {
    const steps = config.evolution.steps;
    expect(steps.map((s) => s.star)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.maxLevel).toBeGreaterThanOrEqual(steps[i - 1]!.maxLevel);
    }
  });
});

describe('cấu hình sai phải bị bắt', () => {
  const cases: Array<[string, (raw: RawConfig) => void, string]> = [
    ['hero dùng vai trò không tồn tại', (r) => void (r.heroes.heroes[0]!['role'] = 'healer'), 'role "healer"'],
    ['hero dùng loại vũ khí không tồn tại', (r) => void (r.heroes.heroes[0]!['weaponType'] = 'laser'), 'weaponType "laser"'],
    ['hero tham chiếu kỹ năng không tồn tại', (r) => void (r.heroes.heroes[0]!['skills'] = ['warrior_basic', 'ghost']), 'kỹ năng "ghost"'],
    ['kỹ năng tham chiếu hiệu ứng không tồn tại', (r) => void (r.skills.skills[1]!['effects'] = ['nope']), 'hiệu ứng "nope"'],
    ['hero thiếu tuyệt kỹ', (r) => void (r.heroes.heroes[0]!['skills'] = ['warrior_basic', 'passive_sample_ur']), 'đúng 1 tuyệt kỹ'],
    ['hero có hai kỹ năng thường', (r) => void (r.heroes.heroes[0]!['skills'] = ['warrior_basic', 'mage_basic', 'warrior_ultimate']), 'đúng 1 kỹ năng thường'],
    ['UR vượt số kỹ năng cho phép', (r) => void (r.rules.heroSkillSlots['UR'] = 2), 'vượt giới hạn 2 của bậc UR'],
    ['id nhân vật bị trùng', (r) => void (r.heroes.heroes[1]!['id'] = r.heroes.heroes[0]!['id']), 'id "xich_diem" bị trùng'],
    ['đường cong cấp bị hở', (r) => void (r.rules.levelCurve.stages[1]!['fromLevel'] = 152), 'phải bắt đầu ở cấp 151'],
    ['vòng khắc hệ khắc lẫn nhau', (r) => void Object.assign(r.rules.damage.elementBeats, { fire: 'wind', wind: 'fire' }), 'khắc lẫn nhau'],
    ['buff thiếu stat', (r) => void delete r.effects.effects.find((e) => e['id'] === 'atk_up_30')!['stat'], 'cần stat'],
    ['heal có duration khác 0', (r) => void (r.effects.effects.find((e) => e['id'] === 'heal_atk_80')!['duration'] = 2), 'duration phải bằng 0'],
    ['bị động thiếu trigger', (r) => void delete r.skills.skills.find((s) => s['id'] === 'passive_sample_ur')!['trigger'], 'phải có trigger'],
    ['special trên kỹ năng không phải bị động', (r) => void (r.skills.skills[0]!['special'] = { kind: 'counter', chance: 1 }), 'special chỉ dùng cho kỹ năng bị động'],
    ['phản kích sai trigger', (r) => void (r.skills.skills.find((s) => s['id'] === 'passive_counter_sample')!['trigger'] = 'turn_start'), 'phải có trigger after_damage'],
    ['hồi sinh thiếu reviveHpRatio', (r) => void delete (r.skills.skills.find((s) => s['id'] === 'passive_revive_sample')!['special'] as Record<string, unknown>)['reviveHpRatio'], 'cần reviveHpRatio'],
    ['reviveHpRatio trên phản kích', (r) => void ((r.skills.skills.find((s) => s['id'] === 'passive_counter_sample')!['special'] as Record<string, unknown>)['reviveHpRatio'] = 0.5), 'chỉ dùng cho revive'],
    ['thiếu timeoutRule', (r) => void delete (r.rules as unknown as { battle: Record<string, unknown> }).battle['timeoutRule'], 'timeoutRule'],
    ['gõ sai tên trường', (r) => void (r.heroes.heroes[0]!['atkk'] = 1), 'atkk'],
    ['thiếu một bậc tiến hóa', (r) => void r.evolution.steps.splice(6, 1), 'thiếu ★7'],
    ['cấp tối đa giảm giữa hai bậc', (r) => void (r.evolution.steps[9]!['maxLevel'] = 10), 'thấp hơn ★9'],
    ['cấp tối đa vượt đường cong cấp', (r) => void (r.evolution.steps[19]!['maxLevel'] = 1200), 'vượt cấp cuối'],
    ['phiên bản cấu hình sai định dạng', (r) => void (r.manifest['configVersion'] = 'v1'), 'x.y.z'],
    ['taxonomy không đủ 5 vai trò', (r) => void r.taxonomy.roles.pop(), '5 vai trò'],
  ];

  it.each(cases)('%s', (_label, mutate, expected) => {
    expect(errorsAfter(mutate).join('\n')).toContain(expected);
  });

  it('báo thiếu phần cấu hình', () => {
    const raw = freshRaw() as unknown as Record<string, unknown>;
    delete raw['skills'];
    const result = validateGameConfig(raw);
    expect(result).toEqual({ ok: false, errors: ['skills: thiếu phần cấu hình này'] });
  });

  it('báo lỗi khi đầu vào không phải object', () => {
    expect(validateGameConfig(null).ok).toBe(false);
    expect(validateGameConfig('abc').ok).toBe(false);
  });
});

describe('kiểu dữ liệu', () => {
  it('GameConfig trả về đúng hình dạng', () => {
    const result = validateGameConfig(freshRaw());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const config: GameConfig = result.config;
      expect(Object.keys(config).sort()).toEqual(
        ['effects', 'evolution', 'heroes', 'manifest', 'rules', 'skills', 'taxonomy'],
      );
    }
  });
});
