import { describe, expect, it } from 'vitest';
import { BundledAssetStore, MemoryStore, roomImageRef, type AssetStore } from '@osr-vtt/shared';
import { PENDING_IMAGE_URL, RoomImageAssets } from './room-images.svelte';
import { fitWithin } from './image-resize';

const BYTES = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

/** One microtask-delivered snapshot later — `MemoryStore` emits the way
 * `onSnapshot` does, off the synchronous call stack. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('RoomImageAssets (SPEC-057 §6)', () => {
  it('resolves an img: ref to its image once it arrives, and every other ref as before', async () => {
    const store = new MemoryStore();
    await store.ensureAuth();
    const roomId = await store.createRoom({ name: 'Keep', profileTemplate: [] });
    const base = new BundledAssetStore('/assets/');
    const assets = new RoomImageAssets(base, store, roomId);

    const id = await store.putImage(roomId, { bytes: BYTES, mime: 'image/webp', w: 1, h: 1 });
    await settle();
    expect(assets.resolve(roomImageRef(id))).toBe(`data:image/webp;base64,${BYTES}`);
    expect(assets.resolve('tokens/goblin.svg')).toBe('/assets/tokens/goblin.svg');
    expect(assets.images.map((i) => i.id)).toEqual([id]);

    // A deleted image leaves its refs resolving to the transparent placeholder.
    await store.deleteImage(roomId, id);
    await settle();
    expect(assets.resolve(roomImageRef(id))).toBe(PENDING_IMAGE_URL);
    assets.dispose();
  });

  it('passes the Storage upload members through only when the base store has them', async () => {
    const store = new MemoryStore();
    await store.ensureAuth();
    const roomId = await store.createRoom({ name: 'Keep', profileTemplate: [] });
    const bundled = new RoomImageAssets(new BundledAssetStore(), store, roomId);
    expect(bundled.upload).toBeUndefined();
    expect(bundled.listRoomUploads).toBeUndefined();

    const withUploads: AssetStore = {
      resolve: (ref) => ref,
      upload: async () => 'rooms/r/uploads/u/o.png',
    };
    const wrapped = new RoomImageAssets(withUploads, store, roomId);
    expect(await wrapped.upload!(new File([], 'x.png'), { roomId, uid: 'u' })).toBe(
      'rooms/r/uploads/u/o.png',
    );
    bundled.dispose();
    wrapped.dispose();
  });
});

describe('fitWithin — the client-side resize target', () => {
  it('scales the longer side down to 256, keeping the aspect ratio', () => {
    expect(fitWithin(1024, 512)).toEqual({ w: 256, h: 128 });
    expect(fitWithin(300, 900)).toEqual({ w: 85, h: 256 });
  });

  it('never enlarges a small image, and never rounds a side to zero', () => {
    expect(fitWithin(64, 48)).toEqual({ w: 64, h: 48 });
    expect(fitWithin(5000, 1)).toEqual({ w: 256, h: 1 });
  });
});
