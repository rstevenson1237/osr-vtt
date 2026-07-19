/**
 * Douglas-Peucker simplification (SPEC §5 step 4). Runs on every commit to
 * bound vertex growth — the primary long-session perf risk (§8.2, §8.3). The
 * tolerance is in lattice units and is exposed as a live slider in the UI so
 * the §8.3 "visual degradation vs. vertex count" tradeoff can be seen directly.
 *
 * polygon-clipping has no built-in simplify (REVIEW M6 — another reason a
 * chosen library matters), so this is hand-rolled here; WI-A may use the
 * library's own simplify if it ships one (Clipper2 does: SimplifyPaths).
 */
import type { MultiPoly, Point, Poly, Ring } from './types.js';

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

function dpOpen(pts: Point[], tol: number): Point[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, first, last);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [first, last];
  const left = dpOpen(pts.slice(0, idx + 1), tol);
  const right = dpOpen(pts.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}

/** Simplify a closed ring. We treat the ring as an open chain from its first
 * vertex back to itself; good enough for the POC's tolerance study. */
export function simplifyRing(ring: Ring, tol: number): Ring {
  if (tol <= 0 || ring.length <= 4) return ring;
  // Drop a duplicated closing vertex if present, simplify, then leave open
  // (polygon-clipping treats rings as implicitly closed).
  const open = ring.slice();
  const a = open[0]!;
  const z = open[open.length - 1]!;
  if (a.x === z.x && a.y === z.y) open.pop();
  const simplified = dpOpen(open, tol);
  return simplified.length >= 3 ? simplified : ring;
}

export function simplifyPoly(poly: Poly, tol: number): Poly {
  return poly.map((ring) => simplifyRing(ring, tol));
}

export function simplifyMulti(mp: MultiPoly, tol: number): MultiPoly {
  return mp.map((poly) => simplifyPoly(poly, tol));
}

export function countVertices(mp: MultiPoly): number {
  let n = 0;
  for (const poly of mp) for (const ring of poly) n += ring.length;
  return n;
}
