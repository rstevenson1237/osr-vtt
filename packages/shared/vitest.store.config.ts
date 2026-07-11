import { defineConfig } from 'vitest/config';

// The FirebaseStore half of the CampaignStore contract suite (Plan §7 Phase
// 6, Gate 6) runs the real SDK against the Firestore/Auth/RTDB emulators —
// same requirement as the rules tests (vitest.rules.config.ts) — so it needs
// generous timeouts and must run inside `firebase emulators:exec` (see
// package.json `test:store` / root `test:all:emulators`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/store/firebase-store.contract.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
