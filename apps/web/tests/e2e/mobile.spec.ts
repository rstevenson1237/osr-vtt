import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * Mobile / tablet smoke suite (Master Plan v2, R1.8 / WI-3, Gate 3). Runs under
 * the `mobile-chromium` Playwright project (a touch phone viewport < 900px), so
 * the room renders its single-activity mobile chrome: compact top bar, bottom
 * activity bar, and the drag-handle tool sheet — no docked rails, no mini-cards.
 *
 * Verifies the CI-checkable half of Gate 3: phone-sized viewport shows the
 * single-activity UI with no horizontal overflow, activities switch from the
 * bottom bar, a cell carves, and dice roll. Real pinch/pan/tool-touch on a
 * physical tablet is the [HUMAN] half of the gate.
 */

async function createRoomAndJoin(page: Page, roomName: string, displayName: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

/** Switch the whole stage from the mobile bottom activity bar (no mini-cards). */
async function switchActivity(
  page: Page,
  id: 'map' | 'encounter' | 'dice' | 'characters' | 'log' | 'session' | 'assets',
): Promise<void> {
  await page.getByTestId(`mobile-activity-${id}`).click();
}

test('mobile single-activity shell: switch activities, carve, and roll', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // --- The mobile chrome is present and the desktop docked rails are not. ---
  await expect(page.getByTestId('app-shell-mobile')).toBeVisible();
  await expect(page.getByTestId('mobile-activity-bar')).toBeVisible();
  await expect(page.getByTestId('mobile-top-bar')).toBeVisible();
  await expect(page.getByTestId('activities-rail')).toHaveCount(0);

  // --- No horizontal overflow at phone width (Gate 3). ---
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // --- Bottom bar switches the whole stage directly. ---
  await switchActivity(page, 'dice');
  await expect(page.getByTestId('dice-activity')).toBeVisible();
  await switchActivity(page, 'log');
  await expect(page.getByTestId('log-activity')).toBeVisible();
  await switchActivity(page, 'map');
  await expect(page.locator('[data-testid="map-canvas"] canvas')).toBeVisible();

  // --- Tool bottom-sheet: tap the handle to open, pick Carve, then carve a
  // cell by dragging the canvas in the clear area above the sheet. ---
  await page.getByTestId('tool-sheet-handle').click();
  await page.getByTestId('map-tool-carve').click();

  const canvas = page.locator('[data-testid="map-canvas"] canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Map canvas not found/visible');
  await page.mouse.move(box.x + 50, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 110, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('floor-cell-count')).not.toHaveText('0');

  // --- Dice roll from the Dice activity. Summed mode so the shared overlay
  // shows a single total (the default Separate mode renders per-die badges). ---
  await switchActivity(page, 'dice');
  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('tray-mode-summed').click();
  await page.getByTestId('roll-button').click();
  await expect(page.getByTestId('last-roll-total')).toBeVisible();
});

test('mobile single-activity shell: remaining activities switch with no mini-cards', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // The GM-only Session tab is reachable from the bottom bar on mobile too
  // (no rail grouping, but availability filtering still applies).
  await expect(page.getByTestId('mobile-activity-session')).toHaveCount(1);

  await switchActivity(page, 'encounter');
  await expect(page.getByTestId('encounter-board')).toBeVisible();

  await switchActivity(page, 'characters');
  await expect(page.getByTestId('characters-activity')).toBeVisible();

  await switchActivity(page, 'assets');
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await switchActivity(page, 'session');
  await expect(page.getByTestId('session-activity')).toBeVisible();

  // Dice/Characters have desktop mini-cards, but mobile never docks a flyout
  // — switching to them always replaces the whole stage.
  await expect(page.getByTestId('activities-rail')).toHaveCount(0);
  await switchActivity(page, 'dice');
  await expect(page.getByTestId('dice-activity')).toBeVisible();
  await expect(page.locator('.stage-scrim')).toHaveCount(0);
});
