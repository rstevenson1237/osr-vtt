import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Pure-logic unit tests (dice engine, profile view mapping) plus the rune
// classes that back the shell (`*.svelte.ts`) — the Svelte plugin is here only
// so those compile; no components are mounted. Component behavior and the full
// sync flow are exercised by Playwright e2e against the real emulators (see
// playwright.config.ts) — that's the higher-value place to test Svelte +
// Firebase wiring for this phase.
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
