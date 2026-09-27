import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openActivity, signInAsReferee, switchToEditMode } from './helpers';

/**
 * Universal VTT import (SPEC-056 §8, WI-187). The conversion itself is unit
 * tested (`uvtt.test.ts`, `import-uvtt.test.ts`); this covers the control: a
 * good file lands as a new map row, a bad one says why and adds nothing.
 */

const SAMPLE = fileURLToPath(
  new URL('../../public/assets/maps/sample-dungeon.dd2vtt', import.meta.url),
);

test('Import UVTT makes a new map; a bad file writes nothing', async ({ page }) => {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill('The Drowned Crypt');
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  await switchToEditMode(page);
  await openActivity(page, 'assets');

  const rows = page.locator('[data-testid^="map-row-"]');
  await expect(rows).toHaveCount(1);

  await page.getByTestId('maps-import-uvtt').setInputFiles({
    name: 'broken.uvtt',
    mimeType: 'application/json',
    buffer: Buffer.from('{ not json'),
  });
  await expect(page.getByTestId('maps-import-uvtt-error')).toContainText('broken.uvtt');
  await expect(rows).toHaveCount(1);

  await page.getByTestId('maps-import-uvtt').setInputFiles(SAMPLE);
  await expect(rows).toHaveCount(2);
  // The new map opens in the inline rename, named after the file.
  await expect(page.locator('[data-testid^="map-edit-name-"]')).toHaveValue('sample-dungeon');
  await expect(page.getByTestId('maps-import-uvtt-error')).toHaveCount(0);
});
