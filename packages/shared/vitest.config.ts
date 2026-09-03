import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Everything that needs a live emulator is excluded here and runs under
    // its own config + script instead (test:rules, test:store): the rules
    // tests, the FirebaseStore half of the contract suite, and the
    // `*.emulator.test.ts` files.
    //
    // The glob is what makes this suite honestly emulator-free. Naming the two
    // emulator files individually is what went wrong before: `test:store` listed
    // `account-recovery.emulator.test.ts` and nothing listed
    // `room-uploads.emulator.test.ts`, so the latter ran *here* — failing with
    // `auth/network-request-failed` for anyone running `pnpm verify` without an
    // emulator, and running in CI without the 60s timeout and retry its sibling
    // gets. A pattern cannot be forgotten when the third such file is added.
    exclude: [
      'src/rules/**',
      'src/store/firebase-store.contract.test.ts',
      'src/**/*.emulator.test.ts',
    ],
  },
});
