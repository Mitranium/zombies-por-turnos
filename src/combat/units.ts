import type { SkillResult, Unit } from '../game/types';
import { createUnit, uid } from '../game/state';
import { getDiceConfig, rollDice } from './dice';
import { combatDistance, prefersBackTargets } from './hexGrid';

export function performAttack(
  attacker: Unit,
  target: Unit,
  special = false,
): SkillResult {
  const config = getDiceConfig(attacker.role, special);
  const rolled = rollDice(config);

  const damage = Math.max(1, rolled.total);
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) target.alive = false;

  return {
    damage,
    logKey: 'log.hit',
    logParams: { amount: damage },
    diceRoll: rolled,
  };
}

export function performSpecial(
  attacker: Unit,
  target: Unit | null,
  allies: Unit[],
  enemies: Unit[],
): SkillResult {
  switch (attacker.role) {
    case 'athlete': {
      const dmg = performAttack(attacker, target!, true);
      return { ...dmg, logKey: 'log.hit' };
    }
    case 'medic': {
      const healTarget = target ?? allies.find((a) => a.alive)!;
      const amount = 10;
      healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + amount);
      return { heal: amount, logKey: 'log.heal', logParams: { amount } };
    }
    case 'criminal': {
      const result = performAttack(attacker, target!, true);
      const selfDamage = 2;
      attacker.hp = Math.max(0, attacker.hp - selfDamage);
      if (attacker.hp <= 0) attacker.alive = false;
      return { ...result, selfDamage };
    }
    case 'screamer': {
      return { summon: 'shambler', logKey: 'log.summon' };
    }
    case 'ripper': {
      const backTarget = enemies.find((e) => e.alive && e.gridRow >= 2) ?? target!;
      return performAttack(attacker, backTarget);
    }
    default:
      return performAttack(attacker, target!);
  }
}

export function triageHeal(allies: Unit[]): SkillResult {
  const amount = 8;
  for (const ally of allies.filter((a) => a.alive)) {
    ally.hp = Math.min(ally.maxHp, ally.hp + amount);
  }
  return { heal: amount, logKey: 'log.heal', logParams: { amount } };
}

export function pickAiTarget(attacker: Unit, enemies: Unit[]): Unit | null {
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return null;

  const preferBack = prefersBackTargets(attacker.role);
  return alive.reduce((best, candidate) => {
    const bestDist = combatDistance(attacker, 'enemy', best, 'player');
    const candDist = combatDistance(attacker, 'enemy', candidate, 'player');
    if (candDist < bestDist) return candidate;
    if (candDist > bestDist) return best;
    if (preferBack) return candidate.gridRow > best.gridRow ? candidate : best;
    return candidate.gridRow < best.gridRow ? candidate : best;
  }, alive[0]);
}

export function summonShambler(squadId: string): Unit {
  return createUnit('shambler', squadId, 'front', 'unit.shambler', { id: uid('shambler') });
}

export function cloneUnitsForCombat(units: Unit[]): Unit[] {
  return units.map((u) => ({ ...u }));
}

export function sortByInitiative(units: Unit[]): Unit[] {
  return [...units].sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id));
}
