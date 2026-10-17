import { beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { AssetRef, HandoutRecord, Room, RoomImage } from '../../types.js';
import {
  MAX_ROOM_IMAGE_BASE64_CHARS,
  MAX_ROOM_IMAGE_DIMENSION,
  parseRoomImageRef,
  roomImageRef,
} from '../room-images.js';
import type { CampaignStore } from '../campaign-store.js';
import {
  waitFor,
  createTestRoom,
  TINY_WEBP_BASE64,
  type ContractContext,
  subscribeCurrentRoom,
} from './helpers.js';

/** `CollabStore` domain: saved asset refs, handouts and the Yjs transport. (SPEC-057 §5, DEC-117). */
export function defineCollabContract(ctx: ContractContext): void {
  let clientA: CampaignStore;
  let clientB: CampaignStore;

  beforeAll(() => {
    clientA = ctx.clientA();
    clientB = ctx.clientB();
  });

  describe('Assets activity — saved URL refs (Master Plan v2, R7.2)', () => {
    it('saves and deletes an asset ref, and a second client sees it too (reusable across clients)', async () => {
      const roomId = await createTestRoom(clientA);
      await clientB.joinRoom(roomId, 'Bram');
      const refId = await clientA.saveAssetRef(roomId, {
        ref: 'https://example.com/goblin.png',
        label: 'Goblin art',
        addedBy: clientA.currentUid()!,
        ts: Date.now(),
      });

      const seenByB = await waitFor<AssetRef[]>(
        (cb) => clientB.subscribeAssetRefs(roomId, cb),
        (items) => items.length === 1,
      );
      expect(seenByB[0]?.ref).toBe('https://example.com/goblin.png');
      expect(seenByB[0]?.label).toBe('Goblin art');

      await clientA.deleteAssetRef(roomId, refId);
      await waitFor<AssetRef[]>(
        (cb) => clientA.subscribeAssetRefs(roomId, cb),
        (items) => items.length === 0,
      );
    });
  });

  describe('portrait images in Firestore (SPEC-057 §6, DEC-119)', () => {
    it('a member puts an image, every client sees it stamped with its writer, and an img: ref names it', async () => {
      const roomId = await createTestRoom(clientA);
      await clientB.joinRoom(roomId, 'Bram');
      const imageId = await clientB.putImage(roomId, {
        bytes: TINY_WEBP_BASE64,
        mime: 'image/webp',
        w: 1,
        h: 1,
      });
      expect(parseRoomImageRef(roomImageRef(imageId))).toBe(imageId);

      const seenByA = await waitFor<RoomImage[]>(
        (cb) => clientA.subscribeImages(roomId, cb),
        (items) => items.some((i) => i.id === imageId),
      );
      expect(seenByA.find((i) => i.id === imageId)).toEqual({
        id: imageId,
        bytes: TINY_WEBP_BASE64,
        mime: 'image/webp',
        w: 1,
        h: 1,
        by: clientB.currentUid(),
      });

      // The creator removes it; a ref still naming it simply resolves to nothing.
      await clientB.deleteImage(roomId, imageId);
      await waitFor<RoomImage[]>(
        (cb) => clientA.subscribeImages(roomId, cb),
        (items) => items.length === 0,
      );
    });

    it('the referee may remove an image another member stored', async () => {
      const roomId = await createTestRoom(clientA);
      await clientB.joinRoom(roomId, 'Bram');
      const imageId = await clientB.putImage(roomId, {
        bytes: TINY_WEBP_BASE64,
        mime: 'image/webp',
        w: 1,
        h: 1,
      });
      await waitFor<RoomImage[]>(
        (cb) => clientA.subscribeImages(roomId, cb),
        (items) => items.length === 1,
      );
      await clientA.deleteImage(roomId, imageId);
      await waitFor<RoomImage[]>(
        (cb) => clientB.subscribeImages(roomId, cb),
        (items) => items.length === 0,
      );
    });

    it('refuses an image outside the per-write bounds, in every store', async () => {
      const roomId = await createTestRoom(clientA);
      const ok = { bytes: TINY_WEBP_BASE64, mime: 'image/webp' as const, w: 1, h: 1 };
      await expect(
        clientA.putImage(roomId, { ...ok, w: MAX_ROOM_IMAGE_DIMENSION + 1 }),
      ).rejects.toThrow();
      await expect(
        clientA.putImage(roomId, { ...ok, bytes: 'A'.repeat(MAX_ROOM_IMAGE_BASE64_CHARS + 1) }),
      ).rejects.toThrow();
      await expect(
        clientA.putImage(roomId, { ...ok, mime: 'image/png' as unknown as 'image/webp' }),
      ).rejects.toThrow();
      await expect(clientA.putImage(roomId, { ...ok, h: 1.5 })).rejects.toThrow();
      const images = await waitFor<RoomImage[]>(
        (cb) => clientA.subscribeImages(roomId, cb),
        () => true,
      );
      expect(images).toEqual([]);
    });

    it('round-trips through exportRoom/importRoom with the ids an img: ref names', async () => {
      const roomId = await createTestRoom(clientA);
      const imageId = await clientA.putImage(roomId, {
        bytes: TINY_WEBP_BASE64,
        mime: 'image/webp',
        w: 1,
        h: 1,
      });
      const snapshot = await clientA.exportRoom(roomId);
      expect(snapshot.collections['images']).toEqual([
        {
          id: imageId,
          bytes: TINY_WEBP_BASE64,
          mime: 'image/webp',
          w: 1,
          h: 1,
          by: clientA.currentUid(),
        },
      ]);
      const importedId = await clientA.importRoom(snapshot);
      const imported = await waitFor<RoomImage[]>(
        (cb) => clientA.subscribeImages(importedId, cb),
        (items) => items.length === 1,
      );
      expect(imported[0]?.id).toBe(imageId);
      expect(imported[0]?.bytes).toBe(TINY_WEBP_BASE64);
    });
  });

  describe('handouts', () => {
    it('saves unrevealed, reveals onto the room pointer, then hides again', async () => {
      const roomId = await createTestRoom(clientA);
      const handoutId = await clientA.saveHandout(roomId, {
        ts: Date.now(),
        title: 'The Vault Door',
        ref: 'maps/vault.svg',
      });

      const library = await waitFor<HandoutRecord[]>(
        (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
        (items) => items.length === 1,
      );
      expect(library[0]?.revealed).toBe(false);
      expect(library[0]?.kind).toBe('handout');

      const handout = library[0] as HandoutRecord & { id: string };
      await clientA.revealHandout(roomId, { ...handout, id: handoutId });

      const revealedRoom = await waitFor<Room | null>(
        (cb) => subscribeCurrentRoom(clientA, roomId, cb),
        (room) => room?.handout?.ref === 'maps/vault.svg',
      );
      expect(revealedRoom?.handout?.title).toBe('The Vault Door');
      await waitFor<HandoutRecord[]>(
        (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
        (items) => items.find((h) => h.id === handoutId)?.revealed === true,
      );

      await clientA.hideHandout(roomId);
      await waitFor<Room | null>(
        (cb) => subscribeCurrentRoom(clientA, roomId, cb),
        (room) => room?.handout === null,
      );
    });
  });

  describe('Yjs transport (concurrent Notes)', () => {
    /** Subscribes and applies every callback to one `Y.Doc` — the
     * `subscribeYState` guarantee (SPEC-065 §4): a callback is an update, not
     * necessarily the whole state — until the doc's text satisfies `done`. */
    function waitForYDoc(
      store: CampaignStore,
      roomId: string,
      done: (text: string) => boolean,
    ): Promise<Y.Doc> {
      const doc = new Y.Doc();
      return waitFor<Uint8Array | null>(
        (cb) => store.subscribeYState(roomId, 'notes', cb),
        (update) => {
          if (update) Y.applyUpdate(doc, update);
          return done(doc.getText('notes').toString());
        },
      ).then(() => doc);
    }

    it('merges concurrent updates from independent clients with no stomp', async () => {
      const roomId = await createTestRoom(clientA);
      const base = new Y.Doc();
      base.getText('notes').insert(0, 'Room 3: ');
      await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(base));

      const seenByB = await waitForYDoc(clientB, roomId, (text) => text === 'Room 3: ');
      const baseState = Y.encodeStateAsUpdate(seenByB);
      const docA = new Y.Doc();
      Y.applyUpdate(docA, baseState);
      docA.getText('notes').insert(8, 'trapped');

      const docB = new Y.Doc();
      Y.applyUpdate(docB, baseState);
      docB.getText('notes').insert(8, 'empty, ');

      await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docA));
      await clientB.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docB));

      const converged = await waitForYDoc(
        clientA,
        roomId,
        (text) => text.includes('trapped') && text.includes('empty'),
      );
      // Two concurrent inserts at the same position resolve by clientID,
      // not content, so which one lands first isn't fixed (see the same
      // caveat in yjs-merge.test.ts) — assert no data loss, not an exact
      // concatenation order.
      const text = converged.getText('notes').toString();
      expect(text).toContain('Room 3: ');
      expect(text).toContain('trapped');
      expect(text).toContain('empty, ');

      // The one-shot read (`exportRoom`'s source) is the same merged state.
      const stored = new Y.Doc();
      Y.applyUpdate(stored, (await clientA.getYState(roomId, 'notes'))!);
      expect(stored.getText('notes').toString()).toBe(text);
    });

    it('round-trips both Yjs docs (notes and room-notes) through exportRoom/importRoom', async () => {
      const roomId = await createTestRoom(clientA);
      const texts: Record<string, string> = { notes: 'Party notes', 'room-notes': 'Two braziers' };
      for (const [name, text] of Object.entries(texts)) {
        const doc = new Y.Doc();
        doc.getText(name).insert(0, text);
        await clientA.mergeYUpdate(roomId, name, Y.encodeStateAsUpdate(doc));
      }

      const snapshot = await clientA.exportRoom(roomId);
      expect(Object.keys(snapshot.yjs).sort()).toEqual(['notes', 'room-notes']);

      const imported = await clientA.importRoom(snapshot);
      for (const [name, text] of Object.entries(texts)) {
        const state = await clientA.getYState(imported, name);
        const doc = new Y.Doc();
        Y.applyUpdate(doc, state!);
        expect(doc.getText(name).toString()).toBe(text);
      }
    });
  });
}
