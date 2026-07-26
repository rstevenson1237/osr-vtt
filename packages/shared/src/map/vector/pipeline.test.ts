import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { commitCarve, countHoles, estimateBytes } from './pipeline.js';
import { bufferPolyline, rectPoly, regularPoly } from './primitives.js';
import { countVertices } from './simplify.js';
import type { MultiPoly, Point, Poly } from './types.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;
const TOL = 0;

describe('commitCarve — boolean combine (SPEC §5)', () => {
  it('overlapping carves merge to one region', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [rect(0, 0, 5, 5)], 'add', TOL, B).floor;
    f = commitCarve(f, [rect(3, 3, 8, 8)], 'add', TOL, B).floor;
    expect(f).toHaveLength(1);
  });

  it('disjoint carves stay two regions', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [rect(0, 0, 3, 3)], 'add', TOL, B).floor;
    f = commitCarve(f, [rect(6, 6, 9, 9)], 'add', TOL, B).floor;
    expect(f).toHaveLength(2);
  });

  it('a full bisection splits one region into two (SPEC §2.4 core claim)', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [rect(0, 0, 10, 4)], 'add', TOL, B).floor;
    expect(f).toHaveLength(1);
    // A rock bar spanning the full height cuts the strip in two.
    f = commitCarve(f, [rect(4, -1, 6, 5)], 'subtract', TOL, B).floor;
    expect(f).toHaveLength(2);
  });

  it('an interior subtraction makes one region with one hole (SPEC §2.4)', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [rect(0, 0, 10, 10)], 'add', TOL, B).floor;
    f = commitCarve(f, [rect(4, 4, 6, 6)], 'subtract', TOL, B).floor;
    expect(f).toHaveLength(1);
    expect(countHoles(f)).toBe(1);
  });

  it('subtracting everything empties the floor', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [rect(0, 0, 4, 4)], 'add', TOL, B).floor;
    f = commitCarve(f, [rect(-1, -1, 5, 5)], 'subtract', TOL, B).floor;
    expect(f).toHaveLength(0);
  });

  it('carving into an empty floor is just the stroke', () => {
    const { floor } = commitCarve([], [rect(0, 0, 2, 2)], 'add', TOL, B);
    expect(floor).toHaveLength(1);
    // The backend returns CLOSED rings (first vertex repeated), so a rectangle
    // comes back as 5 points, not the 4 the primitive emitted.
    expect(floor[0]![0]).toHaveLength(5);
    expect(floor[0]![0]![0]).toEqual(floor[0]![0]![4]);
  });
});

describe('commitCarve — metrics (SPEC §8.2/§8.4)', () => {
  it('reports region, hole, vertex and byte counts', () => {
    const res = commitCarve([], [rect(0, 0, 4, 4)], 'add', TOL, B);
    expect(res.metrics.regions).toBe(1);
    expect(res.metrics.holes).toBe(0);
    // Closed ring → 5 vertices; tol 0 leaves it untouched.
    expect(res.metrics.verticesRaw).toBe(5);
    expect(res.metrics.verticesSimplified).toBe(5);
    expect(res.metrics.bytesRaw).toBe(estimateBytes(res.floor));
    expect(res.metrics.opMs).toBeGreaterThanOrEqual(0);
  });

  it('simplification never increases the vertex count', () => {
    let f: MultiPoly = [];
    for (let i = 0; i < 10; i++) f = commitCarve(f, [rect(i, 0, i + 3, 3)], 'add', 0.1, B).floor;
    const res = commitCarve(f, [rect(2, 2, 20, 5)], 'add', 0.25, B);
    expect(res.metrics.verticesSimplified).toBeLessThanOrEqual(res.metrics.verticesRaw);
  });
});

describe('commitCarve — simplify only touched regions, not bbox-overlapping ones', () => {
  it("a disjoint region keeps its exact vertices even when a later stroke's bbox spans it", () => {
    // A crisp circle (N-gon sides=1) committed at tolerance 0.
    let f: MultiPoly = [];
    f = commitCarve(f, [regularPoly({ x: 100, y: 100 }, 5, 1)!], 'add', 0, B).floor;
    const circleVertsBefore = countVertices(f);
    expect(circleVertsBefore).toBeGreaterThan(60); // 64-gon, untouched

    // An L-shaped stroke hugging the axes: its bounding box (0,0)-(110,110)
    // fully contains the circle's bbox (~95,95)-(105,105), but the stroke's
    // actual footprint — two 10-wide arms along x=0 and y=0 — never comes
    // near the circle itself. A bbox-only "affected" test would wrongly
    // treat the circle as touched by this commit.
    const lShape: Poly = [
      [
        { x: 0, y: 0 },
        { x: 110, y: 0 },
        { x: 110, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 110 },
        { x: 0, y: 110 },
      ],
    ];
    f = commitCarve(f, [lShape], 'add', 0.5, B).floor;
    expect(f).toHaveLength(2); // circle and L-shape stay disjoint regions

    const circleAfter = f.find((poly) => {
      const bb = poly[0]!;
      return bb.some((p) => Math.hypot(p.x - 100, p.y - 100) < 6);
    });
    expect(circleAfter).toBeDefined();
    expect(countVertices([circleAfter!])).toBe(circleVertsBefore);
  });
});

describe('commitCarve — a coarse stroke never facets the shape it merges into', () => {
  const circleAt = (cx: number, cy: number, r: number) => regularPoly({ x: cx, y: cy }, r, 1)!;

  /** Largest deviation of a ring's vertices from the circle they were sampled
   * on — near-zero while the arc is intact, large once a chord replaces it. */
  const arcError = (poly: Poly, cx: number, cy: number, r: number) => {
    let worst = 0;
    const ring = poly[0]!;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Only judge midpoints that sit on the circle's side of the shape.
      if (Math.abs(Math.hypot(a.x - cx, a.y - cy) - r) > 0.05) continue;
      if (Math.abs(Math.hypot(b.x - cx, b.y - cy) - r) > 0.05) continue;
      worst = Math.max(worst, r - Math.hypot(mx - cx, my - cy));
    }
    return worst;
  };

  it('a Path merging into a circle leaves the circle’s arc intact', () => {
    let f: MultiPoly = [];
    f = commitCarve(f, [circleAt(0, 0, 8)], 'add', 0, B).floor;
    const before = arcError(f[0]!, 0, 0, 8);

    // A freeform path running out of the circle, committed at the Path
    // tolerance — this is the reported bug: one fused region, whole thing
    // re-simplified at 0.15, circle facets.
    const stroke = bufferPolyline(
      [
        { x: 4, y: 0 },
        { x: 12, y: 0.3 },
        { x: 18, y: -0.2 },
      ],
      2,
      B,
    );
    f = commitCarve(f, stroke, 'add', 0.15, B).floor;
    expect(f).toHaveLength(1); // fused into a single region

    expect(arcError(f[0]!, 0, 0, 8)).toBeLessThan(before + 0.01);
  });

  it('still prunes the redundant vertices the stroke itself contributed', () => {
    const noisy: Point[] = [];
    for (let i = 0; i <= 60; i++) noisy.push({ x: i * 0.4, y: Math.sin(i) * 0.02 });
    const stroke = bufferPolyline(noisy, 2, B);
    const raw = commitCarve([], stroke, 'add', 0, B);
    const pruned = commitCarve([], stroke, 'add', 0.15, B);
    expect(countVertices(pruned.floor)).toBeLessThan(countVertices(raw.floor));
  });
});

describe('countVertices / estimateBytes', () => {
  it('counts every vertex across regions and rings', () => {
    const mp: MultiPoly = [
      [
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ], // outer, 3
        [
          { x: 0.2, y: 0.2 },
          { x: 0.4, y: 0.2 },
          { x: 0.4, y: 0.4 },
        ], // hole, 3
      ],
    ];
    expect(countVertices(mp)).toBe(6);
    expect(estimateBytes(mp)).toBe(6 * 16);
  });
});
