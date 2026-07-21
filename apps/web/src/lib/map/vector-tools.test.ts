import { vectorMap, type CampaignStore, type StoredVectorWall, type VectorDoor, type VectorFloorRegion } from '@osr-vtt/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCarveOp,
  buildDoorPreviewSeg,
  buildDragOp,
  buildFloorStroke,
  buildWallPreviewSegs,
  buildWallRunOp,
  commitVectorOpForward,
  distToPoint,
  distToSeg,
  edgeHandles,
  findOwnerRecord,
  invertVectorOp,
  isNoopVectorOp,
  nextVectorId,
  pickEdgeHandle,
  pickVertexHandle,
  recomputeRegionBBox,
  strokeBBoxOf,
  vertexHandles,
  type VectorEditorOp,
} from './vector-tools.js';

function region(id: string, ox: number): VectorFloorRegion {
  const rings = [
    [
      { x: ox, y: 0 },
      { x: ox + 4, y: 0 },
      { x: ox + 4, y: 4 },
      { x: ox, y: 4 },
    ],
  ];
  return { id, rings, bbox: { minX: ox, minY: 0, maxX: ox + 4, maxY: 4 } };
}

function wall(id: string): StoredVectorWall {
  return { id, a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, source: 'explicit', blocksSight: true, blocksMovement: true };
}

function door(id: string): VectorDoor {
  return { id, a: { x: 2, y: 0 }, b: { x: 2, y: 1 }, type: 'single', state: 'closed' };
}

describe('op invert/no-op', () => {
  it('inverts a floorRegionBatch by swapping from/to on every change', () => {
    const r = region('r1', 0);
    const op: VectorEditorOp = { kind: 'floorRegionBatch', changes: [{ id: 'r1', from: null, to: r }] };
    const inv = invertVectorOp(op);
    expect(inv).toEqual({ kind: 'floorRegionBatch', changes: [{ id: 'r1', from: r, to: null }] });
    expect(invertVectorOp(inv)).toEqual(op);
  });

  it('inverts a door op by swapping from/to', () => {
    const d = door('d1');
    const op: VectorEditorOp = { kind: 'door', id: 'd1', from: null, to: d };
    expect(invertVectorOp(op)).toEqual({ kind: 'door', id: 'd1', from: d, to: null });
  });

  it('an empty batch is a no-op; a real change is not', () => {
    expect(isNoopVectorOp({ kind: 'floorRegionBatch', changes: [] })).toBe(true);
    expect(isNoopVectorOp({ kind: 'wallsBatch', changes: [] })).toBe(true);
    expect(isNoopVectorOp({ kind: 'door', id: 'd1', from: null, to: door('d1') })).toBe(false);
  });
});

describe('commitVectorOpForward', () => {
  function fakeStore() {
    return {
      commitFloorRegions: vi.fn().mockResolvedValue(undefined),
      setWalls: vi.fn().mockResolvedValue(undefined),
      removeWalls: vi.fn().mockResolvedValue(undefined),
      setDoor: vi.fn().mockResolvedValue(undefined),
      removeDoor: vi.fn().mockResolvedValue(undefined),
    } as unknown as CampaignStore & {
      commitFloorRegions: ReturnType<typeof vi.fn>;
      setWalls: ReturnType<typeof vi.fn>;
      removeWalls: ReturnType<typeof vi.fn>;
      setDoor: ReturnType<typeof vi.fn>;
      removeDoor: ReturnType<typeof vi.fn>;
    };
  }

  it('splits a floorRegionBatch into put/delete and calls commitFloorRegions once', async () => {
    const store = fakeStore();
    const survivor = region('a', 0);
    const op: VectorEditorOp = {
      kind: 'floorRegionBatch',
      changes: [
        { id: 'a', from: null, to: survivor },
        { id: 'b', from: region('b', 6), to: null },
      ],
    };
    await commitVectorOpForward(store, 'room1', 'map1', op);
    expect(store.commitFloorRegions).toHaveBeenCalledWith('room1', 'map1', { put: [survivor], delete: ['b'] });
  });

  it('routes a wallsBatch to setWalls and removeWalls', async () => {
    const store = fakeStore();
    const op: VectorEditorOp = {
      kind: 'wallsBatch',
      changes: [
        { id: 'w1', from: null, to: wall('w1') },
        { id: 'w2', from: wall('w2'), to: null },
      ],
    };
    await commitVectorOpForward(store, 'room1', 'map1', op);
    expect(store.setWalls).toHaveBeenCalledWith('room1', 'map1', [wall('w1')]);
    expect(store.removeWalls).toHaveBeenCalledWith('room1', 'map1', ['w2']);
  });

  it('routes a door create to setDoor and a door delete to removeDoor', async () => {
    const store = fakeStore();
    await commitVectorOpForward(store, 'room1', 'map1', { kind: 'door', id: 'd1', from: null, to: door('d1') });
    expect(store.setDoor).toHaveBeenCalledWith('room1', 'map1', door('d1'));

    await commitVectorOpForward(store, 'room1', 'map1', { kind: 'door', id: 'd1', from: door('d1'), to: null });
    expect(store.removeDoor).toHaveBeenCalledWith('room1', 'map1', 'd1');
  });
});

describe('buildCarveOp (SPEC §8.5 floorRegionBatch, Model A bbox-diffing)', () => {
  it('a fresh carve with no prior regions is pure creation (from: null)', () => {
    const stroke: vectorMap.MultiPoly = [region('new', 0).rings];
    const strokeBBox = strokeBBoxOf(stroke);
    const op = buildCarveOp([], stroke, strokeBBox, () => 'new-1');
    expect(op).toEqual({ kind: 'floorRegionBatch', changes: [{ id: 'new-1', from: null, to: { id: 'new-1', rings: stroke[0], bbox: strokeBBox } }] });
  });

  it('a stroke bridging two regions deletes both and creates the merged survivor', () => {
    const a = region('a', 0);
    const b = region('b', 10); // bbox disjoint from a — a bridging stroke would touch both
    const mergedRing = [
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 14, y: 4 },
      { x: 0, y: 4 },
    ];
    const afterFloor: vectorMap.MultiPoly = [[mergedRing]];
    const strokeBBox = vectorMap.unionBBox([a.bbox, b.bbox])!;
    const op = buildCarveOp([a, b], afterFloor, strokeBBox, () => 'merged-1');
    expect(op.kind).toBe('floorRegionBatch');
    if (op.kind !== 'floorRegionBatch') throw new Error('unreachable');
    expect(op.changes).toContainEqual({ id: 'a', from: a, to: null });
    expect(op.changes).toContainEqual({ id: 'b', from: b, to: null });
    expect(op.changes.find((c) => c.to)?.to?.rings).toEqual([mergedRing]);
  });

  it('a region whose bbox does not overlap the stroke is left out of the op entirely', () => {
    const untouched = region('far', 100);
    const strokeBBox = { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    const op = buildCarveOp([untouched], [], strokeBBox, () => 'x');
    expect(op).toEqual({ kind: 'floorRegionBatch', changes: [] });
  });

  it('a null stroke bbox (nothing drawn) is a no-op', () => {
    expect(buildCarveOp([region('a', 0)], [], null)).toEqual({ kind: 'floorRegionBatch', changes: [] });
  });
});

describe('buildFloorStroke (SPEC §2.5 — one pipeline, five collectors)', () => {
  const backend = vectorMap.polygonClippingBackend;
  const opts = { snap: 'full' as const, width: 2, sides: 6 };

  it('room needs a drag start+end and emits an axis-aligned rect', () => {
    expect(buildFloorStroke('room', opts, null, { x: 1, y: 1 }, [], backend)).toBeNull();
    const mp = buildFloorStroke('room', opts, { x: 0, y: 0 }, { x: 4, y: 3 }, [], backend);
    expect(mp).toHaveLength(1);
    expect(mp![0]![0]).toHaveLength(4);
  });

  it('polygon needs at least 2 collected points plus the live cursor', () => {
    expect(buildFloorStroke('polygon', opts, null, null, [{ x: 0, y: 0 }], backend)).toBeNull();
    const mp = buildFloorStroke(
      'polygon',
      opts,
      null,
      { x: 4, y: 4 },
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      backend,
    );
    expect(mp).not.toBeNull();
  });

  it('path buffers a polyline to a corridor of `width`', () => {
    const mp = buildFloorStroke(
      'path',
      opts,
      null,
      { x: 4, y: 0 },
      [{ x: 0, y: 0 }],
      backend,
    );
    expect(mp).not.toBeNull();
    expect(mp!.length).toBeGreaterThan(0);
  });

  it('ngon with sides=1 degenerates to a circle (SPEC §2.5)', () => {
    const mp = buildFloorStroke('ngon', { ...opts, sides: 1 }, { x: 0, y: 0 }, { x: 3, y: 0 }, [], backend);
    expect(mp).not.toBeNull();
    expect(mp![0]![0]!.length).toBeGreaterThan(8); // sampled as a fine polygon
  });
});

describe('wall/door preview + run building', () => {
  it('buildWallPreviewSegs chains collected points into segments', () => {
    const segs = buildWallPreviewSegs(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      { x: 4, y: 0 },
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 2, y: 0 }, source: 'explicit' });
  });

  it('buildWallRunOp emits one create change per segment with unique ids', () => {
    const op = buildWallRunOp([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
    expect(op.kind).toBe('wallsBatch');
    if (op.kind !== 'wallsBatch') throw new Error('unreachable');
    expect(op.changes).toHaveLength(2);
    expect(new Set(op.changes.map((c) => c.id)).size).toBe(2);
    expect(op.changes.every((c) => c.from === null)).toBe(true);
  });

  it('buildDoorPreviewSeg is null until both endpoints exist', () => {
    expect(buildDoorPreviewSeg(null, { x: 1, y: 1 })).toBeNull();
    expect(buildDoorPreviewSeg({ x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 1, y: 1 },
      source: 'explicit',
      blocksSight: true,
      blocksMovement: true,
    });
  });

  it('nextVectorId never collides within a batch', () => {
    const ids = Array.from({ length: 50 }, () => nextVectorId('wall'));
    expect(new Set(ids).size).toBe(50);
  });
});

describe('Select-tool handle picking + geometric edit', () => {
  const regions = [region('r1', 0)];
  const walls = [wall('w1')];
  const doors = [door('d1')];

  it('vertexHandles covers doors, walls, and every region ring point', () => {
    const handles = vertexHandles(regions, walls, doors);
    // 2 door endpoints + 2 wall endpoints + 4 region corners
    expect(handles).toHaveLength(2 + 2 + 4);
  });

  it('edgeHandles covers doors, walls, and every region ring edge (wrap-around)', () => {
    const handles = edgeHandles(regions, walls, doors);
    expect(handles).toHaveLength(1 + 1 + 4);
  });

  it('doors are picked ahead of overlapping walls/floor (priority order)', () => {
    // A vertex handle exists at (2,0) for the door endpoint from `door()`.
    const handles = vertexHandles(regions, walls, doors);
    const hit = pickVertexHandle({ x: 2, y: 0.05 }, handles, 0.5);
    expect(hit?.owner).toEqual({ kind: 'door', id: 'd1' });
  });

  it('pickEdgeHandle finds the nearest edge within threshold, null outside it', () => {
    const handles = edgeHandles(regions, [], []);
    const hit = pickEdgeHandle({ x: 2, y: 0.1 }, handles, 0.5);
    expect(hit).not.toBeNull();
    expect(pickEdgeHandle({ x: 2, y: 5 }, handles, 0.5)).toBeNull();
  });

  it('a handle.locate() re-resolves against a cloned working copy, not the original', () => {
    const handles = vertexHandles(regions, [], []);
    const cornerHandle = handles.find((h) => h.a.x === 0 && h.a.y === 0)!;
    const clone = structuredClone(regions[0]!);
    const [live] = cornerHandle.locate(clone);
    live!.x = 99;
    expect(clone.rings[0]![0]).toEqual({ x: 99, y: 0 });
    expect(regions[0]!.rings[0]![0]).toEqual({ x: 0, y: 0 }); // original untouched
  });

  it('findOwnerRecord looks up by owner kind + id', () => {
    expect(findOwnerRecord({ kind: 'wall', id: 'w1' }, regions, walls, doors)).toEqual(wall('w1'));
    expect(findOwnerRecord({ kind: 'door', id: 'missing' }, regions, walls, doors)).toBeNull();
  });

  it('recomputeRegionBBox derives a fresh bbox from the current rings', () => {
    const r = region('r1', 0);
    r.rings[0]![0]!.x = -10; // drag a corner out
    const recomputed = recomputeRegionBBox(r);
    expect(recomputed.bbox.minX).toBe(-10);
  });

  it('buildDragOp on a region produces a floorRegionBatch preserving identity (Model A: geometric, not parametric)', () => {
    const before = region('r1', 0);
    const after = recomputeRegionBBox({ ...before, rings: [[...before.rings[0]!.slice(0, 3), { x: -1, y: 4 }]] });
    const op = buildDragOp({ kind: 'region', id: 'r1' }, before, after);
    expect(op).toEqual({ kind: 'floorRegionBatch', changes: [{ id: 'r1', from: before, to: after }] });
  });

  it('buildDragOp on a door produces a door op', () => {
    const before = door('d1');
    const after = { ...before, state: 'open' as const };
    expect(buildDragOp({ kind: 'door', id: 'd1' }, before, after)).toEqual({
      kind: 'door',
      id: 'd1',
      from: before,
      to: after,
    });
  });
});

describe('distance helpers', () => {
  it('distToPoint is Euclidean distance', () => {
    expect(distToPoint({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('distToSeg clamps to the nearest endpoint past the segment ends', () => {
    expect(distToSeg({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distToSeg({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });
});
