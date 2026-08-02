import type { UnitRole } from '../game/types';

export interface DiceConfig {
  count: number;
  sides: number;
  bonus: number;
}

export interface DiceRoll {
  rolls: number[];
  total: number;
  sides: number;
  bonus: number;
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

export function diceLabel(config: DiceConfig): string {
  const base = config.count > 1 ? `${config.count}d${config.sides}` : `d${config.sides}`;
  return config.bonus > 0 ? `${base}+${config.bonus}` : base;
}

export function diceLabelForRole(role: UnitRole, special = false): string {
  return diceLabel(getDiceConfig(role, special));
}
