import { createFirebaseClient } from '../firebase-config.js';
import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { FirebaseStore } from './firebase-store.js';

/**
 * The other half of Gate 6's abstraction proof (Plan §7 Phase 6, Roadmap
 * Gate 6): the exact same contract suite that exercises `MemoryStore`
 * (`memory-store.test.ts`) runs here against `FirebaseStore` itself, over
 * the real Firestore/Auth/RTDB emulators — `MemoryStore` passing alone would
 * only prove *its own* internal consistency, not that the interface is a
 * faithful abstraction over the implementation everything actually ships
 * with.
 *
 * Needs the Firestore + Auth + Realtime Database emulators running
 * (`singleProjectMode`, so the project id must match `.firebaserc`'s
 * "osr-vtt" — see `firebase.json`). Invoke via `pnpm test:store`, which must
 * run inside `firebase emulators:exec` (see root package.json
 * `test:all:emulators`) — same requirement as the Security Rules tests.
 */

let clientCounter = 0;

defineCampaignStoreContract('FirebaseStore (emulators)', (count) => {
  return Array.from({ length: count }, () => {
    clientCounter += 1;
    // A distinct Firebase App per simulated "client" (Plan §1.3) — each gets
    // its own Anonymous Auth session/uid, exactly like a separate browser
    // tab, all against the one emulator-backed "osr-vtt" project.
    const client = createFirebaseClient({
      config: {
        apiKey: 'demo-api-key',
        authDomain: 'osr-vtt.firebaseapp.com',
        projectId: 'osr-vtt',
        databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
        appId: '1:0:web:demo',
      },
      useEmulators: true,
      appName: `store-contract-${clientCounter}`,
    });
    return new FirebaseStore(client);
  });
});
