import type { SkillResult, Squad, Unit, UnitRole } from '../game/types';
import { applyPowerBonuses } from '../game/state';
import { createUnit, uid } from '../game/state';
import { getDiceConfig, rollDice } from './dice';

export function performAttack(
  attacker: Unit,
  target: Unit,
  squad?: Squad,
  special = false,
): SkillResult {
  const config = getDiceConfig(attacker.role, special);
  const rolled = rollDice(config);

  let mult = squad ? applyPowerBonuses(squad, attacker).damageMult : 1;
  if (squad?.policeBuff && attacker.role === 'criminal') mult += 0.15;

  const damage = Math.max(1, Math.round(rolled.total * mult));
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
  squad?: Squad,
): SkillResult {
  switch (attacker.role) {
    case 'athlete': {
      const dmg = performAttack(attacker, target!, squad, true);
      return { ...dmg, logKey: 'log.hit' };
    }
    case 'medic': {
      const healTarget = target ?? allies.find((a) => a.alive)!;
      const amount = 10;
      healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + amount);
      return { heal: amount, logKey: 'log.heal', logParams: { amount } };
    }
    case 'criminal': {
      const result = performAttack(attacker, target!, squad, true);
      const selfDamage = 2;
      attacker.hp = Math.max(0, attacker.hp - selfDamage);
      if (attacker.hp <= 0) attacker.alive = false;
      return { ...result, selfDamage };
    }
    case 'screamer': {
      return { summon: 'shambler', logKey: 'log.summon' };
    }
    case 'ripper': {
      const backTarget = enemies.find((e) => e.alive && e.rank === 'back') ?? target!;
      return performAttack(attacker, backTarget, squad);
    }
    default:
      return performAttack(attacker, target!, squad);
  }
}

export function triageHeal(allies: Unit[]): SkillResult {
  for (const ally of allies.filter((a) => a.alive)) {
    ally.hp = Math.min(ally.maxHp, ally.hp + 4);
  }
  return { heal: 4, logKey: 'log.heal', logParams: { amount: 4 } };
}

export function pickAiTarget(attacker: Unit, enemies: Unit[]): Unit | null {
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return null;

  if (attacker.role === 'ripper') {
    return alive.find((e) => e.rank === 'back') ?? alive[0];
  }
  if (attacker.role === 'criminal' || attacker.role === 'rival') {
    return alive.find((e) => e.rank === 'back') ?? alive[0];
  }
  return alive.find((e) => e.rank === 'front') ?? alive[0];
}

export function pickAiHealTarget(allies: Unit[]): Unit | null {
  const alive = allies.filter((a) => a.alive);
  if (!alive.length) return null;
  return alive.reduce((lowest, u) => (u.hp < lowest.hp ? u : lowest), alive[0]);
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

export function getDefaultRank(role: UnitRole): 'front' | 'back' {
  if (role === 'medic') return 'back';
  if (role === 'screamer') return 'back';
  return 'front';
}
