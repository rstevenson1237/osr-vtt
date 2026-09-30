import { expect, test } from '@playwright/test';
import { closeQuickSheet, expandQuickSheet, openActivity, signInAsReferee } from './helpers';

/**
 * SPEC-057 §6 (WI-195) — a portrait image picked from the device is resized to
 * at most 256×256 WebP in the browser, stored as a `rooms/{roomId}/images/{id}`
 * document through the Firestore emulator (so the rules' containment bounds are
 * what accepted it), and referenced as `img:<id>`. Placed as a creature, the
 * token's texture loads from the resolved `data:` URL without a broken badge.
 */

// A 1x1 opaque PNG — any decodable image will do; the browser re-encodes it.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('an image picked in the token picker is stored in the room and placed as a creature', async ({
  page,
}) => {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill('Portrait Images');
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  await expect(page.getByTestId('room-name')).toHaveText('Portrait Images');

  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' && msg.text().includes('token image failed to load')) {
      warnings.push(msg.text());
    }
  });

  await openActivity(page, 'map');
  await expandQuickSheet(page, 'maptools');
  await page.getByTestId('add-creature').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'visible' });
  await page.getByTestId('token-picker-tab-images').click();
  await expect(page.getByTestId('token-picker-images-empty')).toBeVisible();

  await page.getByTestId('token-picker-image-input').setInputFiles({
    name: 'goblin.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });

  const option = page.locator('[data-testid^="asset-option-image-"]');
  await expect(option).toHaveCount(1);
  await expect(page.getByTestId('token-picker-image-error')).toHaveCount(0);
  // Stored as WebP: the option's preview resolves the `img:` ref to its bytes.
  await expect(option.locator('img')).toHaveAttribute('src', /^data:image\/webp;base64,/);
  // The referee may remove what they stored.
  await expect(page.locator('[data-testid^="token-picker-image-delete-"]')).toHaveCount(1);

  await option.click();
  await page.getByTestId('token-picker-confirm').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'detached' });
  await closeQuickSheet(page, 'maptools');

  await expect(page.getByTestId('broken-token-count')).toHaveText('0');
  expect(warnings).toEqual([]);
});
