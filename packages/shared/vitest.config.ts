import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Rules tests and the FirebaseStore contract suite both need the
    // Firestore/Auth/RTDB emulators running — they get their own vitest
    // config + script (test:rules, test:store) instead of running here.
    exclude: ['src/rules/**', 'src/store/firebase-store.contract.test.ts'],
  },
});
