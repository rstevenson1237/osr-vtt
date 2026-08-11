/**
 * Per-point snap decision (SPEC §2.5). Snapping is a per-point input modifier,
 * not a property of the shape — every primitive's point collector runs raw
 * pointer positions through this. Freeform = identity (with one exception —
 * see `VertexAttraction`); snapped = nearest lattice intersection (or
 * half-lattice for finer control).
 *
 * Namespaced under `map/vector/` to keep it distinct from the existing
 * token-oriented `map/snap.ts` (which snaps in pixel space by cell size); this
 * one works purely in lattice units.
 */
import type { Point } from './types.js';

export type VectorSnapMode = 'free' | 'full' | 'half';

/**
 * Free snap's one exception to identity (SPEC-028 §12): the vertices a raw
 * pointer position is allowed to be pulled onto, and how close it has to get.
 *
 * Both in **lattice units** — the caller converts its screen-pixel pick radius
 * (`pickPx`) at the same boundary it converts everything else, so the
 * attraction scales with zoom and pointer coarseness the way every other
 * hit-test on the canvas does (DEC-061).
 */
export interface VertexAttraction {
  vertices: readonly Point[];
  radius: number;
}

/**
 * The nearest vertex strictly within `radius` of `p`, or `null`. Returns a
 * fresh point, never a reference into `vertices` — the candidates are live
 * stored geometry, and a snapped point goes on to be pushed into a collector
 * or written to a document.
 *
 * `d < bestD` seeded at `radius` matches `pickVertexHandle`'s test, so
 * "attracts to this vertex" and "picks this vertex" agree at the boundary.
 */
export function nearestVertexWithin(
  p: Point,
  vertices: readonly Point[],
  radius: number,
): Point | null {
  let best: Point | null = null;
  let bestD = radius;
  for (const v of vertices) {
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Free is identity unless `attract` is passed and the pointer is within its
 * radius of an existing vertex, in which case Free returns that vertex exactly
 * (SPEC-028 §12) — what lets a free-drawn wall, door or polygon edge be pulled
 * flush against geometry that already exists.
 *
 * The parameter is optional and unused by the snapped modes, which already
 * round to lattice vertices: every caller that does not pass one gets the pure
 * function it always had.
 */
export function snapPoint(p: Point, mode: VectorSnapMode, attract?: VertexAttraction): Point {
  if (mode === 'free') {
    const near = attract ? nearestVertexWithin(p, attract.vertices, attract.radius) : null;
    return near ?? { x: p.x, y: p.y };
  }
  const step = mode === 'half' ? 0.5 : 1;
  return {
    x: Math.round(p.x / step) * step,
    y: Math.round(p.y / step) * step,
  };
}

/**
 * Snap to the *cell the pointer is inside*, not to the nearest lattice
 * intersection — the convention for things that live in a cell's interior
 * rather than on its corners (room labels). Returns the cell's top-left
 * lattice coordinate, so a renderer centres on `snapped + 0.5` (or
 * `+ step / 2` under half-snap).
 *
 * `snapPoint` rounds, which picks the nearest *vertex*: clicking anywhere in a
 * cell's lower-right quadrant would place the label in the neighbouring cell.
 * Flooring keeps the object in the cell that was actually clicked. Freeform
 * passes the raw point through, same as `snapPoint`.
 */
export function snapCell(p: Point, mode: VectorSnapMode): Point {
  if (mode === 'free') return { x: p.x, y: p.y };
  const step = mode === 'half' ? 0.5 : 1;
  return {
    x: Math.floor(p.x / step) * step,
    y: Math.floor(p.y / step) * step,
  };
}

/** The cell size `snapCell` quantizes to, for callers that need to centre or
 * hit-test within the snapped cell. Freeform has no cell — treated as 1. */
export function snapCellSize(mode: VectorSnapMode): number {
  return mode === 'half' ? 0.5 : 1;
}

export function snapScalar(v: number, mode: VectorSnapMode): number {
  if (mode === 'free') return v;
  const step = mode === 'half' ? 0.5 : 1;
  return Math.round(v / step) * step;
}

/**
 * The centre of the cell (half-cell) the pointer is inside — `snapCell` plus
 * half a step. This is the anchor for shapes that occupy a cell rather than
 * hang off its corners: an n-gon or a corridor snapped with `snapPoint` lands
 * centred on a grid intersection, which is a quarter-cell off from where the
 * referee pointed in every direction at once.
 *
 * Freeform passes the raw point through, so a free-snap shape is centred
 * exactly where the pointer went down.
 */
export function snapCellCenter(p: Point, mode: VectorSnapMode): Point {
  if (mode === 'free') return { x: p.x, y: p.y };
  const half = snapCellSize(mode) / 2;
  const cell = snapCell(p, mode);
  return { x: cell.x + half, y: cell.y + half };
}

/**
 * Snap a direction (radians) to the compass resolution the snap mode implies:
 * full → the four cardinals, half → the eight points (cardinals plus
 * diagonals), free → untouched. Used to orient a regular polygon's flat face
 * from the direction of the drag.
 */
export function snapAngle(theta: number, mode: VectorSnapMode): number {
  if (mode === 'free') return theta;
  const step = mode === 'half' ? Math.PI / 4 : Math.PI / 2;
  return Math.round(theta / step) * step;
}

/**
 * Snap a span — a diameter, a width, any measurement across a shape — to a
 * whole number of cells (half-cells), never below one. Distinct from
 * `snapScalar`, which is a position quantizer and is free to return zero: a
 * span of zero is a degenerate shape, so the smallest snapped shape is one
 * cell across rather than nothing at all.
 */
export function snapSpan(v: number, mode: VectorSnapMode): number {
  if (mode === 'free') return v;
  const step = snapCellSize(mode);
  return Math.max(step, Math.round(v / step) * step);
}
