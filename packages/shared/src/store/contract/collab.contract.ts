import { beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { AssetRef, HandoutRecord, Room } from '../../types.js';
import type { CampaignStore } from '../campaign-store.js';
import { waitFor, createTestRoom, type ContractContext } from './helpers.js';

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
        (cb) => clientA.subscribeRoom(roomId, cb),
        (room) => room?.handout?.ref === 'maps/vault.svg',
      );
      expect(revealedRoom?.handout?.title).toBe('The Vault Door');
      await waitFor<HandoutRecord[]>(
        (cb) => clientA.subscribeHandoutLibrary(roomId, cb),
        (items) => items.find((h) => h.id === handoutId)?.revealed === true,
      );

      await clientA.hideHandout(roomId);
      await waitFor<Room | null>(
        (cb) => clientA.subscribeRoom(roomId, cb),
        (room) => room?.handout === null,
      );
    });
  });

  describe('Yjs transport (concurrent Notes)', () => {
    it('merges concurrent updates from independent clients with no stomp', async () => {
      const roomId = await createTestRoom(clientA);
      const base = new Y.Doc();
      base.getText('notes').insert(0, 'Room 3: ');
      await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(base));

      const baseState = await waitFor<Uint8Array | null>(
        (cb) => clientB.subscribeYState(roomId, 'notes', cb),
        (state) => state !== null,
      );
      const docA = new Y.Doc();
      Y.applyUpdate(docA, baseState!);
      docA.getText('notes').insert(8, 'trapped');

      const docB = new Y.Doc();
      Y.applyUpdate(docB, baseState!);
      docB.getText('notes').insert(8, 'empty, ');

      await clientA.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docA));
      await clientB.mergeYUpdate(roomId, 'notes', Y.encodeStateAsUpdate(docB));

      const converged = await waitFor<Uint8Array | null>(
        (cb) => clientA.subscribeYState(roomId, 'notes', cb),
        (state) => {
          if (!state) return false;
          const doc = new Y.Doc();
          Y.applyUpdate(doc, state);
          const text = doc.getText('notes').toString();
          return text.includes('trapped') && text.includes('empty');
        },
      );
      const doc = new Y.Doc();
      Y.applyUpdate(doc, converged!);
      // Two concurrent inserts at the same position resolve by clientID,
      // not content, so which one lands first isn't fixed (see the same
      // caveat in yjs-merge.test.ts) — assert no data loss, not an exact
      // concatenation order.
      const text = doc.getText('notes').toString();
      expect(text).toContain('Room 3: ');
      expect(text).toContain('trapped');
      expect(text).toContain('empty, ');
    });
  });
}
