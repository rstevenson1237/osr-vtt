import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { closeQuickSheet, expandQuickSheet, openActivity, roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * IN-008/WI-032 — a URL-derived token failing to load used to leave a
 * permanent blank white square with no way to tell "broken link" from "no
 * token set". Two independent causes reach `loadTokenTexture`, and this spec
 * covers both: an unrecognized/extensionless URL (client-fixable — Pixi's
 * `Assets.load` only claims URLs whose extension it knows) and a
 * CORS-blocked host (not client-fixable — the pixel data can't be uploaded
 * to WebGL without the host's cooperation, so the fix is to fail visibly
 * instead of silently).
 *
 * Both fixtures are served via `page.route`, not a real network fetch, so
 * this doesn't depend on any external host being up.
 */

// A 1x1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function createRoomAndJoin(page: Page, roomName: string): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill('Referee');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

/** Saves `url` via Assets → By URL, waiting for the preview to confirm it
 * loads (a plain `<img>`, so this succeeds for both fixtures below — display
 * doesn't need CORS headers, only a WebGL texture upload does). */
async function saveUrlAsset(page: Page, url: string): Promise<void> {
  await openActivity(page, 'assets');
  await page.getByTestId('assets-tab-url').click();
  await page.getByTestId('asset-url-input').fill(url);
  await expect(page.getByTestId('asset-url-preview')).toBeVisible();
  await expect(page.getByTestId('asset-url-save')).toBeEnabled();
  await page.getByTestId('asset-url-save').click();
  await expect(page.getByTestId('asset-url-input')).toHaveValue('');
}

/** Places a token from the just-saved URL asset via the GM "Add creature"
 * flow — same `loadTokenTexture` path a dragged-from-sheet token uses. The
 * button only exists in the *expanded* Map tools sheet (see `addCreature`
 * in helpers.ts), so this mirrors that helper rather than a bare toggle. */
async function addCreatureFromSavedUrl(page: Page): Promise<void> {
  await openActivity(page, 'map');
  await expandQuickSheet(page, 'maptools');
  await page.getByTestId('add-creature').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'visible' });
  await page.getByTestId('token-picker-tab-saved').click();
  await page.locator('[data-testid^="asset-option-saved-"]').first().click();
  await page.getByTestId('token-picker-confirm').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'detached' });
  await closeQuickSheet(page, 'maptools');
}

test('an extensionless/query-string image URL now loads as a token (fixes the unrecognized-extension cause)', async ({
  page,
}) => {
  const url = 'https://faux-cdn.example/asset?id=dwarf-token';
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      // `no-store` forces a real second network round trip for the token's
      // texture load (loadTokenTexture's own `Image()`) rather than the
      // browser silently serving it from the URL-picker preview's cached
      // response — which would make `waitForResponse` below hang forever.
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      body: Buffer.from(PNG_BASE64, 'base64'),
    }),
  );

  await createRoomAndJoin(page, 'Token Load Test');
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' && msg.text().includes('token image failed to load')) {
      warnings.push(msg.text());
    }
  });

  await saveUrlAsset(page, url);
  const [response] = await Promise.all([page.waitForResponse(url), addCreatureFromSavedUrl(page)]);
  expect(response.ok()).toBe(true);

  await expect(page.getByTestId('broken-token-count')).toHaveText('0');
  expect(warnings).toEqual([]);
});

test('a CORS-blocked image host fails visibly (a broken-image badge) instead of a silent white square', async ({
  page,
}) => {
  const url = 'https://cors-blocked.example/dwarf.png';
  await page.route(url, (route) => {
    // A `crossOrigin="anonymous"` fetch (loadTokenTexture's own `Image()`)
    // sends an `Origin` header; a plain `<img>` (the Assets/picker preview)
    // does not — that's how a CORS-less real host produces exactly this
    // split (loads as a plain image, fails as a CORS-mode one). Chromium's
    // own header-based CORS gate isn't applied to `route.fulfill` responses
    // (verified: it still fires `onload` even with no ACAO header), so the
    // split is reproduced here directly, at the mock, rather than relying
    // on the browser to enforce it against a synthetic response.
    if (route.request().headers().origin) {
      route.abort('accessdenied');
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(PNG_BASE64, 'base64'),
    });
  });

  await createRoomAndJoin(page, 'Token Load CORS Test');
  await saveUrlAsset(page, url);
  await addCreatureFromSavedUrl(page);

  await expect(page.getByTestId('broken-token-count')).toHaveText('1');
});
