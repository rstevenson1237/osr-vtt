import { describe, expect, it } from 'vitest';
import { chainWallEdges, hashSeed, naturalizePolyline, type Point } from './natural.js';
import type { Edge } from './walls.js';

const CELL = 70;

describe('hashSeed', () => {
  it('is deterministic and varies by input (R9.4 seed = hash(roomId + runKey))', () => {
    expect(hashSeed('room-1:3,4')).toBe(hashSeed('room-1:3,4'));
    expect(hashSeed('room-1:3,4')).not.toBe(hashSeed('room-1:3,5'));
  });
});

describe('naturalizePolyline (Master Plan v2, R9.4)', () => {
  const line: Point[] = [
    { x: 0, y: 0 },
    { x: 4 * CELL, y: 0 },
  ];

  it('same inputs produce an identical point list (deterministic render)', () => {
    const a = naturalizePolyline(line, { seed: hashSeed('r:0,0'), cellSize: CELL });
    const b = naturalizePolyline(line, { seed: hashSeed('r:0,0'), cellSize: CELL });
    expect(a).toEqual(b);
  });

  it('a different seed yields a different point list', () => {
    const a = naturalizePolyline(line, { seed: hashSeed('r:0,0'), cellSize: CELL });
    const b = naturalizePolyline(line, { seed: hashSeed('r:9,9'), cellSize: CELL });
    expect(a).not.toEqual(b);
  });

  it('keeps the two global endpoints exactly on the true geometry', () => {
    const pts = naturalizePolyline(line, { seed: 123, cellSize: CELL });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 4 * CELL, y: 0 });
  });

  it('clamps displacement to ≤0.25 cell so art never disagrees with LoS edges', () => {
    // A huge requested displacement is clamped; the horizontal line only bows
    // in y, so every |y| must stay within 0.25·cell of the true edge.
    const pts = naturalizePolyline(line, {
      seed: 42,
      cellSize: CELL,
      maxDisplaceCells: 5,
      subdivisions: 6,
    });
    for (const p of pts) expect(Math.abs(p.y)).toBeLessThanOrEqual(0.25 * CELL + 1e-9);
  });

  it('inserts subdivision points between vertices', () => {
    const pts = naturalizePolyline(line, { seed: 1, cellSize: CELL, subdivisions: 3 });
    // one segment, 3 subdivisions => start + 3 interior + end = 5 points.
    expect(pts).toHaveLength(5);
  });

  it('passes short polylines through unchanged', () => {
    expect(naturalizePolyline([{ x: 5, y: 5 }], { seed: 1, cellSize: CELL })).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('chainWallEdges (Master Plan v2, R9.4)', () => {
  it('chains the four edges of a unit cell into a single closed loop', () => {
    // Perimeter of cell (0,0): N, S, W, E edges.
    const edges: Edge[] = [
      { x: 0, y: 0, side: 'N' },
      { x: 0, y: 0, side: 'S' },
      { x: 0, y: 0, side: 'W' },
      { x: 0, y: 0, side: 'E' },
    ];
    const chains = chainWallEdges(edges);
    expect(chains).toHaveLength(1);
    const loop = chains[0]!;
    // A closed 4-edge loop visits 4 corners and returns to the start (5 points).
    expect(loop).toHaveLength(5);
    expect(loop[0]).toEqual(loop[loop.length - 1]);
  });

  it('splits disconnected edge sets into separate polylines', () => {
    const edges: Edge[] = [
      { x: 0, y: 0, side: 'N' }, // (0,0)-(1,0)
      { x: 5, y: 5, side: 'N' }, // (5,5)-(6,5), far away
    ];
    expect(chainWallEdges(edges)).toHaveLength(2);
  });

  it('is deterministic across calls', () => {
    const edges: Edge[] = [
      { x: 0, y: 0, side: 'N' },
      { x: 1, y: 0, side: 'N' },
      { x: 2, y: 0, side: 'N' },
    ];
    expect(chainWallEdges(edges)).toEqual(chainWallEdges(edges));
  });
});
