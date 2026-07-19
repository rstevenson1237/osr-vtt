/**
 * Douglas-Peucker simplification (SPEC §5 step 4). Runs on every commit to bound
 * vertex growth — the primary long-session perf risk (§8.2). The tolerance is in
 * lattice units.
 *
 * polygon-clipping has no built-in simplify (REVIEW M6), so this is hand-rolled;
 * a future Clipper2 backend can delegate to its `SimplifyPaths` instead (that
 * choice rides the §8.1 shootout, same seam as `backend.ts`).
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

/** Iterative Douglas-Peucker over an open chain (recursion-free so deep/organic
 * rings can't blow the stack). */
function dpOpen(pts: Point[], tol: number): Point[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (hi - lo < 2) continue;
    let maxD = 0;
    let idx = -1;
    const a = pts[lo]!;
    const b = pts[hi]!;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(pts[i]!, a, b);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = true;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]!);
  return out;
}

/**
 * Simplify a closed ring. The ring is treated as an open chain from its first
 * vertex; the closing edge is preserved implicitly (rings are stored open, so
 * `rings[0]` implicitly joins the last vertex). Returns the input untouched when
 * simplification would drop below a valid triangle.
 */
export function simplifyRing(ring: Ring, tol: number): Ring {
  if (tol <= 0 || ring.length <= 4) return ring;
  const open = ring.slice();
  const a = open[0]!;
  const z = open[open.length - 1]!;
  // Drop an explicit closing-duplicate vertex if present; we store rings open.
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
