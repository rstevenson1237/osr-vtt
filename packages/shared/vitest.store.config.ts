import { defineConfig } from 'vitest/config';

// The FirebaseStore half of the CampaignStore contract suite (Plan §7 Phase
// 6, Gate 6) runs the real SDK against the Firestore/Auth/RTDB emulators —
// same requirement as the rules tests (vitest.rules.config.ts) — so it needs
// generous timeouts and must run inside `firebase emulators:exec` (see
// package.json `test:store` / root `test:all:emulators`).
//
// Timeout is 60s (not 30s): these tests do heavy real emulator I/O — create
// room, join, write every subcollection, recursively delete — whose latency is
// variable under CI runner/emulator load, and the recursive `deleteRoom` clears
// more collections since the vector cutover (floorRegions/walls/doors). 30s was
// occasionally tripped in CI by that variance (including on map-unrelated tests
// like renamePlayer, confirming it's load, not logic); 60s gives headroom.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/store/firebase-store.contract.test.ts',
      'src/store/account-recovery.emulator.test.ts',
    ],
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
