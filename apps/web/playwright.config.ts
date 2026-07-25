import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';

/**
 * Two-context e2e acceptance test (Plan §8 Acceptance, §9). Must run against
 * the real Firebase Emulator Suite — invoke via `pnpm test:e2e` inside
 * `firebase emulators:exec` (see root package.json `test:all:emulators`), or
 * with `firebase emulators:start` already running in another terminal.
 */

/**
 * Resolves a Chromium binary to launch, or `undefined` to let Playwright use
 * its own managed download (what CI does, and the default everywhere the
 * download is available).
 *
 * Some sandboxes ship a pre-installed Chromium under `PLAYWRIGHT_BROWSERS_PATH`
 * built for a *different* Playwright revision than this package pins, and block
 * `cdn.playwright.dev` so the pinned build can never be fetched. Playwright then
 * fails every test with "Executable doesn't exist at …/chromium_headless_shell-<rev>".
 * Rather than making every caller remember an env var, fall back to whatever
 * Chromium is actually present — only when the pinned revision is genuinely
 * missing, so CI's managed browser always wins and this never silently
 * downgrades a normal run.
 *
 * `PW_EXECUTABLE_PATH` still overrides everything, for pointing at a specific
 * binary by hand.
 */
function resolveChromiumPath(): string | undefined {
  const explicit = process.env.PW_EXECUTABLE_PATH;
  if (explicit) return explicit;

  // Playwright's own pinned build is present: use it, unconditionally. This is
  // the CI path and the normal local path.
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // executablePath() throws when nothing is installed at all — fall through.
  }

  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersPath || !existsSync(browsersPath)) return undefined;

  // Playwright names its installs `chromium-<revision>`; images that
  // pre-install one usually also drop a stable `chromium` symlink beside them.
  // Prefer that, then any versioned directory's binary.
  const candidates = [
    join(browsersPath, 'chromium'),
    ...readdirSync(browsersPath)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .map((entry) => join(browsersPath, entry, 'chrome-linux', 'chrome')),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const chromiumPath = resolveChromiumPath();
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
  // Retry on CI only: these two-context, emulator-backed acceptance flows are
  // occasionally flaky under CI resource pressure (e.g. a dice/initiative sync
  // race). A retry recovers those without masking a deterministic failure, which
  // fails all attempts.
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    // Empty unless the pinned browser is missing and a pre-installed one was
    // found — see resolveChromiumPath above. CI keeps the managed browser.
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
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
    // Desktop acceptance suite (the quick-sheet shell's docked layout). Skips
    // the mobile smoke, which asserts the < 900px chrome.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts$/,
    },
    // Mobile / tablet smoke (Master Plan v2, R1.8 / WI-3). A touch phone
    // viewport (< 900px, coarse pointer) so the shell renders its quick-sheet
    // chips + bottom tab bar; runs only the mobile spec.
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile\.spec\.ts$/,
    },
  ],
});
