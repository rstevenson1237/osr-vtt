import { describe, expect, it } from 'vitest';
import { bufferPolyline, regularPoly } from './primitives.js';
import { polygonClippingBackend as B } from './backend.js';
import { cleanRing, countVertices, simplifyMulti, simplifyRing } from './simplify.js';
import type { Ring } from './types.js';

describe('simplifyRing (Douglas-Peucker, SPEC §5.4)', () => {
  it('is a no-op at tolerance 0 or for near-triangles', () => {
    const tri: Ring = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    expect(simplifyRing(tri, 0.5)).toBe(tri);
    const quad: Ring = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(simplifyRing(quad, 0)).toBe(quad);
  });

  it('drops collinear midpoints on a straight edge', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, // collinear filler
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    const out = simplifyRing(ring, 0.01);
    expect(out).toHaveLength(4);
    expect(out).not.toContainEqual({ x: 1, y: 0 });
  });

  it('keeps a real corner that exceeds the tolerance', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0.5 }, // 0.5 off the 0,0→2,0 chord
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(simplifyRing(ring, 0.1)).toContainEqual({ x: 1, y: 0.5 });
    expect(simplifyRing(ring, 1)).not.toContainEqual({ x: 1, y: 0.5 });
  });

  it('reduces a sampled circle vertex count (bounds organic growth)', () => {
    const circle = regularPoly({ x: 0, y: 0 }, 8, 1)!; // 64-gon
    const before = countVertices([circle]);
    const after = countVertices(simplifyMulti([circle], 0.05));
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(3);
  });

  it('does not blow the stack on a very large ring', () => {
    const ring: Ring = [];
    for (let i = 0; i < 20000; i++) ring.push({ x: i, y: (i % 2) * 0.001 });
    expect(() => simplifyRing(ring, 0.01)).not.toThrow();
  });
});

describe('cleanRing (post-boolean-op render cleanup)', () => {
  it('drops near-duplicate vertices', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 0, y: 1e-9 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(cleanRing(ring)).toHaveLength(4);
  });

  it('drops a near-collinear vertex', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 2, y: 1e-9 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(cleanRing(ring)).toHaveLength(4);
  });

  it('drops a duplicate of the first vertex at the end (rings are stored open)', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 0 },
    ];
    expect(cleanRing(ring)).toHaveLength(3);
  });

  it('keeps a real corner and every genuine vertex of an n-gon', () => {
    const square: Ring = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(cleanRing(square)).toHaveLength(4);
    const ngon = regularPoly({ x: 0, y: 0 }, 5, 64)!;
    expect(cleanRing(ngon[0]!)).toHaveLength(64);
  });

  it('never returns a degenerate ring', () => {
    const sliver: Ring = [
      { x: 0, y: 0 },
      { x: 1e-9, y: 0 },
      { x: 0, y: 1e-9 },
    ];
    expect(cleanRing(sliver).length).toBeGreaterThanOrEqual(3);
  });

  // The reported symptom: a smooth circle facets once a Path crosses it,
  // because the union leaves micro-edges that starve the render-time fillet.
  it('leaves no micro-edges in a circle unioned with a path', () => {
    const circle = regularPoly({ x: 0, y: 0 }, 5, 64)!;
    const path = bufferPolyline(
      [
        { x: -8, y: 0 },
        { x: 8, y: 0.2 },
      ],
      1,
      B,
    );
    const united = B.union(path, [circle]);
    for (const poly of united) {
      for (const ring of poly) {
        const cleaned = cleanRing(ring);
        for (let i = 0; i < cleaned.length; i++) {
          const a = cleaned[i]!;
          const b = cleaned[(i + 1) % cleaned.length]!;
          expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(1e-3);
        }
      }
    }
  });
});
