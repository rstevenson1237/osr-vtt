/**
 * Per-point snap decision (SPEC §2.5). Snapping is a per-point input modifier,
 * not a property of the shape — every primitive's point collector runs raw
 * pointer positions through this. Freeform = identity; snapped = nearest lattice
 * intersection (or half-lattice for finer control).
 *
 * Namespaced under `map/vector/` to keep it distinct from the existing
 * token-oriented `map/snap.ts` (which snaps in pixel space by cell size); this
 * one works purely in lattice units.
 */
import type { Point } from './types.js';

export type VectorSnapMode = 'free' | 'full' | 'half';

export function snapPoint(p: Point, mode: VectorSnapMode): Point {
  if (mode === 'free') return { x: p.x, y: p.y };
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
