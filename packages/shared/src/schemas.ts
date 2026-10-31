import { z } from 'zod';
import {
  BASE_ELEMENTS,
  EFFECT_KINDS,
  ELEMENTS,
  HOOKS,
  MAX_STAR,
  RARITIES,
  SKILL_KINDS,
  STAT_KEYS,
  TARGET_RULES,
} from './constants';

/**
 * Schema Zod cho các file trong /config. Mọi object đều strict: gõ sai tên trường là báo lỗi ngay.
 * Các kiểm tra tham chiếu chéo giữa file (hero -> skill -> effect...) nằm ở config.ts.
 */

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'id phải là snake_case ASCII, bắt đầu bằng chữ thường');
const name = z.string().min(1);
const fraction = z.number().min(0).max(1);
const posInt = z.number().int().min(1);
const nonNegInt = z.number().int().min(0);
const star = z.number().int().min(1).max(MAX_STAR);

/**
 * Trạng thái của từng file cấu hình:
 * - placeholder: số liệu/tên do mình điền tạm để dựng khung, KHÔNG phải quyết định thiết kế.
 * - draft: đề xuất đã có (ví dụ phụ lục A, B), chờ bạn duyệt.
 * - final: đã chốt.
 */
export const statusSchema = z.enum(['placeholder', 'draft', 'final']);
export type ConfigStatus = z.infer<typeof statusSchema>;

export const elementSchema = z.enum(ELEMENTS);
export const raritySchema = z.enum(RARITIES);
export const statKeySchema = z.enum(STAT_KEYS);

// ---------------------------------------------------------------- manifest

export const manifestSchema = z.strictObject({
  /** Số phiên bản của cả bộ cấu hình; được lưu cùng hồ sơ trận để phát lại đúng bản. */
  configVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'configVersion phải có dạng x.y.z'),
  schemaVersion: z.literal(1),
});

// ---------------------------------------------------------------- taxonomy

const labelled = z.strictObject({ id, name });

export const taxonomySchema = z.strictObject({
  status: statusSchema,
  roles: z.array(labelled).length(5, 'Tài liệu thiết kế có đúng 5 vai trò'),
  weaponTypes: z.array(labelled).min(1),
});

// ---------------------------------------------------------------- rules

const levelStageSchema = z.strictObject({
  fromLevel: posInt,
  toLevel: posInt,
  /** k_i trong công thức chỉ số theo cấp. */
  multiplier: z.number().positive(),
});

export const rulesSchema = z
  .strictObject({
    status: statusSchema,
    battle: z.strictObject({
      maxRounds: posInt,
      maxTeamSize: posInt,
      grid: z.strictObject({ rows: posInt, cols: posInt }),
    }),
    damage: z.strictObject({
      /** k trong phụ lục A. */
      defenseConstant: z.number().positive(),
      baseCritRate: fraction,
      /** +0.5 nghĩa là chí mạng nhân 1.5. */
      baseCritDamage: z.number().min(0),
      minDamage: posInt,
      elementAdvantage: z.number().positive(),
      elementDisadvantage: z.number().positive(),
      lightDarkMultiplier: z.number().positive(),
      /** Mỗi hệ cơ bản khắc đúng một hệ cơ bản khác (giá trị = hệ bị khắc). */
      elementBeats: z.strictObject({
        fire: z.enum(BASE_ELEMENTS),
        water: z.enum(BASE_ELEMENTS),
        wind: z.enum(BASE_ELEMENTS),
        lightning: z.enum(BASE_ELEMENTS),
      }),
      /** null = chưa đặt giới hạn trên (quyết định ngày 2026-10-31). */
      caps: z.strictObject({
        critRate: z.number().positive().nullable(),
        evasion: z.number().positive().nullable(),
        effectAccuracy: z.number().positive().nullable(),
      }),
    }),
    energy: z.strictObject({
      /** Đầy năng lượng thì tung tuyệt kỹ. */
      max: posInt,
    }),
    levelCurve: z.strictObject({
      stages: z.array(levelStageSchema).min(1),
    }),
    /** Số kỹ năng tối đa của một nhân vật theo bậc hiếm (UR có thêm kỹ năng bị động #5). */
    heroSkillSlots: z.strictObject({
      A: posInt,
      S: posInt,
      SS: posInt,
      UR: posInt,
    }),
    economy: z.strictObject({
      /** 0.8 = hoàn 80% nguyên liệu khi hoàn trả nhân vật. */
      refundRate: fraction,
    }),
  })
  .superRefine((rules, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    // Đường cong cấp: các giai đoạn phải liền nhau, bắt đầu từ cấp 1.
    let expectedFrom = 1;
    rules.levelCurve.stages.forEach((stage, i) => {
      if (stage.fromLevel !== expectedFrom) {
        issue(
          ['levelCurve', 'stages', i, 'fromLevel'],
          `giai đoạn ${i + 1} phải bắt đầu ở cấp ${expectedFrom}, hiện là ${stage.fromLevel}`,
        );
      }
      if (stage.toLevel < stage.fromLevel) {
        issue(['levelCurve', 'stages', i, 'toLevel'], `giai đoạn ${i + 1} có toLevel nhỏ hơn fromLevel`);
      }
      expectedFrom = stage.toLevel + 1;
    });

    // Vòng khắc hệ: không tự khắc, không khắc lẫn nhau, mỗi hệ bị đúng một hệ khác khắc.
    const beats = rules.damage.elementBeats;
    const beaten = new Set<string>();
    for (const el of BASE_ELEMENTS) {
      const target = beats[el];
      if (target === el) {
        issue(['damage', 'elementBeats', el], `${el} không thể khắc chính nó`);
      } else if (beats[target] === el) {
        issue(['damage', 'elementBeats', el], `${el} và ${target} khắc lẫn nhau`);
      }
      if (beaten.has(target)) {
        issue(['damage', 'elementBeats', el], `${target} bị hơn một hệ cơ bản khắc`);
      }
      beaten.add(target);
    }
  });

// ---------------------------------------------------------------- effects

export const effectSchema = z
  .strictObject({
    id,
    name,
    kind: z.enum(EFFECT_KINDS),
    /** Số lượt kéo dài; hồi máu tức thời có duration 0. */
    duration: nonNegInt,
    /**
     * Giá trị là phân số (0.3 = 30%). Với shield/heal/dot nhân với `scaling`;
     * với buff/debuff là hệ số cộng thêm lên `stat`. Cách cộng dồn chi tiết chốt ở Giai đoạn 1.
     */
    value: z.number().min(0).optional(),
    stat: statKeySchema.optional(),
    scaling: z.enum(['casterAtk', 'targetMaxHp']).optional(),
    /** Xác suất gốc (0 đến 1) trước khi tính Chính xác và Kháng hiệu ứng. */
    chance: fraction,
  })
  .superRefine((e, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    switch (e.kind) {
      case 'stun':
      case 'silence':
        if (e.duration < 1) issue('duration', `${e.kind} phải kéo dài ít nhất 1 lượt`);
        break;
      case 'heal':
        if (e.duration !== 0) issue('duration', 'heal là tức thời, duration phải bằng 0');
        break;
      case 'shield':
      case 'dot':
      case 'buff':
      case 'debuff':
        if (e.duration < 1) issue('duration', `${e.kind} phải kéo dài ít nhất 1 lượt`);
        break;
    }
    if (['heal', 'shield', 'dot', 'buff', 'debuff'].includes(e.kind) && !(e.value && e.value > 0)) {
      issue('value', `${e.kind} cần value lớn hơn 0`);
    }
    if (['heal', 'shield', 'dot'].includes(e.kind) && !e.scaling) {
      issue('scaling', `${e.kind} cần scaling (casterAtk hoặc targetMaxHp)`);
    }
    if (['buff', 'debuff'].includes(e.kind) && !e.stat) {
      issue('stat', `${e.kind} cần stat để biết chỉ số nào bị thay đổi`);
    }
  });

export const effectsFileSchema = z.strictObject({
  status: statusSchema,
  effects: z.array(effectSchema).min(1),
});

// ---------------------------------------------------------------- skills

const groupTargeting = z.strictObject({
  side: z.enum(['enemy', 'ally']),
  rule: z.enum(TARGET_RULES),
  /** Số mục tiêu tối đa; với front_row, column, all là số mục tiêu tối đa trong nhóm đó. */
  count: z.number().int().min(1).max(5),
});
const selfTargeting = z.strictObject({ side: z.literal('self') });
export const targetingSchema = z.discriminatedUnion('side', [groupTargeting, selfTargeting]);

export const skillSchema = z
  .strictObject({
    id,
    name,
    kind: z.enum(SKILL_KINDS),
    targeting: targetingSchema,
    /** Hệ số kỹ năng s trong công thức sát thương (2.0 = 200% ATK); 0 = không gây sát thương. */
    damageCoef: z.number().min(0),
    /** id hiệu ứng áp lên mục tiêu của kỹ năng. */
    effects: z.array(id),
    /** Năng lượng nhận được khi dùng (chỉ đánh thường). Tuyệt kỹ tiêu hao toàn bộ năng lượng. */
    energyGain: nonNegInt,
    /** Bậc ★ mở khóa kỹ năng; UR có bị động #5 mở ở ★15. */
    unlockStar: star,
    /** Chỉ dành cho kỹ năng bị động. */
    trigger: z.enum(HOOKS).optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (s.kind === 'passive' && !s.trigger) issue('trigger', 'kỹ năng bị động phải có trigger');
    if (s.kind !== 'passive' && s.trigger) issue('trigger', 'trigger chỉ dùng cho kỹ năng bị động');
    if (s.kind !== 'basic' && s.energyGain !== 0) issue('energyGain', 'energyGain chỉ dành cho kỹ năng thường');
    if (s.damageCoef === 0 && s.effects.length === 0) {
      issue('damageCoef', 'kỹ năng phải có damageCoef lớn hơn 0 hoặc ít nhất một hiệu ứng');
    }
  });

export const skillsFileSchema = z.strictObject({
  status: statusSchema,
  skills: z.array(skillSchema).min(1),
});

// ---------------------------------------------------------------- heroes

/** T(L) = a + b * sum(k_i * n_i(L)); xem công thức ở mục 5 của tài liệu thiết kế. */
const statCurve = z.strictObject({ a: z.number().positive(), b: z.number().min(0) });

export const heroSchema = z
  .strictObject({
    id,
    name,
    element: elementSchema,
    role: id,
    rarity: raritySchema,
    weaponType: id,
    stats: z.strictObject({
      atk: statCurve,
      def: statCurve,
      hp: statCurve,
      spd: statCurve,
    }),
    /** Danh sách id kỹ năng của nhân vật. */
    skills: z.array(id).min(2),
    /** id vũ khí Trấn (chỉ UR; mẫu vũ khí thêm ở Giai đoạn 4). */
    signatureWeaponId: id.optional(),
  })
  .superRefine((h, ctx) => {
    if (new Set(h.skills).size !== h.skills.length) {
      ctx.addIssue({ code: 'custom', path: ['skills'], message: 'danh sách kỹ năng có id bị lặp' });
    }
    if (h.signatureWeaponId && h.rarity !== 'UR') {
      ctx.addIssue({ code: 'custom', path: ['signatureWeaponId'], message: 'chỉ nhân vật UR có vũ khí Trấn' });
    }
  });

export const heroesFileSchema = z.strictObject({
  status: statusSchema,
  heroes: z.array(heroSchema).min(1),
});

// ---------------------------------------------------------------- evolution

export const evolutionStepSchema = z.strictObject({
  star,
  /** Cấp tối đa khi đạt bậc ★ này. */
  maxLevel: posInt,
  /** Nguyên liệu để lên bậc ★ này (★1 là bậc khởi đầu nên chi phí bằng 0). */
  cost: z.strictObject({
    /** Số bản sao của chính nhân vật. */
    copies: nonNegInt,
    /** Xác theo sao. Ràng buộc "cùng hệ hoặc xác vạn năng" kiểm tra ở server (Giai đoạn 2). */
    fodder: z.array(z.strictObject({ star, count: posInt })),
    awakeningStone: nonNegInt,
    bloodCrystal: nonNegInt,
    timeStone: nonNegInt,
  }),
});

export const evolutionFileSchema = z.strictObject({
  status: statusSchema,
  steps: z.array(evolutionStepSchema).min(1),
});

// ---------------------------------------------------------------- tổng hợp

export const configSectionSchemas = {
  manifest: manifestSchema,
  taxonomy: taxonomySchema,
  rules: rulesSchema,
  effects: effectsFileSchema,
  skills: skillsFileSchema,
  heroes: heroesFileSchema,
  evolution: evolutionFileSchema,
} as const;

export type ConfigSectionName = keyof typeof configSectionSchemas;
export type Manifest = z.infer<typeof manifestSchema>;
export type Taxonomy = z.infer<typeof taxonomySchema>;
export type Rules = z.infer<typeof rulesSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type EffectsFile = z.infer<typeof effectsFileSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillsFile = z.infer<typeof skillsFileSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type HeroesFile = z.infer<typeof heroesFileSchema>;
export type EvolutionStep = z.infer<typeof evolutionStepSchema>;
export type EvolutionFile = z.infer<typeof evolutionFileSchema>;
