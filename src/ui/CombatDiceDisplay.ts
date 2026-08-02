import type { DiceRollResult, Lang } from '../game/types';
import { t } from '../i18n/strings';

type DicePhase = 'hidden' | 'preview' | 'rolling' | 'result';

// The actual dice are rendered as physically-simulated 3D objects inside
// CombatScene (see combat/diceRig.ts). This overlay only supplies the
// surrounding text: what you're about to roll, and the final breakdown.
export class CombatDiceDisplay {
  private readonly el: HTMLElement;
  private readonly totalEl: HTMLElement;
  private readonly damageEl: HTMLElement;
  private readonly previewEl: HTMLElement;

  private phase: DicePhase = 'hidden';
  private rollKey = '';
  private targetRoll: DiceRollResult | null = null;
  private damage = 0;
  private rollTimer = 0;
  private resultTimer = 0;
  private settleAt = 1.2;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'combat-dice-stage hidden';

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'dice-preview';
    this.el.appendChild(this.previewEl);

    this.totalEl = document.createElement('div');
    this.totalEl.className = 'dice-total';
    this.el.appendChild(this.totalEl);

    this.damageEl = document.createElement('div');
    this.damageEl.className = 'dice-damage';
    this.el.appendChild(this.damageEl);
  }

  mount(parent: HTMLElement): void {
    if (this.el.parentElement !== parent) parent.appendChild(this.el);
  }

  hide(): void {
    this.phase = 'hidden';
    this.el.classList.add('hidden');
  }

  setPreview(formula: string, lang: Lang): void {
    if (this.phase === 'rolling') return;
    this.phase = 'preview';
    this.el.classList.remove('hidden', 'result');
    this.el.classList.add('preview-mode');
    this.totalEl.style.display = 'none';
    this.damageEl.style.display = 'none';
    this.previewEl.style.display = 'flex';
    this.previewEl.innerHTML = `
      <span class="dice-preview-label">${t('combat.dice.ready', lang)}</span>
      <span class="dice-formula">${formula}</span>
    `;
  }

  startRoll(key: string, roll: DiceRollResult, damage: number, lang: Lang): void {
    if (key === this.rollKey && this.phase === 'result') return;
    this.rollKey = key;
    this.targetRoll = roll;
    this.damage = damage;
    this.phase = 'rolling';
    this.rollTimer = 0;
    this.resultTimer = 0;
    this.settleAt = 1.15 + roll.rolls.length * 0.12;

    this.el.classList.remove('hidden', 'preview-mode');
    this.el.classList.add('rolling-mode');
    this.previewEl.style.display = 'none';
    this.totalEl.style.display = 'none';
    this.damageEl.style.display = 'block';
    this.damageEl.textContent = t('combat.dice.rolling', lang);
  }

  tick(dt: number, lang: Lang): void {
    if (this.phase !== 'rolling' && this.phase !== 'result') return;
    if (!this.targetRoll) return;

    if (this.phase === 'rolling') {
      this.rollTimer += dt;
      if (this.rollTimer >= this.settleAt) {
        this.phase = 'result';
        this.el.classList.remove('rolling-mode');
        this.el.classList.add('result');
        this.totalEl.style.display = 'block';
        const breakdown = this.targetRoll.rolls.join(' + ') + (this.targetRoll.bonus > 0 ? ` + ${this.targetRoll.bonus}` : '');
        this.totalEl.textContent = this.targetRoll.rolls.length > 1 || this.targetRoll.bonus > 0
          ? `${breakdown} = ${this.targetRoll.total}`
          : `= ${this.targetRoll.total}`;
        this.damageEl.textContent = `${this.damage} ${t('combat.dice.damage', lang)}`;
        this.resultTimer = 0;
      }
      return;
    }

    this.resultTimer += dt;
    if (this.resultTimer > 2.2) {
      this.phase = 'hidden';
      this.el.classList.add('hidden');
      this.el.classList.remove('result');
    }
  }

  syncRoll(key: string, roll: DiceRollResult, damage: number, lang: Lang): void {
    if (key !== this.rollKey) this.startRoll(key, roll, damage, lang);
  }

  isBusy(): boolean {
    return this.phase === 'rolling' || this.phase === 'result';
  }
}
