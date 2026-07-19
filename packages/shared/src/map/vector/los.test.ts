import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import {
  buildMovementSegments,
  buildSightSegments,
  perimeterSegments,
  visibilityPolygon,
} from './los.js';
import { commitCarve } from './pipeline.js';
import { rectPoly } from './primitives.js';
import type { Door, MultiPoly, Point, Segment } from './types.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;

// Proper segment crossing (matches los raycast semantics: bare endpoint touches
// / collinear grazes don't count).
const orient = (a: Point, b: Point, c: Point) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const cross = (p1: Point, p2: Point, p3: Point, p4: Point) =>
  orient(p3, p4, p1) * orient(p3, p4, p2) < 0 && orient(p1, p2, p3) * orient(p1, p2, p4) < 0;
const blocked = (eye: Point, target: Point, segs: Segment[]) =>
  segs.some((s) => cross(eye, target, s.a, s.b));

describe('perimeterSegments (SPEC §3.1)', () => {
  it('derives one segment per boundary edge, tagged perimeter/block-both', () => {
    const floor = commitCarve([], [rect(0, 0, 4, 4)], 'add', 0, B).floor;
    const segs = perimeterSegments(floor);
    expect(segs).toHaveLength(4);
    expect(segs.every((s) => s.source === 'perimeter')).toBe(true);
    expect(segs.every((s) => s.blocksSight && s.blocksMovement)).toBe(true);
  });

  it('includes hole rings (interior rock-carve boundary blocks too)', () => {
    let floor: MultiPoly = commitCarve([], [rect(0, 0, 10, 10)], 'add', 0, B).floor;
    floor = commitCarve(floor, [rect(4, 4, 6, 6)], 'subtract', 0, B).floor;
    // 4 outer + 4 hole edges.
    expect(perimeterSegments(floor)).toHaveLength(8);
  });
});

describe('door reconciliation at build time (SPEC §3.3)', () => {
  const floor = commitCarve([], [rect(0, 0, 10, 6)], 'add', 0, B).floor;
  const eye = { x: 5, y: 3 };
  const overDoorway = { x: 5, y: 9 }; // straight up through the door span, out of the room
  const closed: Door = {
    id: 'd',
    a: { x: 4, y: 6 },
    b: { x: 6, y: 6 },
    type: 'single',
    state: 'closed',
  };
  const open: Door = { ...closed, state: 'open' };

  it('a closed door blocks sight through the wall', () => {
    expect(blocked(eye, overDoorway, buildSightSegments(floor, [], [closed]))).toBe(true);
  });
  it('an open door opens a real gap in sight', () => {
    expect(blocked(eye, overDoorway, buildSightSegments(floor, [], [open]))).toBe(false);
  });
  it('an open door only opens its own span (solid wall still blocks)', () => {
    expect(blocked(eye, { x: 1, y: 9 }, buildSightSegments(floor, [], [open]))).toBe(true);
  });
  it('a barred door blocks even when marked open', () => {
    const barred: Door = { ...open, type: 'barred' };
    expect(blocked(eye, overDoorway, buildSightSegments(floor, [], [barred]))).toBe(true);
  });
  it('sight-only explicit walls are excluded from the movement build and vice-versa', () => {
    const sightOnly: Segment = {
      a: { x: 2, y: 1 },
      b: { x: 2, y: 5 },
      source: 'explicit',
      blocksSight: true,
      blocksMovement: false,
    };
    expect(buildSightSegments(floor, [sightOnly], []).some((s) => s.source === 'explicit')).toBe(
      true,
    );
    expect(buildMovementSegments(floor, [sightOnly], []).some((s) => s.source === 'explicit')).toBe(
      false,
    );
  });
});

describe('visibilityPolygon', () => {
  it('builds a filled polygon from a non-empty segment set', () => {
    const floor = commitCarve([], [rect(0, 0, 10, 6)], 'add', 0, B).floor;
    const segs = buildSightSegments(floor, [], []);
    expect(visibilityPolygon({ x: 5, y: 3 }, segs, 50).length).toBeGreaterThan(3);
  });
  it('returns nothing with no segments', () => {
    expect(visibilityPolygon({ x: 0, y: 0 }, [], 50)).toEqual([]);
  });
});
