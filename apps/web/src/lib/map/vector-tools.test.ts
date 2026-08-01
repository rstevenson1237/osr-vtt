import {
  vectorMap,
  type CampaignStore,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
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
  strokeMeasureText,
  targetedCellFor,
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
  return {
    id,
    a: { x: 0, y: 0 },
    b: { x: 4, y: 0 },
    source: 'explicit',
    blocksSight: true,
    blocksMovement: true,
  };
}

function door(id: string): VectorDoor {
  return { id, a: { x: 2, y: 0 }, b: { x: 2, y: 1 }, type: 'single', state: 'closed' };
}

describe('op invert/no-op', () => {
  it('inverts a floorRegionBatch by swapping from/to on every change', () => {
    const r = region('r1', 0);
    const op: VectorEditorOp = {
      kind: 'floorRegionBatch',
      changes: [{ id: 'r1', from: null, to: r }],
    };
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
    expect(store.commitFloorRegions).toHaveBeenCalledWith('room1', 'map1', {
      put: [survivor],
      delete: ['b'],
    });
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
    await commitVectorOpForward(store, 'room1', 'map1', {
      kind: 'door',
      id: 'd1',
      from: null,
      to: door('d1'),
    });
    expect(store.setDoor).toHaveBeenCalledWith('room1', 'map1', door('d1'));

    await commitVectorOpForward(store, 'room1', 'map1', {
      kind: 'door',
      id: 'd1',
      from: door('d1'),
      to: null,
    });
    expect(store.removeDoor).toHaveBeenCalledWith('room1', 'map1', 'd1');
  });
});

describe('buildCarveOp (SPEC §8.5 floorRegionBatch, Model A bbox-diffing)', () => {
  it('a fresh carve with no prior regions is pure creation (from: null)', () => {
    const stroke: vectorMap.MultiPoly = [region('new', 0).rings];
    const strokeBBox = strokeBBoxOf(stroke);
    const op = buildCarveOp([], stroke, strokeBBox, () => 'new-1');
    expect(op).toEqual({
      kind: 'floorRegionBatch',
      changes: [
        { id: 'new-1', from: null, to: { id: 'new-1', rings: stroke[0], bbox: strokeBBox } },
      ],
    });
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
    expect(buildCarveOp([region('a', 0)], [], null)).toEqual({
      kind: 'floorRegionBatch',
      changes: [],
    });
  });
});

describe('buildFloorStroke (SPEC §2.5 — one pipeline, five collectors)', () => {
  const backend = vectorMap.polygonClippingBackend;
  const opts = { snap: 'full' as const, width: 2, corridorWidth: 1, sides: 6 };

  it('room needs a drag start+end and emits an axis-aligned rect', () => {
    expect(buildFloorStroke('room', opts, null, { x: 1, y: 1 }, [], backend)).toBeNull();
    const mp = buildFloorStroke('room', opts, { x: 0, y: 0 }, { x: 4, y: 3 }, [], backend);
    expect(mp).toHaveLength(1);
    expect(mp![0]![0]).toHaveLength(4);
  });

  // SPEC-028: the three cell-anchored tools take *raw* lattice points and do
  // their own snapping, which is what lets them answer "which cell was that".
  it('room snaps to whole cells, and a click with no drag is 1×1', () => {
    const click = buildFloorStroke(
      'room',
      opts,
      { x: 3.7, y: 5.2 },
      { x: 3.7, y: 5.2 },
      [],
      backend,
    );
    expect(click![0]![0]).toEqual([
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 3, y: 6 },
    ]);
    // Dragging into the next cell over grows it to 2×1 — both end cells count.
    const drag = buildFloorStroke(
      'room',
      opts,
      { x: 3.7, y: 5.2 },
      { x: 4.1, y: 5.9 },
      [],
      backend,
    );
    expect(drag![0]![0]![2]).toEqual({ x: 5, y: 6 });
  });

  it('room in free snap keeps corner-to-corner, degenerate case included', () => {
    const free = { ...opts, snap: 'free' as const };
    expect(buildFloorStroke('room', free, { x: 1, y: 1 }, { x: 1, y: 1 }, [], backend)).toBeNull();
    const mp = buildFloorStroke('room', free, { x: 1.25, y: 1 }, { x: 3.5, y: 2 }, [], backend);
    expect(mp![0]![0]![0]).toEqual({ x: 1.25, y: 1 });
  });

  it('corridor uses corridorWidth, not the shared brush width', () => {
    const wide = buildFloorStroke(
      'corridor',
      { ...opts, corridorWidth: 2, width: 0.5 },
      { x: 2.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
      [],
      backend,
    );
    const narrow = buildFloorStroke(
      'corridor',
      { ...opts, corridorWidth: 0.5, width: 2 },
      { x: 2.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
      [],
      backend,
    );
    const height = (mp: vectorMap.MultiPoly | null): number => {
      const b = strokeBBoxOf(mp)!;
      return b.maxY - b.minY;
    };
    expect(height(wide)).toBeCloseTo(2);
    expect(height(narrow)).toBeCloseTo(0.5);
  });

  it('ngon takes its diameter across the flats and its rotation from the drag', () => {
    // Drag due east from the centre of cell (0,0), 1.5 cells long → an
    // across-flats diameter of 3, snapped, and a flat face pointing east.
    const mp = buildFloorStroke(
      'ngon',
      { ...opts, sides: 4 },
      { x: 0.4, y: 0.6 },
      { x: 1.9, y: 0.6 },
      [],
      backend,
    );
    const ring = mp![0]![0]!;
    expect(ring).toHaveLength(4);
    // A square with a face normal on the x-axis, centred on cell (0,0)'s
    // centre, has its corners at 0.5 ± 1.5 in both axes.
    for (const p of ring) {
      expect(Math.abs(p.x - 0.5)).toBeCloseTo(1.5);
      expect(Math.abs(p.y - 0.5)).toBeCloseTo(1.5);
    }
  });

  it('ngon is centred in the cell the drag started in, wherever in it that was', () => {
    const a = buildFloorStroke('ngon', opts, { x: 3.1, y: 4.1 }, { x: 6, y: 4.1 }, [], backend);
    const b = buildFloorStroke('ngon', opts, { x: 3.9, y: 4.9 }, { x: 6.8, y: 4.9 }, [], backend);
    expect(strokeBBoxOf(a)).toEqual(strokeBBoxOf(b));
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
    const mp = buildFloorStroke('path', opts, null, { x: 4, y: 0 }, [{ x: 0, y: 0 }], backend);
    expect(mp).not.toBeNull();
    expect(mp!.length).toBeGreaterThan(0);
  });

  it('ngon with sides=1 degenerates to a circle (SPEC §2.5)', () => {
    const mp = buildFloorStroke(
      'ngon',
      { ...opts, sides: 1 },
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      [],
      backend,
    );
    expect(mp).not.toBeNull();
    expect(mp![0]![0]!.length).toBeGreaterThan(8); // sampled as a fine polygon
  });
});

describe('carve brush — snap level picks the shape', () => {
  const backend = vectorMap.polygonClippingBackend;
  const opts = { snap: 'full' as const, width: 2, corridorWidth: 1, sides: 6 };
  const stroke = [
    { x: 0.5, y: 0.5 },
    { x: 3.5, y: 0.5 },
  ];

  /** Shoelace area of a MultiPoly, outer rings positive and holes negative. */
  function area(mp: vectorMap.MultiPoly | null): number {
    if (!mp) return 0;
    let total = 0;
    for (const poly of mp) {
      poly.forEach((ring, ringIndex) => {
        let sum = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]!;
          const b = ring[(i + 1) % ring.length]!;
          sum += a.x * b.y - b.x * a.y;
        }
        total += (ringIndex === 0 ? 1 : -1) * Math.abs(sum / 2);
      });
    }
    return total;
  }

  it('emits nothing before any point has been sampled', () => {
    expect(buildFloorStroke('carve', opts, null, null, [], backend)).toBeNull();
  });

  it('cell snap paints whole lattice cells, so every vertex is on the lattice', () => {
    const mp = buildFloorStroke('carve', opts, null, null, stroke, backend);
    expect(mp).not.toBeNull();
    for (const ring of mp![0]!) {
      for (const p of ring) {
        expect(Number.isInteger(p.x)).toBe(true);
        expect(Number.isInteger(p.y)).toBe(true);
      }
    }
  });

  it('half snap paints on the half-lattice', () => {
    const mp = buildFloorStroke('carve', { ...opts, snap: 'half' }, null, null, stroke, backend);
    expect(mp).not.toBeNull();
    const onHalfLattice = mp![0]![0]!.every((p) => (p.x * 2) % 1 === 0 && (p.y * 2) % 1 === 0);
    expect(onHalfLattice).toBe(true);
  });

  it('free snap buffers the polyline instead of quantizing it', () => {
    const free = buildFloorStroke('carve', { ...opts, snap: 'free' }, null, null, stroke, backend);
    const snapped = buildFloorStroke('carve', opts, null, null, stroke, backend);
    expect(free).not.toBeNull();
    expect(snapped).not.toBeNull();
    // Both cover roughly the same swath, but only the snapped one lands on
    // whole cells — the free ribbon's own extent is not cell-aligned.
    expect(area(free)).toBeGreaterThan(0);
    const freeBBox = strokeBBoxOf(free)!;
    expect(freeBBox.minY % 1).not.toBe(0);
  });

  it('a brush narrower than a cell still paints the cell it passes through', () => {
    const mp = buildFloorStroke(
      'carve',
      { ...opts, width: 0.1 },
      null,
      null,
      [{ x: 2.5, y: 2.5 }],
      backend,
    );
    expect(area(mp)).toBeCloseTo(1, 6);
  });

  it('appends the live cursor to the sampled points', () => {
    const withCursor = buildFloorStroke('carve', opts, null, { x: 8.5, y: 0.5 }, stroke, backend);
    const without = buildFloorStroke('carve', opts, null, null, stroke, backend);
    expect(area(withCursor)).toBeGreaterThan(area(without));
  });
});

describe('targetedCellFor (SPEC-028 snap indicator)', () => {
  it('highlights the whole cell the pointer is in, for Room and Corridor', () => {
    for (const tool of ['room', 'corridor']) {
      expect(targetedCellFor(tool, 'full', { x: 3.9, y: 5.1 })).toEqual({ x: 3, y: 5, size: 1 });
    }
  });

  it('drops to the half-cell under half snap', () => {
    expect(targetedCellFor('room', 'half', { x: 3.9, y: 5.1 })).toEqual({
      x: 3.5,
      y: 5,
      size: 0.5,
    });
  });

  it('shows nothing in free snap — there is no cell to target', () => {
    expect(targetedCellFor('room', 'free', { x: 3.9, y: 5.1 })).toBeNull();
  });

  it('shows nothing before the pointer has been anywhere', () => {
    expect(targetedCellFor('room', 'full', null)).toBeNull();
  });

  it('stays off for every other tool, n-gon included', () => {
    // The n-gon anchors to a cell but extends well past it, so a centre-cell
    // highlight would advertise the wrong extent.
    for (const tool of ['ngon', 'carve', 'path', 'polygon', 'wall', 'door', 'pan']) {
      expect(targetedCellFor(tool, 'full', { x: 3.9, y: 5.1 })).toBeNull();
    }
  });
});

describe('strokeMeasureText (live dimension readout)', () => {
  const measure = { perSquare: 10, unit: 'feet' };

  it('reports a room as w × h in game units, unit named once', () => {
    const m = strokeMeasureText('room', { x: 0, y: 0 }, { x: 4, y: 3 }, measure);
    expect(m?.text).toBe('40 × 30 feet');
    expect(m?.at).toEqual({ x: 2, y: 1.5 });
  });

  it('falls back to raw cells with no measure', () => {
    expect(strokeMeasureText('room', { x: 0, y: 0 }, { x: 4, y: 3 }, null)?.text).toBe('4 × 3');
  });

  // SPEC-028 moved the n-gon's authored dimension from the radius to the
  // across-flats diameter, so the chip reports the number being steered.
  it('reports an n-gon drag as a diameter across the flats', () => {
    const m = strokeMeasureText('ngon', { x: 0, y: 0 }, { x: 3, y: 4 }, measure);
    expect(m?.text).toBe('⌀ 100 feet');
  });

  it('reports the committed size under snap, not the distance dragged', () => {
    // A drag that stays inside one cell still commits a 1×1 room...
    expect(
      strokeMeasureText('room', { x: 2.1, y: 2.1 }, { x: 2.4, y: 2.4 }, null, 'full')?.text,
    ).toBe('1 × 1');
    // ...and one that crosses into the next cell commits two.
    expect(
      strokeMeasureText('room', { x: 2.1, y: 2.1 }, { x: 3.4, y: 2.4 }, null, 'full')?.text,
    ).toBe('2 × 1');
    expect(strokeMeasureText('ngon', { x: 0, y: 0 }, { x: 0.6, y: 0 }, null, 'full')?.text).toBe(
      '⌀ 1',
    );
  });

  it('rounds to one decimal for freeform drags', () => {
    const m = strokeMeasureText('room', { x: 0, y: 0 }, { x: 1.234, y: 2 }, null);
    expect(m?.text).toBe('1.2 × 2');
  });

  it('stays silent for a degenerate drag and for tools with no single dimension', () => {
    expect(strokeMeasureText('room', { x: 2, y: 2 }, { x: 2, y: 2 }, measure)).toBeNull();
    expect(strokeMeasureText('carve', { x: 0, y: 0 }, { x: 4, y: 3 }, measure)).toBeNull();
    expect(strokeMeasureText('path', { x: 0, y: 0 }, { x: 4, y: 3 }, measure)).toBeNull();
    expect(strokeMeasureText('room', null, { x: 4, y: 3 }, measure)).toBeNull();
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
    const after = recomputeRegionBBox({
      ...before,
      rings: [[...before.rings[0]!.slice(0, 3), { x: -1, y: 4 }]],
    });
    const op = buildDragOp({ kind: 'region', id: 'r1' }, before, after);
    expect(op).toEqual({
      kind: 'floorRegionBatch',
      changes: [{ id: 'r1', from: before, to: after }],
    });
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
