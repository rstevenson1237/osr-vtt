import { describe, expect, it } from 'vitest';
import { FloorGrid, rectToCells } from './grid.js';
import { canonicalizeEdge, derivePerimeterEdges, edgeId, isEdgeBlocked, neighborAcross, parseEdgeId } from './walls.js';

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
