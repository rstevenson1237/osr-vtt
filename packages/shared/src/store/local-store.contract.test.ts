import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { LocalStore, MemoryCampaignFile } from './local-store.js';
import { MemoryBackend } from './memory-store.js';

/**
 * The third leg of the abstraction proof (RULE-001, SPEC-041 §2): the same
 * contract suite that exercises `FirebaseStore` and `MemoryStore` runs here
 * against `LocalStore`. "If it cannot pass that suite, local mode is a fork
 * rather than a backend, and that is the line this spec will not cross."
 *
 * Persistence is **live** for this run, not stubbed out: each store binds the
 * first room it creates as its campaign and writes the whole thing back to its
 * own in-memory `CampaignFile` on a debounce, exactly as the app does. So this
 * suite also asserts, implicitly, that a store saving continuously underneath
 * the contract still satisfies it. What a save actually *preserves* is
 * `local-store.test.ts`'s job.
 */
const backend = new MemoryBackend();

defineCampaignStoreContract(
  'LocalStore',
  (count) =>
    Array.from(
      { length: count },
      (_, i) => new LocalStore(new MemoryCampaignFile(`tab-${i}`), backend),
    ),
  async (roomId, mapId, ref) => {
    const maps = backend.bucket(roomId).maps;
    const cur = maps.getDoc(mapId);
    if (cur) maps.setDoc(mapId, { ...cur, background: { ref } });
  },
  async (roomId, mapId, background) => {
    backend
      .bucket(roomId)
      .mapBucket(mapId)
      .backgrounds.setDoc(background.id, { ...background });
  },
);
