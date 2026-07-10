import type { Cell } from './grid.js';

/**
 * Wall/edge model (Map Tooling Spec §1, §6). A wall is a divider on a grid
 * edge between two cells. Perimeter walls (floor↔rock) are ALWAYS derived,
 * never stored. Explicit walls (floor↔floor) subdivide open space and are
 * the only kind persisted at `walls/{edgeId}`.
 */

export type EdgeSide = 'N' | 'E' | 'S' | 'W';

export interface Edge {
  x: number;
  y: number;
  side: EdgeSide;
}

/** Every edge has two equivalent descriptions (S of (x,y) == N of (x,y+1)).
 * Canonicalizing to N/W means each physical edge has exactly one id. */
export function canonicalizeEdge(edge: Edge): Edge {
  if (edge.side === 'S') return { x: edge.x, y: edge.y + 1, side: 'N' };
  if (edge.side === 'E') return { x: edge.x + 1, y: edge.y, side: 'W' };
  return edge;
}

export function edgeId(edge: Edge): string {
  const c = canonicalizeEdge(edge);
  return `${c.x},${c.y},${c.side}`;
}

export function parseEdgeId(id: string): Edge {
  const [x, y, side] = id.split(',');
  return { x: Number(x), y: Number(y), side: side as EdgeSide };
}

/** The cell on the other side of an edge from `cell`. */
export function neighborAcross(cell: Cell, side: EdgeSide): Cell {
  switch (side) {
    case 'N':
      return { x: cell.x, y: cell.y - 1 };
    case 'S':
      return { x: cell.x, y: cell.y + 1 };
    case 'E':
      return { x: cell.x + 1, y: cell.y };
    case 'W':
      return { x: cell.x - 1, y: cell.y };
  }
}

export const ALL_SIDES: readonly EdgeSide[] = ['N', 'E', 'S', 'W'];

/**
 * Derives the perimeter (floor↔rock) wall edges touching a set of floor
 * cells — recomputed whenever cells change (Spec §4 "auto-walls... recomputed
 * instantly"), never persisted. Only emits an edge where the *this* side is
 * floor and the neighbor is not, so each physical perimeter edge is produced
 * exactly once (a rock cell never initiates a perimeter edge).
 */
export function derivePerimeterEdges(isFloor: (cell: Cell) => boolean, floorCells: Iterable<Cell>): Edge[] {
  const edges: Edge[] = [];
  for (const cell of floorCells) {
    for (const side of ALL_SIDES) {
      if (!isFloor(neighborAcross(cell, side))) {
        edges.push({ x: cell.x, y: cell.y, side });
      }
    }
  }
  return edges;
}

/** True if the edge between `cell` and its neighbor on `side` blocks
 * passage — either it's a perimeter (floor/non-floor) boundary, or an
 * explicit wall/closed-or-secret door was placed there. */
export function isEdgeBlocked(
  cell: Cell,
  side: EdgeSide,
  isFloor: (cell: Cell) => boolean,
  explicitWalls: ReadonlySet<string>,
): boolean {
  const neighbor = neighborAcross(cell, side);
  const perimeter = isFloor(cell) !== isFloor(neighbor);
  if (perimeter) return true;
  return explicitWalls.has(edgeId({ x: cell.x, y: cell.y, side }));
}
