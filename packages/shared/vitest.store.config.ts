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
    // A glob, not a list of filenames: `room-uploads.emulator.test.ts` was
    // missing from the enumerated version, so it ran in `test:unit` instead —
    // without an emulator locally, and without this config's timeout and retry
    // in CI, which is what made it the one that went red.
    include: ['src/store/firebase-store.contract.test.ts', 'src/store/*.emulator.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000,
    // Retry: these tests drive the real emulator, whose Listen/Write latency is
    // variable under CI load. Two of them have intermittently tripped a Firestore
    // RESOURCE_EXHAUSTED (an oversized Listen message from accumulated emulator
    // state) and then timed out — the contract suite's recursive room-deletion
    // test, and `room-uploads.emulator.test.ts`, which reached this config only
    // once the include above became a glob. A retry recovers either without
    // masking a deterministic failure, which fails every attempt.
    // TODO(follow-up): trace the oversized Listen payload and isolate emulator
    // state between tests so the retry can be removed. Logged as intake rather
    // than fixed here: the root cause is a listener subscribing more broadly
    // than the test needs, which is a real defect rather than CI noise.
    retry: 2,
  },
});
