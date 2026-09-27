import type { CombatLogEntry, CombatState, GameState, LogParamValue, Rank, SkillResult, Unit, UnitRole } from './types';
import {
  COUNTERATTACK_ATHLETE_LEVEL,
  SCREAMER_SUMMON_CHANCE,
  SPECIAL_CHARGE_REQUIRED,
  WAVE_MAX_COUNT,
  WAVE_RIPPER_EXTRA_FROM_ROUND,
  WAVE_RIPPER_FROM_ROUND,
  WAVE_SCREAMER_FROM_ROUND,
  WAVE_SPEED_CAP,
  WAVE_SPEED_PER_TIER,
  waveHealthScale,
  waveTier,
} from './balance';
import {
  createInitialState,
  createUnit,
  getAliveMembers,
  getPlayerSquad,
  refreshPlayerSquadLevels,
} from './state';
import {
  cloneUnitsForCombat,
  performAttack,
  performSpecial,
  pickAiTarget,
  sortByInitiative,
  summonShambler,
  triageHeal,
} from '../combat/units';
import {
  assignRandomGridCell,
  defaultGridForRole,
  isValidGridCell,
  placeUnitsOnGrid,
  syncRankFromGrid,
} from '../combat/hexGrid';
import { playSfx } from '../audio/sfx';
import { startBgMusic } from '../audio/music';
import type { CombatScene } from '../combat/CombatScene';
import {
  awardKillXp,
  isEnemyRole,
  levelUp,
  saveProfile,
  type PlayerRole,
} from './progression';

export type GameListener = (state: GameState) => void;

type HitAnimAction = { type: 'hit' | 'heal'; attackerId: string; targetId: string; crit?: boolean };
type CounterAnimAction = {
  type: 'counter';
  attackerId: string;
  targetId: string;
  counterAttackerId: string;
  counterTargetId: string;
  crit?: boolean;
};
type AnimAction = HitAnimAction | CounterAnimAction | null;

let listener: GameListener | null = null;
let combatScene: CombatScene | null = null;

export function setCombatScene(scene: CombatScene): void {
  combatScene = scene;
}

export function setGameListener(fn: GameListener | null): void {
  listener = fn;
}

function emit(state: GameState): void {
  listener?.(state);
}

function unitRef(unit: Unit): { nameKey: string } {
  return { nameKey: unit.nameKey };
}

/** Log lines are kept as data so they can be rendered in the current language. */
function pushLog(combat: CombatState, key: string, params?: Record<string, LogParamValue>): void {
  const entry: CombatLogEntry = { key };
  if (params) entry.params = params;
  combat.log.push(entry);
}

function pushSkillLog(combat: CombatState, result: SkillResult, actor: Unit, target?: Unit): void {
  const params: Record<string, LogParamValue> = { ...result.logParams, attacker: unitRef(actor) };
  if (target) params.target = unitRef(target);
  if (result.damage !== undefined) params.amount = result.damage;
  pushLog(combat, result.logKey, params);
  if (result.selfDamage !== undefined) {
    pushLog(combat, 'log.self', { attacker: unitRef(actor), amount: result.selfDamage });
  }
}

function queueAnim(state: GameState, action: AnimAction, then: () => void): void {
  const scene = combatScene;
  if (!action || !scene) {
    then();
    return;
  }
  if (action.type === 'counter') {
    scene.playHit(action.attackerId, action.targetId, () => {
      const counterCrit = resolveCounterattack(state, action.counterAttackerId, action.counterTargetId);
      scene.playHit(action.counterAttackerId, action.counterTargetId, () => {
        emit(state);
        then();
      }, counterCrit);
      emit(state);
    }, action.crit);
    emit(state);
    return;
  }
  const done = () => {
    emit(state);
    then();
  };
  if (action.type === 'heal') scene.playHeal(action.attackerId, done);
  else scene.playHit(action.attackerId, action.targetId, done, action.crit);
  emit(state);
}

export function startGame(state: GameState): void {
  startBgMusic();
  state.phaseNumber = 1;
  state.runXpGained = 0;
  resetSquadForRound(state);
  enterDeployment(state);
}

export function openSquadMenu(state: GameState): void {
  refreshPlayerSquadLevels(getPlayerSquad(state), state.profile);
  state.phase = 'squad';
  emit(state);
}

export function closeSquadMenu(state: GameState): void {
  state.phase = 'title';
  emit(state);
}

export function openWikiMenu(state: GameState): void {
  state.phase = 'wiki';
  emit(state);
}

export function closeWikiMenu(state: GameState): void {
  state.phase = 'title';
  emit(state);
}

export function levelUpCharacter(state: GameState, role: PlayerRole): void {
  if (!levelUp(state.profile, role)) {
    playSfx('locked');
    return;
  }
  refreshPlayerSquadLevels(getPlayerSquad(state), state.profile);
  playSfx('claim');
  emit(state);
}

function tryAwardKillXp(state: GameState, enemy: Unit, wasAlive: boolean): void {
  if (!wasAlive || enemy.alive || !isEnemyRole(enemy.role) || !state.combat) return;
  const gained = awardKillXp(state.profile, enemy.role);
  if (gained <= 0) return;
  state.runXpGained += gained;
  pushLog(state.combat, 'log.xp', { amount: gained });
}

/** Bring the squad back to full strength between rounds. */
function resetSquadForRound(state: GameState): void {
  const player = getPlayerSquad(state);
  refreshPlayerSquadLevels(player, state.profile);
  for (const member of player.members) {
    member.alive = true;
    member.hp = member.maxHp;
    member.basicAttacks = 0;
  }
}

export function startNextRound(state: GameState): void {
  if (state.phase !== 'roundbreak') return;
  resetSquadForRound(state);
  state.phaseNumber += 1;
  enterDeployment(state);
}

export function enterDeployment(state: GameState): void {
  const player = getPlayerSquad(state);
  const units = cloneUnitsForCombat(getAliveMembers(player));
  const hasSavedLayout = units.length > 0 && units.every(
    (unit) => isValidGridCell(unit.gridCol, unit.gridRow),
  );

  if (hasSavedLayout) {
    for (const unit of units) syncRankFromGrid(unit);
  } else {
    placeUnitsOnGrid(units, (unit) => defaultGridForRole(unit.role));
  }

  state.deployment = {
    units,
    selectedUnitId: units[0]?.id ?? null,
  };
  state.combat = null;
  state.phase = 'deployment';
  emit(state);
}

function saveDeploymentToSquad(state: GameState, units: Unit[]): void {
  const player = getPlayerSquad(state);
  for (const unit of units) {
    const member = player.members.find((candidate) => candidate.id === unit.id);
    if (!member) continue;
    member.gridCol = unit.gridCol;
    member.gridRow = unit.gridRow;
    member.rank = unit.rank;
  }
}

export function selectDeploymentUnit(state: GameState, unitId: string): void {
  if (!state.deployment) return;
  if (!state.deployment.units.some((unit) => unit.id === unitId)) return;
  state.deployment.selectedUnitId = unitId;
  emit(state);
}

export function placeDeploymentUnit(state: GameState, col: number, row: number): void {
  if (!state.deployment) return;
  const selected = state.deployment.units.find((unit) => unit.id === state.deployment!.selectedUnitId);
  if (!selected) return;

  const occupant = state.deployment.units.find(
    (unit) => unit.id !== selected.id && unit.gridCol === col && unit.gridRow === row,
  );
  if (occupant) {
    const oldCol = selected.gridCol;
    const oldRow = selected.gridRow;
    occupant.gridCol = oldCol;
    occupant.gridRow = oldRow;
    syncRankFromGrid(occupant);
  }

  selected.gridCol = col;
  selected.gridRow = row;
  syncRankFromGrid(selected);
  emit(state);
}

export function confirmDeployment(state: GameState): void {
  if (!state.deployment) return;
  const units = state.deployment.units;
  saveDeploymentToSquad(state, units);
  state.deployment = null;
  startRound(state, units);
}

/** Default spawn cells for wave units. */
const SCREAMER_CELL = { col: 1, row: 2 };
const FRONT_CELL = { col: 1, row: 0 };

function waveRole(round: number, index: number, count: number): UnitRole {
  if (round === 1) return 'shambler';
  if (round >= WAVE_RIPPER_FROM_ROUND && index === count - 1) return 'ripper';
  if (round >= WAVE_SCREAMER_FROM_ROUND && index % 3 === 2) return 'screamer';
  if (round >= WAVE_RIPPER_EXTRA_FROM_ROUND && index % 4 === 1) return 'ripper';
  return 'shambler';
}

function buildWave(round: number): Unit[] {
  const count = Math.min(round + 1, WAVE_MAX_COUNT);
  const tier = waveTier(round);
  const squadId = `wave_${round}`;

  const units = Array.from({ length: count }, (_, index) => {
    const role = waveRole(round, index, count);
    const rank: Rank = role === 'screamer' ? 'back' : 'front';
    const unit = createUnit(role, squadId, rank, `unit.${role}`);
    unit.maxHp = Math.round(unit.maxHp * waveHealthScale(round));
    unit.hp = unit.maxHp;
    unit.speed = Math.min(WAVE_SPEED_CAP, unit.speed + tier * WAVE_SPEED_PER_TIER);
    return unit;
  });

  placeUnitsOnGrid(units, (unit) => (
    unit.role === 'screamer' ? SCREAMER_CELL : FRONT_CELL
  ));
  return units;
}

function startRound(state: GameState, deployedUnits: Unit[]): void {
  playSfx('combat');
  const playerUnits = deployedUnits.map((unit) => ({ ...unit }));

  if (!playerUnits.length) {
    state.phase = 'gameover';
    state.combat = null;
    emit(state);
    return;
  }

  const enemyUnits = buildWave(state.phaseNumber);
  state.combat = {
    playerUnits,
    enemyUnits,
    turnOrder: sortByInitiative([...playerUnits, ...enemyUnits]),
    turnIndex: 0,
    log: [],
    selectedAction: null,
    lastRoll: null,
  };
  pushLog(state.combat, 'log.roundStart', {
    round: state.phaseNumber,
    count: enemyUnits.length,
  });
  state.phase = 'combat';
  advanceCombatTurn(state);
}

function getCurrentCombatUnit(combat: CombatState): Unit | null {
  const unit = combat.turnOrder[combat.turnIndex];
  if (!unit || !unit.alive) return null;
  return unit;
}

function isPlayerUnit(unit: Unit, combat: CombatState): boolean {
  return combat.playerUnits.some((player) => player.id === unit.id && player.alive);
}

/**
 * The acting unit when it belongs to the player. Shared with the UI layer so
 * "player turn" means exactly the same thing everywhere.
 */
export function getPlayerTurnUnit(combat: CombatState): Unit | null {
  const current = getCurrentCombatUnit(combat);
  return current && isPlayerUnit(current, combat) ? current : null;
}

function syncPlayerSquadFromCombat(state: GameState): void {
  if (!state.combat) return;
  const player = getPlayerSquad(state);
  for (const unit of state.combat.playerUnits) {
    const member = player.members.find((candidate) => candidate.id === unit.id);
    if (!member) continue;
    member.hp = unit.hp;
    member.alive = unit.alive;
    member.basicAttacks = unit.basicAttacks;
  }
}

function recordDiceRoll(
  combat: CombatState,
  attackerId: string,
  targetId: string,
  result: SkillResult,
): void {
  if (result.diceRoll && result.damage !== undefined) {
    combat.lastRoll = { attackerId, targetId, roll: result.diceRoll, damage: result.damage, crit: result.crit };
    playSfx('dice');
  }
}

export function cancelCombatAction(state: GameState): void {
  if (!state.combat?.selectedAction || combatScene?.animating) return;
  state.combat.selectedAction = null;
  emit(state);
}

export function selectCombatAction(state: GameState, action: 'attack' | 'special'): void {
  if (!state.combat || combatScene?.animating) return;
  const current = getPlayerTurnUnit(state.combat);
  if (!current) return;
  if (action === 'special' && current.basicAttacks < SPECIAL_CHARGE_REQUIRED) {
    playSfx('locked');
    return;
  }
  state.combat.selectedAction = action;
  emit(state);
}

export function selectCombatTarget(state: GameState, targetId: string): void {
  if (!state.combat || !state.combat.selectedAction || combatScene?.animating) return;
  const current = getPlayerTurnUnit(state.combat);
  if (!current) return;

  const combat = state.combat;
  const enemies = combat.enemyUnits.filter((unit) => unit.alive);

  if (combat.selectedAction === 'attack') {
    const target = enemies.find((enemy) => enemy.id === targetId);
    if (!target) return;
    const wasAlive = target.alive;
    const result = performAttack(current, target);
    tryAwardKillXp(state, target, wasAlive);
    current.basicAttacks = Math.min(SPECIAL_CHARGE_REQUIRED, current.basicAttacks + 1);
    recordDiceRoll(combat, current.id, target.id, result);
    pushSkillLog(combat, result, current, target);
    playSfx('hit');
    clearSelection(combat);
    queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id, crit: result.crit }, () => finishCombatTurn(state));
    return;
  }

  if (current.role === 'medic') {
    const result = triageHeal(combat.playerUnits.filter((unit) => unit.alive));
    current.basicAttacks = 0;
    pushSkillLog(combat, result, current);
    playSfx('heal');
    clearSelection(combat);
    queueAnim(state, { type: 'heal', attackerId: current.id, targetId: current.id }, () => finishCombatTurn(state));
    return;
  }

  const target = enemies.find((enemy) => enemy.id === targetId);
  if (!target) return;
  const wasAlive = target.alive;
  const result = performSpecial(current, target);
  tryAwardKillXp(state, target, wasAlive);
  current.basicAttacks = 0;
  recordDiceRoll(combat, current.id, target.id, result);
  pushSkillLog(combat, result, current, target);
  playSfx('special');
  clearSelection(combat);
  queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id, crit: result.crit }, () => finishCombatTurn(state));
}

function clearSelection(combat: CombatState): void {
  combat.selectedAction = null;
}

export function advanceCombatTurn(state: GameState): void {
  if (!state.combat) return;
  if (combatScene?.animating) {
    // Never drop a turn: retry as soon as the running animation/dice settle.
    combatScene.whenIdle(() => advanceCombatTurn(state));
    return;
  }
  stepCombatTurn(state);
}

function stepCombatTurn(state: GameState): void {
  if (!state.combat) return;

  let safety = 0;
  while (safety < 32) {
    safety += 1;
    if (checkCombatEnd(state)) return;

    const combat = state.combat;
    const current = getCurrentCombatUnit(combat);
    if (!current) {
      combat.turnIndex = (combat.turnIndex + 1) % combat.turnOrder.length;
      continue;
    }

    if (isPlayerUnit(current, combat)) {
      emit(state);
      return;
    }

    const anim = runEnemyTurn(state, current);
    if (checkCombatEnd(state)) return;
    combat.turnIndex = (combat.turnIndex + 1) % combat.turnOrder.length;
    if (anim) {
      queueAnim(state, anim, () => stepCombatTurn(state));
      return;
    }
    emit(state);
  }

  // Safety valve exhausted (should be unreachable): keep the UI in sync.
  emit(state);
}

function runEnemyTurn(state: GameState, unit: Unit): AnimAction {
  if (!state.combat) return null;
  const combat = state.combat;
  const targets = combat.playerUnits;
  const allies = combat.enemyUnits.filter((ally) => ally.alive);

  assignRandomGridCell(unit, allies);
  emit(state);

  if (unit.role === 'screamer' && Math.random() < SCREAMER_SUMMON_CHANCE) {
    const summoned = summonShambler(`wave_${state.phaseNumber}`);
    summoned.maxHp = Math.round(summoned.maxHp * waveHealthScale(state.phaseNumber));
    summoned.hp = summoned.maxHp;
    assignRandomGridCell(summoned, [...allies, summoned]);
    combat.enemyUnits.push(summoned);
    combat.turnOrder.push(summoned);
    pushLog(combat, 'log.summon');
    playSfx('hit');
    return null;
  }

  const target = pickAiTarget(unit, targets);
  if (!target) return null;
  const result = performAttack(unit, target);
  recordDiceRoll(combat, unit.id, target.id, result);
  pushSkillLog(combat, result, unit, target);
  playSfx('hit');
  if (!target.alive) playSfx('death');
  if (canCounterattack(state, target)) {
    return {
      type: 'counter',
      attackerId: unit.id,
      targetId: target.id,
      counterAttackerId: target.id,
      counterTargetId: unit.id,
      crit: result.crit,
    };
  }
  return { type: 'hit', attackerId: unit.id, targetId: target.id, crit: result.crit };
}

function canCounterattack(state: GameState, target: Unit): boolean {
  return target.alive
    && target.role === 'athlete'
    && state.profile.levels.athlete >= COUNTERATTACK_ATHLETE_LEVEL;
}

/** Resolves the athlete's counterattack; returns whether it was a critical. */
function resolveCounterattack(state: GameState, athleteId: string, zombieId: string): boolean {
  if (!state.combat) return false;
  const athlete = state.combat.playerUnits.find((unit) => unit.id === athleteId);
  const zombie = state.combat.enemyUnits.find((unit) => unit.id === zombieId);
  if (!athlete?.alive || !zombie?.alive) return false;

  const wasAlive = zombie.alive;
  const result = performAttack(athlete, zombie);
  recordDiceRoll(state.combat, athlete.id, zombie.id, result);
  tryAwardKillXp(state, zombie, wasAlive);
  pushSkillLog(state.combat, result, athlete, zombie);
  playSfx('hit');
  if (!zombie.alive) playSfx('death');
  return result.crit ?? false;
}

function finishCombatTurn(state: GameState): void {
  if (!state.combat) return;
  state.combat.lastRoll = null;
  state.combat.turnIndex = (state.combat.turnIndex + 1) % state.combat.turnOrder.length;
  advanceCombatTurn(state);
}

function checkCombatEnd(state: GameState): boolean {
  if (!state.combat) return false;
  const playersAlive = state.combat.playerUnits.some((unit) => unit.alive && unit.hp > 0);
  const enemiesAlive = state.combat.enemyUnits.some((unit) => unit.alive && unit.hp > 0);

  if (!playersAlive) {
    syncPlayerSquadFromCombat(state);
    state.combat = null;
    state.phase = 'gameover';
    playSfx('death');
    emit(state);
    return true;
  }

  if (!enemiesAlive) {
    syncPlayerSquadFromCombat(state);
    if (state.phaseNumber > state.profile.bestRound) {
      state.profile.bestRound = state.phaseNumber;
      saveProfile(state.profile);
    }
    state.combat = null;
    state.phase = 'roundbreak';
    playSfx('wave');
    emit(state);
    return true;
  }

  return false;
}

export function restartGame(state: GameState): GameState {
  const fresh = createInitialState(state.lang);
  emit(fresh);
  return fresh;
}

export function setLanguage(state: GameState, lang: 'en' | 'es'): void {
  state.lang = lang;
  emit(state);
}
