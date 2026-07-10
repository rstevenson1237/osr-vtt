import { defineConfig } from 'vitest/config';

// Rules tests spin up @firebase/rules-unit-testing against the local
// Firestore emulator. They must run inside `firebase emulators:exec` (or with
// FIRESTORE_EMULATOR_HOST already set) — see package.json `test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/rules/**/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
