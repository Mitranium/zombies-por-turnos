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
  log: CombatLogEntry[];
  selectedAction: 'attack' | 'special' | null;
  lastRoll: { attackerId: string; targetId: string; roll: DiceRollResult; damage: number; crit?: boolean } | null;
}

/**
 * A log line kept as data (translation key + params) so it can be re-rendered
 * in the current language. A `{ nameKey }` param resolves to a unit name.
 */
export interface CombatLogEntry {
  key: string;
  params?: Record<string, LogParamValue>;
}

export type LogParamValue = string | number | { nameKey: string };

export interface GameState {
  phase: GamePhase;
  lang: Lang;
  phaseNumber: number;
  squads: Squad[];
  combat: CombatState | null;
  deployment: DeploymentState | null;
  profile: PlayerProfile;
  runXpGained: number;
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
  crit?: boolean;
  diceRoll?: DiceRollResult;
  logKey: string;
  logParams?: Record<string, string | number>;
}
