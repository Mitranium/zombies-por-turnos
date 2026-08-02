import type { PlayerProfile } from './progression';

export type Lang = 'en' | 'es';

export type GamePhase =
  | 'title'
  | 'squad'
  | 'wiki'
  | 'deployment'
  | 'combat'
  | 'roundbreak'
  | 'gameover';

export type UnitRole =
  | 'athlete'
  | 'medic'
  | 'criminal'
  | 'shambler'
  | 'screamer'
  | 'ripper';

export type Rank = 'front' | 'back';

export interface Unit {
  id: string;
  nameKey: string;
  role: UnitRole;
  hp: number;
  maxHp: number;
  speed: number;
  rank: Rank;
  gridCol: number;
  gridRow: number;
  squadId: string;
  alive: boolean;
  basicAttacks: number;
}

export interface DeploymentState {
  units: Unit[];
  selectedUnitId: string | null;
}

export interface Squad {
  id: string;
  nameKey: string;
  members: Unit[];
  isPlayer: boolean;
}

export interface CombatState {
  playerUnits: Unit[];
  enemyUnits: Unit[];
  turnOrder: Unit[];
  turnIndex: number;
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
  squads: Squad[];
  combat: CombatState | null;
  deployment: DeploymentState | null;
  profile: PlayerProfile;
  runXpGained: number;
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
