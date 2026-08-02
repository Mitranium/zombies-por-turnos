import type { Lang, UnitRole } from '../game/types';
import { diceLabelForRole } from '../combat/dice';
import { t } from '../i18n/strings';

export interface ActionCardInfo {
  dice: string | null;
  title: string;
  body: string;
  icon: string;
}

export interface RoleTheme {
  hex: number;
  css: string;
  glyph: string;
}

export const ROLE_THEME: Record<UnitRole, RoleTheme> = {
  athlete: { hex: 0xd4a017, css: '#d4a017', glyph: '🏃' },
  medic: { hex: 0x4a9e8c, css: '#4a9e8c', glyph: '⚕' },
  criminal: { hex: 0xc0392b, css: '#c0392b', glyph: '🔪' },
  shambler: { hex: 0x4a7a3a, css: '#4a7a3a', glyph: '🧟' },
  screamer: { hex: 0xb8860b, css: '#b8860b', glyph: '📣' },
  ripper: { hex: 0x9b2c6a, css: '#9b2c6a', glyph: '🗡' },
};

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
): ActionCardInfo {
  const dice = action === 'attack' ? attackDiceLabel(role) : specialDiceLabel(role);
  const title = t(`combat.${action}.title.${role}`, lang);
  const body = t(`combat.${action}.body.${role}`, lang);
  const icons: Record<UnitRole, { attack: string; special: string }> = {
    athlete: { attack: '⚔', special: '💥' },
    medic: { attack: '💉', special: '🩹' },
    criminal: { attack: '🔪', special: '☠' },
    shambler: { attack: '✊', special: '✊' },
    screamer: { attack: '✊', special: '📢' },
    ripper: { attack: '✊', special: '✊' },
  };
  return { dice, title, body, icon: icons[role][action] };
}
