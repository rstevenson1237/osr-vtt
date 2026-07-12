import { describe, expect, it } from 'vitest';
import { FloorGrid, rectToCells } from './grid.js';
import {
  canonicalizeEdge,
  derivePerimeterEdges,
  edgeId,
  edgeSegmentPixels,
  isAxisAlignedRun,
  isEdgeBlocked,
  neighborAcross,
  parseEdgeId,
  snapToIntersection,
  wallRunEdges,
} from './walls.js';

describe('edge canonicalization', () => {
  it('S of (x,y) is the same edge as N of (x,y+1)', () => {
    expect(edgeId({ x: 0, y: 0, side: 'S' })).toBe(edgeId({ x: 0, y: 1, side: 'N' }));
  });

  it('E of (x,y) is the same edge as W of (x+1,y)', () => {
    expect(edgeId({ x: 0, y: 0, side: 'E' })).toBe(edgeId({ x: 1, y: 0, side: 'W' }));
  });

  it('N and W edges canonicalize to themselves', () => {
    expect(canonicalizeEdge({ x: 3, y: 3, side: 'N' })).toEqual({ x: 3, y: 3, side: 'N' });
    expect(canonicalizeEdge({ x: 3, y: 3, side: 'W' })).toEqual({ x: 3, y: 3, side: 'W' });
  });

  it('round-trips through parseEdgeId', () => {
    const id = edgeId({ x: -2, y: 5, side: 'E' });
    expect(parseEdgeId(id)).toEqual(canonicalizeEdge({ x: -2, y: 5, side: 'E' }));
  });
});

describe('neighborAcross', () => {
  it('finds the cell on the other side of each side', () => {
    const cell = { x: 5, y: 5 };
    expect(neighborAcross(cell, 'N')).toEqual({ x: 5, y: 4 });
    expect(neighborAcross(cell, 'S')).toEqual({ x: 5, y: 6 });
    expect(neighborAcross(cell, 'E')).toEqual({ x: 6, y: 5 });
    expect(neighborAcross(cell, 'W')).toEqual({ x: 4, y: 5 });
  });
});

describe('derivePerimeterEdges', () => {
  it('derives exactly the floor/rock boundary of a single carved cell', () => {
    const { grid } = new FloorGrid().setCells([{ x: 0, y: 0 }], true);
    const edges = derivePerimeterEdges((c) => grid.isFloor(c), [{ x: 0, y: 0 }]);
    expect(edges).toHaveLength(4);
  });

  it('does not wall off shared interior edges of a carved room (no z-order, floor unions)', () => {
    const { grid } = new FloorGrid().setCells(rectToCells({ x: 0, y: 0 }, { x: 1, y: 0 }), true);
    const edges = derivePerimeterEdges((c) => grid.isFloor(c), [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    // A 2x1 room has 6 perimeter edges (not 8) — the shared internal edge
    // between the two floor cells is not a boundary.
    expect(edges).toHaveLength(6);
  });
});

describe('isEdgeBlocked', () => {
  it('blocks on a perimeter (floor/rock) boundary with no explicit wall', () => {
    const { grid } = new FloorGrid().setCells([{ x: 0, y: 0 }], true);
    const blocked = isEdgeBlocked({ x: 0, y: 0 }, 'E', (c) => grid.isFloor(c), new Set());
    expect(blocked).toBe(true);
  });

  it('does not block between two floor cells with no explicit wall', () => {
    const { grid } = new FloorGrid().setCells(rectToCells({ x: 0, y: 0 }, { x: 1, y: 0 }), true);
    const blocked = isEdgeBlocked({ x: 0, y: 0 }, 'E', (c) => grid.isFloor(c), new Set());
    expect(blocked).toBe(false);
  });

  it('blocks between two floor cells when an explicit wall subdivides them', () => {
    const { grid } = new FloorGrid().setCells(rectToCells({ x: 0, y: 0 }, { x: 1, y: 0 }), true);
    const walls = new Set([edgeId({ x: 0, y: 0, side: 'E' })]);
    expect(isEdgeBlocked({ x: 0, y: 0 }, 'E', (c) => grid.isFloor(c), walls)).toBe(true);
    // Explicit walls persist regardless of which cell you query the edge from.
    expect(isEdgeBlocked({ x: 1, y: 0 }, 'W', (c) => grid.isFloor(c), walls)).toBe(true);
  });
});

describe('snapToIntersection (Master Plan v2, R9.2 — wall drag-run pointer snapping)', () => {
  const cellSize = 70;

  it('snaps a point to the nearest lattice corner, not the nearest cell', () => {
    expect(snapToIntersection({ x: 5, y: 5 }, cellSize)).toEqual({ x: 0, y: 0 });
    expect(snapToIntersection({ x: 40, y: 5 }, cellSize)).toEqual({ x: 1, y: 0 });
    expect(snapToIntersection({ x: 100, y: 200 }, cellSize)).toEqual({ x: 1, y: 3 });
  });
});

describe('isAxisAlignedRun', () => {
  it('is true for two distinct intersections sharing a row or column', () => {
    expect(isAxisAlignedRun({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(true);
    expect(isAxisAlignedRun({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe(true);
  });

  it('is false for a diagonal pair or an identical pair', () => {
    expect(isAxisAlignedRun({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(false);
    expect(isAxisAlignedRun({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });
});

describe('wallRunEdges (Master Plan v2, R9.2 — "drag a run" batch decomposition)', () => {
  it('decomposes a 6-cell horizontal drag into exactly 6 canonical edges, one per Firestore batch write', () => {
    const edges = wallRunEdges({ x: 1, y: 1 }, { x: 7, y: 1 });
    expect(edges).toHaveLength(6);
    expect(edges.every((e) => e.side === 'N' && e.y === 1)).toBe(true);
    expect(edges.map((e) => e.x)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('decomposes a vertical drag into W-side edges', () => {
    const edges = wallRunEdges({ x: 4, y: 0 }, { x: 4, y: 3 });
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.side === 'W' && e.x === 4)).toBe(true);
    expect(edges.map((e) => e.y)).toEqual([0, 1, 2]);
  });

  it('is direction-independent — dragging backward produces the same edge set', () => {
    const forward = wallRunEdges({ x: 1, y: 1 }, { x: 4, y: 1 });
    const backward = wallRunEdges({ x: 4, y: 1 }, { x: 1, y: 1 });
    expect(backward).toEqual(forward);
  });

  it('returns [] for a diagonal drag (handled as a vector SightWall instead)', () => {
    expect(wallRunEdges({ x: 0, y: 0 }, { x: 3, y: 2 })).toEqual([]);
  });
});

describe('edgeSegmentPixels', () => {
  it('converts a canonical N edge to its pixel-space horizontal segment', () => {
    expect(edgeSegmentPixels({ x: 1, y: 1, side: 'N' }, 70)).toEqual({
      x1: 70,
      y1: 70,
      x2: 140,
      y2: 70,
    });
  });

  it('converts a canonical W edge to its pixel-space vertical segment', () => {
    expect(edgeSegmentPixels({ x: 4, y: 0, side: 'W' }, 70)).toEqual({
      x1: 280,
      y1: 0,
      x2: 280,
      y2: 70,
    });
  });
});
