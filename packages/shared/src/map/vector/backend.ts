/**
 * Boolean-op backend (SPEC §5 step 3, §8.1). The whole pipeline talks to this
 * interface, never to a library directly, so swapping the geometry library for
 * the §8.1 benchmark (Clipper2 vs. martinez vs. this pure-JS polygon-clipping)
 * is a one-file change.
 *
 * ⚠️ Offsetting (SPEC §5 step 2 / REVIEW M6): polygon-clipping does boolean ops
 * ONLY — no polygon offsetting, no simplify. `primitives.ts:bufferPolyline`
 * stands in for a true offset by unioning per-segment quads (robust because the
 * UNION is the library's), and `simplify.ts` hand-rolls Douglas-Peucker. The
 * §8.1 spike (OFFSET-SPIKE.md) measured this and locked polygon-clipping as the
 * boolean backend; `clipper-lib` is the ready pure-JS fallback if an exact
 * offset is ever needed, dropping in behind this same seam.
 */
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { MultiPoly, Poly } from './types.js';

function toLib(poly: Poly): Polygon {
  return poly.map((ring) => ring.map((p) => [p.x, p.y] as [number, number]));
}

function fromLib(mp: MultiPolygon): MultiPoly {
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => ({ x, y }))));
}

/** Deep-clone a MultiPoly so callers never alias backend inputs. */
function clone(mp: MultiPoly): MultiPoly {
  return mp.map((poly) => poly.map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))));
}

export interface BooleanBackend {
  readonly name: string;
  /** Union an existing floor union with one or more new polygons. */
  union(base: MultiPoly, add: Poly[]): MultiPoly;
  /** Subtract polygons from the floor union (erase / interior rock-carve §2.4). */
  difference(base: MultiPoly, sub: Poly[]): MultiPoly;
}

/**
 * Default backend. polygon-clipping accepts `Polygon | MultiPolygon` and returns
 * `MultiPolygon`; disjoint results and holes come back as separate polys/rings,
 * so §2.4's split-on-full-bisection falls out with no special-casing.
 */
export const polygonClippingBackend: BooleanBackend = {
  name: 'polygon-clipping (pure JS)',
  union(base, add) {
    if (base.length === 0 && add.length === 0) return [];
    const b = base.map(toLib) as MultiPolygon;
    return fromLib(polygonClipping.union(b, ...add.map(toLib)));
  },
  difference(base, sub) {
    if (base.length === 0) return [];
    if (sub.length === 0) return clone(base);
    const b = base.map(toLib) as MultiPolygon;
    return fromLib(polygonClipping.difference(b, ...sub.map(toLib)));
  },
};
