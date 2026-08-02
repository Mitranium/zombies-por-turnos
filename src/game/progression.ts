import type { UnitRole } from './types';

export type PlayerRole = 'athlete' | 'medic' | 'criminal';

export interface PlayerProfile {
  xp: number;
  levels: Record<PlayerRole, number>;
  bestRound: number;
  totalKills: number;
}

const STORAGE_KEY = 'zpt-profile';
export const MAX_LEVEL = 5;
const BASE_LEVEL = 1;

const XP_BY_ENEMY: Partial<Record<UnitRole, number>> = {
  shambler: 1,
  screamer: 2,
  ripper: 3,
};

export const PLAYER_ROLES: PlayerRole[] = ['athlete', 'criminal', 'medic'];

export type EnemyRole = 'shambler' | 'screamer' | 'ripper';

export const ENEMY_ROLES: EnemyRole[] = ['shambler', 'screamer', 'ripper'];

export function createDefaultProfile(): PlayerProfile {
  return {
    xp: 0,
    levels: { athlete: BASE_LEVEL, medic: BASE_LEVEL, criminal: BASE_LEVEL },
    bestRound: 0,
    totalKills: 0,
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const defaults = createDefaultProfile();
    return {
      xp: parsed.xp ?? defaults.xp,
      levels: { ...defaults.levels, ...parsed.levels },
      bestRound: parsed.bestRound ?? defaults.bestRound,
      totalKills: parsed.totalKills ?? defaults.totalKills,
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function xpForKill(role: UnitRole): number {
  return XP_BY_ENEMY[role] ?? 0;
}

export function isEnemyRole(role: UnitRole): boolean {
  return role === 'shambler' || role === 'screamer' || role === 'ripper';
}

export function awardKillXp(profile: PlayerProfile, role: UnitRole): number {
  const gained = xpForKill(role);
  if (gained <= 0) return 0;
  profile.xp += gained;
  profile.totalKills += 1;
  saveProfile(profile);
  return gained;
}

export function levelUpCost(level: number): number {
  return 10 * level;
}

export function canLevelUp(profile: PlayerProfile, role: PlayerRole): boolean {
  const level = profile.levels[role];
  if (level >= MAX_LEVEL) return false;
  return profile.xp >= levelUpCost(level);
}

export function levelUp(profile: PlayerProfile, role: PlayerRole): boolean {
  if (!canLevelUp(profile, role)) return false;
  const cost = levelUpCost(profile.levels[role]);
  profile.xp -= cost;
  profile.levels[role] += 1;
  saveProfile(profile);
  return true;
}

export function getLevelBonuses(level: number): { maxHpBonus: number; speedBonus: number } {
  const steps = Math.max(0, level - BASE_LEVEL);
  return { maxHpBonus: steps * 2, speedBonus: steps };
}

export function isPlayerRole(role: UnitRole): role is PlayerRole {
  return PLAYER_ROLES.includes(role as PlayerRole);
}
