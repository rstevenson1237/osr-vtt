/**
 * FloorRegion construction (SPEC §2.1). The pipeline works on raw `MultiPoly`
 * geometry; storage and spatial queries want the `FloorRegion` shape — boundary
 * rings + a derived, denormalized `bbox`. This module is the bridge between the
 * two, and is the source of truth for how a committed region's bbox is computed
 * (recomputed every commit, never hand-edited).
 */
import type { BBox, FloorRegion, MultiPoly, Poly } from './types.js';

/** Bounding box of a polygon's OUTER ring (holes are interior, so they never
 * extend the bbox). Returns null for an empty/degenerate outer ring. */
export function polyBBox(poly: Poly): BBox | null {
  const outer = poly[0];
  if (!outer || outer.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Union of several bboxes (e.g. all regions near a viewport). Null if empty. */
export function unionBBox(boxes: readonly BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}

/** Do two bboxes overlap (touching edges count)? Used to pick which regions a
 * new stroke can affect before running the (costlier) boolean op. */
export function bboxOverlaps(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Turn a floor union into stored `FloorRegion`s with derived bboxes. IDs are
 * assigned by `makeId(index)` — WI-B supplies real doc IDs; tests and in-memory
 * callers can pass a simple counter. Degenerate polys (no outer ring) are
 * dropped.
 */
export function toFloorRegions(floor: MultiPoly, makeId: (index: number) => string): FloorRegion[] {
  const regions: FloorRegion[] = [];
  floor.forEach((poly, i) => {
    const bbox = polyBBox(poly);
    if (!bbox) return;
    regions.push({
      id: makeId(i),
      rings: poly.map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))),
      bbox,
    });
  });
  return regions;
}

/** The floor union carried by a set of regions (drops the ids/bboxes). */
export function regionsToMultiPoly(regions: readonly FloorRegion[]): MultiPoly {
  return regions.map((r) => r.rings.map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))));
}
