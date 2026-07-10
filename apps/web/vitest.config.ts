import { defineConfig } from 'vitest/config';

// Pure-logic unit tests only (dice engine, profile view mapping). Component
// behavior and the full sync flow are exercised by Playwright e2e against
// the real emulators (see playwright.config.ts) — that's the higher-value
// place to test Svelte + Firebase wiring for this phase.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
