import { cellToPixel, type Cell } from './grid.js';
import type { WallStyle } from '../types.js';

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
 * A wall's effective render style (Master Plan v2, R10.3): the wall's own
 * `style` wins; failing that it derives from its hosting `MapRoom.wallStyle`;
 * failing that it falls back to `'masonry'`. This keeps pre-R10 walls (no
 * `style`) deriving from the room exactly as before, while a wall that carries
 * its own style reads that way even in a differently-styled room (R10.1).
 */
export function resolveWallStyle(
  wallStyle: WallStyle | undefined,
  roomStyle: WallStyle | undefined,
): WallStyle {
  return wallStyle ?? roomStyle ?? 'masonry';
}

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

/**
 * Wall drag-run interaction (Master Plan v2, R9.2): "pointer-down snaps to
 * nearest grid intersection; drag shows ghost run; release snaps the end
 * intersection." An intersection is a lattice point at a cell corner —
 * distinct from `pixelToCell`'s cell-interior snapping used by carve/fill.
 */
export interface Intersection {
  x: number;
  y: number;
}

export function snapToIntersection(point: { x: number; y: number }, cellSize: number): Intersection {
  return { x: Math.round(point.x / cellSize), y: Math.round(point.y / cellSize) };
}

export function intersectionToPixel(i: Intersection, cellSize: number): { x: number; y: number } {
  return { x: i.x * cellSize, y: i.y * cellSize };
}

/** True for two distinct intersections that share a row or column — a
 * straight horizontal or vertical run (Master Plan v2, R9.2). Any other pair
 * of distinct intersections is a diagonal run, stored as a vector wall
 * instead (see `SightWall`). */
export function isAxisAlignedRun(a: Intersection, b: Intersection): boolean {
  const same = a.x === b.x && a.y === b.y;
  return !same && (a.x === b.x || a.y === b.y);
}

/**
 * Decomposes an axis-aligned drag between two lattice intersections into its
 * sequence of unit grid edges — one edge per cell width/height spanned
 * (Master Plan v2, R9.2 "drag a run"), always canonicalized to N/W so the
 * result is ready to batch through `setWalls`. Returns `[]` for a
 * non-axis-aligned pair (use a `SightWall` for those instead).
 */
export function wallRunEdges(a: Intersection, b: Intersection): Edge[] {
  if (!isAxisAlignedRun(a, b)) return [];
  const edges: Edge[] = [];
  if (a.y === b.y) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    for (let x = minX; x < maxX; x++) edges.push(canonicalizeEdge({ x, y: a.y, side: 'N' }));
  } else {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (let y = minY; y < maxY; y++) edges.push(canonicalizeEdge({ x: a.x, y, side: 'W' }));
  }
  return edges;
}

/** A canonicalized edge's pixel-space line segment — used to draw the wall
 * drag-run's ghost preview (Master Plan v2, R9.2). */
export function edgeSegmentPixels(
  edge: Edge,
  cellSize: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const c = canonicalizeEdge(edge);
  const a = cellToPixel({ x: c.x, y: c.y }, cellSize);
  return c.side === 'N'
    ? { x1: a.x, y1: a.y, x2: a.x + cellSize, y2: a.y }
    : { x1: a.x, y1: a.y, x2: a.x, y2: a.y + cellSize };
}
