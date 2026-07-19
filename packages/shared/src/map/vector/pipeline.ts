/**
 * The shared carve pipeline (SPEC §5): stroke polygon → boolean combine against
 * the floor union → simplify → new floor union. Every primitive funnels through
 * `commitCarve`, whether it's a union (carve floor) or a difference (fill / the
 * §2.4 interior rock-carve that cuts a hole and may split a region).
 *
 * `CommitResult` carries the metrics the POC exists to report (§8.2/§8.4):
 * vertex counts, region/hole counts, estimated Firestore doc bytes, and op ms.
 */
import type { BooleanBackend } from './backend.js';
import { bboxOverlaps, polyBBox, unionBBox } from './region.js';
import { countVertices, simplifyPoly } from './simplify.js';
import type { BBox, MultiPoly, Poly } from './types.js';

export type CarveMode = 'add' | 'subtract';

export interface CommitResult {
  floor: MultiPoly;
  metrics: CommitMetrics;
}

export interface CommitMetrics {
  regions: number;
  holes: number;
  verticesRaw: number;
  verticesSimplified: number;
  bytesRaw: number;
  bytesSimplified: number;
  opMs: number;
}

/** Rough Firestore-doc byte estimate (§8.2): JSON of the ring coordinates. Not
 * exact (Firestore uses its own encoding) but a faithful relative measure for
 * the "does a region ever blow the 1 MiB limit?" question. */
export function estimateBytes(mp: MultiPoly): number {
  let n = 0;
  for (const poly of mp) for (const ring of poly) n += ring.length * 16; // ~2 floats + overhead
  return n;
}

export function countHoles(mp: MultiPoly): number {
  let h = 0;
  for (const poly of mp) h += Math.max(0, poly.length - 1);
  return h;
}

/** A clock injection point so tests are deterministic and Node/browser both
 * work; defaults to `performance.now()` where available, else `Date.now()`. */
function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** The bbox a set of strokes touches — the only area a commit can have changed
 * (boolean ops are local: a region disjoint from every stroke passes through
 * untouched). Null when there are no strokes. */
function strokesBBox(strokes: Poly[]): BBox | null {
  const boxes: BBox[] = [];
  for (const s of strokes) {
    const bb = polyBBox(s);
    if (bb) boxes.push(bb);
  }
  return unionBBox(boxes);
}

/**
 * Simplify ONLY the regions this stroke actually touched (their bbox overlaps
 * the stroke bbox). Regions the boolean op left untouched keep their exact
 * vertices — this is what makes per-tool tolerance stable: a circle committed
 * crisp at tolerance 0 stays crisp when a later, coarser carve happens elsewhere
 * on the map, instead of being re-rounded by that carve's tolerance.
 */
function simplifyAffected(mp: MultiPoly, tolerance: number, affected: BBox | null): MultiPoly {
  if (tolerance <= 0 || !affected) return mp;
  return mp.map((poly) => {
    const bb = polyBBox(poly);
    return bb && bboxOverlaps(bb, affected) ? simplifyPoly(poly, tolerance) : poly;
  });
}

/**
 * Combine one carve stroke (or several strokes) into the floor union and
 * simplify. `mode='add'` unions (carve floor), `mode='subtract'` differences
 * (erase / §2.4 interior rock-carve). A full bisection returns two regions with
 * no special-casing — it falls out of the boolean op.
 *
 * `tolerance` is the per-commit Douglas-Peucker tolerance — pass the emitting
 * tool's value via `toolTolerance(kind)` (SPEC §8.3). Only regions the stroke
 * touched are re-simplified, so prior per-tool decisions survive later edits.
 */
export function commitCarve(
  floor: MultiPoly,
  strokes: Poly[],
  mode: CarveMode,
  tolerance: number,
  backend: BooleanBackend,
): CommitResult {
  const t0 = now();
  const combined =
    mode === 'add' ? backend.union(floor, strokes) : backend.difference(floor, strokes);
  const verticesRaw = countVertices(combined);
  const bytesRaw = estimateBytes(combined);
  const simplified = simplifyAffected(combined, tolerance, strokesBBox(strokes));
  const opMs = now() - t0;
  return {
    floor: simplified,
    metrics: {
      regions: simplified.length,
      holes: countHoles(simplified),
      verticesRaw,
      verticesSimplified: countVertices(simplified),
      bytesRaw,
      bytesSimplified: estimateBytes(simplified),
      opMs,
    },
  };
}
