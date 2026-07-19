/**
 * Per-point snap decision (SPEC §2.5). Snapping is a per-point input modifier,
 * not a property of the shape — every primitive's point collector runs raw
 * pointer positions through this. Freeform = identity; snapped = nearest
 * lattice intersection (or half-lattice for finer control).
 */
import type { Point } from './types.js';

export type SnapMode = 'free' | 'full' | 'half';

export function snapPoint(p: Point, mode: SnapMode): Point {
  if (mode === 'free') return p;
  const step = mode === 'half' ? 0.5 : 1;
  return {
    x: Math.round(p.x / step) * step,
    y: Math.round(p.y / step) * step,
  };
}

export function snapScalar(v: number, mode: SnapMode): number {
  if (mode === 'free') return v;
  const step = mode === 'half' ? 0.5 : 1;
  return Math.round(v / step) * step;
}
