/**
 * Wall / door / LoS unification (SPEC §3). One consumer:
 *
 *   perimeter (derived from the floor union boundary, never stored)
 *     + explicit walls
 *     + imported walls (none in POC)
 *   → door reconciliation at BUILD time (§3.3):
 *       open door  → clip its span out of collinear-overlapping segments (gap)
 *       blocking door → add the door's own segment as a blocker
 *   → sight-blocking segment list → visibility polygon from an eye point.
 *
 * This is the single vector-wall consumer the spec unifies toward. All of it is
 * rebuilt once per render (build-once, probe-many) — no per-frame-per-cell cost.
 */
import type { Door, MultiPoly, Point, Segment } from './types.js';
import { doorPasses } from './types.js';

const EPS = 1e-6;

/** Perimeter segments: every consecutive vertex pair of every ring (outer +
 * holes) of the floor union. This REPLACES derivePerimeterEdges' bit-walker —
 * the boundary is the polygon boundary itself (SPEC §3.1 `source:'perimeter'`). */
export function perimeterSegments(floor: MultiPoly): Segment[] {
  const segs: Segment[] = [];
  for (const poly of floor) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) < EPS) continue;
        segs.push({ a, b, source: 'perimeter', blocksSight: true, blocksMovement: true });
      }
    }
  }
  return segs;
}

// ---- door ↔ wall reconciliation (SPEC §3.3) ----

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Parameter t of point p projected onto segment a→b (0 at a, 1 at b). */
function projT(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

function pointAt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Is point p on the infinite line through a→b (within EPS)? */
function collinear(a: Point, b: Point, p: Point): boolean {
  const d = cross(b.x - a.x, b.y - a.y, p.x - a.x, p.y - a.y);
  const scale = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return Math.abs(d) / scale < 0.08; // ~1/12 cell tolerance: doors need only be "near" the wall
}

/** Subtract the door's span from a segment if collinear & overlapping,
 * returning the surviving sub-segments (0, 1, or 2). */
function clipDoorFromSegment(seg: Segment, door: Door): Segment[] {
  if (!collinear(seg.a, seg.b, door.a) || !collinear(seg.a, seg.b, door.b)) return [seg];
  let t0 = projT(seg.a, seg.b, door.a);
  let t1 = projT(seg.a, seg.b, door.b);
  if (t0 > t1) [t0, t1] = [t1, t0];
  t0 = Math.max(0, t0);
  t1 = Math.min(1, t1);
  if (t1 - t0 <= EPS) return [seg]; // no overlap along the segment
  const out: Segment[] = [];
  if (t0 > EPS) out.push({ ...seg, b: pointAt(seg.a, seg.b, t0) });
  if (t1 < 1 - EPS) out.push({ ...seg, a: pointAt(seg.a, seg.b, t1) });
  return out;
}

/**
 * Build the final sight-blocking segment list for a scene (SPEC §3.3). Walls =
 * perimeter + explicit. Open doors carve gaps; blocking doors add their own
 * blocker. Returns segments in lattice units for the visibility pass.
 */
export function buildSightSegments(floor: MultiPoly, explicit: Segment[], doors: Door[]): Segment[] {
  let segs = [...perimeterSegments(floor), ...explicit.filter((s) => s.blocksSight)];
  const open = doors.filter(doorPasses);
  const blocking = doors.filter((d) => !doorPasses(d));
  for (const door of open) {
    segs = segs.flatMap((s) => clipDoorFromSegment(s, door));
  }
  for (const door of blocking) {
    segs.push({ a: door.a, b: door.b, source: 'explicit', blocksSight: true, blocksMovement: true });
  }
  return segs;
}

// ---- visibility polygon from an eye point ----

interface Ray {
  angle: number;
}

function raySegmentHit(eye: Point, angle: number, s: Segment): number | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const sx = s.b.x - s.a.x;
  const sy = s.b.y - s.a.y;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < EPS) return null;
  const tx = s.a.x - eye.x;
  const ty = s.a.y - eye.y;
  const t = (tx * sy - ty * sx) / denom; // distance along ray
  const u = (tx * dy - ty * dx) / denom; // param along segment
  if (t >= 0 && u >= -EPS && u <= 1 + EPS) return t;
  return null;
}

/**
 * Classic angular-sweep visibility polygon: cast rays at (±ε of) every segment
 * endpoint, keep the nearest hit per ray, sort by angle. The filled polygon is
 * the lit area — an open door visibly lets light through, a closed one casts a
 * shadow. This is the POC's proof that door reconciliation actually drives LoS.
 */
export function visibilityPolygon(eye: Point, segs: Segment[], maxDist: number): Point[] {
  if (segs.length === 0) return [];
  const rays: Ray[] = [];
  for (const s of segs) {
    for (const p of [s.a, s.b]) {
      const base = Math.atan2(p.y - eye.y, p.x - eye.x);
      rays.push({ angle: base - 0.0001 }, { angle: base }, { angle: base + 0.0001 });
    }
  }
  rays.sort((r1, r2) => r1.angle - r2.angle);
  const poly: Point[] = [];
  for (const ray of rays) {
    let best = maxDist;
    for (const s of segs) {
      const t = raySegmentHit(eye, ray.angle, s);
      if (t !== null && t < best) best = t;
    }
    poly.push({ x: eye.x + Math.cos(ray.angle) * best, y: eye.y + Math.sin(ray.angle) * best });
  }
  return poly;
}
