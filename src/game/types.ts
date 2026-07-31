export type Lang = 'en' | 'es';

export type GamePhase =
  | 'title'
  | 'tutorial'
  | 'move'
  | 'resolve'
  | 'combat'
  | 'gameover'
  | 'victory';

export type PoiType = 'mall' | 'hospital' | 'police' | null;

export type UnitRole =
  | 'athlete'
  | 'medic'
  | 'criminal'
  | 'shambler'
  | 'screamer'
  | 'ripper'
  | 'rival';

export type Rank = 'front' | 'back';

export interface DistrictNode {
  id: string;
  labelKey: string;
  label?: { en: string; es: string };
  x: number;
  z: number;
  poi: PoiType;
  neighbors: string[];
}

export interface LandmarkPoi {
  id: string;
  name: string;
  category: string;
  x: number;
  z: number;
}

export interface SaavedraMapData {
  meta: {
    name: string;
    center: [number, number];
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  };
  boundary: [number, number][];
  streetLines: [number, number][][];
  nodes: DistrictNode[];
  landmarks: LandmarkPoi[];
}

export interface Unit {
  id: string;
  nameKey: string;
  role: UnitRole;
  hp: number;
  maxHp: number;
  speed: number;
  rank: Rank;
  squadId: string;
  alive: boolean;
}

export interface Squad {
  id: string;
  nameKey: string;
  nodeId: string;
  power: number;
  controlledPois: string[];
  members: Unit[];
  isPlayer: boolean;
  eliminated: boolean;
  policeBuff: boolean;
}

export interface ZombiePack {
  nodeId: string;
  units: Unit[];
}

export interface CombatState {
  playerUnits: Unit[];
  enemyUnits: Unit[];
  turnOrder: Unit[];
  turnIndex: number;
  encounterType: 'zombies' | 'rival';
  rivalSquadId: string | null;
  log: string[];
  selectedAction: 'attack' | 'special' | null;
  selectedTargetId: string | null;
  pendingPlayerUnitId: string | null;
  lastRoll: { attackerId: string; targetId: string; roll: DiceRollResult; damage: number } | null;
}

export interface GameState {
  phase: GamePhase;
  lang: Lang;
  phaseNumber: number;
  district: DistrictNode[];
  squads: Squad[];
  zombiePacks: ZombiePack[];
  poiOwners: Record<string, string | null>;
  hoveredNodeId: string | null;
  combat: CombatState | null;
  tutorialStep: number;
  message: string;
}

export interface DiceRollResult {
  rolls: number[];
  total: number;
  sides: number;
  bonus: number;
}

export interface SkillResult {
  damage?: number;
  heal?: number;
  selfDamage?: number;
  summon?: UnitRole;
  diceRoll?: DiceRollResult;
  logKey: string;
  logParams?: Record<string, string | number>;
}
