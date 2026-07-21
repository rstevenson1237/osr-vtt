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
  // Retry on CI only: the heavy two-context portability flow (repeated map/Pixi
  // mount+teardown across many activity switches, plus a .vttcamp round trip) is
  // occasionally flaky under CI resource pressure. A retry recovers those
  // without masking a deterministic failure (which fails all attempts).
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    // Optional escape hatch for environments that ship a pre-installed Chromium
    // whose build differs from this @playwright/test's pinned one: point
    // PW_EXECUTABLE_PATH at that binary to launch it instead of downloading.
    // Unset in CI, so the default managed browser is used there.
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    // Explicit --host: without it Vite binds to `localhost`, which Node
    // resolves IPv6-first on some hosts — the health check below against
    // 127.0.0.1 then never connects and the whole thing times out with no
    // error (this is what was happening in CI; identical command "worked"
    // locally only because that host's DNS order happened to favor IPv4).
    command: 'pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    // A cold GitHub-hosted runner (fresh checkout, no .vite cache) can take
    // longer than 60s for Vite's first dependency pre-bundle + transform
    // pass, especially with Phase 1's larger source tree.
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    // Desktop acceptance suite (the Activity Shell's docked-rail layout). Skips
    // the mobile smoke, which asserts the < 900px single-activity chrome.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts$/,
    },
    // Mobile / tablet smoke (Master Plan v2, R1.8 / WI-3). A touch phone
    // viewport (< 900px, coarse pointer) so the shell renders its bottom
    // activity bar + tool sheet; runs only the mobile spec.
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile\.spec\.ts$/,
    },
  ],
});
