import type { DistrictNode, GameState, Squad } from '../game/types';
import { getReachableNodes } from '../map/district';
import { getAliveMembers } from '../game/state';

export function chooseRivalDestination(
  state: GameState,
  squad: Squad,
  district: DistrictNode[],
): string {
  const options = getReachableNodes(district, squad.nodeId, true);
  const poiNodes = options.filter((n) => n.poi);
  const unownedPoi = poiNodes.find((n) => !state.poiOwners[n.id] || state.poiOwners[n.id] !== squad.id);
  if (unownedPoi) return unownedPoi.id;

  const player = state.squads.find((s) => s.isPlayer && !s.eliminated);
  if (player) {
    const towardPlayer = options.find((n) => n.id === player.nodeId);
    if (towardPlayer && getAliveMembers(squad).length >= 2) return towardPlayer.id;
    const adjacentToPlayer = options.find((n) =>
      district.find((d) => d.id === player.nodeId)?.neighbors.includes(n.id),
    );
    if (adjacentToPlayer) return adjacentToPlayer.id;
  }

  const zombieNode = options.find((n) =>
    state.zombiePacks.some((z) => z.nodeId === n.id && z.units.some((u) => u.alive)),
  );
  if (zombieNode && squad.power >= 1) return zombieNode.id;

  const nonCurrent = options.filter((n) => n.id !== squad.nodeId);
  if (nonCurrent.length) {
    return nonCurrent[Math.floor(Math.random() * nonCurrent.length)].id;
  }
  return squad.nodeId;
}

export function resolveVoteMajority(
  votes: Record<string, string | null>,
  voterIds: string[],
): { winner: string | null; tied: boolean; options: string[] } {
  const counts = new Map<string, number>();
  for (const voterId of voterIds) {
    const dest = votes[voterId];
    if (!dest) continue;
    counts.set(dest, (counts.get(dest) ?? 0) + 1);
  }

  let max = 0;
  let options: string[] = [];
  for (const [dest, count] of counts) {
    if (count > max) {
      max = count;
      options = [dest];
    } else if (count === max) {
      options.push(dest);
    }
  }

  if (!options.length) return { winner: null, tied: false, options: [] };
  if (options.length === 1) return { winner: options[0], tied: false, options };
  return { winner: null, tied: true, options };
}
