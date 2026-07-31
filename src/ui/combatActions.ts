import type { Lang, UnitRole } from '../game/types';
import { diceLabelForRole } from '../combat/dice';
import { t } from '../i18n/strings';

export interface ActionCardInfo {
  dice: string | null;
  title: string;
  body: string;
  icon: string;
}

export function attackDiceLabel(role: UnitRole): string {
  return diceLabelForRole(role, false);
}

export function specialDiceLabel(role: UnitRole): string | null {
  if (role === 'medic') return null;
  return diceLabelForRole(role, true);
}

export function getActionCard(
  role: UnitRole,
  action: 'attack' | 'special',
  lang: Lang,
  powerMult = 1,
): ActionCardInfo {
  const dice = action === 'attack' ? attackDiceLabel(role) : specialDiceLabel(role);
  const title = t(`combat.${action}.title.${role}`, lang);
  let body = t(`combat.${action}.body.${role}`, lang);
  if (action === 'attack' && powerMult > 1) {
    body += ` ${t('combat.powerBonus', lang, { pct: Math.round((powerMult - 1) * 100) })}`;
  }
  const icons: Record<UnitRole, { attack: string; special: string }> = {
    athlete: { attack: '⚔', special: '💥' },
    medic: { attack: '💉', special: '🩹' },
    criminal: { attack: '🔪', special: '☠' },
    shambler: { attack: '✊', special: '✊' },
    screamer: { attack: '✊', special: '📢' },
    ripper: { attack: '✊', special: '✊' },
    rival: { attack: '⚔', special: '⚔' },
  };
  return { dice, title, body, icon: icons[role][action] };
}
