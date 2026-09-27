import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MemoryBackend,
  MemoryStore,
  UvttParseError,
  type GameMap,
  type StoredVectorWall,
  type vectorMap,
} from '@osr-vtt/shared';
import { importUvttMap, UVTT_WALL_BATCH, uvttMapName } from './import-uvtt';

/** SPEC-056 §8: the import writes a new square map through existing store
 * methods, and a bad file writes nothing. */

const SAMPLE = readFileSync(
  fileURLToPath(new URL('../../../public/assets/maps/sample-dungeon.dd2vtt', import.meta.url)),
  'utf8',
);

async function setup() {
  const store = new MemoryStore(new MemoryBackend());
  const roomId = await store.createRoom({ name: 'R', profileTemplate: [] });
  return { store, roomId };
}

/** The first value a subscription delivers. */
function current<T>(sub: (cb: (v: T) => void) => () => void): Promise<T> {
  return new Promise((resolve) => {
    let unsub: (() => void) | null = null;
    let done = false;
    unsub = sub((v) => {
      if (done) return;
      done = true;
      resolve(v);
      queueMicrotask(() => unsub?.());
    });
    if (done) unsub();
  });
}

describe('importUvttMap', () => {
  it('makes a new square map of the sample file’s walls and door', async () => {
    const { store, roomId } = await setup();
    const before = await current<GameMap[]>((cb) => store.subscribeMaps(roomId, cb));
    const activeBefore = (await store.getRoom(roomId))!.activeMapId;

    const mapId = await importUvttMap(store, roomId, 'Sample', SAMPLE);

    const maps = await current<GameMap[]>((cb) => store.subscribeMaps(roomId, cb));
    expect(maps).toHaveLength(before.length + 1);
    const map = maps.find((m) => m.id === mapId)!;
    expect(map.name).toBe('Sample');
    expect(map.hex).toBeUndefined();
    expect(map.grid).toEqual({ w: 10, h: 10, cellSize: 70 });
    // Nothing existing is touched — the active map stays where it was.
    expect((await store.getRoom(roomId))!.activeMapId).toBe(activeBefore);

    const walls = await current<StoredVectorWall[]>((cb) => store.subscribeWalls(roomId, mapId, cb));
    expect(walls.map(({ id: _id, ...w }) => w)).toEqual([
      {
        a: { x: 5, y: 0 },
        b: { x: 5, y: 7 },
        source: 'imported',
        blocksSight: true,
        blocksMovement: true,
      },
    ]);
    const doors = await current<vectorMap.Door[]>((cb) => store.subscribeDoors(roomId, mapId, cb));
    expect(doors.map(({ id: _id, ...d }) => d)).toEqual([
      { a: { x: 5, y: 7 }, b: { x: 5, y: 8 }, type: 'single', state: 'closed' },
    ]);
  });

  it('splits a large wall set into batches the store can commit', async () => {
    const { store, roomId } = await setup();
    const count = UVTT_WALL_BATCH * 2 + 3;
    const line = Array.from({ length: count + 1 }, (_, i) => ({ x: i, y: 0 }));
    const calls: number[] = [];
    const setWalls = store.setWalls.bind(store);
    store.setWalls = async (r, m, w) => {
      calls.push(w.length);
      await setWalls(r, m, w);
    };
    const text = JSON.stringify({
      resolution: { map_size: { x: count, y: 1 } },
      line_of_sight: [line],
    });
    const mapId = await importUvttMap(store, roomId, 'Big', text);
    expect(calls).toEqual([UVTT_WALL_BATCH, UVTT_WALL_BATCH, 3]);
    const walls = await current<StoredVectorWall[]>((cb) => store.subscribeWalls(roomId, mapId, cb));
    expect(new Set(walls.map((w) => w.id)).size).toBe(count);
  });

  it('writes nothing when the file does not parse', async () => {
    const { store, roomId } = await setup();
    const before = (await current<GameMap[]>((cb) => store.subscribeMaps(roomId, cb))).length;
    await expect(importUvttMap(store, roomId, 'Bad', '{"resolution": {}}')).rejects.toThrow(
      UvttParseError,
    );
    expect(await current<GameMap[]>((cb) => store.subscribeMaps(roomId, cb))).toHaveLength(before);
  });
});

describe('uvttMapName', () => {
  it('drops the extension and never comes back empty', () => {
    expect(uvttMapName('Crypt of Bones.dd2vtt')).toBe('Crypt of Bones');
    expect(uvttMapName('cave.UVTT')).toBe('cave');
    expect(uvttMapName('.uvtt')).toBe('Imported map');
  });
});
