import { FloorGrid, FogGrid, rectToCells } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import {
  applyFloorOp,
  applyFogOp,
  buildFloorOp,
  buildFogOp,
  invertOp,
  isNoopOp,
  nextMapRoomKey,
} from './tools.js';

describe('buildFloorOp / invertOp / applyFloorOp (carve -> undo -> redo)', () => {
  it('carve produces a floor op patching only the cells that actually changed', () => {
    const empty = new FloorGrid();
    const { op, grid } = buildFloorOp(empty, rectToCells({ x: 0, y: 0 }, { x: 1, y: 0 }), true);
    expect(op.kind).toBe('floor');
    if (op.kind !== 'floor') throw new Error('unreachable');
    expect(op.patches).toHaveLength(2);
    expect(grid.isFloor({ x: 0, y: 0 })).toBe(true);
    expect(grid.isFloor({ x: 1, y: 0 })).toBe(true);
  });

  it('re-carving the same cells is a no-op — nothing to undo', () => {
    const { grid: once } = buildFloorOp(new FloorGrid(), [{ x: 0, y: 0 }], true);
    const { op } = buildFloorOp(once, [{ x: 0, y: 0 }], true);
    expect(isNoopOp(op)).toBe(true);
  });

  it('undo (invert + reapply) restores the pre-carve grid exactly', () => {
    const before = new FloorGrid();
    const { op, grid: afterCarve } = buildFloorOp(before, rectToCells({ x: 0, y: 0 }, { x: 2, y: 2 }), true);
    const inverse = invertOp(op);
    if (inverse.kind !== 'floor') throw new Error('unreachable');
    const restored = applyFloorOp(afterCarve, inverse);
    for (const cell of rectToCells({ x: 0, y: 0 }, { x: 2, y: 2 })) {
      expect(restored.isFloor(cell)).toBe(before.isFloor(cell));
    }
  });

  it('redo (reapply the original op) reaches the same state as the first carve', () => {
    const before = new FloorGrid();
    const { op, grid: afterCarve } = buildFloorOp(before, [{ x: 5, y: 5 }], true);
    const inverse = invertOp(op);
    if (op.kind !== 'floor' || inverse.kind !== 'floor') throw new Error('unreachable');
    const undone = applyFloorOp(afterCarve, inverse);
    const redone = applyFloorOp(undone, op);
    expect(redone.isFloor({ x: 5, y: 5 })).toBe(true);
  });

  it('undoing a fill restores cells that were floor beforehand', () => {
    const carved = buildFloorOp(new FloorGrid(), rectToCells({ x: 0, y: 0 }, { x: 1, y: 1 }), true).grid;
    const { op, grid: filled } = buildFloorOp(carved, [{ x: 0, y: 0 }], false);
    expect(filled.isFloor({ x: 0, y: 0 })).toBe(false);
    const inverse = invertOp(op);
    if (inverse.kind !== 'floor') throw new Error('unreachable');
    const restored = applyFloorOp(filled, inverse);
    expect(restored.isFloor({ x: 0, y: 0 })).toBe(true);
  });
});

describe('buildFogOp / applyFogOp (FoW eraser)', () => {
  it('reveals only the swept cells and undo hides them again', () => {
    const { op, grid: revealed } = buildFogOp(FogGrid.empty(), [{ x: 1, y: 1 }]);
    expect(revealed.isRevealed({ x: 1, y: 1 })).toBe(true);
    const inverse = invertOp(op);
    if (inverse.kind !== 'fog') throw new Error('unreachable');
    const hidden = applyFogOp(revealed, inverse);
    expect(hidden.isRevealed({ x: 1, y: 1 })).toBe(false);
  });
});

describe('invertOp / isNoopOp — wallBatch (Master Plan v2, R9.2 drag-run undo)', () => {
  it('inverts every change in a batch, swapping from/to on each', () => {
    const op = {
      kind: 'wallBatch' as const,
      changes: [
        { edgeId: '1,1,N', from: null, to: { id: '1,1,N', x: 1, y: 1, side: 'N' as const } },
        { edgeId: '2,1,N', from: null, to: { id: '2,1,N', x: 2, y: 1, side: 'N' as const } },
      ],
    };
    const inverse = invertOp(op);
    if (inverse.kind !== 'wallBatch') throw new Error('unreachable');
    expect(inverse.changes).toEqual([
      { edgeId: '1,1,N', from: { id: '1,1,N', x: 1, y: 1, side: 'N' }, to: null },
      { edgeId: '2,1,N', from: { id: '2,1,N', x: 2, y: 1, side: 'N' }, to: null },
    ]);
  });

  it('an empty batch is a no-op', () => {
    expect(isNoopOp({ kind: 'wallBatch', changes: [] })).toBe(true);
  });

  it('a non-empty batch is not a no-op', () => {
    expect(
      isNoopOp({
        kind: 'wallBatch',
        changes: [{ edgeId: '1,1,N', from: null, to: { id: '1,1,N', x: 1, y: 1, side: 'N' } }],
      }),
    ).toBe(false);
  });
});

describe('invertOp — sightWall (Master Plan v2, R9.2 diagonal wall undo)', () => {
  it('inverts a diagonal wall placement into its removal', () => {
    const wall = { id: 'sw-1', ax: 0, ay: 0, bx: 70, by: 70, visible: true, style: 'masonry' as const };
    const inverse = invertOp({ kind: 'sightWall', id: 'sw-1', from: null, to: wall });
    expect(inverse).toEqual({ kind: 'sightWall', id: 'sw-1', from: wall, to: null });
  });
});

describe('nextMapRoomKey', () => {
  it('starts at 1 for an empty map', () => {
    expect(nextMapRoomKey([])).toBe('1');
  });

  it('increments past the highest existing numeric key', () => {
    expect(nextMapRoomKey(['1', '2', '4'])).toBe('5');
  });

  it('ignores lettered sub-keys when computing the next number', () => {
    expect(nextMapRoomKey(['1', '2a'])).toBe('3');
  });
});
