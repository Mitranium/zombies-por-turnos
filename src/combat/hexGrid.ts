import type { Unit, UnitRole } from '../game/types';

/** Local grid shown to the player (per side). */
export const GRID_SIZE = 3;
export const HEX_RADIUS = 0.58;

/** Unified battle grid: 3 player cols + 3 enemy cols, 3 rows deep. */
export const PLAYER_ZONE_COLS = 3;

export interface GridPos {
  col: number;
  row: number;
}

export type GridSide = 'player' | 'enemy';

export function isValidGridCell(col: number, row: number): boolean {
  return col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE;
}

export function gridKey(col: number, row: number): string {
  return `${col},${row}`;
}

function oddRToAxial(col: number, row: number): { q: number; r: number } {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}

export function hexDistance(a: GridPos, b: GridPos): number {
  const ac = oddRToAxial(a.col, a.row);
  const bc = oddRToAxial(b.col, b.row);
  return (
    (Math.abs(ac.q - bc.q)
      + Math.abs(ac.q + ac.r - bc.q - bc.r)
      + Math.abs(ac.r - bc.r))
    / 2
  );
}

/** Map a unit's local 3×3 cell to the shared 6×3 battle grid. */
export function toBattlePos(unit: Unit, side: GridSide): GridPos {
  return {
    col: side === 'player' ? unit.gridCol : unit.gridCol + PLAYER_ZONE_COLS,
    row: unit.gridRow,
  };
}

export function combatDistance(
  attacker: Unit,
  attackerSide: GridSide,
  target: Unit,
  targetSide: GridSide,
): number {
  return hexDistance(toBattlePos(attacker, attackerSide), toBattlePos(target, targetSide));
}

export function gridToWorld(col: number, row: number, side: GridSide): { x: number; y: number; z: number } {
  const size = HEX_RADIUS;
  const xSpacing = size * Math.sqrt(3);
  const zSpacing = size * 1.5;
  const xOffset = row & 1 ? xSpacing / 2 : 0;
  const gridWidth = (GRID_SIZE - 1) * xSpacing + xSpacing / 2;
  const gridDepth = (GRID_SIZE - 1) * zSpacing;
  const localX = col * xSpacing + xOffset - gridWidth / 2;
  const localZ = row * zSpacing - gridDepth / 2;
  const centerX = side === 'player' ? -5.0 : 5.0;
  return { x: centerX + localX, y: 0, z: localZ };
}

export function syncRankFromGrid(unit: Unit): void {
  unit.rank = unit.gridRow >= 2 ? 'back' : 'front';
}

export function occupiedCells(units: Unit[], excludeId?: string): Set<string> {
  const set = new Set<string>();
  for (const unit of units) {
    if (unit.id === excludeId) continue;
    if (unit.alive === false) continue;
    if (!isValidGridCell(unit.gridCol, unit.gridRow)) continue;
    set.add(gridKey(unit.gridCol, unit.gridRow));
  }
  return set;
}

export function getEmptyCells(units: Unit[], excludeId?: string): GridPos[] {
  const occ = occupiedCells(units, excludeId);
  const cells: GridPos[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!occ.has(gridKey(col, row))) cells.push({ col, row });
    }
  }
  return cells;
}

export function assignRandomGridCell(unit: Unit, gridUnits: Unit[]): void {
  const empty = getEmptyCells(gridUnits, unit.id);
  if (!empty.length) return;
  const cell = empty[Math.floor(Math.random() * empty.length)];
  unit.gridCol = cell.col;
  unit.gridRow = cell.row;
  syncRankFromGrid(unit);
}

export function defaultGridForRole(role: UnitRole): GridPos {
  switch (role) {
    case 'athlete':
      return { col: 1, row: 0 };
    case 'criminal':
      return { col: 0, row: 0 };
    case 'medic':
      return { col: 2, row: 2 };
    case 'screamer':
      return { col: 1, row: 2 };
    default:
      return { col: 1, row: 1 };
  }
}

export function placeUnitsOnGrid(
  units: Unit[],
  getDefault: (unit: Unit) => GridPos,
): void {
  const placed: Unit[] = [];
  for (const unit of units) {
    const preferred = getDefault(unit);
    const taken = placed.some((p) => p.gridCol === preferred.col && p.gridRow === preferred.row);
    if (!taken) {
      unit.gridCol = preferred.col;
      unit.gridRow = preferred.row;
    } else {
      assignRandomGridCell(unit, placed);
    }
    syncRankFromGrid(unit);
    placed.push(unit);
  }
}

export function prefersBackTargets(role: UnitRole): boolean {
  return role === 'ripper' || role === 'criminal';
}
