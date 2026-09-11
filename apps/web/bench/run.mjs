/**
 * WI-122 — drives `hex-overlay-cost.html` in headless Chromium and prints its
 * JSON. Starts a Vite dev server on its own port, so it needs nothing running
 * and touches no emulator.
 *
 *   node apps/web/bench/run.mjs
 *
 * The numbers are recorded in `docs/completed/wi-122/render-cost.md`; this is
 * here so they can be re-derived rather than trusted.
 */
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

/** Same fallback `playwright.config.ts` documents: some sandboxes ship a
 * pre-installed Chromium under `PLAYWRIGHT_BROWSERS_PATH` built for a different
 * Playwright revision than this package pins, and block the CDN the pinned one
 * would come from. Use Playwright's own build when it is actually there. */
function chromiumPath() {
  if (process.env.PW_EXECUTABLE_PATH) return process.env.PW_EXECUTABLE_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined;
  } catch {
    // Nothing installed at all — fall through to the pre-installed one.
  }
  const preinstalled = `${process.env.PLAYWRIGHT_BROWSERS_PATH ?? ''}/chromium`;
  return existsSync(preinstalled) ? preinstalled : undefined;
}

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { port: 5199, strictPort: true },
  logLevel: 'warn',
});
await server.listen();

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (err) => console.error('page error:', err.message));
page.on('console', (msg) => console.error(`[page] ${msg.text()}`));
await page.goto('http://localhost:5199/bench/hex-overlay-cost.html');
const result = await page.waitForFunction(() => globalThis.__benchResult, null, {
  timeout: 1_800_000,
});
// stdout, not `console.log`: the JSON is the harness's output and is meant to be
// redirected to a file, while the per-variant progress lines go to stderr.
process.stdout.write(`${JSON.stringify(await result.jsonValue(), null, 2)}\n`);

await browser.close();
await server.close();
