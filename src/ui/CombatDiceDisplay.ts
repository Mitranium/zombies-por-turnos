import type { DiceRollResult, Lang } from '../game/types';
import { t } from '../i18n/strings';

type DicePhase = 'hidden' | 'preview' | 'rolling' | 'result';

export class CombatDiceDisplay {
  private readonly el: HTMLElement;
  private readonly rowEl: HTMLElement;
  private readonly totalEl: HTMLElement;
  private readonly damageEl: HTMLElement;
  private readonly previewEl: HTMLElement;

  private phase: DicePhase = 'hidden';
  private rollKey = '';
  private targetRoll: DiceRollResult | null = null;
  private damage = 0;
  private faceEls: HTMLElement[] = [];
  private rollTimer = 0;
  private resultTimer = 0;
  private tickAccum = 0;
  private sides = 6;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'combat-dice-stage hidden';

    this.previewEl = document.createElement('div');
    this.previewEl.className = 'dice-preview';
    this.el.appendChild(this.previewEl);

    this.rowEl = document.createElement('div');
    this.rowEl.className = 'dice-row';
    this.el.appendChild(this.rowEl);

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
    this.rowEl.style.display = 'none';
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
    this.tickAccum = 0;
    this.sides = roll.sides;

    this.el.classList.remove('hidden', 'preview-mode');
    this.el.classList.add('rolling-mode');
    this.previewEl.style.display = 'none';
    this.rowEl.style.display = 'flex';
    this.totalEl.style.display = 'none';
    this.damageEl.style.display = 'none';

    this.rowEl.innerHTML = '';
    this.faceEls = [];
    for (let i = 0; i < roll.rolls.length; i++) {
      const face = document.createElement('div');
      face.className = 'die-face rolling';
      face.textContent = '?';
      this.rowEl.appendChild(face);
      this.faceEls.push(face);
    }
    if (roll.bonus > 0) {
      const bonus = document.createElement('span');
      bonus.className = 'die-bonus';
      bonus.textContent = `+${roll.bonus}`;
      this.rowEl.appendChild(bonus);
    }
    this.totalEl.textContent = '';
    this.damageEl.textContent = t('combat.dice.rolling', lang);
    this.damageEl.style.display = 'block';
  }

  tick(dt: number, lang: Lang): void {
    if (this.phase !== 'rolling' && this.phase !== 'result') return;
    if (!this.targetRoll) return;

    if (this.phase === 'rolling') {
      this.rollTimer += dt;
      this.tickAccum += dt;
      const tickEvery = Math.max(0.045, 0.14 - this.rollTimer * 0.1);
      const settleAt = 0.5 + this.faceEls.length * 0.2;

      if (this.tickAccum >= tickEvery) {
        this.tickAccum = 0;
        for (let i = 0; i < this.faceEls.length; i++) {
          const face = this.faceEls[i];
          const settleTime = 0.3 + i * 0.2;
          if (this.rollTimer >= settleTime) {
            face.textContent = String(this.targetRoll.rolls[i]);
            face.classList.remove('rolling');
            face.classList.add('landed');
          } else {
            face.textContent = String(1 + Math.floor(Math.random() * this.sides));
          }
        }
      }

      if (this.rollTimer >= settleAt) {
        this.phase = 'result';
        this.el.classList.remove('rolling-mode');
        this.el.classList.add('result');
        this.totalEl.style.display = 'block';
        this.totalEl.textContent = `= ${this.targetRoll.total}`;
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
