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
