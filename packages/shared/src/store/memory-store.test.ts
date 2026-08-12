import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { MemoryBackend, MemoryStore } from './memory-store.js';

/**
 * Half of Gate 6's abstraction proof (Plan §7 Phase 6, Roadmap Gate 6): the
 * exact same contract suite that exercises `FirebaseStore`
 * (`firebase-store.contract.test.ts`) runs here against `MemoryStore` too.
 * No emulator needed — this is a plain, fast unit test.
 */
// One shared backend per suite run — `count` MemoryStore "tabs" all see
// the same rooms, mirroring several browser tabs against one project.
const backend = new MemoryBackend();

defineCampaignStoreContract(
  'MemoryStore',
  (count) => Array.from({ length: count }, () => new MemoryStore(backend)),
  // The pre-v23 map background the store interface can no longer express
  // (SPEC-038 §1) — written straight into the backing collection, the
  // in-memory analog of the raw `updateDoc` the FirebaseStore suite uses.
  async (roomId, mapId, ref) => {
    const maps = backend.bucket(roomId).maps;
    const cur = maps.getDoc(mapId);
    if (cur) maps.setDoc(mapId, { ...cur, background: { ref } });
  },
);
