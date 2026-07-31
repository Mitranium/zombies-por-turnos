import type { DistrictNode, SaavedraMapData } from '../game/types';
import saavedraData from './data/saavedra.json';

export function getMapData(): SaavedraMapData {
  return saavedraData as SaavedraMapData;
}

export function createDistrict(): DistrictNode[] {
  return getMapData().nodes;
}

export function getReachableNodes(
  district: DistrictNode[],
  fromNodeId: string,
  includeHold = true,
): DistrictNode[] {
  const from = district.find((n) => n.id === fromNodeId);
  if (!from) return [];
  const nodes = from.neighbors
    .map((id) => district.find((n) => n.id === id))
    .filter((n): n is DistrictNode => !!n);
  if (includeHold) return [from, ...nodes];
  return nodes;
}

export function nodeDisplayName(node: DistrictNode, lang: 'en' | 'es'): string {
  if (node.label) return node.label[lang] ?? node.label.en;
  return node.labelKey;
}
