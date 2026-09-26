import type { GameState, Squad, Unit, UnitRole } from './types';
import {
  getLevelBonuses,
  isPlayerRole,
  loadProfile,
  type PlayerProfile,
} from './progression';

let idCounter = 0;

export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function createUnit(
  role: UnitRole,
  squadId: string,
  rank: 'front' | 'back',
  nameKey: string,
  overrides?: Partial<Unit>,
): Unit {
  const base = UNIT_STATS[role];
  return {
    id: uid(role),
    nameKey,
    role,
    hp: base.hp,
    maxHp: base.hp,
    speed: base.speed,
    rank,
    gridCol: -1,
    gridRow: -1,
    squadId,
    alive: true,
    basicAttacks: 0,
    ...overrides,
  };
}

const UNIT_STATS: Record<UnitRole, { hp: number; speed: number }> = {
  athlete: { hp: 28, speed: 6 },
  medic: { hp: 20, speed: 5 },
  criminal: { hp: 22, speed: 7 },
  shambler: { hp: 24, speed: 3 },
  screamer: { hp: 14, speed: 5 },
  ripper: { hp: 18, speed: 8 },
};

export function getBaseUnitStats(role: UnitRole): { hp: number; speed: number } {
  return UNIT_STATS[role];
}

export function applyProfileLevelToMember(member: Unit, level: number): void {
  const base = UNIT_STATS[member.role];
  const { maxHpBonus, speedBonus } = getLevelBonuses(level);
  member.maxHp = base.hp + maxHpBonus;
  member.speed = base.speed + speedBonus;
  member.hp = Math.min(member.hp, member.maxHp);
}

export function refreshPlayerSquadLevels(squad: Squad, profile: PlayerProfile): void {
  for (const member of squad.members) {
    if (!isPlayerRole(member.role)) continue;
    applyProfileLevelToMember(member, profile.levels[member.role]);
  }
}

export function createPlayerSquad(profile?: PlayerProfile): Squad {
  const squadId = 'player';
  const squad: Squad = {
    id: squadId,
    nameKey: 'squad.player',
    isPlayer: true,
    members: [
      createUnit('athlete', squadId, 'front', 'unit.athlete'),
      createUnit('criminal', squadId, 'front', 'unit.criminal'),
      createUnit('medic', squadId, 'back', 'unit.medic'),
    ],
  };
  if (profile) refreshPlayerSquadLevels(squad, profile);
  return squad;
}

export function createInitialState(lang: 'en' | 'es' = 'en'): GameState {
  const profile = loadProfile();
  return {
    phase: 'title',
    lang,
    phaseNumber: 1,
    squads: [createPlayerSquad(profile)],
    combat: null,
    deployment: null,
    profile,
    runXpGained: 0,
  };
}

export function getSquad(state: GameState, squadId: string): Squad {
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) throw new Error(`Unknown squad: ${squadId}`);
  return squad;
}

export function getPlayerSquad(state: GameState): Squad {
  return getSquad(state, 'player');
}

export function getAliveMembers(squad: Squad): Unit[] {
  return squad.members.filter((m) => m.alive && m.hp > 0);
}
