import { FloorGrid, FogGrid, rectToCells } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import type { MapRoom } from '@osr-vtt/shared';
import {
  applyFloorOp,
  applyFogOp,
  buildFloorOp,
  buildFogOp,
  compareMapRoomKeys,
  invertOp,
  isMapRoomKeyUnique,
  isNoopOp,
  mapRoomCellCount,
  nextMapRoomKey,
  renumberMapRoomsByOrder,
  sortMapRoomsByKey,
} from './tools.js';

function mapRoom(id: string, key: string, name = '', bbox = { x: 0, y: 0, w: 1, h: 1 }): MapRoom {
  return { id, key, name, bbox, labelAnchor: { x: bbox.x, y: bbox.y }, wallStyle: 'masonry' };
}

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

describe('Rooms manager helpers (Master Plan v2, R17.2 / R13.3 / WI-20)', () => {
  it('cell count reports the bbox area', () => {
    expect(mapRoomCellCount(mapRoom('a', '1', '', { x: 2, y: 3, w: 6, h: 8 }))).toBe(48);
  });

  it('sorts by key numerically, not lexically (10 after 9)', () => {
    const rooms = [mapRoom('c', '10'), mapRoom('a', '2'), mapRoom('b', '9')];
    expect(sortMapRoomsByKey(rooms).map((r) => r.key)).toEqual(['2', '9', '10']);
  });

  it('sorts a lettered sub-key just after its numeric stem', () => {
    expect(['2a', '2', '3'].sort(compareMapRoomKeys)).toEqual(['2', '2a', '3']);
  });

  it('key uniqueness ignores the room being edited but catches a collision', () => {
    const rooms = [mapRoom('a', '1'), mapRoom('b', '2')];
    expect(isMapRoomKeyUnique('2', rooms, 'a')).toBe(false); // collides with b
    expect(isMapRoomKeyUnique('2', rooms, 'b')).toBe(true); // b keeping its own key
    expect(isMapRoomKeyUnique('3', rooms, 'a')).toBe(true);
    expect(isMapRoomKeyUnique('  ', rooms, 'a')).toBe(false); // blank never valid
  });

  it('renumber-by-order assigns sequential 1..n keys and returns only the changed rooms', () => {
    // Start 1,2,3; move room "3" to the front → desired order [3,1,2].
    const r1 = mapRoom('a', '1');
    const r2 = mapRoom('b', '2');
    const r3 = mapRoom('c', '3');
    const changes = renumberMapRoomsByOrder([r3, r1, r2]);
    // r3 → 1, r1 → 2, r2 → 3 : all three keys change.
    expect(changes.map((c) => [c.id, c.to.key])).toEqual([
      ['c', '1'],
      ['a', '2'],
      ['b', '3'],
    ]);
    // Keys stay globally unique (1..n) by construction.
    expect(new Set(changes.map((c) => c.to.key)).size).toBe(3);
  });

  it('renumber-by-order is a no-op when the order already matches the keys', () => {
    const list = [mapRoom('a', '1'), mapRoom('b', '2'), mapRoom('c', '3')];
    expect(renumberMapRoomsByOrder(list)).toEqual([]);
  });
});

describe('invertOp / isNoopOp — mapRoomBatch (Master Plan v2, R13.3 renumber undo)', () => {
  it('inverts every change in a renumber batch, swapping from/to', () => {
    const from = mapRoom('a', '1');
    const to = { ...from, key: '2' };
    const inverse = invertOp({ kind: 'mapRoomBatch', changes: [{ id: 'a', from, to }] });
    if (inverse.kind !== 'mapRoomBatch') throw new Error('unreachable');
    expect(inverse.changes).toEqual([{ id: 'a', from: to, to: from }]);
  });

  it('an empty renumber batch is a no-op', () => {
    expect(isNoopOp({ kind: 'mapRoomBatch', changes: [] })).toBe(true);
  });
});
