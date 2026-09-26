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
import { stopBgMusic } from './audio/music';
import { combatKeyFromEvent } from './ui/combatKeyboard';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

/** Cap the frame delta so a backgrounded tab can't fast-forward timers on return. */
const MAX_FRAME_DT = 0.1;
const RESIZE_REFRESH_DELAY_MS = 120;

let state: GameState = createInitialState(
  (navigator.language.startsWith('es') ? 'es' : 'en') as 'en' | 'es',
);

const combatScene = new CombatScene(canvas);
const ui = new UIManager('ui-root');
setCombatScene(combatScene);

let refreshTimer: number | undefined;

function scheduleRefresh(): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refresh, RESIZE_REFRESH_DELAY_MS);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  combatScene.resize(width, height);
  scheduleRefresh();
}

function refresh(): void {
  // Render is driven exclusively by the game listener (see setGameListener):
  // every state mutation emits exactly one change.
  ui.render(state, combatScene);

  if (state.phase === 'combat' && state.combat) {
    combatScene.syncCombat(state.combat, state.lang);
  } else if (state.phase === 'deployment' && state.deployment) {
    combatScene.syncDeployment(state.deployment, state.lang, state.deployment.selectedUnitId);
  } else if (state.phase === 'title' || state.phase === 'squad' || state.phase === 'wiki') {
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
      return;
    }
    const cell = combatScene.pickHexCell(canvas, event.clientX, event.clientY, 'player');
    if (cell) {
      placeDeploymentUnit(state, cell.col, cell.row);
    }
    return;
  }
  if (state.phase !== 'combat' || !state.combat?.selectedAction) return;
  const targetId = combatScene.pickUnit(canvas, event.clientX, event.clientY);
  if (!targetId) return;
  selectCombatTarget(state, targetId);
});

window.addEventListener('keydown', (event) => {
  const combatKey = combatKeyFromEvent(event);
  if (!combatKey) return;
  // A focused button owns Enter/Space: let the browser activate it instead of
  // running the global confirm action behind its back.
  const target = event.target;
  if (combatKey === 'confirm' && target instanceof HTMLElement && target.closest('button')) return;
  if (ui.handleKeyboard(combatKey, state, combatScene)) {
    event.preventDefault();
  }
});

window.addEventListener('resize', resize);

let last = performance.now();
let frameId = 0;
function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
  last = now;
  combatScene.update(dt);
  ui.tickCombatDice(dt, state);
  combatScene.render();
  frameId = requestAnimationFrame(loop);
}

window.addEventListener('pagehide', () => {
  window.clearTimeout(refreshTimer);
  cancelAnimationFrame(frameId);
  stopBgMusic();
  combatScene.dispose();
});

resize();
refresh();
frameId = requestAnimationFrame(loop);
