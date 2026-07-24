import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * Shell mechanics (Master Plan v2, R1 / Gate 12; rewritten for the Shell UI
 * Redesign). Targets the shell itself rather than any one panel's content: the
 * main-view tabs, the keyboard digit shortcuts, quick sheets (independent
 * toggling, persistence, expand/collapse, exclusivity of the expanded view),
 * the Log and Session settings modals, and the shortcuts sheet.
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

test('desktop shell: every main-view tab switches the stage', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  await page.getByTestId('activity-tab-encounter').click();
  await expect(page.getByTestId('encounter-board')).toBeVisible();

  await page.getByTestId('activity-tab-assets').click();
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await page.getByTestId('activity-tab-map').click();
  await expect(page.locator('[data-testid="vector-map-canvas"] canvas')).toBeVisible();
});

test('desktop shell: Log and Session settings open as modals', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('log-open').click();
  await expect(page.getByTestId('log-overlay')).toBeVisible();
  await expect(page.getByTestId('log-activity')).toBeVisible();
  // The main view stays mounted underneath — the modal never replaces it.
  await expect(page.locator('[data-testid="vector-map-canvas"] canvas')).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('log-overlay')).toHaveCount(0);

  await page.getByTestId('session-shortcut').click();
  await expect(page.getByTestId('session-overlay')).toBeVisible();
  await expect(page.getByTestId('session-activity')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('session-overlay')).toHaveCount(0);
});

test('desktop shell: 1-3 switch the main view, 4-7 toggle quick sheets', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Main views for a GM, in tab order: map, encounter, assets.
  await page.keyboard.press('2');
  await expect(page.getByTestId('encounter-board')).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.getByTestId('assets-activity')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('[data-testid="vector-map-canvas"] canvas')).toBeVisible();

  // Quick sheets, in rail order: maptools, character, roll, room.
  await page.keyboard.press('5');
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
  await page.keyboard.press('5');
  await expect(page.getByTestId('quick-sheet-character')).toHaveCount(0);
});

test('desktop shell: quick sheets toggle independently and stack', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-toggle-roll')).toHaveAttribute('aria-pressed', 'true');
  // The map view is untouched — a sheet layers over the stage, it doesn't
  // replace it.
  await expect(page.locator('[data-testid="vector-map-canvas"] canvas')).toBeVisible();

  // Opening a second sheet does NOT close the first (independent, non-exclusive
  // — the key difference from the retired one-mini-card-per-rail behaviour).
  await page.getByTestId('quick-sheet-toggle-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-roll')).toBeVisible();

  // Each sheet's ✕ closes only itself.
  await page.getByTestId('quick-sheet-close-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveCount(0);
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
});

test('desktop shell: expanding a sheet is exclusive and collapses back', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-roll').click();
  await page.getByTestId('quick-sheet-toggle-character').click();

  await page.getByTestId('quick-sheet-expand-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'expanded');
  // The full dice tray only mounts in the expanded Roll sheet.
  await expect(page.getByTestId('roll-button')).toBeVisible();

  // Expanding another sheet collapses the first — only one expanded at a time.
  await page.getByTestId('quick-sheet-expand-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toHaveAttribute('data-mode', 'expanded');
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'docked');

  // Escape collapses back to docked without closing the sheet.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('quick-sheet-character')).toHaveAttribute('data-mode', 'docked');
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
});

test('desktop shell: open quick sheets persist across reload', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-maptools').click();
  await expect(page.getByTestId('quick-sheet-maptools')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('room-name')).toHaveText('The Glass Ossuary');
  await expect(page.getByTestId('quick-sheet-maptools')).toBeVisible();

  // Expansion is deliberately *not* persisted — a modal surviving a refresh
  // reads as the app being stuck, not as a restored preference.
  await page.getByTestId('quick-sheet-expand-maptools').click();
  await expect(page.getByTestId('quick-sheet-maptools')).toHaveAttribute('data-mode', 'expanded');
  await page.reload();
  await expect(page.getByTestId('quick-sheet-maptools')).toHaveAttribute('data-mode', 'docked');

  // Closing persists too.
  await page.getByTestId('quick-sheet-close-maptools').click();
  await page.reload();
  await expect(page.getByTestId('room-name')).toHaveText('The Glass Ossuary');
  await expect(page.getByTestId('quick-sheet-maptools')).toHaveCount(0);
});

test('Gate 18: the stage is full-bleed with sheets closed; Snap lives on the character sheet', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Token Snap lives on the character quick sheet, not the map toolbar (moved
  // off the always-visible rail so it doesn't compete with the draw tools).
  // Scale is absent from the map toolbar until a token is selected (R14.2).
  await page.getByTestId('quick-sheet-toggle-character').click();
  await expect(page.getByTestId('map-defaults')).toBeVisible();
  await expect(page.getByTestId('token-snap-control')).toBeVisible();
  await page.getByTestId('quick-sheet-close-character').click();
  await expect(page.getByTestId('token-scale-control')).toHaveCount(0);

  // With no docked sheets, the retired right Tools rail no longer costs any
  // stage width: the map canvas spans ≥90% of the viewport (Gate 2 / R14.1).
  const stage = page.locator('[data-testid="vector-map-canvas"]');
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  expect((box!.width / viewportWidth) * 100).toBeGreaterThanOrEqual(90);
});

test('desktop shell: "?" opens the shortcut sheet, Escape closes it', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcut-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0);
});

test('desktop shell: "L" opens the Log modal and focuses the chat input', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await expect(page.getByTestId('log-overlay')).toHaveCount(0);
  await page.keyboard.press('l');
  await expect(page.getByTestId('log-overlay')).toBeVisible();
  await expect(page.getByTestId('chat-text-stage')).toBeFocused();
});
