import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { commitCarve } from './pipeline.js';
import {
  pointInFloorUnion,
  pointInFloorUnionRegions,
  pointInPoly,
  pointInRing,
} from './point-in-floor.js';
import { rectPoly } from './primitives.js';
import { toFloorRegions } from './region.js';
import type { MultiPoly, Ring } from './types.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;
const unitSquare: Ring = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

describe('pointInRing (crossing number)', () => {
  it('detects interior and exterior points', () => {
    expect(pointInRing({ x: 2, y: 2 }, unitSquare)).toBe(true);
    expect(pointInRing({ x: 5, y: 2 }, unitSquare)).toBe(false);
    expect(pointInRing({ x: -1, y: 2 }, unitSquare)).toBe(false);
  });
});

describe('pointInPoly (outer minus holes)', () => {
  it('excludes points that fall inside a hole', () => {
    const holed = [
      unitSquare,
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
      ],
    ];
    expect(pointInPoly({ x: 2, y: 2 }, holed)).toBe(false); // inside the hole
    expect(pointInPoly({ x: 0.5, y: 0.5 }, holed)).toBe(true); // in the frame
  });
});

describe('pointInFloorUnion (SPEC §7, REVIEW M5)', () => {
  it('is true inside a carved room, false outside', () => {
    const floor = commitCarve([], [rect(0, 0, 10, 6)], 'add', 0, B).floor;
    expect(pointInFloorUnion({ x: 5, y: 3 }, floor)).toBe(true);
    expect(pointInFloorUnion({ x: 12, y: 3 }, floor)).toBe(false);
  });

  it('is false inside an interior rock-carve hole', () => {
    let floor: MultiPoly = commitCarve([], [rect(0, 0, 10, 10)], 'add', 0, B).floor;
    floor = commitCarve(floor, [rect(4, 4, 6, 6)], 'subtract', 0, B).floor;
    expect(pointInFloorUnion({ x: 1, y: 1 }, floor)).toBe(true); // floor
    expect(pointInFloorUnion({ x: 5, y: 5 }, floor)).toBe(false); // in the hole
  });

  it('covers both regions of a split floor union', () => {
    let floor: MultiPoly = commitCarve([], [rect(0, 0, 10, 4)], 'add', 0, B).floor;
    floor = commitCarve(floor, [rect(4, -1, 6, 5)], 'subtract', 0, B).floor;
    expect(floor).toHaveLength(2);
    expect(pointInFloorUnion({ x: 1, y: 2 }, floor)).toBe(true); // left region
    expect(pointInFloorUnion({ x: 9, y: 2 }, floor)).toBe(true); // right region
    expect(pointInFloorUnion({ x: 5, y: 2 }, floor)).toBe(false); // carved gap
  });
});

describe('pointInFloorUnionRegions (bbox-accelerated)', () => {
  it('matches pointInFloorUnion but skips regions by bbox', () => {
    let floor: MultiPoly = commitCarve([], [rect(0, 0, 3, 3)], 'add', 0, B).floor;
    floor = commitCarve(floor, [rect(10, 10, 13, 13)], 'add', 0, B).floor;
    const regions = toFloorRegions(floor, (i) => `r${i}`);
    expect(regions).toHaveLength(2);
    expect(pointInFloorUnionRegions({ x: 1, y: 1 }, regions)).toBe(true);
    expect(pointInFloorUnionRegions({ x: 11, y: 11 }, regions)).toBe(true);
    expect(pointInFloorUnionRegions({ x: 6, y: 6 }, regions)).toBe(false);
  });
});
