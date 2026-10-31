/**
 * Hằng số cố định của luật game (đã chốt trong tài liệu thiết kế).
 * Mọi con số có thể cân bằng được nằm trong /config, không nằm ở đây.
 */

/** 6 hệ. Khóa dùng trong code và cấu hình; tên hiển thị ở ELEMENT_LABELS_VI. */
export const ELEMENTS = ['fire', 'water', 'wind', 'lightning', 'light', 'dark'] as const;
export type Element = (typeof ELEMENTS)[number];

/** Bốn hệ cơ bản khắc nhau theo vòng; Quang và Ám khắc lẫn nhau (+15%). */
export const BASE_ELEMENTS = ['fire', 'water', 'wind', 'lightning'] as const;
export type BaseElement = (typeof BASE_ELEMENTS)[number];

export const ELEMENT_LABELS_VI: Record<Element, string> = {
  fire: 'Hỏa',
  water: 'Thủy',
  wind: 'Phong',
  lightning: 'Lôi',
  light: 'Quang',
  dark: 'Ám',
};

/** 4 bậc hiếm (đã chốt: A, S, SS, UR). */
export const RARITIES = ['A', 'S', 'SS', 'UR'] as const;
export type Rarity = (typeof RARITIES)[number];

/** Chỉ số cơ bản; mỗi nhân vật có hai tham số a (gốc) và b (hệ số tăng) cho từng chỉ số. */
export const BASE_STATS = ['atk', 'def', 'hp', 'spd'] as const;
export type BaseStat = (typeof BASE_STATS)[number];

/**
 * Chỉ số phụ. Đây cũng chính là pool 10 loại sub-stat của phụ kiện
 * (Crit Rate, Crit DMG, Damage Bonus, Healing Bonus, Xuyên giáp, Né tránh,
 * Kháng hiệu ứng, Chính xác, Hút máu, Giảm sát thương).
 */
export const SECONDARY_STATS = [
  'critRate',
  'critDamage',
  'damageBonus',
  'healingBonus',
  'penetration', // "Xuyên giáp": khóa duy nhất theo quyết định ngày 2026-10-31
  'evasion',
  'effectResistance',
  'effectAccuracy',
  'lifesteal',
  'damageReduction',
] as const;
export type SecondaryStat = (typeof SECONDARY_STATS)[number];

export const STAT_KEYS = [...BASE_STATS, ...SECONDARY_STATS] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Tiến hóa ★1 đến ★20. */
export const MAX_STAR = 20;

/** Hiệu ứng trạng thái. Thêm loại mới = thêm bộ xử lý trong engine (Giai đoạn 1). */
export const EFFECT_KINDS = ['stun', 'silence', 'shield', 'heal', 'buff', 'debuff', 'dot'] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const SKILL_KINDS = ['basic', 'ultimate', 'passive'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

/** Luật chọn mục tiêu dưới dạng dữ liệu (xem Giai đoạn 1; "lowest_hp" và "all" được thêm cho kỹ năng hồi máu và đánh diện rộng). */
export const TARGET_RULES = [
  'highest_hp',
  'highest_atk',
  'lowest_hp',
  'front_row',
  'center',
  'column',
  'random',
  'all',
] as const;
export type TargetRule = (typeof TARGET_RULES)[number];

/** Điểm móc để kỹ năng bị động (và sau này ấn, linh thú) can thiệp vào trận. */
export const HOOKS = ['turn_start', 'before_damage', 'after_damage', 'on_death', 'round_end'] as const;
export type Hook = (typeof HOOKS)[number];
