/**
 * Boolean-op backend (SPEC §5 step 3, §8.1).
 *
 * The whole pipeline talks to this interface, never to a library directly, so
 * swapping the geometry library for the §8.1 benchmark (Clipper2 vs. martinez
 * vs. this pure-JS polygon-clipping) is a one-file change. That swap seam IS
 * the deliverable for answering §8.1 — the rest of the app is backend-agnostic.
 *
 * ⚠️ Offsetting (SPEC §5 step 2 / REVIEW M6): polygon-clipping does boolean ops
 * ONLY — no polygon offsetting. The POC buffers polylines by unioning
 * per-segment quads + round-join fans (see primitives.ts:bufferPolyline), which
 * is robust because the UNION is done by the library, but it is not a true
 * offset. WI-A must use a real offset routine (Clipper2 ClipperOffset). This is
 * exactly the M6 finding, made concrete.
 */
import polygonClipping from 'polygon-clipping';
import type { MultiPoly, Poly } from './types.js';

type LibRing = [number, number][];
type LibPoly = LibRing[];
type LibMultiPoly = LibPoly[];

function toLib(poly: Poly): LibPoly {
  return poly.map((ring) => ring.map((p) => [p.x, p.y] as [number, number]));
}

function fromLib(mp: LibMultiPoly): MultiPoly {
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => ({ x, y }))));
}

export interface BooleanBackend {
  readonly name: string;
  /** Union of an existing floor union with one or more new polygons. */
  union(base: MultiPoly, add: Poly[]): MultiPoly;
  /** Subtract polygons from the floor union (erase / interior rock-carve). */
  difference(base: MultiPoly, sub: Poly[]): MultiPoly;
}

/** Default backend. polygon-clipping accepts Polygon | MultiPolygon and returns
 * MultiPolygon; disjoint results and holes come back as separate polys/rings. */
export const polygonClippingBackend: BooleanBackend = {
  name: 'polygon-clipping (pure JS)',
  union(base, add) {
    const b = base.map(toLib) as LibMultiPoly;
    const others = add.map(toLib) as LibPoly[];
    return fromLib(polygonClipping.union(b as never, ...(others as never[])) as LibMultiPoly);
  },
  difference(base, sub) {
    const b = base.map(toLib) as LibMultiPoly;
    const others = sub.map(toLib) as LibPoly[];
    return fromLib(polygonClipping.difference(b as never, ...(others as never[])) as LibMultiPoly);
  },
};
