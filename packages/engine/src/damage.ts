import type { Element, Rules } from '@gacha/shared';

/** Hệ số khắc hệ e (phụ lục A): khắc 1.10, bị khắc 0.90, Quang đánh Ám và Ám đánh Quang 1.15, còn lại 1.00. */
export function elementMultiplier(attacker: Element, defender: Element, damage: Rules['damage']): number {
  if ((attacker === 'light' && defender === 'dark') || (attacker === 'dark' && defender === 'light')) {
    return damage.lightDarkMultiplier;
  }
  if (attacker === 'light' || attacker === 'dark' || defender === 'light' || defender === 'dark') return 1;
  if (damage.elementBeats[attacker] === defender) return damage.elementAdvantage;
  if (damage.elementBeats[defender] === attacker) return damage.elementDisadvantage;
  return 1;
}

export interface DamageInput {
  atk: number;
  /** Hệ số kỹ năng s (2.0 = 200% ATK). */
  skillCoef: number;
  def: number;
  /** Xuyên giáp p của bên tấn công, kẹp vào [0, 1]. */
  penetration: number;
  damageBonus: number;
  element: number;
  /** Giảm sát thương r của mục tiêu, kẹp vào [0, 1]. */
  damageReduction: number;
  crit: boolean;
  critDamage: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * DMG = ATK · s · ATK / (ATK + k·DEF·(1−p)) · (1+b) · e · (1−r) · c      (phụ lục A)
 * Làm tròn một lần ở cuối, tối thiểu `minDamage`.
 */
export function computeDamage(input: DamageInput, damage: Rules['damage']): number {
  const atk = Math.max(0, input.atk);
  const effectiveDef = Math.max(0, input.def) * (1 - clamp01(input.penetration));
  const denominator = atk + damage.defenseConstant * effectiveDef;
  const defenseFactor = denominator > 0 ? atk / denominator : 0;
  const raw =
    atk *
    input.skillCoef *
    defenseFactor *
    (1 + input.damageBonus) *
    input.element *
    (1 - clamp01(input.damageReduction)) *
    (input.crit ? 1 + input.critDamage : 1);
  return Math.max(damage.minDamage, Math.round(raw));
}
