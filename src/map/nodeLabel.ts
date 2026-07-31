import type { Lang } from '../game/types';
import type { DistrictNode } from '../game/types';
import { t } from '../i18n/strings';

export function getNodeLabel(node: DistrictNode, lang: Lang): string {
  if (node.label) return node.label[lang] ?? node.label.en;
  const translated = t(node.labelKey, lang);
  if (translated !== node.labelKey) return translated;
  return node.id.replace(/_/g, ' ');
}
