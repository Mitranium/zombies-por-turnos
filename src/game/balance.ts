/**
 * Single source of truth for combat tuning numbers. Keeping balance out of the
 * flow logic makes waves/skills auditable and keeps the wiki text in sync.
 */

/** Basic attacks needed before a character's special is charged. */
export const SPECIAL_CHARGE_REQUIRED = 2;

/** Athlete level required to counterattack when struck. */
export const COUNTERATTACK_ATHLETE_LEVEL = 3;

// Wave composition
export const WAVE_MAX_COUNT = 8;
export const WAVE_TIER_ROUNDS = 3;
export const WAVE_HEALTH_PER_TIER = 0.18;
export const WAVE_SPEED_PER_TIER = 1;
export const WAVE_SPEED_CAP = 10;
export const SCREAMER_SUMMON_CHANCE = 0.2;

/** Round thresholds that unlock each enemy type in a wave. */
export const WAVE_SCREAMER_FROM_ROUND = 2;
export const WAVE_RIPPER_FROM_ROUND = 3;
export const WAVE_RIPPER_EXTRA_FROM_ROUND = 5;

// Skills
export const TRIAGE_HEAL_AMOUNT = 8;
export const RECKLESS_SELF_DAMAGE = 2;

/** Difficulty tier of a round (grows every WAVE_TIER_ROUNDS rounds). */
export function waveTier(round: number): number {
  return Math.floor((round - 1) / WAVE_TIER_ROUNDS);
}

export function waveHealthScale(round: number): number {
  return 1 + waveTier(round) * WAVE_HEALTH_PER_TIER;
}
