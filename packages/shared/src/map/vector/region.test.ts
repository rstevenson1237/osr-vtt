import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import { commitCarve } from './pipeline.js';
import { rectPoly } from './primitives.js';
import { bboxOverlaps, polyBBox, regionsToMultiPoly, toFloorRegions, unionBBox } from './region.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;

describe('polyBBox (SPEC §2.1 derived bbox)', () => {
  it('bounds the outer ring only (holes stay interior)', () => {
    const holed = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 3, y: 3 },
        { x: 6, y: 3 },
        { x: 6, y: 6 },
        { x: 3, y: 6 },
      ],
    ];
    expect(polyBBox(holed)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
  it('returns null for an empty polygon', () => {
    expect(polyBBox([])).toBeNull();
  });
});

describe('unionBBox / bboxOverlaps', () => {
  it('unions several boxes', () => {
    expect(
      unionBBox([
        { minX: 0, minY: 0, maxX: 2, maxY: 2 },
        { minX: 5, minY: 1, maxX: 7, maxY: 9 },
      ]),
    ).toEqual({ minX: 0, minY: 0, maxX: 7, maxY: 9 });
  });
  it('is null with no boxes', () => {
    expect(unionBBox([])).toBeNull();
  });
  it('detects overlap (touching counts) and separation', () => {
    const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    expect(bboxOverlaps(a, { minX: 2, minY: 2, maxX: 4, maxY: 4 })).toBe(true); // touch
    expect(bboxOverlaps(a, { minX: 3, minY: 3, maxX: 4, maxY: 4 })).toBe(false); // apart
  });
});

describe('toFloorRegions / regionsToMultiPoly (SPEC §2.1)', () => {
  it('assigns ids, derives bboxes, and round-trips the geometry', () => {
    let floor = commitCarve([], [rect(0, 0, 4, 4)], 'add', 0, B).floor;
    floor = commitCarve(floor, [rect(10, 10, 12, 12)], 'add', 0, B).floor;
    const regions = toFloorRegions(floor, (i) => `region-${i}`);
    expect(regions.map((r) => r.id)).toEqual(['region-0', 'region-1']);
    expect(regions[0]!.bbox).toEqual(polyBBox(floor[0]!));
    expect(regionsToMultiPoly(regions)).toEqual(floor);
  });

  it('does not alias the source geometry', () => {
    const floor = commitCarve([], [rect(0, 0, 4, 4)], 'add', 0, B).floor;
    const regions = toFloorRegions(floor, (i) => String(i));
    regions[0]!.rings[0]![0]!.x = 99;
    expect(floor[0]![0]![0]!.x).toBe(0);
  });
});
