import { defineConfig, devices } from '@playwright/test';

/**
 * Two-context e2e acceptance test (Plan §8 Acceptance, §9). Must run against
 * the real Firebase Emulator Suite — invoke via `pnpm test:e2e` inside
 * `firebase emulators:exec` (see root package.json `test:all:emulators`), or
 * with `firebase emulators:start` already running in another terminal.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Generous: cold WASM (Rapier) + WebGL init in headless/software-rendered
  // Chromium can take a while on first load, on top of two real browser
  // contexts driving Firestore/RTDB emulator round trips. The Phase 1 map
  // tools spec chains many more such round trips (carve/wall/door/undo-redo/
  // ruler/ping/fog-eraser/token-scale) than the Phase 0 slice, so it needs
  // more headroom than a single-flow test would.
  timeout: 180_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
