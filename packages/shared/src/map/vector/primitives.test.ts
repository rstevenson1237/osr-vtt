import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { bufferPolyline, corridorPoly, polygonPoly, rectPoly, regularPoly } from './primitives.js';
import type { MultiPoly } from './types.js';

const allAxisAligned = (mp: MultiPoly) =>
  mp.every((poly) =>
    poly.every((ring) =>
      ring.every((p, i) => {
        const q = ring[(i + 1) % ring.length]!;
        return Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.y - q.y) < 1e-9;
      }),
    ),
  );
const allInteger = (mp: MultiPoly) =>
  mp.every((poly) =>
    poly.every((ring) => ring.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))),
  );

describe('rectPoly (Room)', () => {
  it('normalizes opposite corners into a 4-vertex rectangle', () => {
    const poly = rectPoly({ x: 3, y: 5 }, { x: 1, y: 2 });
    expect(poly).not.toBeNull();
    expect(poly![0]).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 1, y: 5 },
    ]);
  });

  it('rejects a degenerate (zero-area) rectangle', () => {
    expect(rectPoly({ x: 1, y: 1 }, { x: 1, y: 5 })).toBeNull();
  });
});

describe('polygonPoly (irregular)', () => {
  it('needs at least three vertices', () => {
    expect(
      polygonPoly([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBeNull();
  });
  it('copies the collected vertices (no aliasing)', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    const poly = polygonPoly(src)!;
    src[0]!.x = 99;
    expect(poly[0]![0]).toEqual({ x: 0, y: 0 });
  });
});

describe('regularPoly (Regular n-gon)', () => {
  it('emits n vertices for n>=3', () => {
    expect(regularPoly({ x: 0, y: 0 }, 5, 6)![0]).toHaveLength(6);
  });
  it('n<=1 is the degenerate circle → finely sampled', () => {
    expect(regularPoly({ x: 0, y: 0 }, 5, 1)![0]).toHaveLength(64);
  });
  it('rejects a non-positive radius', () => {
    expect(regularPoly({ x: 0, y: 0 }, 0, 6)).toBeNull();
  });
});

describe('corridorPoly (L-shaped, cardinal)', () => {
  it('legs are axis-aligned (flat ends, 90° corner) snapped and freeform', () => {
    expect(allAxisAligned(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, true))).toBe(true);
    expect(allAxisAligned(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, false))).toBe(true);
  });
  it('snapped odd-width walls land on whole grid lines (no half-tile offset)', () => {
    expect(allInteger(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, true))).toBe(true);
  });
  it('freeform centers the band rather than grid-forcing it', () => {
    expect(allInteger(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, false))).toBe(false);
  });
});

describe('bufferPolyline (Path — M6 offset stand-in)', () => {
  it('a single point buffers to a round cap', () => {
    const mp = bufferPolyline([{ x: 0, y: 0 }], 2, B);
    expect(mp).toHaveLength(1);
    expect(mp[0]![0]!.length).toBeGreaterThan(3);
  });
  it('a multi-point path unions into one connected region', () => {
    const mp = bufferPolyline(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
      1,
      B,
    );
    expect(mp).toHaveLength(1);
  });
  it('empty input and non-positive width yield nothing', () => {
    expect(bufferPolyline([], 2, B)).toEqual([]);
    expect(bufferPolyline([{ x: 0, y: 0 }], 0, B)).toEqual([]);
  });
});
