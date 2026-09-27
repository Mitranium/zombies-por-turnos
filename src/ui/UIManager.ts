import type { CombatLogEntry, GameState, Lang, Unit } from '../game/types';
import { getPlayerSquad } from '../game/state';
import { getActionCard, ROLE_THEME } from './combatActions';
import { rollEventKey } from '../combat/dice';
import { SCREAMER_SUMMON_CHANCE, SPECIAL_CHARGE_REQUIRED } from '../game/balance';
import { CombatDiceDisplay } from './CombatDiceDisplay';
import type { CombatScene } from '../combat/CombatScene';
import { t } from '../i18n/strings';
import {
  closeSquadMenu,
  closeWikiMenu,
  cancelCombatAction,
  confirmDeployment,
  getPlayerTurnUnit,
  levelUpCharacter,
  openSquadMenu,
  openWikiMenu,
  restartGame,
  selectCombatAction,
  selectCombatTarget,
  selectDeploymentUnit,
  setLanguage,
  startGame,
  startNextRound,
} from '../game/phases';
import { canLevelUp, ENEMY_ROLES, getLevelBonuses, levelUpCost, MAX_LEVEL, PLAYER_ROLES, xpForKill } from '../game/progression';
import { getBaseUnitStats } from '../game/state';
import { attackDiceLabel } from './combatActions';
import { playSfx, unlockAudio } from '../audio/sfx';
import { CombatKeyboardController, type CombatKey } from './combatKeyboard';

/** Number of combat log lines visible at once. */
const LOG_VISIBLE_LINES = 4;

export class UIManager {
  private readonly root: HTMLElement;
  private readonly diceDisplay = new CombatDiceDisplay();
  private readonly keyboard = new CombatKeyboardController();

  constructor(rootId: string) {
    const el = document.getElementById(rootId);
    if (!el) throw new Error('UI root not found');
    this.root = el;
  }

  render(
    state: GameState,
    combatScene?: CombatScene,
  ): void {
    // The UI is rebuilt from scratch on every state change: keep the keyboard
    // focus on the equivalent control so keyboard play never loses its place.
    const focusKey = this.captureFocusKey();
    document.documentElement.lang = state.lang;
    this.root.innerHTML = '';

    switch (state.phase) {
      case 'title':
        this.keyboard.reset();
        this.renderTitle(state);
        break;
      case 'squad':
        this.keyboard.reset();
        this.renderSquad(state);
        break;
      case 'wiki':
        this.keyboard.reset();
        this.renderWiki(state);
        break;
      case 'roundbreak':
        this.keyboard.reset();
        this.renderRoundBreak(state);
        break;
      case 'deployment':
        this.keyboard.reset();
        this.renderDeployment(state);
        break;
      case 'combat':
        this.renderCombat(state, combatScene);
        break;
      case 'gameover':
        this.keyboard.reset();
        this.renderEnd(state);
        break;
    }

    this.restoreFocus(focusKey);
  }

  private captureFocusKey(): string | null {
    const active = document.activeElement;
    return active instanceof HTMLElement ? active.dataset.focusKey ?? null : null;
  }

  private restoreFocus(focusKey: string | null): void {
    if (!focusKey) return;
    const match = Array.from(this.root.querySelectorAll<HTMLElement>('[data-focus-key]'))
      .find((el) => el.dataset.focusKey === focusKey);
    match?.focus();
  }

  /** Split a leading decorative glyph into an aria-hidden span. */
  private setLabel(node: HTMLElement, label: string): void {
    const match = label.match(/^([^\p{L}\p{N}]+)\s+/u);
    if (!match) {
      node.textContent = label;
      return;
    }
    const icon = this.el('span', 'btn-glyph');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = match[1].trim();
    node.append(icon, document.createTextNode(label.slice(match[0].length)));
  }

  private el(tag: string, className: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /** Decorative glyph: hidden from screen readers. */
  private glyph(className: string, text: string): HTMLElement {
    const node = this.el('span', className, text);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  tickCombatDice(dt: number, state: GameState): void {
    if (state.phase !== 'combat') {
      this.diceDisplay.hide();
      return;
    }
    this.diceDisplay.tick(dt, state.lang);
  }

  handleKeyboard(
    key: CombatKey,
    state: GameState,
    combatScene?: CombatScene,
  ): boolean {
    if (key === 'confirm') {
      unlockAudio();
      if (state.phase === 'title') {
        startGame(state);
        playSfx('click');
        return true;
      }
      if (state.phase === 'roundbreak') {
        startNextRound(state);
        playSfx('click');
        return true;
      }
      if (state.phase === 'deployment') {
        confirmDeployment(state);
        playSfx('click');
        return true;
      }
      if (state.phase === 'squad') {
        closeSquadMenu(state);
        playSfx('click');
        return true;
      }
      if (state.phase === 'wiki') {
        closeWikiMenu(state);
        playSfx('click');
        return true;
      }
      if (state.phase === 'gameover') {
        playSfx('click');
        restartGame(state);
        return true;
      }
    }

    return this.keyboard.handle(key, state, combatScene);
  }

  private actionBtn(
    label: string,
    lang: Lang,
    info: ReturnType<typeof getActionCard>,
    onClick: () => void,
    variant: 'attack' | 'special',
    disabled = false,
    status?: string,
    keyboardSelected = false,
    ready = false,
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `combat-action combat-action-${variant}${disabled ? ' locked' : ''}${keyboardSelected ? ' keyboard-selected' : ''}${ready ? ' ready' : ''}`;
    b.disabled = disabled;
    b.dataset.focusKey = `action:${variant}`;
    const tooltipId = `action-tooltip-${variant}`;
    b.innerHTML = `
      <span class="action-icon" aria-hidden="true">${info.icon}</span>
      <span class="action-text">
        <span class="action-label">${label}</span>
        ${status
          ? `<span class="action-dice charge">${status}</span>`
          : info.dice
            ? `<span class="action-dice">${info.dice}</span>`
            : `<span class="action-dice heal">${t('dice.heal', lang)}</span>`}
      </span>
      <span class="action-tooltip" role="tooltip" id="${tooltipId}">
        <strong>${info.title}</strong>
        <span>${info.body}</span>
      </span>
    `;
    b.setAttribute('aria-describedby', tooltipId);
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
    b.dataset.focusKey = label;
    this.setLabel(b, label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
      playSfx('click');
      onClick();
    });
    return b;
  }

  private renderTitle(state: GameState): void {
    const screen = this.el('div', 'title-screen');
    screen.appendChild(this.el('div', 'title-vignette'));
    screen.appendChild(this.el('div', 'title-scanlines'));

    const topbar = this.el('div', 'title-topbar');
    const stats = this.el('div', 'title-stats');
    stats.appendChild(this.buildTitleStat(t('xp.label', state.lang), String(state.profile.xp)));
    stats.appendChild(this.buildTitleStat(t('xp.bestRound', state.lang), String(state.profile.bestRound)));
    stats.appendChild(this.buildTitleStat(t('title.stat.kills', state.lang), String(state.profile.totalKills)));
    topbar.appendChild(stats);

    const lang = this.el('div', 'lang-toggle title-lang');
    lang.append(
      this.btn('EN', () => { setLanguage(state, 'en'); }, state.lang === 'en' ? 'btn chip active' : 'btn chip'),
      this.btn('ES', () => { setLanguage(state, 'es'); }, state.lang === 'es' ? 'btn chip active' : 'btn chip'),
    );
    topbar.appendChild(lang);
    screen.appendChild(topbar);

    const hero = this.el('div', 'title-hero');
    const brand = this.el('div', 'title-brand');
    brand.appendChild(this.el('p', 'title-eyebrow', t('game.eyebrow', state.lang)));
    const logo = this.el('h1', 'title-logo');
    logo.innerHTML = '<span class="title-logo-line">Zombies</span><span class="title-logo-line accent">por Turnos</span>';
    brand.appendChild(logo);
    brand.appendChild(this.el('p', 'title-tagline', t('game.subtitle', state.lang)));
    hero.appendChild(brand);

    const actions = this.el('div', 'title-actions');
    const squadPanel = this.el('button', 'title-squad-panel') as HTMLButtonElement;
    squadPanel.type = 'button';
    squadPanel.dataset.focusKey = 'title:squad';
    squadPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
      playSfx('click');
      openSquadMenu(state);
    });
    squadPanel.appendChild(this.el('span', 'title-squad-label', t('title.squadPreview', state.lang)));
    const roster = this.el('div', 'title-roster');
    for (const role of PLAYER_ROLES) {
      const level = state.profile.levels[role];
      const theme = ROLE_THEME[role];
      const card = this.el('div', 'title-roster-card');
      card.style.setProperty('--role-color', theme.css);
      card.appendChild(this.glyph('title-roster-glyph', theme.glyph));
      card.appendChild(this.el('span', 'title-roster-name', t(`unit.${role}`, state.lang)));
      card.appendChild(this.el('span', 'title-roster-level', t('title.levelShort', state.lang, { level })));
      roster.appendChild(card);
    }
    squadPanel.appendChild(roster);
    squadPanel.appendChild(this.el('span', 'title-squad-cta', `${t('title.manageSquad', state.lang)} →`));
    actions.appendChild(squadPanel);

    actions.appendChild(this.btn(
      `📖  ${t('title.openWiki', state.lang)}`,
      () => { openWikiMenu(state); },
      'btn title-wiki-btn',
    ));

    const playBtn = this.btn(`▶  ${t('btn.start', state.lang)}`, () => { startGame(state); }, 'btn btn-go title-play');
    actions.appendChild(playBtn);
    actions.appendChild(this.el('p', 'title-hint', t('title.playHint', state.lang)));
    hero.appendChild(actions);
    screen.appendChild(hero);

    this.root.appendChild(screen);
  }

  private buildTitleStat(label: string, value: string): HTMLElement {
    const stat = this.el('div', 'title-stat');
    stat.appendChild(this.el('span', 'title-stat-value', value));
    stat.appendChild(this.el('span', 'title-stat-label', label));
    return stat;
  }

  private appendXpBadge(parent: HTMLElement, state: GameState): void {
    parent.appendChild(this.el('span', 'xp-badge', `${t('xp.label', state.lang)}: ${state.profile.xp}`));
  }

  /** Resolve a stored log entry in the current language. */
  private formatLogEntry(entry: CombatLogEntry, lang: Lang): string {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(entry.params ?? {})) {
      params[key] = typeof value === 'object' ? t(value.nameKey, lang) : value;
    }
    return t(entry.key, lang, params);
  }

  private renderSquad(state: GameState): void {
    const screen = this.el('div', 'title-screen squad-screen');
    screen.appendChild(this.el('div', 'title-vignette'));
    screen.appendChild(this.el('div', 'title-scanlines'));

    const panel = this.el('div', 'squad-menu-panel');
    panel.appendChild(this.el('p', 'title-eyebrow', t('squad.eyebrow', state.lang)));
    panel.appendChild(this.el('h1', 'squad-menu-title', t('squad.title', state.lang)));
    this.appendXpBadge(panel, state);
    panel.appendChild(this.el('p', 'panel-body squad-menu-hint', t('squad.hint', state.lang)));

    const list = this.el('div', 'squad-list');
    for (const role of PLAYER_ROLES) {
      const level = state.profile.levels[role];
      const theme = ROLE_THEME[role];
      const bonuses = getLevelBonuses(level);
      const card = this.el('div', 'squad-card');
      card.style.setProperty('--role-color', theme.css);
      card.appendChild(this.glyph('squad-card-glyph', theme.glyph));
      const info = this.el('div', 'squad-card-info');
      info.appendChild(this.el('strong', 'squad-card-name', t(`unit.${role}`, state.lang)));
      info.appendChild(this.el(
        'span',
        'squad-card-level',
        t('squad.levelLine', state.lang, {
          level,
          max: MAX_LEVEL,
          hp: bonuses.maxHpBonus,
          spd: bonuses.speedBonus,
        }),
      ));
      card.appendChild(info);

      if (level < MAX_LEVEL) {
        const cost = levelUpCost(level);
        const canBuy = canLevelUp(state.profile, role);
        const levelBtn = this.btn(
          `${t('squad.levelUp', state.lang)} (${cost} XP)`,
          () => { levelUpCharacter(state, role); },
          `btn chip squad-level-btn${canBuy ? '' : ' locked'}`,
        );
        levelBtn.disabled = !canBuy;
        card.appendChild(levelBtn);
      } else {
        card.appendChild(this.el('span', 'squad-maxed', t('squad.maxed', state.lang)));
      }
      list.appendChild(card);
    }
    panel.appendChild(list);
    panel.appendChild(this.btn(t('squad.back', state.lang), () => { closeSquadMenu(state); }, 'btn btn-go'));
    screen.appendChild(panel);
    this.root.appendChild(screen);
  }

  private renderWiki(state: GameState): void {
    const screen = this.el('div', 'title-screen squad-screen');
    screen.appendChild(this.el('div', 'title-vignette'));
    screen.appendChild(this.el('div', 'title-scanlines'));

    const panel = this.el('div', 'squad-menu-panel wiki-menu-panel');
    panel.appendChild(this.el('p', 'title-eyebrow', t('wiki.eyebrow', state.lang)));
    panel.appendChild(this.el('h1', 'squad-menu-title', t('wiki.title', state.lang)));
    panel.appendChild(this.el('p', 'panel-body squad-menu-hint', t('wiki.hint', state.lang)));

    const list = this.el('div', 'squad-list wiki-list');
    for (const role of ENEMY_ROLES) {
      const theme = ROLE_THEME[role];
      const stats = getBaseUnitStats(role);
      const card = this.el('div', 'squad-card wiki-card');
      card.style.setProperty('--role-color', theme.css);
      card.appendChild(this.glyph('squad-card-glyph', theme.glyph));
      const info = this.el('div', 'squad-card-info');
      info.appendChild(this.el('strong', 'squad-card-name', t(`unit.${role}`, state.lang)));
      info.appendChild(this.el(
        'span',
        'squad-card-level',
        t('wiki.stats', state.lang, {
          hp: stats.hp,
          speed: stats.speed,
          dice: attackDiceLabel(role),
          xp: xpForKill(role),
        }),
      ));
      info.appendChild(this.el('p', 'wiki-card-body', t(`wiki.${role}.body`, state.lang, {
        chance: Math.round(SCREAMER_SUMMON_CHANCE * 100),
      })));
      card.appendChild(info);
      list.appendChild(card);
    }
    panel.appendChild(list);
    panel.appendChild(this.el('p', 'panel-body wiki-crit-note', t('wiki.crit', state.lang)));
    panel.appendChild(this.btn(t('wiki.back', state.lang), () => { closeWikiMenu(state); }, 'btn btn-go'));
    screen.appendChild(panel);
    this.root.appendChild(screen);
  }

  private buildTurnOrder(turnOrder: Unit[], turnIndex: number, state: GameState): HTMLElement {
    const strip = this.el('div', 'turn-order');
    const n = turnOrder.length;
    for (let i = 0; i < n; i++) {
      const idx = (turnIndex + i) % n;
      const unit = turnOrder[idx];
      const theme = ROLE_THEME[unit.role];
      const chip = this.el('div', `turn-chip${i === 0 ? ' current' : ''}${!unit.alive ? ' dead' : ''}`);
      chip.style.setProperty('--role-color', theme.css);
      const glyph = this.glyph('turn-chip-glyph', unit.alive ? theme.glyph : '☠');
      chip.appendChild(glyph);
      chip.title = t(unit.nameKey, state.lang);
      strip.appendChild(chip);
    }
    return strip;
  }

  private renderCombat(state: GameState, combatScene?: CombatScene): void {
    if (!state.combat) return;
    const combat = state.combat;
    const current = getPlayerTurnUnit(combat);
    const isPlayerTurn = current !== null;
    const interactionLocked = combatScene?.animating ?? false;
    const keyboardView = !interactionLocked ? this.keyboard.getView(state) : null;

    if (combatScene) {
      const needsTarget = !interactionLocked
        && isPlayerTurn
        && !!combat.selectedAction
        && !(combat.selectedAction === 'special' && current.role === 'medic');
      combatScene.setTargetable(needsTarget ? combat.enemyUnits.filter((u) => u.alive).map((u) => u.id) : []);
      combatScene.setKeyboardFocus(keyboardView?.keyboardFocusId ?? null);
    }

    this.root.appendChild(this.buildTurnOrder(combat.turnOrder, combat.turnIndex, state));

    this.diceDisplay.mount(this.root);

    if (combat.lastRoll) {
      const r = combat.lastRoll;
      this.diceDisplay.syncRoll(rollEventKey(r), r.roll, r.damage, state.lang, r.crit);
    } else if (isPlayerTurn && !this.diceDisplay.isBusy()) {
      const previewDice = combat.selectedAction === 'special'
        ? getActionCard(current.role, 'special', state.lang).dice ?? t('dice.heal', state.lang)
        : getActionCard(current.role, 'attack', state.lang).dice ?? t('dice.unknown', state.lang);
      this.diceDisplay.setPreview(previewDice, state.lang);
    } else {
      this.diceDisplay.hide();
    }

    const bar = this.el('div', 'combat-bar');
    const top = this.el('div', 'combat-bar-top');
    top.appendChild(this.el('span', 'round-badge', `${t('round.label', state.lang)} ${state.phaseNumber}`));
    this.appendXpBadge(top, state);
    const status = this.el('span', 'combat-status', isPlayerTurn
      ? `${t('combat.playerTurn', state.lang)} · ${t(current.nameKey, state.lang)}`
      : t('combat.enemyTurn', state.lang));
    status.setAttribute('aria-live', 'polite');
    top.appendChild(status);
    if (interactionLocked) {
      top.appendChild(this.el('span', 'combat-hint', t('combat.waitDice', state.lang)));
    } else if (isPlayerTurn) {
      top.appendChild(this.el(
        'span',
        'combat-hint',
        combat.selectedAction
          ? t('combat.keyboard.target', state.lang)
          : t('combat.keyboard.action', state.lang),
      ));
    }

    if (isPlayerTurn && combat.selectedAction && !interactionLocked) {
      top.appendChild(this.el('span', 'combat-hint', t('combat.selectTarget', state.lang)));
      top.appendChild(this.btn(t('btn.cancel', state.lang), () => {
        cancelCombatAction(state);
      }, 'btn chip combat-cancel-btn'));
      if (combat.selectedAction === 'special' && current.role === 'medic') {
        top.appendChild(this.btn(t('combat.special.title.medic', state.lang), () => { selectCombatTarget(state, current.id); }, 'btn chip triage-btn'));
      }
    }
    bar.appendChild(top);

    if (isPlayerTurn && !combat.selectedAction) {
      const actions = this.el('div', 'combat-actions');
      const attackInfo = getActionCard(current.role, 'attack', state.lang);
      const specialInfo = getActionCard(current.role, 'special', state.lang);
      const specialReady = current.basicAttacks >= SPECIAL_CHARGE_REQUIRED;
      const chargeLabel = specialReady
        ? t('combat.special.ready', state.lang)
        : `🔒 ${current.basicAttacks}/${SPECIAL_CHARGE_REQUIRED} ${t('combat.special.basic', state.lang)}`;
      if (specialReady) {
        const readyBanner = this.el('div', 'special-ready-banner');
        readyBanner.append(
          this.glyph('special-ready-icon', '⚡'),
          this.el('span', 'special-ready-copy', t('combat.special.readyAlert', state.lang)),
        );
        bar.appendChild(readyBanner);
      }
      actions.appendChild(this.actionBtn(t('btn.attack', state.lang), state.lang, attackInfo, () => {
        selectCombatAction(state, 'attack');
      }, 'attack', interactionLocked, undefined, keyboardView?.actionIndex === 0));
      actions.appendChild(this.actionBtn(t('btn.special', state.lang), state.lang, specialInfo, () => {
        selectCombatAction(state, 'special');
      }, 'special', interactionLocked || !specialReady, chargeLabel, keyboardView?.actionIndex === 1, specialReady));
      bar.appendChild(actions);
    }

    const log = this.el('div', 'combat-log');
    log.setAttribute('aria-live', 'polite');
    log.textContent = combat.log
      .slice(-LOG_VISIBLE_LINES)
      .map((entry) => this.formatLogEntry(entry, state.lang))
      .join(' · ');
    bar.appendChild(log);

    this.root.appendChild(bar);
  }

  private renderDeployment(state: GameState): void {
    if (!state.deployment) return;
    const deployment = state.deployment;

    const bar = this.el('div', 'deployment-bar');
    const top = this.el('div', 'deployment-bar-top');
    top.appendChild(this.el('span', 'round-badge', `${t('round.label', state.lang)} ${state.phaseNumber}`));
    this.appendXpBadge(top, state);
    top.appendChild(this.el('span', 'deployment-title', t('deployment.title', state.lang)));
    top.appendChild(this.el('span', 'deployment-hint', t('deployment.hint', state.lang)));
    bar.appendChild(top);

    const roster = this.el('div', 'deployment-roster');
    for (const unit of deployment.units) {
      const theme = ROLE_THEME[unit.role];
      const chip = this.el(
        'button',
        `deployment-chip${deployment.selectedUnitId === unit.id ? ' selected' : ''}`,
      ) as HTMLButtonElement;
      chip.type = 'button';
      chip.dataset.focusKey = `chip:${unit.id}`;
      chip.style.setProperty('--role-color', theme.css);
      chip.innerHTML = `<span class="deployment-chip-glyph" aria-hidden="true">${theme.glyph}</span><span>${t(unit.nameKey, state.lang)}</span>`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        unlockAudio();
        playSfx('click');
        selectDeploymentUnit(state, unit.id);
      });
      roster.appendChild(chip);
    }
    bar.appendChild(roster);

    bar.appendChild(
      this.btn(
        t('deployment.confirm', state.lang),
        () => {
          confirmDeployment(state);
        },
        'btn btn-go deployment-confirm',
      ),
    );

    this.root.appendChild(bar);
  }

  private renderRoundBreak(state: GameState): void {
    const player = getPlayerSquad(state);
    const survivors = player.members.filter((member) => member.alive);
    const wrap = this.el('div', 'overlay round-overlay');
    wrap.appendChild(this.el('p', 'eyebrow', t('round.cleared', state.lang)));
    wrap.appendChild(this.el('h1', 'title-main', `${t('round.label', state.lang)} ${state.phaseNumber}`));
    wrap.appendChild(
      this.el(
        'p',
        'panel-body',
        `${t('round.survivors', state.lang)}: ${survivors.length}/${player.members.length}. ${t('round.recovered', state.lang)}`,
      ),
    );
    if (state.runXpGained > 0) {
      wrap.appendChild(this.el('p', 'panel-body', `${t('xp.runGained', state.lang)}: +${state.runXpGained}`));
    }
    wrap.appendChild(
      this.btn(
        t('round.next', state.lang),
        () => {
          startNextRound(state);
        },
        'btn btn-go',
      ),
    );
    this.root.appendChild(wrap);
  }

  private renderEnd(state: GameState): void {
    const wrap = this.el('div', 'overlay end-overlay lose');
    wrap.appendChild(this.el('p', 'eyebrow', `${t('round.reached', state.lang)} ${state.phaseNumber}`));
    wrap.appendChild(this.el('h1', 'title-main', t('end.defeat', state.lang)));
    wrap.appendChild(this.el('p', 'panel-body', t('end.defeatSub', state.lang)));
    wrap.appendChild(this.el('p', 'panel-body', `${t('xp.label', state.lang)}: ${state.profile.xp}`));
    if (state.runXpGained > 0) {
      wrap.appendChild(this.el('p', 'panel-body', `${t('xp.runGained', state.lang)}: +${state.runXpGained}`));
    }
    if (state.profile.bestRound > 0) {
      wrap.appendChild(this.el('p', 'panel-body', `${t('xp.bestRound', state.lang)}: ${state.profile.bestRound}`));
    }
    wrap.appendChild(this.btn(t('btn.restart', state.lang), () => { restartGame(state); }, 'btn btn-go'));
    this.root.appendChild(wrap);
  }
}
