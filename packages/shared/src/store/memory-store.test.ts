import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { MemoryBackend, MemoryStore } from './memory-store.js';

/**
 * Half of Gate 6's abstraction proof (Plan §7 Phase 6, Roadmap Gate 6): the
 * exact same contract suite that exercises `FirebaseStore`
 * (`firebase-store.contract.test.ts`) runs here against `MemoryStore` too.
 * No emulator needed — this is a plain, fast unit test.
 */
defineCampaignStoreContract('MemoryStore', (count) => {
  // One shared backend per suite run — `count` MemoryStore "tabs" all see
  // the same rooms, mirroring several browser tabs against one project.
  const backend = new MemoryBackend();
  return Array.from({ length: count }, () => new MemoryStore(backend));
});
