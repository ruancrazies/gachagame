import { MAX_STAR } from './constants';
import {
  configSectionSchemas,
  type ConfigSectionName,
  type EffectsFile,
  type EvolutionFile,
  type HeroesFile,
  type Manifest,
  type Rules,
  type SkillsFile,
  type Taxonomy,
} from './schemas';

export interface GameConfig {
  manifest: Manifest;
  taxonomy: Taxonomy;
  rules: Rules;
  effects: EffectsFile;
  skills: SkillsFile;
  heroes: HeroesFile;
  evolution: EvolutionFile;
}

export type ConfigValidationResult =
  | { ok: true; config: GameConfig; warnings: string[] }
  | { ok: false; errors: string[] };

/** Thứ tự các phần cấu hình (cũng là tên file: <phần>.json). */
export const CONFIG_SECTIONS = Object.keys(configSectionSchemas) as ConfigSectionName[];

/**
 * Kiểm tra toàn bộ cấu hình: schema từng file rồi tham chiếu chéo giữa các file.
 * Trả về danh sách lỗi (tiếng Việt, có đường dẫn) thay vì ném lỗi, để công cụ báo hết một lượt.
 * Cảnh báo (warnings) liệt kê các phần chưa ở trạng thái `final`.
 */
export function validateGameConfig(raw: unknown): ConfigValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Cấu hình phải là một object gồm các phần: ' + CONFIG_SECTIONS.join(', ')] };
  }
  const input = raw as Record<string, unknown>;

  const errors: string[] = [];
  const parsed: Record<string, unknown> = {};
  for (const section of CONFIG_SECTIONS) {
    if (!(section in input)) {
      errors.push(`${section}: thiếu phần cấu hình này`);
      continue;
    }
    const result = configSectionSchemas[section].safeParse(input[section]);
    if (result.success) {
      parsed[section] = result.data;
    } else {
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(gốc)';
        errors.push(`${section}: ${path} — ${issue.message}`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const config = parsed as unknown as GameConfig;
  const crossErrors = checkReferences(config);
  if (crossErrors.length > 0) return { ok: false, errors: crossErrors };

  return { ok: true, config, warnings: collectWarnings(config) };
}

function collectWarnings(config: GameConfig): string[] {
  const warnings: string[] = [];
  for (const section of ['taxonomy', 'rules', 'effects', 'skills', 'heroes', 'evolution'] as const) {
    const status = config[section].status;
    if (status === 'placeholder') {
      warnings.push(`${section}: đang là placeholder (số liệu điền tạm, chưa phải quyết định thiết kế)`);
    } else if (status === 'draft') {
      warnings.push(`${section}: đang là draft (đề xuất, chờ duyệt)`);
    }
  }
  return warnings;
}

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}

function checkReferences(config: GameConfig): string[] {
  const errors: string[] = [];
  const { taxonomy, rules, effects, skills, heroes, evolution } = config;

  // id duy nhất trong từng danh sách
  const uniqueChecks: Array<[string, string[]]> = [
    ['taxonomy.roles', taxonomy.roles.map((r) => r.id)],
    ['taxonomy.weaponTypes', taxonomy.weaponTypes.map((w) => w.id)],
    ['effects', effects.effects.map((e) => e.id)],
    ['skills', skills.skills.map((s) => s.id)],
    ['heroes', heroes.heroes.map((h) => h.id)],
  ];
  for (const [label, ids] of uniqueChecks) {
    for (const dup of findDuplicates(ids)) errors.push(`${label}: id "${dup}" bị trùng`);
  }

  const roleIds = new Set(taxonomy.roles.map((r) => r.id));
  const weaponIds = new Set(taxonomy.weaponTypes.map((w) => w.id));
  const effectIds = new Set(effects.effects.map((e) => e.id));
  const skillById = new Map(skills.skills.map((s) => [s.id, s]));

  for (const skill of skills.skills) {
    for (const effectId of skill.effects) {
      if (!effectIds.has(effectId)) {
        errors.push(`skills.${skill.id}: hiệu ứng "${effectId}" không tồn tại trong effects`);
      }
    }
  }

  for (const hero of heroes.heroes) {
    const where = `heroes.${hero.id}`;
    if (!roleIds.has(hero.role)) errors.push(`${where}: role "${hero.role}" không có trong taxonomy.roles`);
    if (!weaponIds.has(hero.weaponType)) {
      errors.push(`${where}: weaponType "${hero.weaponType}" không có trong taxonomy.weaponTypes`);
    }

    const kinds = { basic: 0, ultimate: 0, passive: 0 };
    for (const skillId of hero.skills) {
      const skill = skillById.get(skillId);
      if (!skill) {
        errors.push(`${where}: kỹ năng "${skillId}" không tồn tại trong skills`);
        continue;
      }
      kinds[skill.kind] += 1;
    }
    if (kinds.basic !== 1) errors.push(`${where}: phải có đúng 1 kỹ năng thường (basic), hiện có ${kinds.basic}`);
    if (kinds.ultimate !== 1) errors.push(`${where}: phải có đúng 1 tuyệt kỹ (ultimate), hiện có ${kinds.ultimate}`);

    const maxSkills = rules.heroSkillSlots[hero.rarity];
    if (hero.skills.length > maxSkills) {
      errors.push(
        `${where}: có ${hero.skills.length} kỹ năng, vượt giới hạn ${maxSkills} của bậc ${hero.rarity} (rules.heroSkillSlots)`,
      );
    }
  }

  // bảng tiến hóa: đủ ★1..★20, mỗi bậc một dòng, cấp tối đa không giảm và không vượt đường cong cấp
  const curveEnd = rules.levelCurve.stages[rules.levelCurve.stages.length - 1]?.toLevel ?? 0;
  const stepByStar = new Map<number, (typeof evolution.steps)[number]>();
  for (const step of evolution.steps) {
    if (stepByStar.has(step.star)) errors.push(`evolution: ★${step.star} bị lặp`);
    stepByStar.set(step.star, step);
  }
  let previousMax = 0;
  for (let s = 1; s <= MAX_STAR; s++) {
    const step = stepByStar.get(s);
    if (!step) {
      errors.push(`evolution: thiếu ★${s}`);
      continue;
    }
    if (step.maxLevel < previousMax) {
      errors.push(`evolution: ★${s} có cấp tối đa ${step.maxLevel} thấp hơn ★${s - 1} (${previousMax})`);
    }
    if (step.maxLevel > curveEnd) {
      errors.push(`evolution: ★${s} có cấp tối đa ${step.maxLevel} vượt cấp cuối của rules.levelCurve (${curveEnd})`);
    }
    previousMax = step.maxLevel;
  }

  return errors;
}
