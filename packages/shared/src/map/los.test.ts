import { describe, expect, it } from 'vitest';
import {
  allGridCells,
  edgeSegment,
  segmentsCross,
  sightBlocked,
  sightSegments,
  visibleCells,
  type Segment,
} from './los.js';
import type { Cell } from './grid.js';
import type { MapWall, SightWall } from '../types.js';

describe('segmentsCross', () => {
  it('detects a proper crossing', () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it('returns false for non-crossing segments', () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 }),
    ).toBe(false);
  });

  it('treats a bare endpoint touch as not crossing (sight grazes a corner)', () => {
    // Ray ends exactly on the wall's supporting line at a shared point.
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 }),
    ).toBe(false);
  });

  it('treats collinear overlap as not crossing', () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }),
    ).toBe(false);
  });
});

describe('sightBlocked', () => {
  const wall: Segment = { a: { x: 5, y: -10 }, b: { x: 5, y: 10 } };

  it('blocks a ray that crosses the wall', () => {
    expect(sightBlocked({ x: 0, y: 0 }, { x: 10, y: 0 }, [wall])).toBe(true);
  });

  it('passes a ray that stays on one side', () => {
    expect(sightBlocked({ x: 0, y: 0 }, { x: 4, y: 3 }, [wall])).toBe(false);
  });

  it('passes when there are no walls', () => {
    expect(sightBlocked({ x: 0, y: 0 }, { x: 100, y: 100 }, [])).toBe(false);
  });
});

describe('edgeSegment', () => {
  it('maps an N edge to the top side of its cell', () => {
    expect(edgeSegment({ x: 1, y: 2, side: 'N' }, 10)).toEqual({
      a: { x: 10, y: 20 },
      b: { x: 20, y: 20 },
    });
  });

  it('canonicalizes an S edge to the neighbor cell N edge', () => {
    // S of (1,1) == N of (1,2): the horizontal line y=20 from x=10..20.
    expect(edgeSegment({ x: 1, y: 1, side: 'S' }, 10)).toEqual({
      a: { x: 10, y: 20 },
      b: { x: 20, y: 20 },
    });
  });
});

describe('sightSegments', () => {
  const cellSize = 10;

  it('derives perimeter walls around an isolated floor cell', () => {
    const floorCells: Cell[] = [{ x: 0, y: 0 }];
    const isFloor = (c: Cell) => c.x === 0 && c.y === 0;
    const segments = sightSegments({ floorCells, isFloor, walls: [], cellSize });
    // A lone floor cell has 4 perimeter edges.
    expect(segments).toHaveLength(4);
  });

  it('excludes open doors but keeps closed and secret doors', () => {
    const walls: MapWall[] = [
      { id: '0,0,N', x: 0, y: 0, side: 'N', door: { state: 'open', secret: false } },
      { id: '1,0,N', x: 1, y: 0, side: 'N', door: { state: 'closed', secret: false } },
      { id: '2,0,N', x: 2, y: 0, side: 'N', door: { state: 'closed', secret: true } },
    ];
    const segments = sightSegments({ floorCells: [], isFloor: () => false, walls, cellSize });
    // Open door dropped; closed + secret kept.
    expect(segments).toHaveLength(2);
  });

  it('includes imported vector walls, honoring their door state', () => {
    const sightWalls: SightWall[] = [
      { id: 'w1', ax: 0, ay: 0, bx: 50, by: 0 },
      { id: 'w2', ax: 0, ay: 10, bx: 50, by: 10, door: { state: 'open', secret: false } },
    ];
    const segments = sightSegments({
      floorCells: [],
      isFloor: () => false,
      walls: [],
      sightWalls,
      cellSize,
    });
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ a: { x: 0, y: 0 }, b: { x: 50, y: 0 } });
  });
});

describe('visibleCells', () => {
  const cellSize = 10;

  it('hides cells behind a wall from a viewpoint', () => {
    // Vertical wall along x=50 spanning the grid; viewpoint at cell (2,5).
    const wall: Segment = { a: { x: 50, y: 0 }, b: { x: 50, y: 100 } };
    const origin = { x: 25, y: 55 };
    const cells = allGridCells(10, 10);
    const visible = visibleCells([origin], cells, [wall], cellSize);

    // A near cell on the viewpoint's side is visible…
    expect(visible.has('3,5')).toBe(true);
    // …a cell across the wall is not.
    expect(visible.has('7,5')).toBe(false);
    // Every visible cell is on the near side (x < 5).
    for (const key of visible) {
      const [x] = key.split(',').map(Number);
      expect(x).toBeLessThan(5);
    }
  });

  it('sees everything with no walls', () => {
    const cells = allGridCells(4, 4);
    const visible = visibleCells([{ x: 20, y: 20 }], cells, [], cellSize);
    expect(visible.size).toBe(16);
  });

  it('returns nothing without a viewpoint', () => {
    const cells = allGridCells(4, 4);
    expect(visibleCells([], cells, [], cellSize).size).toBe(0);
  });

  it('unions visibility across multiple viewpoints', () => {
    const wall: Segment = { a: { x: 50, y: 0 }, b: { x: 50, y: 100 } };
    const cells = allGridCells(10, 10);
    const near = visibleCells([{ x: 25, y: 55 }], cells, [wall], cellSize);
    const both = visibleCells([{ x: 25, y: 55 }, { x: 75, y: 55 }], cells, [wall], cellSize);
    // A second viewpoint on the far side reveals cells the first couldn't see.
    expect(both.has('7,5')).toBe(true);
    expect(both.size).toBeGreaterThan(near.size);
  });
});
