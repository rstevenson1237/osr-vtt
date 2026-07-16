import { describe, expect, it } from 'vitest';
import {
  angleAt,
  angleInAnyGap,
  angleInArc,
  circleSegmentCount,
  circleWallSegments,
  normalizeAngle,
  pointOnCircle,
} from './circle.js';
import { sightBlocked, sightSegments } from './los.js';
import type { CircleWall } from '../types.js';

describe('normalizeAngle', () => {
  it('wraps into [0, 2π)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('angleInArc', () => {
  it('includes an angle inside a simple CCW arc', () => {
    expect(angleInArc(Math.PI / 2, { start: 0, end: Math.PI })).toBe(true);
  });

  it('excludes an angle outside the arc', () => {
    expect(angleInArc((3 * Math.PI) / 2, { start: 0, end: Math.PI })).toBe(false);
  });

  it('handles a wrap-around arc that crosses the 0/2π seam', () => {
    const arc = { start: (7 * Math.PI) / 4, end: Math.PI / 4 }; // spans the seam
    expect(angleInArc(0, arc)).toBe(true);
    expect(angleInArc(Math.PI, arc)).toBe(false);
  });

  it('a degenerate arc covers nothing', () => {
    expect(angleInArc(1, { start: 1, end: 1 })).toBe(false);
  });
});

describe('circleSegmentCount', () => {
  it('scales with radius and caps at 64', () => {
    expect(circleSegmentCount(10)).toBe(12); // floor
    expect(circleSegmentCount(120)).toBe(20);
    expect(circleSegmentCount(10000)).toBe(64); // cap
  });

  it('is deterministic for the same radius (cross-client stability)', () => {
    expect(circleSegmentCount(210)).toBe(circleSegmentCount(210));
  });
});

describe('circleWallSegments', () => {
  const base: CircleWall = { id: 'c1', cx: 100, cy: 100, r: 60, style: 'solid' };

  it('samples a full ring into an N-gon with N edges', () => {
    const segs = circleWallSegments(base);
    expect(segs.length).toBe(circleSegmentCount(base.r));
  });

  it('endpoints lie on the circle', () => {
    const segs = circleWallSegments(base);
    for (const s of segs) {
      expect(Math.hypot(s.a.x - base.cx, s.a.y - base.cy)).toBeCloseTo(base.r);
      expect(Math.hypot(s.b.x - base.cx, s.b.y - base.cy)).toBeCloseTo(base.r);
    }
  });

  it('a radius of 0 contributes nothing', () => {
    expect(circleWallSegments({ ...base, r: 0 })).toEqual([]);
  });

  it('drops segments whose midpoint falls inside a gap arc (an opening)', () => {
    const withGap: CircleWall = { ...base, gaps: [{ start: 0, end: Math.PI / 2 }] };
    const full = circleWallSegments(base);
    const cut = circleWallSegments(withGap);
    expect(cut.length).toBeLessThan(full.length);
    // No surviving segment has a midpoint inside the gap.
    for (const s of cut) {
      const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      expect(angleInAnyGap(angleAt(base, mid), withGap.gaps)).toBe(false);
    }
  });
});

describe('circle walls in sightSegments (LoS)', () => {
  const circle: CircleWall = { id: 'c1', cx: 100, cy: 100, r: 40, style: 'solid' };
  const input = {
    floorCells: [],
    isFloor: () => true,
    walls: [],
    cellSize: 70,
  };
  // Viewpoint at the ring center, target well outside along a generic (~10.5°)
  // direction so the ray exits through one ring edge cleanly — not through an
  // N-gon vertex (which a raycast intentionally does not treat as a crossing).
  const origin = { x: 100, y: 100 };
  const target = { x: 300, y: 137 };

  it('a solid ring blocks a ray from its interior to the outside', () => {
    const segments = sightSegments({ ...input, circleWalls: [circle] });
    expect(sightBlocked(origin, target, segments)).toBe(true);
  });

  it("a cut gap on the ray's side lets the ray pass through the opening", () => {
    // Open an arc spanning the ray's exit direction (~10.5°). Every ring edge
    // whose midpoint falls in [-30°, 30°] is dropped, so the ray passes.
    const gapped: CircleWall = { ...circle, gaps: [{ start: -Math.PI / 6, end: Math.PI / 6 }] };
    const segments = sightSegments({ ...input, circleWalls: [gapped] });
    expect(sightBlocked(origin, target, segments)).toBe(false);
  });
});

describe('pointOnCircle / angleAt round-trip', () => {
  it('angleAt inverts pointOnCircle', () => {
    const circle = { cx: 5, cy: -3, r: 12 };
    for (const a of [0, Math.PI / 3, Math.PI, (5 * Math.PI) / 4]) {
      const p = pointOnCircle(circle, a);
      expect(angleAt(circle, p)).toBeCloseTo(normalizeAngle(a));
    }
  });
});
