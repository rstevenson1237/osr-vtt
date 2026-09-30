import { describe, expect, it } from 'vitest';
import {
  buildVectorScene,
  vectorMap,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import { createDragSight, type DragSightBase } from './drag-sight';
import type { HandleOwner, OwnerRecord } from './vector-tools';

/** WI-193 / SPEC-057 §4.2: a vertex drag's floor preview, reconciled
 * incrementally, draws the same walls a full `buildVectorScene` of the
 * displayed geometry would — without the per-move rebuild. */

function rect(id: string, x: number, y: number, w: number, h: number): VectorFloorRegion {
  return {
    id,
    rings: [
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
    ],
    bbox: { minX: x, minY: y, maxX: x + w, maxY: y + h },
  };
}

const base: DragSightBase = {
  regions: [rect('r1', 0, 0, 10, 6), rect('r2', 10, 2, 6, 2), rect('r3', 0, 10, 4, 4)],
  walls: [
    {
      id: 'w1',
      a: { x: 5, y: 0 },
      b: { x: 5, y: 6 },
      source: 'explicit',
      blocksSight: true,
      blocksMovement: true,
    },
    {
      id: 'w2',
      a: { x: 1, y: 11 },
      b: { x: 3, y: 11 },
      source: 'explicit',
      blocksSight: false,
      blocksMovement: true,
    },
  ],
  doors: [
    // On r1's top edge, open: a gap in it.
    { id: 'd1', a: { x: 2, y: 0 }, b: { x: 4, y: 0 }, type: 'single', state: 'open' },
    // On r1's right edge where r2 joins, closed: its own blocker.
    { id: 'd2', a: { x: 10, y: 2 }, b: { x: 10, y: 4 }, type: 'double', state: 'closed' },
    // Across the partition wall, open.
    { id: 'd3', a: { x: 5, y: 2 }, b: { x: 5, y: 4 }, type: 'single', state: 'open' },
  ],
};

/** Order-free, float-tolerant view of a segment list. */
function segKey(segs: readonly vectorMap.Segment[]): string[] {
  const r = (n: number) => (Math.round(n * 1e9) / 1e9).toString();
  return segs
    .map((s) => {
      const [p, q] = [s.a, s.b].sort((u, v) => u.x - v.x || u.y - v.y);
      return `${r(p!.x)},${r(p!.y)}-${r(q!.x)},${r(q!.y)}:${s.blocksSight}`;
    })
    .sort();
}

/** What `displayState()` shows mid-drag: the owner swapped for its working copy. */
function displayed(owner: HandleOwner, working: OwnerRecord): DragSightBase {
  const swap = <T extends { id: string }>(list: readonly T[], kind: HandleOwner['kind']) =>
    list.map((x) => (owner.kind === kind && x.id === owner.id ? (working as unknown as T) : x));
  return {
    regions: swap(base.regions, 'region'),
    walls: swap(base.walls, 'wall'),
    doors: swap(base.doors, 'door'),
  };
}

function expectSameAsFullBuild(owner: HandleOwner, working: OwnerRecord): void {
  const live = createDragSight(base, owner)(working);
  const d = displayed(owner, working);
  const full = buildVectorScene(d.regions, d.walls, d.doors);
  expect(segKey(live.sight)).toEqual(segKey(full.sight));
  expect(live.floor).toEqual(full.floor);
}

describe('createDragSight', () => {
  it('a region vertex dragged: same walls and fills as a full rebuild', () => {
    const r1 = structuredClone(base.regions[0]!);
    r1.rings[0]![0] = { x: -1.5, y: -0.5 };
    expectSameAsFullBuild({ kind: 'region', id: 'r1' }, r1);
  });

  it('a region dragged away from the door that clipped it gets its edge back', () => {
    const r1 = structuredClone(base.regions[0]!);
    r1.rings[0]![1] = { x: 10, y: -3 };
    r1.rings[0]![0] = { x: 0, y: -3 };
    expectSameAsFullBuild({ kind: 'region', id: 'r1' }, r1);
  });

  it('a sight-blocking wall endpoint dragged', () => {
    const w1 = structuredClone(base.walls[0]!) as StoredVectorWall;
    w1.b = { x: 7, y: 6 };
    expectSameAsFullBuild({ kind: 'wall', id: 'w1' }, w1);
  });

  it('a movement-only wall dragged adds no sight segment', () => {
    const w2 = structuredClone(base.walls[1]!) as StoredVectorWall;
    w2.a = { x: 0, y: 12 };
    expectSameAsFullBuild({ kind: 'wall', id: 'w2' }, w2);
  });

  it('an open door dragged along its wall moves the gap', () => {
    const d1 = structuredClone(base.doors[0]!) as VectorDoor;
    d1.a = { x: 6, y: 0 };
    d1.b = { x: 8, y: 0 };
    expectSameAsFullBuild({ kind: 'door', id: 'd1' }, d1);
  });

  it('a closed door dragged moves its blocker', () => {
    const d2 = structuredClone(base.doors[1]!) as VectorDoor;
    d2.b = { x: 10, y: 5 };
    expectSameAsFullBuild({ kind: 'door', id: 'd2' }, d2);
  });

  it('reads the working copy afresh on every call (a drag mutates it in place)', () => {
    const working = structuredClone(base.regions[0]!);
    const owner: HandleOwner = { kind: 'region', id: 'r1' };
    const live = createDragSight(base, owner);
    for (const x of [-1, -2, -3]) {
      working.rings[0]![0] = { x, y: 0 };
      const d = displayed(owner, working);
      const full = buildVectorScene(d.regions, d.walls, d.doors);
      expect(segKey(live(working).sight)).toEqual(segKey(full.sight));
    }
  });

  it('an owner deleted mid-drag previews the committed scene without it', () => {
    const ghost = rect('gone', 20, 20, 2, 2);
    const live = createDragSight(base, { kind: 'region', id: 'gone' })(ghost);
    const full = buildVectorScene(base.regions, base.walls, base.doors);
    expect(segKey(live.sight)).toEqual(segKey(full.sight));
    expect(live.floor).toEqual(full.floor);
  });
});
