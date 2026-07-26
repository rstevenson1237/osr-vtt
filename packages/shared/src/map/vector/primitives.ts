/**
 * Shape emission (SPEC §2.5, §5 steps 1-2). Every primitive turns its collected
 * point stream into a `Poly`/`MultiPoly` in lattice units. Primitives differ
 * ONLY here — downstream (boolean combine, simplify) is shared. This is the "one
 * shared abstraction" the spec asks for: five point collectors, one pipeline.
 *
 * `bufferPolyline` is the offset stand-in for SPEC §5 step 2 / REVIEW M6 — a
 * union of per-segment quads + round caps rather than a true polygon offset.
 * The §8.1 spike (see OFFSET-SPIKE.md) measured it against a real Clipper offset
 * and found them quality-equivalent after simplify; its only weakness was
 * per-stroke perf, now fixed by `decimatePolyline`. So this is a measured,
 * mitigated choice, not a temporary shortcut.
 */
import type { BooleanBackend } from './backend.js';
import type { MultiPoly, Point, Poly, Ring } from './types.js';

/** Room: two opposite corners → axis-aligned rectangle (CCW-agnostic; the
 * boolean backend normalizes winding). Returns null for a degenerate rect. */
export function rectPoly(a: Point, b: Point): Poly | null {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  if (maxX - minX < 1e-9 || maxY - minY < 1e-9) return null;
  return [
    [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  ];
}

/** Irregular polygon: the collected vertices, directly. Needs ≥3 vertices. */
export function polygonPoly(vertices: Point[]): Poly | null {
  if (vertices.length < 3) return null;
  return [vertices.map((p) => ({ x: p.x, y: p.y }))];
}

/**
 * Regular n-gon centered at `center`, `radius`, `rotation` radians. `n <= 1` is
 * the degenerate circle case (SPEC §2.5) → sampled as a fine polygon. Returns
 * null for a non-positive radius.
 */
export function regularPoly(center: Point, radius: number, n: number, rotation = 0): Poly | null {
  if (radius <= 0) return null;
  const sides = n <= 1 ? 64 : Math.max(3, Math.round(n));
  const ring: Ring = [];
  for (let i = 0; i < sides; i++) {
    const t = rotation + (i / sides) * Math.PI * 2;
    ring.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
  }
  return [ring];
}

/** A quad for one segment offset to half-width on both sides. */
function segmentQuad(a: Point, b: Point, halfWidth: number): Ring {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halfWidth;
  const ny = (dx / len) * halfWidth;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

/** A round cap / join fan at a point. */
function roundCap(c: Point, r: number, steps = 12): Ring {
  const ring: Ring = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    ring.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
  }
  return ring;
}

/**
 * Drop interior points closer than `minSpacing` to the last kept point
 * (endpoints always survive). Raw pointer input is sampled far denser than a
 * brush-radius buffer can resolve, and the stand-in below does one boolean union
 * per surviving segment — so decimating first is what bounds its per-stroke cost
 * (the §8.1 offset-spike finding: the stand-in's only real weakness is perf that
 * scales with point count, and it's fixed here, not by a new library).
 */
export function decimatePolyline(points: Point[], minSpacing: number): Point[] {
  if (points.length <= 2 || minSpacing <= 0) return points.slice();
  const min2 = minSpacing * minSpacing;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy >= min2) out.push(p);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * Buffer an open polyline to a corridor of `width` (SPEC §5 step 2 stand-in).
 * Powers the Path (rounded) tool. Returns a single unioned MultiPoly. See the
 * file header: this is the M6 offset stand-in, not a true offset.
 *
 * Points are decimated to `minSpacing` (default `width / 4`) first, which caps
 * the boolean-union count so a long freeform drag stays cheap — the §8.1 spike
 * showed that per-stroke cost, not offset quality, is the stand-in's weak point.
 */
export function bufferPolyline(
  points: Point[],
  width: number,
  backend: BooleanBackend,
  minSpacing = width / 4,
): MultiPoly {
  const half = width / 2;
  if (points.length === 0 || half <= 0) return [];
  if (points.length === 1) return [[roundCap(points[0]!, half)]];
  const pts = decimatePolyline(points, minSpacing);
  const parts: Poly[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    parts.push([segmentQuad(pts[i]!, pts[i + 1]!, half)]);
  }
  for (const p of pts) parts.push([roundCap(p, half)]);
  return backend.union([], parts);
}

/**
 * An axis-aligned rectangle band of `width` around the run p→q (which must share
 * a row or column). Flat ends, square corners (SPEC corridor: no rounding — that
 * is the Path tool's job). When `snapped`, the band's outer walls are quantized
 * to whole grid lines so the corridor occupies whole cells exactly like a Room —
 * fixes the half-tile offset from centerline-vs-edge snapping.
 */
/** The band's low cross-axis edge for a centerline at `center`, quantized to a
 * whole grid line when snapped (see `bandRect`). Shared with `cornerBlock` so
 * the corner square lands on exactly the same lines as the two legs. */
function bandLo(center: number, width: number, snapped: boolean): number {
  const lo = center - width / 2;
  return snapped ? Math.round(lo) : lo;
}

function bandRect(p: Point, q: Point, width: number, snapped: boolean): Poly | null {
  const horizontal = Math.abs(q.y - p.y) <= Math.abs(q.x - p.x);
  let x0 = Math.min(p.x, q.x);
  let x1 = Math.max(p.x, q.x);
  let y0 = Math.min(p.y, q.y);
  let y1 = Math.max(p.y, q.y);
  if (horizontal) {
    y0 = bandLo(p.y, width, snapped);
    y1 = y0 + width;
  } else {
    x0 = bandLo(p.x, width, snapped);
    x1 = x0 + width;
  }
  if (x1 - x0 < 1e-9 || y1 - y0 < 1e-9) return null;
  return [
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  ];
}

/**
 * Corridor: an L-shaped run (horizontal leg then vertical leg) of fixed width,
 * ALWAYS cardinal — the corner is a right angle, ends are flat, joints are
 * square (SPEC corridor default). Freeform only means the endpoints are raw
 * (unsnapped); the legs stay axis-aligned regardless. Built as the union of two
 * axis-aligned rectangles, so the flat caps come for free.
 *
 * A third `width × width` square fills the turn. Each leg runs only between its
 * *centerline* endpoints, so at a bend the horizontal leg stops half a width
 * short of the vertical leg's outer wall — leaving a `half × width` notch that,
 * at width 2, read as the corner collapsing to a single tile. The corner block
 * spans both legs' cross-axis extents (same `bandLo` quantization), so the turn
 * stays the corridor's full width.
 */
export function corridorPoly(
  a: Point,
  b: Point,
  width: number,
  backend: BooleanBackend,
  snapped: boolean,
): MultiPoly {
  const corner: Point = { x: b.x, y: a.y };
  const legs: Poly[] = [];
  const h = bandRect(a, corner, width, snapped);
  const v = bandRect(corner, b, width, snapped);
  if (h) legs.push(h);
  if (v) legs.push(v);
  if (h && v) {
    // Both legs exist ⇒ there is a real turn; fill it to full width.
    const cx = bandLo(corner.x, width, snapped);
    const cy = bandLo(corner.y, width, snapped);
    legs.push([
      [
        { x: cx, y: cy },
        { x: cx + width, y: cy },
        { x: cx + width, y: cy + width },
        { x: cx, y: cy + width },
      ],
    ]);
  }
  if (!legs.length) return [];
  return backend.union([], legs);
}
