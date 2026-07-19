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

export function snapScalar(v: number, mode: VectorSnapMode): number {
  if (mode === 'free') return v;
  const step = mode === 'half' ? 0.5 : 1;
  return Math.round(v / step) * step;
}
