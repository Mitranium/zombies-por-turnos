import { createInitialState, getPlayerSquad } from './game/state';
import type { GameState } from './game/types';
import {
  placeDeploymentUnit,
  selectCombatTarget,
  selectDeploymentUnit,
  setCombatScene,
  setGameListener,
} from './game/phases';
import { CombatScene } from './combat/CombatScene';
import { UIManager } from './ui/UIManager';
import { unlockAudio } from './audio/sfx';
import { combatKeyFromEvent } from './ui/combatKeyboard';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

let state: GameState = createInitialState(
  (navigator.language.startsWith('es') ? 'es' : 'en') as 'en' | 'es',
);

const combatScene = new CombatScene(canvas);
const ui = new UIManager('ui-root');
setCombatScene(combatScene);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  combatScene.resize(width, height);
  refresh();
}

function refresh(): void {
  ui.render(
    state,
    (next) => {
      state = next;
      refresh();
    },
    combatScene,
  );

  if (state.phase === 'combat' && state.combat) {
    combatScene.syncCombat(state.combat, state.lang);
  } else if (state.phase === 'deployment' && state.deployment) {
    combatScene.syncDeployment(state.deployment, state.lang, state.deployment.selectedUnitId);
  } else if (state.phase === 'title' || state.phase === 'squad') {
    combatScene.syncTitlePreview(getPlayerSquad(state).members, state.lang);
  } else {
    combatScene.clearBattlefield();
    combatScene.setTargetable([]);
    combatScene.setKeyboardFocus(null);
  }
}

setGameListener((next) => {
  state = next;
  refresh();
});

canvas.addEventListener('pointerup', (event) => {
  unlockAudio();
  if (state.phase === 'deployment' && state.deployment) {
    const unitId = combatScene.pickUnit(canvas, event.clientX, event.clientY);
    if (unitId) {
      selectDeploymentUnit(state, unitId);
      refresh();
      return;
    }
    const cell = combatScene.pickHexCell(canvas, event.clientX, event.clientY, 'player');
    if (cell) {
      placeDeploymentUnit(state, cell.col, cell.row);
      refresh();
    }
    return;
  }
  if (state.phase !== 'combat' || !state.combat?.selectedAction) return;
  const unitId = combatScene.pickUnit(canvas, event.clientX, event.clientY);
  if (!unitId) return;
  selectCombatTarget(state, unitId);
  refresh();
});

window.addEventListener('keydown', (event) => {
  const combatKey = combatKeyFromEvent(event);
  if (!combatKey) return;
  if (ui.handleKeyboard(combatKey, state, (next) => {
    state = next;
    refresh();
  }, combatScene)) {
    event.preventDefault();
  }
});

window.addEventListener('resize', resize);

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  combatScene.update(dt);
  ui.tickCombatDice(dt, state);
  combatScene.render();
  requestAnimationFrame(loop);
}

resize();
refresh();
requestAnimationFrame(loop);
