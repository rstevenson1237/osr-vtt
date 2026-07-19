/**
 * Point-in-floor occupancy query (SPEC §7, REVIEW M5). Answers "is this point on
 * the floor?" against the baked floor union — the replacement for the old cell
 * bitmask's `isFloor(cell)`. WI-A owns this because the carve pipeline needs it
 * anyway; app-side flood-fill / room-detection / interaction-gating rewires onto
 * it (M5). It is called at interaction time or batched — NEVER per-frame-per-cell
 * (SPEC §7). `pointInFloorUnionRegions` uses region bboxes to skip regions the
 * point can't be in, so a batched sweep stays cheap on large maps.
 */
import { bboxOverlaps } from './region.js';
import type { FloorRegion, MultiPoly, Point, Poly, Ring } from './types.js';

/**
 * Crossing-number point-in-ring test. Points exactly on an edge are handled
 * consistently (a half-open convention on the y-range) so a point on a shared
 * boundary between two abutting regions is counted in exactly one — good enough
 * for occupancy, where "on the wall" is not a hot distinction.
 */
export function pointInRing(p: Point, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = ring[i]!;
    const vj = ring[j]!;
    const intersects = vi.y > p.y !== vj.y > p.y;
    if (intersects) {
      const xCross = ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x;
      if (p.x < xCross) inside = !inside;
    }
  }
  return inside;
}

/** Inside a polygon-with-holes: inside the outer ring AND not inside any hole. */
export function pointInPoly(p: Point, poly: Poly): boolean {
  const outer = poly[0];
  if (!outer || !pointInRing(p, outer)) return false;
  for (let h = 1; h < poly.length; h++) {
    if (pointInRing(p, poly[h]!)) return false;
  }
  return true;
}

/** Is the point on the floor union? True iff it is inside some region's polygon
 * (respecting that region's holes). SPEC §7's `pointInFloorUnion`. */
export function pointInFloorUnion(p: Point, floor: MultiPoly): boolean {
  for (const poly of floor) {
    if (pointInPoly(p, poly)) return true;
  }
  return false;
}

/** Region-aware variant: uses each region's derived bbox (SPEC §2.1) to skip the
 * ray-cast entirely for regions the point cannot be in. Same answer as
 * `pointInFloorUnion` over the regions' rings, faster on many-region maps. */
export function pointInFloorUnionRegions(p: Point, regions: readonly FloorRegion[]): boolean {
  const probe = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  for (const region of regions) {
    if (!bboxOverlaps(probe, region.bbox)) continue;
    if (pointInPoly(p, region.rings)) return true;
  }
  return false;
}
