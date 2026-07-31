import type { GameState, LandmarkPoi } from '../game/types';
import { applyPowerBonuses, getPlayerSquad } from '../game/state';
import { getActionCard } from './combatActions';
import { CombatDiceDisplay } from './CombatDiceDisplay';
import type { MapScene } from '../map/MapScene';
import { getNodeLabel } from '../map/nodeLabel';
import { t } from '../i18n/strings';
import {
  advanceTutorial,
  beginMovePhase,
  restartGame,
  selectCombatAction,
  selectCombatTarget,
  setLanguage,
  startGame,
} from '../game/phases';
import { playSfx, unlockAudio } from '../audio/sfx';

export class UIManager {
  private readonly root: HTMLElement;
  private readonly diceDisplay = new CombatDiceDisplay();
  private mapOverlayCtx: {
    state: GameState;
    mapScene: MapScene;
    canvas: HTMLCanvasElement;
  } | null = null;
  private hoveredLandmark: LandmarkPoi | null = null;

  constructor(rootId: string) {
    const el = document.getElementById(rootId);
    if (!el) throw new Error('UI root not found');
    this.root = el;
  }

  render(state: GameState, onStateChange: (s: GameState) => void, mapScene?: MapScene, canvas?: HTMLCanvasElement): void {
    this.root.innerHTML = '';

    switch (state.phase) {
      case 'title':
        this.renderTitle(state, onStateChange);
        break;
      case 'tutorial':
        this.renderTutorial(state, onStateChange);
        break;
      case 'move':
        this.renderSidebar(state);
        if (mapScene && canvas) {
          this.mapOverlayCtx = { state, mapScene, canvas };
          this.root.appendChild(this.buildMapLabels(state, mapScene, canvas));
        }
        break;
      case 'resolve':
        this.renderSidebar(state);
        if (mapScene && canvas) {
          this.mapOverlayCtx = { state, mapScene, canvas };
          this.root.appendChild(this.buildMapLabels(state, mapScene, canvas));
        }
        break;
      case 'combat':
        this.renderCombat(state, onStateChange);
        break;
      case 'gameover':
      case 'victory':
        this.renderEnd(state, onStateChange);
        break;
    }
  }

  private el(tag: string, className: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  refreshMapOverlay(state: GameState, mapScene: MapScene, canvas: HTMLCanvasElement): void {
    this.mapOverlayCtx = { state, mapScene, canvas };
    const existing = this.root.querySelector('.map-labels');
    const tooltip = this.root.querySelector('.landmark-tooltip');
    existing?.remove();
    tooltip?.remove();
    if (state.phase === 'move' || state.phase === 'resolve') {
      this.root.appendChild(this.buildMapLabels(state, mapScene, canvas));
      if (this.hoveredLandmark) {
        this.root.appendChild(this.buildLandmarkTooltip(this.hoveredLandmark, mapScene, canvas));
      }
    }
  }

  setHoveredLandmark(lm: LandmarkPoi | null, mapScene?: MapScene, canvas?: HTMLCanvasElement): void {
    if (this.hoveredLandmark?.id === lm?.id) return;
    this.hoveredLandmark = lm;
    if (this.mapOverlayCtx && mapScene && canvas) {
      this.refreshMapOverlay(this.mapOverlayCtx.state, mapScene, canvas);
    }
  }

  tickCombatDice(dt: number, state: GameState): void {
    if (state.phase !== 'combat') {
      this.diceDisplay.hide();
      return;
    }
    this.diceDisplay.tick(dt, state.lang);
  }

  private actionBtn(
    label: string,
    info: ReturnType<typeof getActionCard>,
    onClick: () => void,
    variant: 'attack' | 'special',
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `combat-action combat-action-${variant}`;
    b.innerHTML = `
      <span class="action-icon">${info.icon}</span>
      <span class="action-text">
        <span class="action-label">${label}</span>
        ${info.dice ? `<span class="action-dice">${info.dice}</span>` : '<span class="action-dice heal">+HP</span>'}
      </span>
      <span class="action-tooltip" role="tooltip">
        <strong>${info.title}</strong>
        <span>${info.body}</span>
      </span>
    `;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
      playSfx('click');
      onClick();
    });
    return b;
  }

  private btn(label: string, onClick: () => void, className = 'btn'): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
      playSfx('click');
      onClick();
    });
    return b;
  }

  private renderTitle(state: GameState, onStateChange: (s: GameState) => void): void {
    const wrap = this.el('div', 'overlay title-overlay');
    wrap.appendChild(this.el('p', 'eyebrow', 'SAAVEDRA · BUENOS AIRES'));
    wrap.appendChild(this.el('h1', 'title-main', t('game.title', state.lang)));
    wrap.appendChild(this.el('p', 'title-tag', t('game.subtitle', state.lang)));

    const lang = this.el('div', 'lang-toggle');
    lang.append(
      this.btn('EN', () => { setLanguage(state, 'en'); onStateChange(state); }, state.lang === 'en' ? 'btn chip active' : 'btn chip'),
      this.btn('ES', () => { setLanguage(state, 'es'); onStateChange(state); }, state.lang === 'es' ? 'btn chip active' : 'btn chip'),
    );
    wrap.appendChild(lang);
    wrap.appendChild(this.btn(t('btn.start', state.lang), () => { startGame(state); onStateChange(state); }, 'btn btn-go'));
    this.root.appendChild(wrap);
  }

  private renderTutorial(state: GameState, onStateChange: (s: GameState) => void): void {
    const step = state.tutorialStep + 1;
    const wrap = this.el('div', 'overlay tutorial-overlay');
    wrap.appendChild(this.el('span', 'step-badge', `${step}/4`));
    wrap.appendChild(this.el('h2', 'panel-title', t(`tutorial.${step}.title`, state.lang)));
    wrap.appendChild(this.el('p', 'panel-body', t(`tutorial.${step}.body`, state.lang)));
    wrap.appendChild(
      this.btn(step >= 4 ? t('btn.start', state.lang) : t('btn.next', state.lang), () => {
        if (step >= 4) beginMovePhase(state);
        else advanceTutorial(state);
        onStateChange(state);
      }, 'btn btn-go'),
    );
    this.root.appendChild(wrap);
  }

  private renderSidebar(state: GameState): void {
    const player = getPlayerSquad(state);
    const sidebar = this.el('aside', 'sidebar');
    sidebar.appendChild(this.el('h2', 'sidebar-heading', t('move.title', state.lang)));

    const stats = this.el('div', 'stat-grid');
    const rivals = state.squads.filter((s) => !s.isPlayer && !s.eliminated).length;
    for (const [label, val] of [
      [t('hud.phase', state.lang), String(state.phaseNumber)],
      [t('hud.power', state.lang), String(player.power)],
      [t('hud.rivals', state.lang), String(rivals)],
    ] as const) {
      const cell = this.el('div', 'stat-cell');
      cell.appendChild(this.el('span', 'stat-label', label));
      cell.appendChild(this.el('span', 'stat-value', val));
      stats.appendChild(cell);
    }
    sidebar.appendChild(stats);

    for (const member of player.members) {
      const row = this.el('div', 'party-row');
      row.appendChild(this.el('span', 'party-name', t(member.nameKey, state.lang)));
      row.appendChild(this.el('span', 'party-hp', `${member.hp}/${member.maxHp}`));
      sidebar.appendChild(row);
    }

    if (state.phase === 'move') {
      sidebar.appendChild(this.el('p', 'hint', t('move.instruction', state.lang)));
      const node = state.district.find((n) => n.id === player.nodeId);
      if (node) {
        const loc = this.el('div', 'move-preview');
        loc.appendChild(this.el('span', 'preview-label', t('move.current', state.lang)));
        loc.appendChild(this.el('strong', 'preview-dest', t(node.labelKey, state.lang)));
        sidebar.appendChild(loc);
      }
    }

    this.root.appendChild(sidebar);
  }


  private buildMapLabels(state: GameState, mapScene: MapScene, canvas: HTMLCanvasElement): HTMLElement {
    const layer = this.el('div', 'map-labels');
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    for (const node of state.district) {
      const pos = mapScene.projectNode(node.id, state.district, w, h);
      if (!pos) continue;
      if (pos.x < -50 || pos.y < -50 || pos.x > w + 50 || pos.y > h + 50) continue;

      const label = this.el('div', 'node-label');
      label.style.left = `${pos.x}px`;
      label.style.top = `${pos.y}px`;
      label.appendChild(this.el('span', 'node-name', getNodeLabel(node, state.lang)));

      const threat = this.threatAtNode(state, node.id);
      if (threat) label.appendChild(this.el('span', 'node-threat', threat));

      if (state.hoveredNodeId === node.id) label.classList.add('selected');

      layer.appendChild(label);
    }
    return layer;
  }

  private buildLandmarkTooltip(lm: LandmarkPoi, mapScene: MapScene, canvas: HTMLCanvasElement): HTMLElement {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const idx = mapScene.getLandmarks().findIndex((l) => l.id === lm.id);
    const pos = idx >= 0 ? mapScene.projectLandmark(idx, w, h) : null;

    const tip = this.el('div', 'landmark-tooltip');
    if (pos) {
      tip.style.left = `${pos.x}px`;
      tip.style.top = `${pos.y - 12}px`;
    }
    tip.appendChild(this.el('strong', '', lm.name));
    tip.appendChild(this.el('span', 'lm-cat', lm.category));
    return tip;
  }

  private threatAtNode(state: GameState, nodeId: string): string | null {
    const hasZ = state.zombiePacks.some((z) => z.nodeId === nodeId && z.units.some((u) => u.alive));
    const hasR = state.squads.some((s) => !s.isPlayer && !s.eliminated && s.nodeId === nodeId);
    if (hasZ && hasR) return '☠ ⚔';
    if (hasZ) return '☠ ZOMBIES';
    if (hasR) return '⚔ RIVAL';
    const node = state.district.find((n) => n.id === nodeId);
    if (node?.poi) return '◆ POI';
    return null;
  }

  private renderCombat(state: GameState, onStateChange: (s: GameState) => void): void {
    if (!state.combat) return;
    const combat = state.combat;
    const current = combat.turnOrder[combat.turnIndex];
    const isPlayerTurn = current?.alive && combat.playerUnits.some((u) => u.id === current.id);
    const player = getPlayerSquad(state);
    const powerMult = applyPowerBonuses(player, current).damageMult;

    this.diceDisplay.mount(this.root);

    if (combat.lastRoll) {
      const r = combat.lastRoll;
      const key = `${r.attackerId}:${r.targetId}:${r.roll.rolls.join(',')}:${r.damage}`;
      this.diceDisplay.syncRoll(key, r.roll, r.damage, state.lang);
    } else if (isPlayerTurn && !this.diceDisplay.isBusy()) {
      const previewDice = combat.selectedAction === 'special'
        ? getActionCard(current.role, 'special', state.lang, powerMult).dice ?? '+HP'
        : getActionCard(current.role, 'attack', state.lang, powerMult).dice ?? '?';
      this.diceDisplay.setPreview(previewDice, state.lang);
    } else {
      this.diceDisplay.hide();
    }

    const bar = this.el('div', 'combat-bar');
    const top = this.el('div', 'combat-bar-top');
    top.appendChild(this.el('span', 'combat-status', isPlayerTurn
      ? `${t('combat.playerTurn', state.lang)} · ${t(current.nameKey, state.lang)}`
      : t('combat.enemyTurn', state.lang)));

    if (isPlayerTurn && combat.selectedAction) {
      top.appendChild(this.el('span', 'combat-hint', t('combat.selectTarget', state.lang)));
      if (combat.selectedAction === 'special' && current.role === 'medic') {
        top.appendChild(this.btn('Triage', () => { selectCombatTarget(state, current.id); onStateChange(state); }, 'btn chip triage-btn'));
      }
    }
    bar.appendChild(top);

    if (isPlayerTurn && !combat.selectedAction) {
      const actions = this.el('div', 'combat-actions');
      const attackInfo = getActionCard(current.role, 'attack', state.lang, powerMult);
      const specialInfo = getActionCard(current.role, 'special', state.lang, powerMult);
      actions.appendChild(this.actionBtn(t('btn.attack', state.lang), attackInfo, () => {
        selectCombatAction(state, 'attack');
        onStateChange(state);
      }, 'attack'));
      actions.appendChild(this.actionBtn(t('btn.special', state.lang), specialInfo, () => {
        selectCombatAction(state, 'special');
        onStateChange(state);
      }, 'special'));
      bar.appendChild(actions);
    }

    const log = this.el('div', 'combat-log');
    log.textContent = combat.log.slice(-4).join(' · ');
    bar.appendChild(log);

    this.root.appendChild(bar);
  }

  private renderEnd(state: GameState, onStateChange: (s: GameState) => void): void {
    const win = state.phase === 'victory';
    const wrap = this.el('div', `overlay end-overlay ${win ? 'win' : 'lose'}`);
    wrap.appendChild(this.el('h1', 'title-main', t(win ? 'end.victory' : 'end.defeat', state.lang)));
    wrap.appendChild(this.el('p', 'panel-body', t(win ? 'end.victorySub' : 'end.defeatSub', state.lang)));
    wrap.appendChild(this.btn(t('btn.restart', state.lang), () => { onStateChange(restartGame(state)); }, 'btn btn-go'));
    this.root.appendChild(wrap);
  }
}
