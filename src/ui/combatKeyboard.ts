import type { GameState } from '../game/types';
import {
  getPlayerTurnUnit,
  selectCombatAction,
  selectCombatTarget,
  cancelCombatAction,
} from '../game/phases';
import { SPECIAL_CHARGE_REQUIRED } from '../game/balance';
import type { CombatScene } from '../combat/CombatScene';
import { playSfx, unlockAudio } from '../audio/sfx';

export type CombatKey =
  | 'prev'
  | 'next'
  | 'confirm'
  | 'cancel';

const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W']);
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S']);
const CONFIRM_KEYS = new Set(['Enter', ' ', 'Spacebar']);
const CANCEL_KEYS = new Set(['Escape', 'Backspace']);

export function combatKeyFromEvent(event: KeyboardEvent): CombatKey | null {
  if (PREV_KEYS.has(event.key)) return 'prev';
  if (NEXT_KEYS.has(event.key)) return 'next';
  if (CONFIRM_KEYS.has(event.key)) return 'confirm';
  if (CANCEL_KEYS.has(event.key)) return 'cancel';
  return null;
}

export interface CombatKeyboardView {
  actionIndex: number;
  targetIndex: number;
  targetEnemyIds: string[];
  keyboardFocusId: string | null;
}

export class CombatKeyboardController {
  private actionIndex = 0;
  private targetIndex = 0;
  private contextKey = '';

  reset(): void {
    this.actionIndex = 0;
    this.targetIndex = 0;
    this.contextKey = '';
  }

  getView(state: GameState): CombatKeyboardView | null {
    if (state.phase !== 'combat' || !state.combat) return null;
    const combat = state.combat;
    const current = getPlayerTurnUnit(combat);
    if (!current) return null;

    const aliveEnemyIds = combat.enemyUnits.filter((unit) => unit.alive).map((unit) => unit.id);
    const key = [
      combat.turnIndex,
      current.id,
      combat.selectedAction,
      aliveEnemyIds.join(','),
    ].join('|');

    if (key !== this.contextKey) {
      this.contextKey = key;
      if (!combat.selectedAction) {
        this.actionIndex = 0;
      } else {
        this.targetIndex = Math.min(this.targetIndex, Math.max(0, aliveEnemyIds.length - 1));
      }
    }

    const needsTarget = !!combat.selectedAction && !(combat.selectedAction === 'special' && current.role === 'medic');
    const keyboardFocusId = needsTarget ? aliveEnemyIds[this.targetIndex] ?? null : null;

    return {
      actionIndex: this.actionIndex,
      targetIndex: this.targetIndex,
      targetEnemyIds: aliveEnemyIds,
      keyboardFocusId,
    };
  }

  handle(
    key: CombatKey,
    state: GameState,
    combatScene: CombatScene | undefined,
  ): boolean {
    if (state.phase !== 'combat' || !state.combat || combatScene?.animating) return false;

    const combat = state.combat;
    const current = getPlayerTurnUnit(combat);
    if (!current) return false;

    unlockAudio();

    if (!combat.selectedAction) {
      const specialReady = current.basicAttacks >= SPECIAL_CHARGE_REQUIRED;

      if (key === 'prev') {
        this.actionIndex = 0;
        playSfx('click');
        return true;
      }
      if (key === 'next') {
        this.actionIndex = 1;
        playSfx('click');
        return true;
      }
      if (key === 'confirm') {
        const action = this.actionIndex === 0 ? 'attack' : 'special';
        if (action === 'special' && !specialReady) {
          playSfx('locked');
          return true;
        }
        selectCombatAction(state, action);
        if (action === 'special' && current.role === 'medic') {
          selectCombatTarget(state, current.id);
        } else {
          this.targetIndex = 0;
        }
        return true;
      }
      return false;
    }

    if (combat.selectedAction === 'special' && current.role === 'medic') {
      if (key === 'confirm') {
        selectCombatTarget(state, current.id);
        return true;
      }
      if (key === 'cancel') {
        cancelCombatAction(state);
        return true;
      }
      return false;
    }

    const enemies = combat.enemyUnits.filter((unit) => unit.alive);
    if (!enemies.length) return false;

    if (key === 'prev') {
      this.targetIndex = (this.targetIndex - 1 + enemies.length) % enemies.length;
      playSfx('click');
      return true;
    }
    if (key === 'next') {
      this.targetIndex = (this.targetIndex + 1) % enemies.length;
      playSfx('click');
      return true;
    }
    if (key === 'confirm') {
      const target = enemies[this.targetIndex];
      if (!target) return false;
      selectCombatTarget(state, target.id);
      return true;
    }
    if (key === 'cancel') {
      cancelCombatAction(state);
      return true;
    }

    return false;
  }
}
