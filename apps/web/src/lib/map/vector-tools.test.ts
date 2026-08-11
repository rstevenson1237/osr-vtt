import {
  vectorMap,
  type CampaignStore,
  type MapRoom,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  attractsToVertex,
  buildCarveOp,
  buildDoorPreviewSeg,
  buildDragOp,
  buildFloorStroke,
  buildHandleRemovalOp,
  buildWallPreviewSegs,
  buildWallRunOp,
  captureMeasureText,
  CELL_ANCHORED_TOOLS,
  commitVectorOpForward,
  distToPoint,
  distToSeg,
  findOwnerRecord,
  invertVectorOp,
  isNoopVectorOp,
  lassoBBox,
  lassoSelect,
  latchBendAxis,
  nextVectorId,
  noteDotCenter,
  objectBounds,
  ownerKey,
  pickNoteDotAt,
  pickPx,
  pickVertexHandle,
  PICK_PX_COARSE,
  PICK_PX_FINE,
  recomputeRegionBBox,
  removeRegionVertices,
  sameHandle,
  strokeBBoxOf,
  strokeMeasureText,
  targetedBandFor,
  targetedCellFor,
  vertexHandles,
  type Handle,
  type OwnerRecord,
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
  const opts = { snap: 'full' as const, width: 2, bandWidth: 1, sides: 6 };

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

  it('corridor uses bandWidth, not the Carve brush width', () => {
    const wide = buildFloorStroke(
      'corridor',
      { ...opts, bandWidth: 2, width: 0.5 },
      { x: 2.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
      [],
      backend,
    );
    const narrow = buildFloorStroke(
      'corridor',
      { ...opts, bandWidth: 0.5, width: 2 },
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

  // SPEC-028 §11 (IN-040, DEC-048): the latched axis reaches `corridorPoly`
  // through the options object, and an unlatched gesture keeps the old shape.
  it('corridor passes the latched bend axis through, and defaults without one', () => {
    const a = { x: 2.5, y: 2.5 };
    const b = { x: 8.5, y: 8.5 };
    const stroke = (bendAxis: vectorMap.BendAxis | null) =>
      buildFloorStroke('corridor', { ...opts, bendAxis }, a, b, [], backend)!;
    const inside = (mp: vectorMap.MultiPoly, p: { x: number; y: number }) =>
      vectorMap.pointInFloorUnion(p, mp);
    // Horizontal-first turns along the start row; vertical-first up the column.
    expect(inside(stroke('h'), { x: 8.5, y: 2.5 })).toBe(true);
    expect(inside(stroke('v'), { x: 8.5, y: 2.5 })).toBe(false);
    expect(inside(stroke('v'), { x: 2.5, y: 8.5 })).toBe(true);
    // No latch yet ⇒ the historical horizontal-first shape.
    const unlatched = stroke(null);
    expect(backend.difference(unlatched, stroke('h'))).toEqual([]);
    expect(backend.difference(stroke('h'), unlatched)).toEqual([]);
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

  it('path buffers a polyline to a band of `bandWidth`', () => {
    const mp = buildFloorStroke('path', opts, null, { x: 4, y: 0 }, [{ x: 0, y: 0 }], backend);
    expect(mp).not.toBeNull();
    expect(mp!.length).toBeGreaterThan(0);
  });

  // SPEC-028 §7 / DEC-032: Path took the Corridor's fixed set, so the Carve
  // brush's free-form `width` no longer reaches it at all.
  it('path uses bandWidth, not the Carve brush width', () => {
    const wide = buildFloorStroke(
      'path',
      { ...opts, bandWidth: 2, width: 0.5 },
      null,
      { x: 8.5, y: 2.5 },
      [{ x: 2.5, y: 2.5 }],
      backend,
    );
    const narrow = buildFloorStroke(
      'path',
      { ...opts, bandWidth: 0.5, width: 2 },
      null,
      { x: 8.5, y: 2.5 },
      [{ x: 2.5, y: 2.5 }],
      backend,
    );
    const height = (mp: vectorMap.MultiPoly | null): number => {
      const b = strokeBBoxOf(mp)!;
      return b.maxY - b.minY;
    };
    expect(height(wide)).toBeCloseTo(2);
    expect(height(narrow)).toBeCloseTo(0.5);
  });

  // The claim DEC-032 actually makes: a snapped Path between right-angle
  // points is the Corridor drawn between the same points.
  it('a right-angle snapped path is geometrically identical to the corridor', () => {
    const a = { x: 2.3, y: 2.7 };
    const corner = { x: 8.1, y: 2.7 };
    const b = { x: 8.1, y: 8.4 };
    for (const [snap, bandWidth] of [
      ['full', 1],
      ['full', 2],
      ['half', 0.5],
    ] as const) {
      const path = buildFloorStroke(
        'path',
        { ...opts, snap, bandWidth },
        null,
        b,
        [a, corner],
        backend,
      );
      const corridor = buildFloorStroke(
        'corridor',
        { ...opts, snap, bandWidth },
        a,
        b,
        [],
        backend,
      );
      const pb = strokeBBoxOf(path)!;
      const cb = strokeBBoxOf(corridor)!;
      expect(pb.minX).toBeCloseTo(cb.minX);
      expect(pb.minY).toBeCloseTo(cb.minY);
      expect(pb.maxX).toBeCloseTo(cb.maxX);
      expect(pb.maxY).toBeCloseTo(cb.maxY);
      // Same footprint, not merely the same bounding box.
      expect(vectorMap.polygonClippingBackend.difference(path!, corridor!)).toEqual([]);
      expect(vectorMap.polygonClippingBackend.difference(corridor!, path!)).toEqual([]);
    }
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
  const opts = { snap: 'full' as const, width: 2, bandWidth: 1, sides: 6 };
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

  // WI-042 (IN-012, IN-013): the brush used to receive vertex-snapped points,
  // so a click's true cell was unrecoverable — a click near a cell's corner
  // rounded to that corner's vertex, which sits 0.707 units from every one of
  // the four surrounding cell centres. At width <= 1 (radius 0.5) that meant
  // no cell qualified at all; at larger widths it painted a block centred on
  // the corner instead of the cell actually clicked.

  it('a dab well inside a cell (width 1) paints exactly that cell, not nothing', () => {
    // A raw click near a cell's corner, not its centre — this is the point a
    // vertex-snapping caller would previously have rounded away from the
    // cell it actually landed in.
    const mp = buildFloorStroke(
      'carve',
      { ...opts, width: 1 },
      null,
      null,
      [{ x: 3.9, y: 5.1 }],
      backend,
    );
    expect(area(mp)).toBeCloseTo(1, 6);
    expect(strokeBBoxOf(mp)).toEqual({ minX: 3, minY: 5, maxX: 4, maxY: 6 });
  });

  it('a dab paints the cell it was clicked in, not a block centred on the nearest corner', () => {
    // Width 1.5 (radius 0.75) is wide enough that the old vertex-rounded
    // behaviour painted a 2x2 block straddling the corner nearest the click;
    // anchored to the actual cell, only that one cell is within radius.
    const mp = buildFloorStroke(
      'carve',
      { ...opts, width: 1.5 },
      null,
      null,
      [{ x: 3.9, y: 5.9 }],
      backend,
    );
    expect(area(mp)).toBeCloseTo(1, 6);
    expect(strokeBBoxOf(mp)).toEqual({ minX: 3, minY: 5, maxX: 4, maxY: 6 });
  });
});

describe('targetedCellFor (SPEC-028 snap indicator)', () => {
  it('highlights the whole cell the pointer is in, for Room', () => {
    expect(targetedCellFor('room', 'full', { x: 3.9, y: 5.1 })).toEqual({ x: 3, y: 5, size: 1 });
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

  it('stays off for every other tool, n-gon and Corridor included', () => {
    // The n-gon anchors to a cell but extends well past it, so a centre-cell
    // highlight would advertise the wrong extent. Corridor and Path moved to
    // `targetedBandFor` at WI-052, since their width can be narrower than the
    // tile.
    for (const tool of ['ngon', 'carve', 'path', 'corridor', 'polygon', 'wall', 'door', 'pan']) {
      expect(targetedCellFor(tool, 'full', { x: 3.9, y: 5.1 })).toBeNull();
    }
  });
});

describe('latchBendAxis (SPEC-028 §11, DEC-048)', () => {
  const from = { x: 2.4, y: 2.4 };

  it('latches the axis the drag has travelled furthest along', () => {
    expect(latchBendAxis(null, from, { x: 5.4, y: 2.6 })).toBe('h');
    expect(latchBendAxis(null, from, { x: 2.6, y: 5.4 })).toBe('v');
    // Direction of travel is irrelevant — only which axis dominates.
    expect(latchBendAxis(null, from, { x: -1.6, y: 2.6 })).toBe('h');
    expect(latchBendAxis(null, from, { x: 2.6, y: -1.6 })).toBe('v');
  });

  it('waits while the drag is shorter than the threshold on both axes', () => {
    expect(latchBendAxis(null, from, { x: 2.6, y: 2.45 })).toBeNull();
    // The threshold is half a cell: the smallest travel that can change which
    // cell the pointer is in, and so the smallest that can produce a bend.
    expect(latchBendAxis(null, from, { x: 2.89, y: 2.4 })).toBeNull();
    expect(latchBendAxis(null, from, { x: 2.91, y: 2.4 })).toBe('h');
  });

  it('waits on a perfectly diagonal drag, which has declared nothing', () => {
    expect(latchBendAxis(null, from, { x: 6.4, y: 6.4 })).toBeNull();
    expect(latchBendAxis(null, from, { x: 6.4, y: -1.6 })).toBeNull();
  });

  it('never re-latches: the first answer holds for the rest of the gesture', () => {
    // The pointer swings well past the diagonal the other way; the corner does
    // not jump, which is the whole reason the axis is latched rather than
    // derived from the current endpoints.
    expect(latchBendAxis('h', from, { x: 2.6, y: 9.4 })).toBe('h');
    expect(latchBendAxis('v', from, { x: 9.4, y: 2.6 })).toBe('v');
  });

  it('has nothing to latch before a gesture starts', () => {
    expect(latchBendAxis(null, null, { x: 9.4, y: 2.6 })).toBeNull();
    expect(latchBendAxis(null, from, null)).toBeNull();
  });

  it('takes its threshold in lattice units, so zoom cannot change it', () => {
    // Passing an explicit threshold is what the caller's `latticeThreshold`
    // equivalent would do; the default is a plain lattice distance (RULE-006).
    expect(latchBendAxis(null, from, { x: 2.6, y: 2.45 }, 0.1)).toBe('h');
    expect(latchBendAxis(null, from, { x: 5.4, y: 2.6 }, 10)).toBeNull();
  });
});

describe('targetedBandFor (SPEC-028 §6, WI-052)', () => {
  it('draws the width×width square centred in the tile, for Corridor and Path', () => {
    for (const tool of ['corridor', 'path']) {
      // Width 1 under cell snap fills exactly the pointed-at cell — same
      // footprint as targetedCellFor gave before this tool moved off it.
      expect(targetedBandFor(tool, 'full', 1, { x: 3.9, y: 5.1 })).toEqual({
        kind: 'rect',
        x: 3,
        y: 5,
        size: 1,
      });
      // A sub-step width is centred inside the tile, not flush with an edge.
      expect(targetedBandFor(tool, 'full', 0.5, { x: 3.9, y: 5.1 })).toEqual({
        kind: 'rect',
        x: 3.25,
        y: 5.25,
        size: 0.5,
      });
    }
  });

  it('drops to the half-cell centre under half snap', () => {
    expect(targetedBandFor('corridor', 'half', 0.5, { x: 3.9, y: 5.1 })).toEqual({
      kind: 'rect',
      x: 3.5,
      y: 5,
      size: 0.5,
    });
  });

  it('shows a circle of the chosen width under free snap, centred on the raw point', () => {
    expect(targetedBandFor('corridor', 'free', 2, { x: 3.9, y: 5.1 })).toEqual({
      kind: 'circle',
      at: { x: 3.9, y: 5.1 },
      radius: 1,
    });
  });

  it('shows nothing before the pointer has been anywhere', () => {
    expect(targetedBandFor('corridor', 'full', 1, null)).toBeNull();
  });

  it('stays off for every other tool, Room included', () => {
    // Room's committed shape *is* the whole tile — targetedCellFor already
    // tells the whole truth, so it has no band of its own.
    for (const tool of ['room', 'ngon', 'carve', 'polygon', 'wall', 'door', 'pan']) {
      expect(targetedBandFor(tool, 'full', 1, { x: 3.9, y: 5.1 })).toBeNull();
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

describe('captureMeasureText (Battle map capture, SPEC-029 §1)', () => {
  it('reports whole cells, always — no RoomMeasure conversion', () => {
    // Both corners land mid-cell, so this is unambiguously a 4×3 span of
    // whole cells — a `RoomMeasure` isn't even accepted as a parameter, so
    // the readout can't be swayed by the source map's units the way
    // `strokeMeasureText`'s would be.
    const m = captureMeasureText({ x: 0.5, y: 0.5 }, { x: 3.5, y: 2.5 });
    expect(m?.text).toBe('4 × 3 cells');
    expect(m?.at).toEqual({ x: 2, y: 1.5 });
  });

  it('a click with no drag reports one cell, regardless of sub-cell position', () => {
    expect(captureMeasureText({ x: 2.1, y: 5.7 }, { x: 2.1, y: 5.7 })?.text).toBe('1 × 1 cells');
  });

  it('is silent before a drag starts', () => {
    expect(captureMeasureText(null, { x: 4, y: 3 })).toBeNull();
    expect(captureMeasureText({ x: 0, y: 0 }, null)).toBeNull();
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

  it('a region handle carries the ring index it came from; a wall/door endpoint has none', () => {
    const handles = vertexHandles(regions, walls, doors);
    const corner = handles.find((h) => h.owner.kind === 'region' && h.point.x === 4)!;
    expect(corner.ring).toEqual({ ringIndex: 0, pointIndex: 1 });
    expect(handles.find((h) => h.owner.kind === 'wall')!.ring).toBeNull();
  });

  it('doors are picked ahead of overlapping walls/floor (priority order)', () => {
    // A vertex handle exists at (2,0) for the door endpoint from `door()`.
    const handles = vertexHandles(regions, walls, doors);
    const hit = pickVertexHandle({ x: 2, y: 0.05 }, handles, 0.5);
    expect(hit?.owner).toEqual({ kind: 'door', id: 'd1' });
  });

  it('pickVertexHandle finds nothing outside the threshold', () => {
    const handles = vertexHandles(regions, [], []);
    expect(pickVertexHandle({ x: 2, y: 8 }, handles, 0.5)).toBeNull();
  });

  it('sameHandle matches by owner and position, not object identity', () => {
    // The rendered array is rebuilt every frame, so a held handle is never the
    // same object as the one being drawn.
    const first = vertexHandles(regions, walls, doors);
    const second = vertexHandles(regions, walls, doors);
    expect(first[0]).not.toBe(second[0]);
    expect(sameHandle(first[0]!, second[0]!)).toBe(true);
    // The two endpoints of one wall share an owner and have no ring — only
    // their positions tell them apart.
    const wallHandles = first.filter((h) => h.owner.kind === 'wall');
    expect(sameHandle(wallHandles[0]!, wallHandles[1]!)).toBe(false);
  });

  it('a handle.locate() re-resolves against a cloned working copy, not the original', () => {
    const handles = vertexHandles(regions, [], []);
    const cornerHandle = handles.find((h) => h.point.x === 0 && h.point.y === 0)!;
    const clone = structuredClone(regions[0]!);
    const live = cornerHandle.locate(clone);
    live.x = 99;
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

// SPEC-033 §4 / DEC-059 — a coarse pointer gets a target, not a gesture.
function mapRoom(id: string, anchor: { x: number; y: number }): MapRoom {
  return {
    id,
    key: id,
    name: id,
    bbox: { x: anchor.x, y: anchor.y, w: 1, h: 1 },
    labelAnchor: anchor,
    wallStyle: 'solid',
  };
}

describe('PICK_PX — one pick radius, resolved from the pointer', () => {
  it('is the unchanged 9px on a fine pointer and the touch floor on a coarse one', () => {
    expect(pickPx(false)).toBe(PICK_PX_FINE);
    expect(pickPx(false)).toBe(9);
    expect(pickPx(true)).toBe(PICK_PX_COARSE);
    expect(PICK_PX_COARSE).toBeGreaterThan(PICK_PX_FINE);
  });
});

describe('attractsToVertex (SPEC-028 §12, DEC-061)', () => {
  it('covers the three vertex-placing tools', () => {
    expect(attractsToVertex('wall')).toBe(true);
    expect(attractsToVertex('door')).toBe(true);
    expect(attractsToVertex('polygon')).toBe(true);
  });
  it('excludes every cell-anchored tool — §2 is a standing constraint', () => {
    for (const tool of CELL_ANCHORED_TOOLS) expect(attractsToVertex(tool)).toBe(false);
  });
  it('excludes Select, whose gate is a handle drag rather than the tool', () => {
    expect(attractsToVertex('select')).toBe(false);
  });
});

describe('the note dot', () => {
  it('centres on the midpoint of the label cell top edge, clear of the chip', () => {
    // The renderer centres the label chip on the cell (`labelAnchor + 0.5`);
    // the dot sits half a cell above that, on the cell's own top edge.
    expect(noteDotCenter(mapRoom('r1', { x: 4, y: 7 }))).toEqual({ x: 4.5, y: 7 });
  });

  it('is hit within the threshold and missed outside it', () => {
    const r1 = mapRoom('r1', { x: 4, y: 7 });
    expect(pickNoteDotAt({ x: 4.5, y: 7 }, [r1], 0.5)).toBe(r1);
    expect(pickNoteDotAt({ x: 4.9, y: 7 }, [r1], 0.5)).toBe(r1);
    // The label's own cell centre is half a cell below the dot — far enough
    // out that a tap on the label itself still belongs to the active tool.
    expect(pickNoteDotAt({ x: 4.5, y: 7.5 }, [r1], 0.4)).toBeNull();
  });

  it('only picks rooms that render a dot', () => {
    const r1 = mapRoom('r1', { x: 4, y: 7 });
    // A room absent from the list draws no dot, so its position must not
    // swallow a tap — an invisible target is worse than no target.
    expect(pickNoteDotAt({ x: 4.5, y: 7 }, [], 0.5)).toBeNull();
    expect(pickNoteDotAt({ x: 4.5, y: 7 }, [r1], 0.5)).toBe(r1);
  });

  it('picks the nearest dot when two labels sit close together', () => {
    const near = mapRoom('near', { x: 4, y: 7 });
    const far = mapRoom('far', { x: 5, y: 7 });
    expect(pickNoteDotAt({ x: 4.7, y: 7 }, [far, near], 2)).toBe(near);
  });
});

// ---- SPEC-037 — one Select tool: the lasso, and vertex removal ----

describe('lassoSelect (SPEC-037 §2)', () => {
  const regions = [region('r1', 0)];
  const catalog = {
    symbols: [{ id: 's1', cell: { x: 1, y: 1 }, kind: 'chest', rotation: 0 }],
    mapRooms: [mapRoom('m1', { x: 2, y: 2 })],
    doors: [door('d1')],
    drawings: [{ id: 'dr1', layer: 'mapping', kind: 'freehand', points: [], style: {} }],
  } as unknown as Parameters<typeof lassoSelect>[2];

  it('normalizes its two corners whichever way the drag ran', () => {
    expect(lassoBBox({ x: 4, y: 5 }, { x: 1, y: 2 })).toEqual({
      minX: 1,
      minY: 2,
      maxX: 4,
      maxY: 5,
    });
  });

  it('collects vertex handles and whole objects into one mixed set', () => {
    const caught = lassoSelect(
      { minX: -1, minY: -1, maxX: 5, maxY: 5 },
      vertexHandles(regions, [], catalog.doors),
      catalog,
      64,
    );
    // 4 ring corners + both door endpoints.
    expect(caught.handles).toHaveLength(6);
    expect(caught.objects.map((o) => o.kind)).toEqual(['symbol', 'mapRoom', 'door']);
  });

  it('takes only what lies wholly inside the region', () => {
    // A box around the region's left edge: two corners, and nothing else —
    // the symbol's footprint and the label's cell both start at x ≥ 1.
    const caught = lassoSelect(
      { minX: -1, minY: -1, maxX: 0.5, maxY: 5 },
      vertexHandles(regions, [], catalog.doors),
      catalog,
      64,
    );
    expect(caught.handles).toHaveLength(2);
    expect(caught.objects).toEqual([]);
  });

  it('catches nothing when the sweep is empty — the caller clears on that', () => {
    const caught = lassoSelect(
      { minX: 20, minY: 20, maxX: 25, maxY: 25 },
      vertexHandles(regions, [], catalog.doors),
      catalog,
      64,
    );
    expect(caught.handles).toEqual([]);
    expect(caught.objects).toEqual([]);
  });

  it('objectBounds matches the box pickObject hit-tests', () => {
    expect(objectBounds({ kind: 'symbol', id: 's1' }, catalog, 64)).toEqual({
      a: { x: 1, y: 1 },
      b: { x: 2, y: 2 },
    });
    expect(objectBounds({ kind: 'mapRoom', id: 'm1' }, catalog, 64)).toEqual({
      a: { x: 2, y: 2 },
      b: { x: 3, y: 3 },
    });
    expect(objectBounds({ kind: 'drawing', id: 'missing' }, catalog, 64)).toBeNull();
  });
});

describe('removeRegionVertices (SPEC-037 §4)', () => {
  /** A five-point ring, so one removal still leaves a polygon. */
  function pentagon(): VectorFloorRegion {
    return {
      id: 'r1',
      rings: [
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 6 },
          { x: 0, y: 4 },
        ],
      ],
      bbox: { minX: 0, minY: 0, maxX: 4, maxY: 6 },
    };
  }

  it('re-stitches the ring across the gap and re-derives the bbox', () => {
    const next = removeRegionVertices(pentagon(), [{ ringIndex: 0, pointIndex: 3 }])!;
    expect(next.rings[0]).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]);
    // The apex was the only point at y=6, so the bbox follows the geometry.
    expect(next.bbox).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 4 });
  });

  it('removes several vertices at once without index drift', () => {
    const next = removeRegionVertices(pentagon(), [
      { ringIndex: 0, pointIndex: 0 },
      { ringIndex: 0, pointIndex: 3 },
    ])!;
    expect(next.rings[0]).toEqual([
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('drops the whole region when the outer boundary falls below 3 points', () => {
    const triangle: VectorFloorRegion = {
      id: 'r1',
      rings: [
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
        ],
      ],
      bbox: { minX: 0, minY: 0, maxX: 2, maxY: 2 },
    };
    expect(removeRegionVertices(triangle, [{ ringIndex: 0, pointIndex: 1 }])).toBeNull();
  });

  it('drops only the hole when a hole collapses, restoring the floor beneath it', () => {
    const holed = pentagon();
    holed.rings.push([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ]);
    const next = removeRegionVertices(holed, [{ ringIndex: 1, pointIndex: 0 }])!;
    expect(next.rings).toHaveLength(1);
    expect(next.rings[0]).toHaveLength(5);
  });

  it('rebuilds points as plain objects rather than carrying the originals over', () => {
    const before = pentagon();
    const next = removeRegionVertices(before, [{ ringIndex: 0, pointIndex: 3 }])!;
    expect(next.rings[0]![0]).not.toBe(before.rings[0]![0]);
    expect(before.rings[0]).toHaveLength(5); // input untouched
  });
});

describe('buildHandleRemovalOp (SPEC-037 §§3–4)', () => {
  const regions = [region('r1', 0)];
  const walls = [wall('w1')];
  const doors = [door('d1')];
  const handles = vertexHandles(regions, walls, doors);
  const records = new Map<string, OwnerRecord>([
    [ownerKey({ kind: 'region', id: 'r1' }), regions[0]!],
    [ownerKey({ kind: 'wall', id: 'w1' }), walls[0]!],
    [ownerKey({ kind: 'door', id: 'd1' }), doors[0]!],
  ]);
  const handleFor = (kind: 'region' | 'wall' | 'door'): Handle =>
    handles.find((h) => h.owner.kind === kind)!;

  it('is null when nothing removable was selected', () => {
    expect(buildHandleRemovalOp([], records)).toBeNull();
  });

  it('a lone floor vertex is a plain floorRegionBatch, not a composite', () => {
    const op = buildHandleRemovalOp([handleFor('region')], records)!;
    expect(op.kind).toBe('floorRegionBatch');
    if (op.kind !== 'floorRegionBatch') throw new Error('unreachable');
    // 4-point ring minus one leaves 3 — still a polygon, so the region lives.
    expect(op.changes[0]!.to!.rings[0]).toHaveLength(3);
  });

  it('a wall or door endpoint takes its whole segment — an endpoint is not a loop', () => {
    const op = buildHandleRemovalOp([handleFor('wall')], records)!;
    expect(op).toEqual({ kind: 'wallsBatch', changes: [{ id: 'w1', from: walls[0], to: null }] });
    expect(buildHandleRemovalOp([handleFor('door')], records)).toEqual({
      kind: 'door',
      id: 'd1',
      from: doors[0],
      to: null,
    });
  });

  it('both endpoints of one wall produce one delete, not two', () => {
    const both = handles.filter((h) => h.owner.kind === 'wall');
    const op = buildHandleRemovalOp(both, records)!;
    if (op.kind !== 'wallsBatch') throw new Error('unreachable');
    expect(op.changes).toHaveLength(1);
  });

  it('a mixed selection becomes one batch, so one Backspace is one undo', () => {
    const op = buildHandleRemovalOp(
      [handleFor('region'), handleFor('wall'), handleFor('door')],
      records,
    )!;
    if (op.kind !== 'batch') throw new Error('unreachable');
    expect(op.ops.map((o) => o.kind)).toEqual(['floorRegionBatch', 'wallsBatch', 'door']);
    // Undoing it unwinds in the opposite order, each member inverted.
    const inverse = invertVectorOp(op);
    if (inverse.kind !== 'batch') throw new Error('unreachable');
    expect(inverse.ops.map((o) => o.kind)).toEqual(['door', 'wallsBatch', 'floorRegionBatch']);
    expect(inverse.ops[0]).toEqual({ kind: 'door', id: 'd1', from: null, to: doors[0] });
  });

  it('a batch is a no-op only when every member is', () => {
    expect(isNoopVectorOp({ kind: 'batch', ops: [] })).toBe(true);
    expect(
      isNoopVectorOp({ kind: 'batch', ops: [{ kind: 'wallsBatch', changes: [] }] }),
    ).toBe(true);
    expect(
      isNoopVectorOp({
        kind: 'batch',
        ops: [{ kind: 'door', id: 'd1', from: doors[0]!, to: null }],
      }),
    ).toBe(false);
  });

  it('commits a batch member by member, in order', async () => {
    const calls: string[] = [];
    const store = {
      commitFloorRegions: vi.fn(async () => void calls.push('floor')),
      removeWalls: vi.fn(async () => void calls.push('walls')),
      removeDoor: vi.fn(async () => void calls.push('door')),
    } as unknown as CampaignStore;
    const op = buildHandleRemovalOp(
      [handleFor('region'), handleFor('wall'), handleFor('door')],
      records,
    )!;
    await commitVectorOpForward(store, 'room1', 'map1', op);
    expect(calls).toEqual(['floor', 'walls', 'door']);
  });
});
