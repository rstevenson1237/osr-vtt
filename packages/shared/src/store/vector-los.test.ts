import { describe, expect, it } from 'vitest';
import {
  commitCarve,
  polygonClippingBackend as B,
  rectPoly,
  toFloorRegions,
} from '../map/vector/index.js';
import type { Point, Segment } from '../map/vector/index.js';
import { MemoryBackend, MemoryStore } from './memory-store.js';
import { buildVectorScene, subscribeVectorScene } from './vector-los.js';
import type { StoredVectorWall, VectorDoor, VectorFloorRegion } from './campaign-store.js';

const rect = (ax: number, ay: number, bx: number, by: number) =>
  rectPoly({ x: ax, y: ay }, { x: bx, y: by })!;

// Proper segment crossing (mirrors map/vector/los.test.ts's raycast semantics).
const orient = (a: Point, b: Point, c: Point) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const crosses = (p1: Point, p2: Point, p3: Point, p4: Point) =>
  orient(p3, p4, p1) * orient(p3, p4, p2) < 0 && orient(p1, p2, p3) * orient(p1, p2, p4) < 0;
const blocked = (eye: Point, target: Point, segs: Segment[]) =>
  segs.some((s) => crosses(eye, target, s.a, s.b));

function squareRegion(): VectorFloorRegion[] {
  const floor = commitCarve([], [rect(0, 0, 10, 6)], 'add', 0, B).floor;
  return toFloorRegions(floor, (i) => `r${i}`);
}

describe('buildVectorScene (SPEC §3.3 — store-shaped combinator)', () => {
  it('unions FloorRegion docs and derives perimeter-only sight/movement segments', () => {
    const scene = buildVectorScene(squareRegion(), [], []);
    expect(scene.floor).toHaveLength(1);
    expect(scene.sight).toHaveLength(4);
    expect(scene.movement).toHaveLength(4);
  });

  it('decouples sight from movement per explicit wall flags (SPEC §3.1)', () => {
    const sightOnly: StoredVectorWall = {
      id: 'w1',
      a: { x: 2, y: 0 },
      b: { x: 2, y: 6 },
      source: 'explicit',
      blocksSight: true,
      blocksMovement: false,
    };
    const scene = buildVectorScene(squareRegion(), [sightOnly], []);
    expect(scene.sight).toHaveLength(5); // 4 perimeter + the sight-blocking divider
    expect(scene.movement).toHaveLength(4); // divider doesn't block movement
  });

  it('reconciles a door at build time: closed blocks, open clips a gap (SPEC §3.3)', () => {
    const eye = { x: 5, y: 3 };
    const overDoorway = { x: 5, y: 9 }; // straight through the south wall's door span
    const closed: VectorDoor = {
      id: 'd1',
      a: { x: 4, y: 6 },
      b: { x: 6, y: 6 },
      type: 'single',
      state: 'closed',
    };
    const regions = squareRegion();
    expect(blocked(eye, overDoorway, buildVectorScene(regions, [], [closed]).sight)).toBe(true);
    const open: VectorDoor = { ...closed, state: 'open' };
    expect(blocked(eye, overDoorway, buildVectorScene(regions, [], [open]).sight)).toBe(false);
  });
});

describe('subscribeVectorScene (WI-C store wiring)', () => {
  it('recomputes the scene as floor regions, walls, and doors each change', async () => {
    const store = new MemoryStore(new MemoryBackend());
    const roomId = await store.createRoom({ name: 'WI-C Room', profileTemplate: [] });
    const room = await store.getRoom(roomId);
    const mapId = room?.activeMapId;
    if (!mapId) throw new Error('room has no active map');

    const seen: import('./vector-los.js').VectorScene[] = [];
    const unsubscribe = subscribeVectorScene(store, roomId, mapId, (scene) => {
      seen.push(scene);
    });

    // Initial (empty) snapshot from all three collections settling.
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.at(-1)?.sight).toHaveLength(0);

    // Commit a floor region — perimeter segments appear.
    const [region] = squareRegion();
    await store.commitFloorRegions(roomId, mapId, { put: [region!], delete: [] });
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.at(-1)?.sight).toHaveLength(4);

    // Add an explicit movement-only wall.
    await store.setWall(roomId, mapId, {
      a: { x: 5, y: 0 },
      b: { x: 5, y: 6 },
      source: 'explicit',
      blocksSight: false,
      blocksMovement: true,
    });
    await new Promise((r) => setTimeout(r, 0));
    const afterWall = seen.at(-1)!;
    expect(afterWall.sight).toHaveLength(4); // unaffected — wall doesn't block sight
    expect(afterWall.movement).toHaveLength(5);

    // Add then remove a door — the callback tracks the live door set too.
    const doorId = await store.setDoor(roomId, mapId, {
      a: { x: 4, y: 6 },
      b: { x: 6, y: 6 },
      type: 'single',
      state: 'closed',
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.at(-1)?.sight.length).toBeGreaterThan(afterWall.sight.length); // door adds a blocker segment

    await store.removeDoor(roomId, mapId, doorId);
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.at(-1)?.sight).toHaveLength(4);

    unsubscribe();
  });
});
