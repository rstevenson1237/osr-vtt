import type { Cell } from './grid.js';
import { canonicalizeEdge, derivePerimeterEdges, type Edge } from './walls.js';
import { circleWallSegments } from './circle.js';
import type { CircleWall, MapDoor, MapWall, SightWall } from '../types.js';

/**
 * 2D raycasting line-of-sight (Plan §7 Phase 4; Map Tooling Spec §6). Walls
 * are line segments — grid-aligned perimeter/explicit edges from the cellular
 * model, plus arbitrary vector walls imported from a `.uvtt` (see `uvtt.ts`).
 * LoS is exact and cheap: a target point is visible from an origin when the
 * open segment between them crosses no sight-blocking wall.
 *
 * Pure geometry — no Pixi, no Firebase. The engine builds `Segment[]` once per
 * render via `sightSegments()` and probes cells/points against them.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Segment {
  a: Vec2;
  b: Vec2;
}

const EPS = 1e-9;

function sign(n: number): number {
  if (n > EPS) return 1;
  if (n < -EPS) return -1;
  return 0;
}

/** Orientation of the ordered triple (a, b, c): +1 ccw, -1 cw, 0 collinear. */
function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

/**
 * True only when the two segments *properly* cross — each straddles the
 * other's supporting line. Collinear overlaps and bare endpoint touches
 * return false, so sight sliding along a wall or grazing a shared corner
 * (where grid edges meet) is not treated as blocked — the classic,
 * intentional raycast-LoS behavior.
 */
export function segmentsCross(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Whether the sight line from `origin` to `target` is blocked by any wall. */
export function sightBlocked(origin: Vec2, target: Vec2, walls: readonly Segment[]): boolean {
  for (const wall of walls) {
    if (segmentsCross(origin, target, wall.a, wall.b)) return true;
  }
  return false;
}

/** Grid edge → its pixel-space wall segment (edges are canonicalized to N/W). */
export function edgeSegment(edge: Edge, cellSize: number): Segment {
  const c = canonicalizeEdge(edge);
  const x = c.x * cellSize;
  const y = c.y * cellSize;
  return c.side === 'N'
    ? { a: { x, y }, b: { x: x + cellSize, y } }
    : { a: { x, y }, b: { x, y: y + cellSize } };
}

export function doorPassesSight(door: MapDoor | undefined): boolean {
  // Master Plan v2, R11.4: an open door lets sight through; closed, secret and
  // trapped(closed) doors block it; a `barred` door is physically blocked and
  // blocks regardless of state. A `oneWay` door blocks like a normal door for
  // sight (its arrow is a GM annotation only, out of LoS scope in v1). A wall
  // with no door always blocks.
  if (!door) return false;
  if (door.type === 'barred') return false;
  return door.state === 'open';
}

export interface SightInput {
  /** Every carved floor cell — the perimeter (floor↔rock) boundary blocks. */
  floorCells: readonly Cell[];
  isFloor: (cell: Cell) => boolean;
  /** Explicit grid walls + doors from the cellular model. */
  walls: readonly MapWall[];
  /** Imported vector walls (already in pixel space), e.g. from a `.uvtt`. */
  sightWalls?: readonly SightWall[];
  /** Circular walls (Master Plan v2, R10.5), sampled into N-gons with any
   * cut `gaps` skipped so an opening genuinely passes sight. */
  circleWalls?: readonly CircleWall[];
  cellSize: number;
}

/**
 * Collects every sight-blocking segment for a scene: auto-derived perimeter
 * walls, explicit grid walls (open doors excluded), and imported vector
 * walls (open portals excluded). Build once per render, then probe against it.
 */
export function sightSegments(input: SightInput): Segment[] {
  const { floorCells, isFloor, walls, sightWalls, circleWalls, cellSize } = input;
  const segments: Segment[] = [];

  for (const edge of derivePerimeterEdges(isFloor, floorCells)) {
    segments.push(edgeSegment(edge, cellSize));
  }
  for (const wall of walls) {
    if (doorPassesSight(wall.door)) continue;
    segments.push(edgeSegment({ x: wall.x, y: wall.y, side: wall.side }, cellSize));
  }
  for (const wall of sightWalls ?? []) {
    if (doorPassesSight(wall.door)) continue;
    segments.push({ a: { x: wall.ax, y: wall.ay }, b: { x: wall.bx, y: wall.by } });
  }
  // Circular walls sample to an N-gon; cut gaps drop the arc segments they
  // cover so a gap really opens the ring to sight (Master Plan v2, R10.5).
  for (const circle of circleWalls ?? []) {
    for (const seg of circleWallSegments(circle)) segments.push(seg);
  }
  return segments;
}

/** `"x,y"` cell key, matching the convention used across the map tooling. */
export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

/**
 * The set of cells (by `"x,y"` key) visible from at least one origin. A cell
 * counts as visible when its *center* has an unblocked sight line to any
 * viewpoint — the standard cheap approximation for grid LoS/fog.
 */
export function visibleCells(
  origins: readonly Vec2[],
  cells: readonly Cell[],
  segments: readonly Segment[],
  cellSize: number,
): Set<string> {
  const visible = new Set<string>();
  if (origins.length === 0) return visible;
  for (const cell of cells) {
    const center = { x: (cell.x + 0.5) * cellSize, y: (cell.y + 0.5) * cellSize };
    for (const origin of origins) {
      if (!sightBlocked(origin, center, segments)) {
        visible.add(cellKey(cell));
        break;
      }
    }
  }
  return visible;
}

/** Every cell in a `w × h` grid, row-major — the render domain for fog. */
export function allGridCells(w: number, h: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells.push({ x, y });
  }
  return cells;
}
