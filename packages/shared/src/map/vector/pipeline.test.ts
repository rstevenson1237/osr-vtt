import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { commitCarve, countHoles, estimateBytes } from './pipeline.js';
import { rectPoly, regularPoly } from './primitives.js';
import { countVertices } from './simplify.js';
import type { MultiPoly, Poly } from './types.js';

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
  it('a disjoint region keeps its exact vertices even when a later stroke\'s bbox spans it', () => {
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
