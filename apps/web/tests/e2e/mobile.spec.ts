import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl, vectorCarve, VECTOR_CANVAS } from './helpers';

/**
 * Mobile / tablet smoke suite (Master Plan v2, R1.8 / WI-3, Gate 3; updated for
 * the Shell UI Redesign). Runs under the `mobile-chromium` Playwright project (a
 * touch phone viewport < 900px), so the room renders its mobile chrome: compact
 * top bar, full-screen main view, a row of quick-sheet chips, and the pinned
 * main-view tab bar. Quick sheets open as bottom sheets; Log and Session
 * settings open full-screen. No docked rails.
 *
 * Verifies the CI-checkable half of Gate 3: phone-sized viewport shows the
 * single-view UI with no horizontal overflow, views switch from the bottom bar,
 * a region carves, and dice roll. Real pinch/pan/tool-touch on a physical tablet
 * is the [HUMAN] half of the gate.
 */

async function createRoomAndJoin(
  page: Page,
  roomName: string,
  displayName: string,
): Promise<string> {
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

test('mobile shell: switch main views, carve, and roll', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // --- The mobile chrome is present and the desktop rails are not. ---
  await expect(page.getByTestId('app-shell-mobile')).toBeVisible();
  await expect(page.getByTestId('mobile-activity-bar')).toBeVisible();
  await expect(page.getByTestId('mobile-top-bar')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-chips')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-rail')).toHaveCount(0);

  // --- No horizontal overflow at phone width (Gate 3). ---
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // --- The Log opens as a full-screen modal over the stage, not as a view. ---
  await openActivity(page, 'log');
  await expect(page.getByTestId('log-activity')).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('log-overlay')).toHaveCount(0);
  await expect(page.locator(VECTOR_CANVAS)).toBeVisible();

  // --- Carve a floor region with the vector Room tool. Every map tool now
  // lives inside the Map tools quick sheet, which starts closed —
  // `vectorCarve` opens it first. ---
  await vectorCarve(page, { x: 50, y: 40 }, { x: 170, y: 110 });
  await expect(page.getByTestId('floor-region-count')).not.toHaveText('0');

  // --- Dice roll from the expanded Roll sheet. Summed mode so the shared
  // overlay shows a single total (Separate renders per-die badges). ---
  await openActivity(page, 'dice');
  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('tray-mode-summed').click();
  await page.getByTestId('roll-button').click();
  await expect(page.getByTestId('last-roll-total')).toBeVisible();
});

test('mobile shell: quick sheets are one-at-a-time bottom sheets', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // The GM-only Session settings gear is reachable on mobile too (no rail
  // grouping, but availability filtering still applies).
  await expect(page.getByTestId('mobile-activity-session')).toHaveCount(1);

  await page.getByTestId('activity-tab-encounter').click();
  await expect(page.getByTestId('encounter-board')).toBeVisible();

  await page.getByTestId('activity-tab-assets').click();
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await openActivity(page, 'session');
  await expect(page.getByTestId('session-activity')).toBeVisible();
  await page.keyboard.press('Escape');

  // Unlike desktop, opening a second quick sheet replaces the first — there is
  // only room for one bottom sheet.
  await page.getByTestId('quick-sheet-toggle-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'mobile');
  await page.getByTestId('quick-sheet-toggle-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveCount(0);

  // The grip toggles the sheet between its half-height peek and full height.
  const sheet = page.getByTestId('quick-sheet-character');
  const halfHeight = (await sheet.boundingBox())!.height;
  await page.getByTestId('quick-sheet-grip-character').click();
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeGreaterThan(halfHeight);
});
