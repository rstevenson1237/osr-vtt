/**
 * Shape emission (SPEC §2.5, §5 step 1-2). Every primitive turns its collected
 * point stream into a Poly (or MultiPoly) in lattice units. The primitives
 * differ ONLY here — downstream (boolean combine, simplify) is shared. This is
 * the "one shared abstraction" the spec asks for: five point collectors, one
 * geometry pipeline.
 *
 * `bufferPolyline` stands in for true polygon offsetting (SPEC §5 step 2). It
 * builds the buffer as a union of per-segment quads + round-join fans, so the
 * robustness comes from the boolean UNION, not from hand-rolled offset math.
 * See backend.ts header / REVIEW M6 — WI-A replaces this with a real offset.
 */
import type { MultiPoly, Point, Poly, Ring } from './types.js';
import type { BooleanBackend } from './backend.js';

/** Room: two opposite corners → axis-aligned rectangle. */
export function rectPoly(a: Point, b: Point): Poly {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return [
    [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  ];
}

/** Irregular polygon: the collected vertices, directly. */
export function polygonPoly(vertices: Point[]): Poly | null {
  if (vertices.length < 3) return null;
  return [vertices.slice()];
}

/** Regular n-gon centered at `center`, `radius`, `rotation` radians. n=1 is the
 * degenerate circle case (SPEC §2.5) → sampled as a fine polygon. */
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

/** A round join / cap fan at a point. */
function roundCap(c: Point, r: number, steps = 12): Ring {
  const ring: Ring = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    ring.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
  }
  return ring;
}

/**
 * Buffer an open polyline to a corridor of `width` (SPEC §5 step 2 stand-in).
 * Powers Corridor and Path. Returns a single unioned MultiPoly.
 */
export function bufferPolyline(points: Point[], width: number, backend: BooleanBackend): MultiPoly {
  const half = width / 2;
  if (points.length === 0) return [];
  if (points.length === 1) return [[roundCap(points[0]!, half)]];
  const parts: Poly[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    parts.push([segmentQuad(points[i]!, points[i + 1]!, half)]);
  }
  for (const p of points) parts.push([roundCap(p, half)]);
  return backend.union([], parts);
}

/** Corridor: L-shaped path (horizontal leg then vertical leg) buffered to a
 * fixed width. `snapped` legs are already axis-aligned by the point collector;
 * freeform passes the two raw endpoints as a straight run. */
export function corridorPoly(
  a: Point,
  b: Point,
  width: number,
  backend: BooleanBackend,
  lShaped: boolean,
): MultiPoly {
  const pts = lShaped ? [a, { x: b.x, y: a.y }, b] : [a, b];
  return bufferPolyline(pts, width, backend);
}
