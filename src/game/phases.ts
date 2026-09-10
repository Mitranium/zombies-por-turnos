import type { CombatState, DiceRollResult, GameState, Rank, Unit, UnitRole } from './types';
import {
  createInitialState,
  createUnit,
  getAliveMembers,
  getPlayerSquad,
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
  shuffleUnitOnGrid,
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
import { refreshPlayerSquadLevels } from './state';

export type GameListener = (state: GameState) => void;
export const SPECIAL_CHARGE_REQUIRED = 2;
export const SCREAMER_SUMMON_CHANCE = 0.2;

type HitAnimAction = { type: 'hit' | 'heal'; attackerId: string; targetId: string };
type CounterAnimAction = {
  type: 'counter';
  attackerId: string;
  targetId: string;
  counterAttackerId: string;
  counterTargetId: string;
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

function queueAnim(state: GameState, action: AnimAction, then: () => void): void {
  const scene = combatScene;
  if (!action || !scene) {
    then();
    return;
  }
  if (action.type === 'counter') {
    scene.playHit(action.attackerId, action.targetId, () => {
      resolveCounterattack(state, action.counterAttackerId, action.counterTargetId);
      scene.playHit(action.counterAttackerId, action.counterTargetId, () => {
        emit(state);
        then();
      });
      emit(state);
    });
    emit(state);
    return;
  }
  const done = () => {
    emit(state);
    then();
  };
  if (action.type === 'heal') scene.playHeal(action.attackerId, done);
  else scene.playHit(action.attackerId, action.targetId, done);
  emit(state);
}

export function startGame(state: GameState): void {
  startBgMusic();
  state.phaseNumber = 1;
  state.message = '';
  state.runXpGained = 0;
  const player = getPlayerSquad(state);
  refreshPlayerSquadLevels(player, state.profile);
  for (const member of player.members) {
    member.alive = true;
    member.hp = member.maxHp;
    member.basicAttacks = 0;
  }
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
  state.combat.log.push(`+${gained} XP`);
}

export function startNextRound(state: GameState): void {
  if (state.phase !== 'roundbreak') return;
  const player = getPlayerSquad(state);
  refreshPlayerSquadLevels(player, state.profile);
  for (const member of player.members) {
    member.alive = true;
    member.hp = member.maxHp;
    member.basicAttacks = 0;
  }
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

function waveRole(round: number, index: number, count: number): UnitRole {
  if (round === 1) return 'shambler';
  if (round >= 3 && index === count - 1) return 'ripper';
  if (round >= 2 && index % 3 === 2) return 'screamer';
  if (round >= 5 && index % 4 === 1) return 'ripper';
  return 'shambler';
}

function buildWave(round: number): Unit[] {
  const count = Math.min(round + 1, 8);
  const tier = Math.floor((round - 1) / 3);
  const squadId = `wave_${round}`;

  const units = Array.from({ length: count }, (_, index) => {
    const role = waveRole(round, index, count);
    const rank = (role === 'screamer' ? 'back' : 'front') as Rank;
    const unit = createUnit(role, squadId, rank, `unit.${role}`);
    const healthScale = 1 + tier * 0.18;
    unit.maxHp = Math.round(unit.maxHp * healthScale);
    unit.hp = unit.maxHp;
    unit.speed = Math.min(10, unit.speed + tier);
    return unit;
  });

  placeUnitsOnGrid(units, (unit) => (
    unit.role === 'screamer' ? { col: 1, row: 2 } : { col: 1, row: 0 }
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
    log: [`Ronda ${state.phaseNumber}: ${enemyUnits.length} zombis`],
    selectedAction: null,
    selectedTargetId: null,
    pendingPlayerUnitId: null,
    lastRoll: null,
  };
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
  result: { damage?: number; diceRoll?: DiceRollResult },
): void {
  if (result.diceRoll && result.damage) {
    combat.lastRoll = { attackerId, targetId, roll: result.diceRoll, damage: result.damage };
    playSfx('dice');
  }
}

export function cancelCombatAction(state: GameState): void {
  if (!state.combat?.selectedAction || combatScene?.animating) return;
  state.combat.selectedAction = null;
  state.combat.selectedTargetId = null;
  state.combat.pendingPlayerUnitId = null;
  emit(state);
}

export function selectCombatAction(state: GameState, action: 'attack' | 'special'): void {
  if (!state.combat || combatScene?.animating) return;
  const current = getCurrentCombatUnit(state.combat);
  if (!current || !isPlayerUnit(current, state.combat)) return;
  if (action === 'special' && current.basicAttacks < SPECIAL_CHARGE_REQUIRED) {
    playSfx('locked');
    return;
  }
  state.combat.selectedAction = action;
  state.combat.selectedTargetId = null;
  state.combat.pendingPlayerUnitId = current.id;
  emit(state);
}

export function selectCombatTarget(state: GameState, targetId: string): void {
  if (!state.combat || !state.combat.selectedAction || combatScene?.animating) return;
  const current = getCurrentCombatUnit(state.combat);
  if (!current || !isPlayerUnit(current, state.combat)) return;

  const allies = state.combat.playerUnits.filter((unit) => unit.alive);
  const enemies = state.combat.enemyUnits.filter((unit) => unit.alive);

  if (state.combat.selectedAction === 'attack') {
    const target = enemies.find((enemy) => enemy.id === targetId);
    if (!target) return;
    const wasAlive = target.alive;
    const result = performAttack(current, target);
    tryAwardKillXp(state, target, wasAlive);
    current.basicAttacks = Math.min(SPECIAL_CHARGE_REQUIRED, current.basicAttacks + 1);
    recordDiceRoll(state.combat, current.id, target.id, result);
    state.combat.log.push(`${current.nameKey} → ${target.nameKey} (${result.damage})`);
    playSfx('hit');
    clearSelection(state.combat);
    queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id }, () => finishCombatTurn(state));
    return;
  }

  if (current.role === 'medic') {
    triageHeal(allies);
    current.basicAttacks = 0;
    state.combat.log.push(`${current.nameKey} triage`);
    playSfx('heal');
    clearSelection(state.combat);
    queueAnim(state, { type: 'heal', attackerId: current.id, targetId: current.id }, () => finishCombatTurn(state));
    return;
  }

  const target = enemies.find((enemy) => enemy.id === targetId);
  if (!target) return;
  const wasAlive = target.alive;
  const result = performSpecial(current, target, allies, enemies);
  tryAwardKillXp(state, target, wasAlive);
  current.basicAttacks = 0;
  if (result.summon) {
    const summoned = summonShambler(`wave_${state.phaseNumber}`);
    state.combat.enemyUnits.push(summoned);
    state.combat.turnOrder.push(summoned);
  }
  recordDiceRoll(state.combat, current.id, target.id, result);
  state.combat.log.push(`${current.nameKey} special → ${target.nameKey} (${result.damage ?? 0})`);
  playSfx('special');
  clearSelection(state.combat);
  queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id }, () => finishCombatTurn(state));
}

function clearSelection(combat: CombatState): void {
  combat.selectedAction = null;
  combat.selectedTargetId = null;
  combat.pendingPlayerUnitId = null;
}

export function advanceCombatTurn(state: GameState): void {
  if (!state.combat || combatScene?.animating) return;
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
}

function runEnemyTurn(state: GameState, unit: Unit): AnimAction {
  if (!state.combat) return null;
  const enemies = state.combat.playerUnits;
  const allies = state.combat.enemyUnits.filter((ally) => ally.alive);

  shuffleUnitOnGrid(unit, allies);
  emit(state);

  if (unit.role === 'screamer' && Math.random() < SCREAMER_SUMMON_CHANCE) {
    const summoned = summonShambler(`wave_${state.phaseNumber}`);
    const tier = Math.floor((state.phaseNumber - 1) / 3);
    summoned.maxHp = Math.round(summoned.maxHp * (1 + tier * 0.18));
    summoned.hp = summoned.maxHp;
    assignRandomGridCell(summoned, [...allies, summoned]);
    state.combat.enemyUnits.push(summoned);
    state.combat.turnOrder.push(summoned);
    state.combat.log.push('Screamer calls a shambler!');
    playSfx('hit');
    return null;
  }

  const target = pickAiTarget(unit, enemies);
  if (!target) return null;
  const result = performAttack(unit, target);
  recordDiceRoll(state.combat, unit.id, target.id, result);
  state.combat.log.push(`${unit.nameKey} → ${target.nameKey} (${result.damage})`);
  playSfx('hit');
  if (!target.alive) playSfx('death');
  if (canCounterattack(state, target)) {
    return {
      type: 'counter',
      attackerId: unit.id,
      targetId: target.id,
      counterAttackerId: target.id,
      counterTargetId: unit.id,
    };
  }
  return { type: 'hit', attackerId: unit.id, targetId: target.id };
}

function canCounterattack(state: GameState, target: Unit): boolean {
  return target.alive
    && target.role === 'athlete'
    && state.profile.levels.athlete >= 3;
}

function resolveCounterattack(state: GameState, athleteId: string, zombieId: string): void {
  if (!state.combat) return;
  const athlete = state.combat.playerUnits.find((unit) => unit.id === athleteId);
  const zombie = state.combat.enemyUnits.find((unit) => unit.id === zombieId);
  if (!athlete?.alive || !zombie?.alive) return;

  const wasAlive = zombie.alive;
  const result = performAttack(athlete, zombie);
  recordDiceRoll(state.combat, athlete.id, zombie.id, result);
  tryAwardKillXp(state, zombie, wasAlive);
  state.combat.log.push(`${athlete.nameKey} counter → ${zombie.nameKey} (${result.damage})`);
  playSfx('hit');
  if (!zombie.alive) playSfx('death');
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
