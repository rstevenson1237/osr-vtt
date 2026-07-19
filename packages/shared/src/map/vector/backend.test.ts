import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { rectPoly } from './primitives.js';
import type { MultiPoly } from './types.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;

describe('polygonClippingBackend (SPEC §5.3)', () => {
  it('names itself for the §8.1 shootout report', () => {
    expect(B.name).toContain('polygon-clipping');
  });

  it('union of empty base + one poly is that poly (returned as a closed ring)', () => {
    const out = B.union([], [rect(0, 0, 2, 2)]);
    expect(out).toHaveLength(1);
    expect(out[0]![0]).toHaveLength(5); // closed: first vertex repeated
    expect(out[0]![0]![0]).toEqual(out[0]![0]![4]);
  });

  it('union of two overlapping polys merges them', () => {
    expect(B.union([], [rect(0, 0, 3, 3), rect(2, 2, 5, 5)])).toHaveLength(1);
  });

  it('difference of nothing returns a clone (not the same reference)', () => {
    const base: MultiPoly = [
      [
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
      ],
    ];
    const out = B.difference(base, []);
    expect(out).toEqual(base);
    expect(out).not.toBe(base);
    expect(out[0]![0]![0]).not.toBe(base[0]![0]![0]);
  });

  it('difference against an empty base stays empty', () => {
    expect(B.difference([], [rect(0, 0, 2, 2)])).toEqual([]);
  });

  it('fully-empty union is empty (no library call)', () => {
    expect(B.union([], [])).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const base = B.union([], [rect(0, 0, 4, 4)]);
    const snapshot = JSON.stringify(base);
    B.difference(base, [rect(1, 1, 2, 2)]);
    B.union(base, [rect(5, 5, 6, 6)]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
