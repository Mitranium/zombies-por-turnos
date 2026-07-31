import { createInitialState } from './game/state';
import type { GameState } from './game/types';
import { setGameListener, selectCombatTarget, moveToNode, setCombatScene } from './game/phases';
import { MapScene } from './map/MapScene';
import { CombatScene } from './combat/CombatScene';
import { UIManager } from './ui/UIManager';
import { playSfx, unlockAudio } from './audio/sfx';
import { getPlayerSquad } from './game/state';
import { getReachableNodes } from './map/district';
import { getMapData } from './map/district';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

const DRAG_THRESHOLD = 6;

let state: GameState = createInitialState(
  (navigator.language.startsWith('es') ? 'es' : 'en') as 'en' | 'es',
);

const mapScene = new MapScene(canvas);
const combatScene = new CombatScene(canvas);
setCombatScene(combatScene);
const ui = new UIManager('ui-root');

const mapData = getMapData();
mapScene.buildFromMapData(mapData);

let pointerDown: { x: number; y: number } | null = null;
let lastPanPos: { x: number; y: number } | null = null;
let didDrag = false;

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  mapScene.resize(w, h);
  combatScene.resize(w, h);
  refresh();
}

window.addEventListener('resize', resize);
resize();

mapScene.onCameraChange(() => {
  if (state.phase === 'move' || state.phase === 'resolve') {
    ui.refreshMapOverlay(state, mapScene, canvas);
  }
});

function refresh(): void {
  ui.render(state, (next) => {
    state = next;
    refresh();
  }, mapScene, canvas);

  if (state.phase === 'combat' && state.combat) {
    combatScene.syncCombat(state.combat, state.lang);
    mapScene.scene.visible = false;
    combatScene.scene.visible = true;
  } else if (state.phase !== 'title') {
    mapScene.syncState(state);
    mapScene.scene.visible = true;
    combatScene.scene.visible = false;
  } else {
    mapScene.syncState(state);
    mapScene.scene.visible = true;
    combatScene.scene.visible = false;
  }
}

setGameListener((s) => {
  state = s;
  refresh();
});

function canPanMap(): boolean {
  return state.phase !== 'combat';
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  pointerDown = { x: ev.clientX, y: ev.clientY };
  lastPanPos = { x: ev.clientX, y: ev.clientY };
  didDrag = false;
});

canvas.addEventListener('pointermove', (ev) => {
  if (pointerDown && lastPanPos && canPanMap()) {
    const totalDx = ev.clientX - pointerDown.x;
    const totalDy = ev.clientY - pointerDown.y;
    if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
      didDrag = true;
      canvas.style.cursor = 'grabbing';
      const dx = ev.clientX - lastPanPos.x;
      const dy = ev.clientY - lastPanPos.y;
      mapScene.pan(dx, dy, canvas);
      lastPanPos = { x: ev.clientX, y: ev.clientY };
      return;
    }
  }

  if (state.phase !== 'move') {
    if (state.hoveredNodeId) {
      state.hoveredNodeId = null;
      mapScene.syncState(state);
    }
    ui.setHoveredLandmark(null);
    return;
  }

  const nodeId = mapScene.pickNode(canvas, ev.clientX, ev.clientY);
  if (state.hoveredNodeId !== nodeId) {
    state.hoveredNodeId = nodeId;
    mapScene.syncState(state);
    ui.refreshMapOverlay(state, mapScene, canvas);
  }

  const lmIdx = mapScene.pickLandmark(canvas, ev.clientX, ev.clientY);
  ui.setHoveredLandmark(lmIdx !== null ? mapScene.getLandmark(lmIdx) : null, mapScene, canvas);
});

canvas.addEventListener('pointerup', (ev) => {
  unlockAudio();

  if (!didDrag && pointerDown) {
    if (state.phase === 'move') {
      const nodeId = mapScene.pickNode(canvas, ev.clientX, ev.clientY);
      if (nodeId) {
        const player = getPlayerSquad(state);
        const reachable = getReachableNodes(state.district, player.nodeId, true);
        if (reachable.some((n) => n.id === nodeId)) {
          playSfx('click');
          moveToNode(state, nodeId);
        }
      }
    }

    if (state.phase === 'combat' && state.combat?.selectedAction) {
      const unitId = combatScene.pickUnit(canvas, ev.clientX, ev.clientY);
      if (unitId) {
        selectCombatTarget(state, unitId);
        refresh();
      }
    }
  }

  pointerDown = null;
  lastPanPos = null;
  didDrag = false;
  canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('pointerleave', () => {
  pointerDown = null;
  lastPanPos = null;
  didDrag = false;
  canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('wheel', (ev) => {
  if (!canPanMap()) return;
  ev.preventDefault();
  mapScene.zoomAt(ev.deltaY, ev.clientX, ev.clientY, canvas);
}, { passive: false });

canvas.addEventListener('dblclick', () => {
  if (canPanMap()) mapScene.resetCamera();
});

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  mapScene.update(dt);
  combatScene.update(dt);

  if (state.phase === 'combat') {
    ui.tickCombatDice(dt, state);
    combatScene.render();
  } else {
    mapScene.render();
  }
  requestAnimationFrame(loop);
}

refresh();
requestAnimationFrame(loop);
