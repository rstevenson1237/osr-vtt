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

/**
 * A tolerant lookup for "was this vertex already on the floor before this
 * commit?". The boolean backend re-emits surviving vertices through its
 * precision grid, so an exact coordinate compare would miss vertices that moved
 * by a hair; points are bucketed on an epsilon grid and matched against the 3×3
 * neighbourhood.
 */
export class PointSet {
  private readonly eps: number;
  private readonly buckets = new Set<string>();

  constructor(eps: number = CLEAN_RING_EPSILON) {
    this.eps = eps > 0 ? eps : CLEAN_RING_EPSILON;
  }

  private key(ix: number, iy: number): string {
    return `${ix}:${iy}`;
  }

  add(p: Point): void {
    this.buckets.add(this.key(Math.round(p.x / this.eps), Math.round(p.y / this.eps)));
  }

  addMulti(mp: MultiPoly): void {
    for (const poly of mp) for (const ring of poly) for (const p of ring) this.add(p);
  }

  has(p: Point): boolean {
    const ix = Math.round(p.x / this.eps);
    const iy = Math.round(p.y / this.eps);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (this.buckets.has(this.key(ix + dx, iy + dy))) return true;
    return false;
  }

  get size(): number {
    return this.buckets.size;
  }
}

/**
 * Simplify a closed ring while pinning every vertex `isProtected` claims.
 *
 * This is what keeps a crisp circle crisp when a coarse freeform Path is drawn
 * through it: the union fuses both into a single region, so the region is
 * "changed" and gets simplified at the Path's tolerance — which would facet the
 * circle's 64 sampled arc vertices. Pinning the vertices that were already on
 * the floor confines Douglas-Peucker to the runs of genuinely new vertices the
 * stroke contributed, between the pinned ones.
 */
export function simplifyRingProtected(
  ring: Ring,
  tol: number,
  isProtected: (p: Point) => boolean,
): Ring {
  if (tol <= 0 || ring.length <= 4) return ring;
  const open = ring.slice();
  const a = open[0]!;
  const z = open[open.length - 1]!;
  if (a.x === z.x && a.y === z.y) open.pop();
  const n = open.length;
  if (n <= 4) return ring;

  const anchors: number[] = [];
  for (let i = 0; i < n; i++) if (isProtected(open[i]!)) anchors.push(i);
  if (anchors.length === 0) return simplifyRing(ring, tol);
  if (anchors.length === n) return ring;

  const out: Point[] = [];
  for (let k = 0; k < anchors.length; k++) {
    const lo = anchors[k]!;
    const hi = anchors[(k + 1) % anchors.length]!;
    // Walk lo→hi forward with wrap; the sub-chain includes both endpoints, and
    // we push everything but the last so the next span contributes it.
    const chain: Point[] = [open[lo]!];
    for (let i = (lo + 1) % n; ; i = (i + 1) % n) {
      chain.push(open[i]!);
      if (i === hi) break;
    }
    const kept = dpOpen(chain, tol);
    for (let i = 0; i < kept.length - 1; i++) out.push(kept[i]!);
  }
  return out.length >= 3 ? out : ring;
}

export function simplifyPolyProtected(
  poly: Poly,
  tol: number,
  isProtected: (p: Point) => boolean,
): Poly {
  return poly.map((ring) => simplifyRingProtected(ring, tol, isProtected));
}

export function simplifyPoly(poly: Poly, tol: number): Poly {
  return poly.map((ring) => simplifyRing(ring, tol));
}

export function simplifyMulti(mp: MultiPoly, tol: number): MultiPoly {
  return mp.map((poly) => simplifyPoly(poly, tol));
}

/** Default `cleanRing` epsilon, in lattice units — far below any feature a
 * referee could mean to draw (a thousandth of a cell), but comfortably above
 * the artefacts a boolean op leaves behind. */
export const CLEAN_RING_EPSILON = 1e-3;

/**
 * Drop the degenerate vertices a boolean op leaves in a ring: near-duplicate
 * points and the near-collinear runs they create.
 *
 * `polygon-clipping` re-emits every ring through its internal precision grid,
 * so a union or difference can turn one clean vertex into two a hair apart.
 * That is invisible to the geometry but not to the renderer: the adaptive
 * corner fillet scales with the *shorter adjacent edge*, so a micro-edge
 * collapses the radius to nothing and the perturbed neighbours read as sharp
 * turns — which is why a smooth 64-gon circle broke into visible facets the
 * moment a Path was drawn through it.
 *
 * Render-only cleanup; stored geometry is untouched, so no migration.
 */
export function cleanRing(ring: Ring, eps: number = CLEAN_RING_EPSILON): Ring {
  if (ring.length < 3) return ring;
  const out: Point[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) <= eps) continue;
    out.push(p);
  }
  // The ring is stored open, so the first and last vertices are neighbours too.
  while (out.length >= 2) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first.x - last.x, first.y - last.y) > eps) break;
    out.pop();
  }
  if (out.length < 3) return ring;

  // Second pass: a vertex whose perpendicular offset from the chord between its
  // neighbours is within eps adds nothing but a spurious corner.
  const keep: Point[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = keep.length > 0 ? keep[keep.length - 1]! : out[(i - 1 + out.length) % out.length]!;
    const cur = out[i]!;
    const next = out[(i + 1) % out.length]!;
    if (perpDist(cur, prev, next) <= eps) continue;
    keep.push(cur);
  }
  return keep.length >= 3 ? keep : out;
}

export function cleanPoly(poly: Poly, eps: number = CLEAN_RING_EPSILON): Poly {
  return poly.map((ring) => cleanRing(ring, eps));
}

export function countVertices(mp: MultiPoly): number {
  let n = 0;
  for (const poly of mp) for (const ring of poly) n += ring.length;
  return n;
}
