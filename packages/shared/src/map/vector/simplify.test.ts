import { describe, expect, it } from 'vitest';
import { regularPoly } from './primitives.js';
import { countVertices, simplifyMulti, simplifyRing } from './simplify.js';
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
