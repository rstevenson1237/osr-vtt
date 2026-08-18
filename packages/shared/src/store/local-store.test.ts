import { describe, expect, it } from 'vitest';
import { VTTCAMP_FORMAT, VttCampFormatError, readManifest } from '../portability/vttcamp.js';
import type { ProfileTemplateField } from '../types.js';
import { LocalStore, MemoryCampaignFile } from './local-store.js';

/**
 * The half of local mode the contract suite cannot see (SPEC-041 §2): that the
 * `.vttcamp` really is the database. `local-store.contract.test.ts` proves
 * `LocalStore` is a `CampaignStore`; this proves that closing it and opening it
 * again gets the campaign back.
 */

const TEMPLATE: ProfileTemplateField[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'hp', label: 'HP', type: 'counter' },
];

/** `dispose()` after every store so no debounce timer outlives its test. */
async function withStore<T>(store: LocalStore, fn: (store: LocalStore) => Promise<T>): Promise<T> {
  try {
    return await fn(store);
  } finally {
    store.dispose();
  }
}

describe('LocalStore', () => {
  it('writes a new campaign to the file the moment it is created', async () => {
    const file = new MemoryCampaignFile();
    await withStore(new LocalStore(file), async (store) => {
      const roomId = await store.createCampaign({
        name: 'The Sunless Vault',
        profileTemplate: TEMPLATE,
      });
      expect(store.campaignRoomId).toBe(roomId);
      expect(file.writes).toBe(1);

      const bytes = await file.read();
      expect(bytes).not.toBeNull();
      const manifest = readManifest(bytes!);
      expect(manifest.format).toBe(VTTCAMP_FORMAT);
      expect(manifest.roomName).toBe('The Sunless Vault');
    });
  });

  it('round-trips a campaign through the file — close it, open it, it is all there', async () => {
    const file = new MemoryCampaignFile();
    const tokenId = await withStore(new LocalStore(file, undefined, 0), async (store) => {
      const roomId = await store.createCampaign({ name: 'Keep', profileTemplate: TEMPLATE });
      await store.renameRoom(roomId, 'The Moathouse');
      const id = await store.createToken(roomId, {
        imageRef: 'tokens/goblin.svg',
        pos: { x: 3, y: 4 },
        size: 1,
        layer: 'tokens',
      });
      await store.setTokenName(roomId, id, 'Grik');
      await store.flush();
      return id;
    });

    // A second store over the same bytes — a fresh app run opening the file.
    await withStore(new LocalStore(file, undefined, 0), async (store) => {
      const roomId = await store.openCampaign();
      const room = await store.getRoom(roomId);
      expect(room?.name).toBe('The Moathouse');
      expect(room?.gmUid).toBe(store.currentUid());

      const tokens = await new Promise<Array<{ id: string; name?: string }>>((resolve) => {
        const unsub = store.subscribeTokens(roomId, (t) => {
          unsub();
          resolve(t);
        });
      });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.name).toBe('Grik');
      // A round-trip that renamed the token's id would still be a round-trip
      // that lost the referee's link to it.
      expect(tokens[0]!.id).toBe(tokenId);
      expect(store.saveState().dirty).toBe(false);
    });
  });

  it('collapses a burst of mutations into one debounced write', async () => {
    const file = new MemoryCampaignFile();
    await withStore(new LocalStore(file, undefined, 5), async (store) => {
      const roomId = await store.createCampaign({ name: 'Burst', profileTemplate: TEMPLATE });
      expect(file.writes).toBe(1);

      for (let i = 0; i < 20; i += 1) await store.renameRoom(roomId, `Burst ${i}`);
      expect(file.writes).toBe(1); // nothing yet — still inside the debounce
      expect(store.saveState().dirty).toBe(true);

      await new Promise((r) => setTimeout(r, 40));
      expect(file.writes).toBe(2);
      expect(store.saveState().dirty).toBe(false);
      expect(readManifest((await file.read())!).roomName).toBe('Burst 19');
    });
  });

  it('never writes on its own when the host cannot autosave — Save is the user’s', async () => {
    const file = new MemoryCampaignFile('campaign.vttcamp', false);
    await withStore(new LocalStore(file, undefined, 0), async (store) => {
      const roomId = await store.createCampaign({ name: 'Manual', profileTemplate: TEMPLATE });
      expect(file.writes).toBe(0);

      await store.renameRoom(roomId, 'Still manual');
      await new Promise((r) => setTimeout(r, 20));
      expect(file.writes).toBe(0);

      const state = store.saveState();
      expect(state.autosave).toBe(false);
      expect(state.dirty).toBe(true);

      await store.save();
      expect(file.writes).toBe(1);
      expect(store.saveState().dirty).toBe(false);
      expect(readManifest((await file.read())!).roomName).toBe('Still manual');
    });
  });

  it('reports a failed write instead of pretending the campaign is on disk', async () => {
    const file = new MemoryCampaignFile('campaign.vttcamp', false);
    file.write = async () => {
      throw new Error('disk full');
    };
    await withStore(new LocalStore(file, undefined, 0), async (store) => {
      await store.createCampaign({ name: 'Doomed', profileTemplate: TEMPLATE });
      await store.save();
      const state = store.saveState();
      expect(state.error).toBe('disk full');
      expect(state.dirty).toBe(true);
      expect(state.lastSavedAt).toBeNull();
    });
  });

  it('publishes save state to subscribers', async () => {
    const file = new MemoryCampaignFile();
    await withStore(new LocalStore(file, undefined, 0), async (store) => {
      const seen: boolean[] = [];
      const unsub = store.subscribeSaveState((s) => seen.push(s.dirty));
      const roomId = await store.createCampaign({ name: 'Watched', profileTemplate: TEMPLATE });
      await store.renameRoom(roomId, 'Watched twice');
      await store.flush();
      unsub();
      expect(seen).toContain(true);
      expect(seen.at(-1)).toBe(false);
    });
  });

  it('rejects an unsupported archive rather than opening it', async () => {
    const file = new MemoryCampaignFile();
    await withStore(new LocalStore(file), async (store) => {
      await expect(store.openCampaign()).rejects.toThrow(/empty/);
    });

    const notAnArchive = new MemoryCampaignFile(
      'junk.vttcamp',
      true,
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    );
    await withStore(new LocalStore(notAnArchive), async (store) => {
      await expect(store.openCampaign()).rejects.toThrow(VttCampFormatError);
    });
  });

  it('stops writing once the campaign room is deleted', async () => {
    const file = new MemoryCampaignFile();
    await withStore(new LocalStore(file, undefined, 0), async (store) => {
      const roomId = await store.createCampaign({ name: 'Gone', profileTemplate: TEMPLATE });
      expect(file.writes).toBe(1);
      await store.deleteRoom(roomId);
      expect(store.campaignRoomId).toBeNull();
      await new Promise((r) => setTimeout(r, 20));
      expect(file.writes).toBe(1);
    });
  });
});
