import type { DistrictNode, GameState, Squad, Unit, UnitRole } from './types';
import { createDistrict } from '../map/district';

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
    squadId,
    alive: true,
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
  rival: { hp: 20, speed: 6 },
};

export function createPlayerSquad(nodeId: string): Squad {
  const squadId = 'player';
  return {
    id: squadId,
    nameKey: 'squad.player',
    nodeId,
    power: 0,
    controlledPois: [],
    isPlayer: true,
    eliminated: false,
    policeBuff: false,
    members: [
      createUnit('athlete', squadId, 'front', 'unit.athlete'),
      createUnit('criminal', squadId, 'front', 'unit.criminal'),
      createUnit('medic', squadId, 'back', 'unit.medic'),
    ],
  };
}

export function createRivalSquad(id: string, nameKey: string, nodeId: string): Squad {
  return {
    id,
    nameKey,
    nodeId,
    power: 0,
    controlledPois: [],
    isPlayer: false,
    eliminated: false,
    policeBuff: false,
    members: [
      createUnit('rival', id, 'front', 'unit.rivalA'),
      createUnit('rival', id, 'front', 'unit.rivalB'),
      createUnit('rival', id, 'back', 'unit.rivalC'),
    ],
  };
}

export function createZombiePack(nodeId: string, roles: UnitRole[]): { nodeId: string; units: Unit[] } {
  const squadId = `zombies_${nodeId}`;
  return {
    nodeId,
    units: roles.map((role, i) =>
      createUnit(role, squadId, i < 2 ? 'front' : 'back', `unit.${role}`),
    ),
  };
}

export function createInitialState(lang: 'en' | 'es' = 'en'): GameState {
  const district = createDistrict();
  const startNode = district.find((n) => n.id === 'plaza_saavedra') ?? district[0];
  const rival1Node = district.find((n) => n.id === 'parque_saavedra') ?? district[1];
  const rival2Node = district.find((n) => n.id === 'cabildo_arias') ?? district[2];

  const squads: Squad[] = [
    createPlayerSquad(startNode.id),
    createRivalSquad('rival_1', 'squad.rival1', rival1Node.id),
    createRivalSquad('rival_2', 'squad.rival2', rival2Node.id),
  ];

  const poiOwners: Record<string, string | null> = {};
  for (const node of district) {
    if (node.poi) poiOwners[node.id] = null;
  }

  return {
    phase: 'title',
    lang,
    phaseNumber: 1,
    district,
    squads,
    zombiePacks: [
      createZombiePack('dot_baires', ['shambler', 'screamer']),
      createZombiePack('estacion_belgrano_r', ['ripper', 'shambler']),
      createZombiePack('roosevelt_garcia_del_rio', ['shambler']),
    ],
    poiOwners,
    hoveredNodeId: null,
    combat: null,
    tutorialStep: 0,
    message: '',
  };
}

export function getNode(state: GameState, nodeId: string): DistrictNode {
  const node = state.district.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  return node;
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

export function recalcPower(
  squad: Squad,
  district: DistrictNode[],
  poiOwners: Record<string, string | null>,
): void {
  squad.power = 0;
  squad.controlledPois = [];
  squad.policeBuff = false;

  for (const node of district) {
    if (!node.poi) continue;
    if (poiOwners[node.id] !== squad.id) continue;
    squad.controlledPois.push(node.id);
    if (node.poi === 'mall') squad.power += 2;
    else squad.power += 1;
    if (node.poi === 'police') squad.policeBuff = true;
  }
}

export function applyPowerBonuses(squad: Squad, _unit: Unit): { maxHpBonus: number; damageMult: number } {
  const maxHpBonus = squad.power * 2;
  const damageMult = 1 + squad.power * 0.05;
  return { maxHpBonus, damageMult };
}

export function refreshSquadHpFromPower(squad: Squad): void {
  for (const member of squad.members) {
    if (!member.alive) continue;
    const { maxHpBonus } = applyPowerBonuses(squad, member);
    const baseMax = UNIT_STATS[member.role].hp;
    member.maxHp = baseMax + maxHpBonus;
    member.hp = Math.min(member.hp, member.maxHp);
  }
}

export function resetGameState(state: GameState): GameState {
  const fresh = createInitialState(state.lang);
  fresh.phase = 'tutorial';
  fresh.tutorialStep = 0;
  return fresh;
}
