/**
 * Circular wall geometry + line-of-sight sampling (Master Plan v2, R10.5).
 *
 * A `CircleWall` is stored as a center + radius in pixel space (see
 * `types.ts`). For LoS it is sampled into a regular N-gon whose edges feed
 * `sightSegments()` exactly like any other vector wall — with one twist: any
 * ring segment whose midpoint angle falls inside an OPEN `gaps` arc is dropped,
 * so a cut gap is a real opening that light and movement pass through (R10.5,
 * R10.5b).
 *
 * Pure + deterministic: the same `CircleWall` always samples to the identical
 * N-gon on every client (no RNG, integer segment count derived from the
 * radius), so a circle run blocks/opens identically across clients.
 */

import type { Arc, CircleWall } from '../types.js';
import type { Segment, Vec2 } from './los.js';

const TWO_PI = Math.PI * 2;

/** Wrap an angle into `[0, 2π)`. */
export function normalizeAngle(a: number): number {
  const m = a % TWO_PI;
  return m < 0 ? m + TWO_PI : m;
}

/**
 * True when `angle` lies inside the OPEN arc `[start, end]` swept CCW from
 * `start` to `end` (R10.5 — `gaps` are open spans). Handles the wrap case
 * where `start > end` (the arc crosses the 0/2π seam). A degenerate arc
 * (`start === end`) covers nothing.
 */
export function angleInArc(angle: number, arc: Arc): boolean {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(arc.start);
  const e = normalizeAngle(arc.end);
  if (s === e) return false;
  return s < e ? a >= s && a <= e : a >= s || a <= e;
}

/** True when `angle` falls inside any of the ring's gap arcs. */
export function angleInAnyGap(angle: number, gaps: readonly Arc[] | undefined): boolean {
  if (!gaps || gaps.length === 0) return false;
  for (const gap of gaps) {
    if (angleInArc(angle, gap)) return true;
  }
  return false;
}

/**
 * Number of segments to sample a ring into: proportional to the radius, so a
 * small circle stays cheap and a large one reads smooth, capped so LoS never
 * explodes on a huge ring (R10.5 "N∝radius, cap ~64"). Deterministic integer.
 */
export function circleSegmentCount(radius: number, maxSegments = 64): number {
  const n = Math.round(Math.abs(radius) / 6);
  return Math.max(12, Math.min(maxSegments, n));
}

/** A ring sample point at `angle` (radians) in pixel space. */
export function pointOnCircle(circle: Pick<CircleWall, 'cx' | 'cy' | 'r'>, angle: number): Vec2 {
  return { x: circle.cx + Math.cos(angle) * circle.r, y: circle.cy + Math.sin(angle) * circle.r };
}

/**
 * Sample a `CircleWall` into the sight-blocking N-gon segments it contributes
 * to LoS (R10.5). Each of the `N` ring segments spans angles
 * `[k/N·2π, (k+1)/N·2π]`; a segment is **omitted** when its midpoint angle
 * falls inside a `gaps` arc, so the gap is a genuine opening (R10.5b). A
 * radius of 0 contributes nothing.
 */
export function circleWallSegments(circle: CircleWall, maxSegments = 64): Segment[] {
  if (circle.r <= 0) return [];
  const n = circleSegmentCount(circle.r, maxSegments);
  const segments: Segment[] = [];
  for (let k = 0; k < n; k++) {
    const midAngle = ((k + 0.5) / n) * TWO_PI;
    if (angleInAnyGap(midAngle, circle.gaps)) continue; // an open gap — sight passes
    const a = pointOnCircle(circle, (k / n) * TWO_PI);
    const b = pointOnCircle(circle, ((k + 1) / n) * TWO_PI);
    segments.push({ a, b });
  }
  return segments;
}

/**
 * The angle (radians, CCW from +x) of `point` about the circle's center — the
 * geometry a "cut a gap" interaction uses to turn a pointer position on the
 * ring into an arc angle (R10.6). Returns a value in `[0, 2π)`.
 */
export function angleAt(circle: Pick<CircleWall, 'cx' | 'cy'>, point: Vec2): number {
  return normalizeAngle(Math.atan2(point.y - circle.cy, point.x - circle.cx));
}
