import type { CombatState, DiceRollResult, GameState, Rank, Unit } from './types';
import {
  createInitialState,
  getAliveMembers,
  getNode,
  getPlayerSquad,
  getSquad,
  recalcPower,
  refreshSquadHpFromPower,
  resetGameState,
} from './state';
import { chooseRivalDestination } from '../ai/rivalAI';
import {
  cloneUnitsForCombat,
  performAttack,
  performSpecial,
  pickAiHealTarget,
  pickAiTarget,
  sortByInitiative,
  summonShambler,
  triageHeal,
} from '../combat/units';
import { playSfx } from '../audio/sfx';
import { getReachableNodes } from '../map/district';
import type { CombatScene } from '../combat/CombatScene';

export type GameListener = (state: GameState) => void;

let listener: GameListener | null = null;
let combatScene: CombatScene | null = null;

type AnimAction = { type: 'hit' | 'heal'; attackerId: string; targetId: string } | null;

export function setCombatScene(scene: CombatScene): void {
  combatScene = scene;
}

function queueAnim(state: GameState, action: AnimAction, then: () => void): void {
  if (!action || !combatScene) {
    then();
    return;
  }
  const done = () => {
    emit(state);
    then();
  };
  if (action.type === 'heal') combatScene.playHeal(action.attackerId, done);
  else combatScene.playHit(action.attackerId, action.targetId, done);
  emit(state);
}

export function setGameListener(fn: GameListener | null): void {
  listener = fn;
}

function emit(state: GameState): void {
  listener?.(state);
}

export function startGame(state: GameState): void {
  state.phase = 'tutorial';
  state.tutorialStep = 0;
  emit(state);
}

export function advanceTutorial(state: GameState): void {
  state.tutorialStep += 1;
  if (state.tutorialStep >= 4) {
    beginMovePhase(state);
  } else {
    emit(state);
  }
}

export function beginMovePhase(state: GameState): void {
  state.phase = 'move';
  state.hoveredNodeId = null;
  state.message = '';
  emit(state);
}

export function moveToNode(state: GameState, nodeId: string): void {
  if (state.phase !== 'move') return;
  const player = getPlayerSquad(state);
  const reachable = getReachableNodes(state.district, player.nodeId, true);
  if (!reachable.some((n) => n.id === nodeId)) return;

  resolvePhase(state, nodeId);
}

// legacy alias
export const beginVotePhase = beginMovePhase;

function isPlayerUnit(unit: Unit, combat: CombatState): boolean {
  return combat.playerUnits.some((u) => u.id === unit.id && u.alive);
}

function resolvePhase(state: GameState, destinationNodeId: string): void {
  state.phase = 'resolve';
  playSfx('phase');

  const player = getPlayerSquad(state);
  player.nodeId = destinationNodeId;

  for (const squad of state.squads.filter((s) => !s.isPlayer && !s.eliminated)) {
    squad.nodeId = chooseRivalDestination(state, squad, state.district);
  }

  resolveClaims(state);
  resolveEncounters(state);
}

function resolveClaims(state: GameState): void {
  for (const squad of state.squads.filter((s) => !s.eliminated)) {
    const node = getNode(state, squad.nodeId);
    if (!node.poi) continue;

    const previousOwner = state.poiOwners[node.id];
    if (previousOwner && previousOwner !== squad.id) {
      const prev = getSquad(state, previousOwner);
      prev.controlledPois = prev.controlledPois.filter((id) => id !== node.id);
    }

    state.poiOwners[node.id] = squad.id;
    if (!squad.controlledPois.includes(node.id)) squad.controlledPois.push(node.id);

    if (node.poi === 'hospital') {
      for (const member of getAliveMembers(squad)) {
        member.hp = Math.min(member.maxHp, member.hp + 4);
      }
    }

    playSfx('claim');
    state.message = `claim:${node.id}:${squad.id}`;
  }

  for (const squad of state.squads.filter((s) => !s.eliminated)) {
    recalcPower(squad, state.district, state.poiOwners);
    refreshSquadHpFromPower(squad);
  }
}

function resolveEncounters(state: GameState): void {
  const player = getPlayerSquad(state);
  const nodeId = player.nodeId;

  const rival = state.squads.find(
    (s) => !s.isPlayer && !s.eliminated && s.nodeId === nodeId,
  );
  if (rival) {
    startCombat(state, 'rival', rival.id);
    return;
  }

  const pack = state.zombiePacks.find(
    (z) => z.nodeId === nodeId && z.units.some((u) => u.alive),
  );
  if (pack) {
    startCombat(state, 'zombies', null, pack.units);
    return;
  }

  checkWinCondition(state);
  if (state.phase === 'resolve') {
    state.phaseNumber += 1;
    beginMovePhase(state);
  }
}

function startCombat(
  state: GameState,
  type: 'zombies' | 'rival',
  rivalSquadId: string | null,
  zombieUnits?: Unit[],
): void {
  playSfx('combat');
  const player = getPlayerSquad(state);
  const playerUnits = cloneUnitsForCombat(getAliveMembers(player)).map((u) => ({
    ...u,
    rank: (u.role === 'medic' ? 'back' : 'front') as Rank,
  }));

  let enemyUnits: Unit[] = [];
  if (type === 'rival' && rivalSquadId) {
    const rival = getSquad(state, rivalSquadId);
    enemyUnits = cloneUnitsForCombat(getAliveMembers(rival)).map((u, i) => ({
      ...u,
      rank: (i >= 2 ? 'back' : 'front') as Rank,
    }));
  } else if (zombieUnits) {
    enemyUnits = cloneUnitsForCombat(zombieUnits.filter((u) => u.alive));
  }

  const turnOrder = sortByInitiative([...playerUnits, ...enemyUnits]);
  state.combat = {
    playerUnits,
    enemyUnits,
    turnOrder,
    turnIndex: 0,
    encounterType: type,
    rivalSquadId,
    log: [],
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

function syncPlayerSquadFromCombat(state: GameState): void {
  const player = getPlayerSquad(state);
  if (!state.combat) return;
  for (const unit of state.combat.playerUnits) {
    const member = player.members.find((m) => m.id === unit.id);
    if (member) {
      member.hp = unit.hp;
      member.alive = unit.alive;
    }
  }
}

function syncRivalFromCombat(state: GameState): void {
  if (!state.combat?.rivalSquadId) return;
  const rival = getSquad(state, state.combat.rivalSquadId);
  for (const unit of state.combat.enemyUnits) {
    const member = rival.members.find((m) => m.id === unit.id);
    if (member) {
      member.hp = unit.hp;
      member.alive = unit.alive;
    }
  }
  if (!getAliveMembers(rival).length) {
    rival.eliminated = true;
  }
}

function syncZombiesFromCombat(state: GameState): void {
  if (!state.combat || state.combat.encounterType !== 'zombies') return;
  const pack = state.zombiePacks.find((z) => z.nodeId === getPlayerSquad(state).nodeId);
  if (!pack) return;
  for (const unit of state.combat.enemyUnits) {
    const z = pack.units.find((u) => u.id === unit.id);
    if (z) {
      z.hp = unit.hp;
      z.alive = unit.alive;
    }
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
  }
}

export function selectCombatAction(state: GameState, action: 'attack' | 'special'): void {
  if (!state.combat) return;
  const current = getCurrentCombatUnit(state.combat);
  if (!current || !isPlayerUnit(current, state.combat)) return;
  state.combat.selectedAction = action;
  state.combat.selectedTargetId = null;
  state.combat.pendingPlayerUnitId = current.id;
  emit(state);
}

export function selectCombatTarget(state: GameState, targetId: string): void {
  if (!state.combat || !state.combat.selectedAction) return;
  const current = getCurrentCombatUnit(state.combat);
  if (!current || !isPlayerUnit(current, state.combat)) return;

  const player = getPlayerSquad(state);
  const { playerUnits, enemyUnits } = state.combat;
  const allies = playerUnits.filter((u) => u.alive);
  const enemies = enemyUnits.filter((u) => u.alive);

  if (state.combat.selectedAction === 'attack') {
    const target = enemies.find((e) => e.id === targetId);
    if (!target) return;
    const result = performAttack(current, target, player);
    recordDiceRoll(state.combat, current.id, target.id, result);
    state.combat.log.push(`${current.nameKey} → ${target.nameKey} (${result.damage})`);
    playSfx('hit');
    state.combat.selectedAction = null;
    state.combat.selectedTargetId = null;
    state.combat.pendingPlayerUnitId = null;
    queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id }, () => finishCombatTurn(state));
    return;
  }

  let healAnim: AnimAction = null;
  if (current.role === 'medic') {
    triageHeal(allies);
    state.combat.log.push(`${current.nameKey} triage`);
    playSfx('heal');
    healAnim = { type: 'heal', attackerId: current.id, targetId: current.id };
  } else {
      const target = enemies.find((e) => e.id === targetId);
      if (!target) return;
      const result = performSpecial(current, target, allies, enemies, player);
      if (result.summon) {
        state.combat.enemyUnits.push(summonShambler('zombies'));
        state.combat.turnOrder.push(state.combat.enemyUnits[state.combat.enemyUnits.length - 1]);
        state.combat.log.push('summon shambler');
      }
      recordDiceRoll(state.combat, current.id, target.id, result);
      state.combat.log.push(`${current.nameKey} special → ${target.nameKey} (${result.damage ?? 0})`);
      playSfx('hit');
      state.combat.selectedAction = null;
      state.combat.selectedTargetId = null;
      state.combat.pendingPlayerUnitId = null;
      queueAnim(state, { type: 'hit', attackerId: current.id, targetId: target.id }, () => finishCombatTurn(state));
      return;
  }

  state.combat.selectedAction = null;
  state.combat.selectedTargetId = null;
  state.combat.pendingPlayerUnitId = null;
  queueAnim(state, healAnim, () => finishCombatTurn(state));
}

export function advanceCombatTurn(state: GameState): void {
  if (!state.combat || combatScene?.animating) return;
  stepCombatTurn(state);
}

function stepCombatTurn(state: GameState): void {
  if (!state.combat) return;

  let safety = 0;
  while (safety < 20) {
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
  const { playerUnits, enemyUnits } = state.combat;
  const allies = isPlayerUnit(unit, state.combat) ? playerUnits : enemyUnits;
  const enemies = isPlayerUnit(unit, state.combat) ? enemyUnits : playerUnits;
  const squad = state.squads.find((s) => s.id === unit.squadId);

  if (unit.role === 'medic' && unit.hp < unit.maxHp * 0.5) {
    const healTarget = pickAiHealTarget(allies);
    if (healTarget) performSpecial(unit, healTarget, allies, enemies, squad);
    state.combat.log.push(`${unit.nameKey} heals`);
    playSfx('heal');
    return { type: 'heal', attackerId: unit.id, targetId: unit.id };
  }

  if (unit.role === 'screamer' && unit.hp > 0 && Math.random() < 0.3) {
    const result = performSpecial(unit, null, allies, enemies, squad);
    if (result.summon) {
      const summoned = summonShambler('zombies');
      state.combat.enemyUnits.push(summoned);
      state.combat.turnOrder.push(summoned);
      state.combat.log.push('Screamer calls a shambler!');
    }
    playSfx('hit');
    return null;
  }

  const target = pickAiTarget(unit, enemies);
  if (target) {
    const result = performAttack(unit, target, squad);
    recordDiceRoll(state.combat, unit.id, target.id, result);
    state.combat.log.push(`${unit.nameKey} → ${target.nameKey} (${result.damage})`);
    playSfx('hit');
    if (!target.alive) playSfx('death');
    return { type: 'hit', attackerId: unit.id, targetId: target.id };
  }
  return null;
}

function finishCombatTurn(state: GameState): void {
  if (!state.combat) return;
  state.combat.lastRoll = null;
  state.combat.turnIndex = (state.combat.turnIndex + 1) % state.combat.turnOrder.length;
  advanceCombatTurn(state);
}

function checkCombatEnd(state: GameState): boolean {
  if (!state.combat) return false;
  const { playerUnits, enemyUnits } = state.combat;
  const playersAlive = playerUnits.some((u) => u.alive && u.hp > 0);
  const enemiesAlive = enemyUnits.some((u) => u.alive && u.hp > 0);

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
    syncRivalFromCombat(state);
    syncZombiesFromCombat(state);
    state.combat = null;
    checkWinCondition(state);
    if (state.phase !== 'victory') {
      state.phaseNumber += 1;
      beginMovePhase(state);
    }
    emit(state);
    return true;
  }

  return false;
}

function checkWinCondition(state: GameState): void {
  const rivalsAlive = state.squads.filter((s) => !s.isPlayer && !s.eliminated).length;
  if (rivalsAlive === 0) {
    state.phase = 'victory';
    playSfx('claim');
  }
}

export function restartGame(state: GameState): GameState {
  const fresh = resetGameState(createInitialState(state.lang));
  fresh.phase = 'tutorial';
  fresh.tutorialStep = 0;
  emit(fresh);
  return fresh;
}

export function setLanguage(state: GameState, lang: 'en' | 'es'): void {
  state.lang = lang;
  emit(state);
}
