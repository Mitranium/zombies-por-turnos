import type { DiceRollResult, UnitRole } from '../game/types';

export interface DiceConfig {
  count: number;
  sides: number;
  bonus: number;
}

export type DiceRoll = DiceRollResult;

export interface RollEvent {
  attackerId: string;
  targetId: string;
  roll: DiceRoll;
  damage: number;
}

/**
 * Stable identity of a dice event. Shared by the 3D dice rig and the text
 * overlay so both animate exactly once per real roll.
 */
export function rollEventKey(event: RollEvent): string {
  return `${event.attackerId}:${event.targetId}:${event.roll.rolls.join(',')}:${event.damage}`;
}

const ROLE_DICE: Record<UnitRole, DiceConfig> = {
  athlete: { count: 2, sides: 6, bonus: 1 },
  medic: { count: 1, sides: 4, bonus: 1 },
  criminal: { count: 1, sides: 8, bonus: 1 },
  shambler: { count: 1, sides: 6, bonus: 0 },
  screamer: { count: 1, sides: 4, bonus: 0 },
  ripper: { count: 1, sides: 10, bonus: 0 },
};

const SPECIAL_DICE: Partial<Record<UnitRole, DiceConfig>> = {
  athlete: { count: 2, sides: 8, bonus: 2 },
  criminal: { count: 2, sides: 6, bonus: 0 },
};

export function getDiceConfig(role: UnitRole, special = false): DiceConfig {
  if (special && SPECIAL_DICE[role]) return SPECIAL_DICE[role]!;
  return ROLE_DICE[role];
}

export function rollDice(config: DiceConfig): DiceRoll {
  const rolls: number[] = [];
  for (let i = 0; i < config.count; i++) {
    rolls.push(1 + Math.floor(Math.random() * config.sides));
  }
  const total = rolls.reduce((a, b) => a + b, 0) + config.bonus;
  return { rolls, total, sides: config.sides, bonus: config.bonus };
}

/** A critical hit: every die landed on its highest face. */
export function isCritRoll(roll: DiceRollResult): boolean {
  return roll.rolls.length > 0 && roll.rolls.every((value) => value === roll.sides);
}

export function diceLabel(config: DiceConfig): string {
  const base = config.count > 1 ? `${config.count}d${config.sides}` : `d${config.sides}`;
  return config.bonus > 0 ? `${base}+${config.bonus}` : base;
}

export function diceLabelForRole(role: UnitRole, special = false): string {
  return diceLabel(getDiceConfig(role, special));
}
