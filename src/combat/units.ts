import type { SkillResult, Unit } from '../game/types';
import { createUnit, uid } from '../game/state';
import {
  RECKLESS_SELF_DAMAGE,
  TRIAGE_HEAL_AMOUNT,
} from '../game/balance';
import { getDiceConfig, isCritRoll, rollDice } from './dice';
import { combatDistance, prefersBackTargets } from './hexGrid';

export function performAttack(
  attacker: Unit,
  target: Unit,
  special = false,
): SkillResult {
  const config = getDiceConfig(attacker.role, special);
  const rolled = rollDice(config);

  // All-max dice double the roll: a critical hit, for zombies and survivors
  // alike (see the wiki note).
  const crit = isCritRoll(rolled);
  const damage = Math.max(1, crit ? rolled.total * 2 : rolled.total);
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) target.alive = false;

  return {
    damage,
    crit,
    logKey: crit ? 'log.crit' : 'log.hit',
    logParams: { amount: damage },
    diceRoll: rolled,
  };
}

/**
 * Special attack for player characters. The medic's special is a heal and goes
 * through `triageHeal` instead.
 */
export function performSpecial(attacker: Unit, target: Unit): SkillResult {
  const result = performAttack(attacker, target, true);
  const logKey = result.crit ? 'log.specialCrit' : 'log.special';
  if (attacker.role === 'criminal') {
    attacker.hp = Math.max(0, attacker.hp - RECKLESS_SELF_DAMAGE);
    if (attacker.hp <= 0) attacker.alive = false;
    return { ...result, selfDamage: RECKLESS_SELF_DAMAGE, logKey };
  }
  return { ...result, logKey };
}

export function triageHeal(allies: Unit[]): SkillResult {
  const amount = TRIAGE_HEAL_AMOUNT;
  for (const ally of allies.filter((a) => a.alive)) {
    ally.hp = Math.min(ally.maxHp, ally.hp + amount);
  }
  return { heal: amount, logKey: 'log.triage', logParams: { amount } };
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
