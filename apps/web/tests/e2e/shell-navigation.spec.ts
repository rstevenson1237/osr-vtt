import { expect, type Page, test } from '@playwright/test';
import {
  closeActivityDrawer,
  openActivityDrawer,
  roomIdFromUrl,
  VECTOR_CANVAS,
} from './helpers';

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

  // The tabs live in the rail's activity drawer, which shows only the current
  // activity until it is opened.
  await openActivityDrawer(page);
  await page.getByTestId('activity-tab-encounter').click();
  await expect(page.getByTestId('encounter-board')).toBeVisible();
  // Picking a view closes the drawer behind you.
  await expect(page.getByTestId('activity-drawer')).toHaveCount(0);

  await openActivityDrawer(page);
  await page.getByTestId('activity-tab-assets').click();
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await openActivityDrawer(page);
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
  await expect(page.getByTestId('tray-custom-die')).toBeVisible();

  // The expanded sheet is genuinely modal: its backdrop covers the rail and the
  // other docked cards, so nothing behind it is reachable until it collapses.
  await expect(page.locator('.sheet-backdrop')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-character')).toHaveAttribute('data-mode', 'docked');

  // Clicking the backdrop collapses it back to docked without closing it.
  // Aim at a corner: the backdrop spans the viewport, so its centre — where
  // Playwright clicks by default — is covered by the modal it dims.
  await page.locator('.sheet-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'docked');
  await expect(page.getByTestId('quick-sheet-roll')).toBeVisible();

  // Expanding a second sheet leaves the first docked — at most one expanded.
  await page.getByTestId('quick-sheet-expand-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toHaveAttribute('data-mode', 'expanded');
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'docked');

  // Escape also collapses, without closing the sheet.
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

test('desktop shell: "L" focuses the bottom bar chat input, no modal', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // The desktop bottom bar has its own chat input now, so `L` goes straight
  // there rather than opening the Log modal (mobile, which has no bar, still
  // opens it — see the mobile spec).
  await expect(page.getByTestId('chat-text-bar')).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.getByTestId('chat-text-bar')).toBeFocused();
  await expect(page.getByTestId('log-overlay')).toHaveCount(0);
});

test('desktop shell: the bottom bar chat input posts to the log', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('chat-text-bar').fill('table talk');
  await page.getByTestId('chat-send-bar').click();

  await page.getByTestId('log-open').click();
  await expect(page.getByTestId('action-log')).toContainText('table talk');
});

test('desktop shell: the rail moves to the other edge and the choice persists', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  const rail = page.getByTestId('shell-rail');
  await expect(rail).toHaveAttribute('data-side', 'left');

  // Clicking the handle flips sides; the docked sheet column follows. The
  // handle lives in the activity drawer now, so that has to be open first.
  await page.getByTestId('quick-sheet-toggle-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toBeVisible();
  await openActivityDrawer(page);
  await page.getByTestId('rail-move').click();
  await expect(rail).toHaveAttribute('data-side', 'right');
  await closeActivityDrawer(page);

  const shell = await page.getByTestId('shell-stage').boundingBox();
  const sheet = await page.getByTestId('quick-sheet-roll').boundingBox();
  if (!shell || !sheet) throw new Error('stage or sheet not laid out');
  // The card now sits in the right half of the stage.
  expect(sheet.x).toBeGreaterThan(shell.x + shell.width / 2);

  // The side is a durable layout preference, like the open-sheet set.
  await page.reload();
  await expect(page.getByTestId('shell-rail')).toHaveAttribute('data-side', 'right');
});

test('roll quick sheet: tray controls and macros are usable while docked', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-roll').click();
  // Docked — no expanding first. The recent-rolls list is gone; the Log owns it.
  await expect(page.getByTestId('tray-modifier')).toBeVisible();
  await expect(page.getByTestId('tray-mode-summed')).toBeVisible();
  // Saved macros show docked, but the *creator* is expanded-only (playtest
  // feedback) — as is the recent-rolls list, which the Log owns now.
  await expect(page.getByTestId('macro-name-input')).toHaveCount(0);
  await expect(page.getByTestId('roll-button')).toBeVisible();
  await expect(page.getByTestId('quick-roll-recent')).toHaveCount(0);

  // A die button *stages* a die rather than rolling it, so a pool can be built
  // without expanding anything; the Roll button next to it throws it.
  await page.getByTestId('quick-roll-d20').click();
  await page.getByTestId('quick-roll-d6').click();
  await expect(page.locator('[data-testid^="staged-die-"]')).toHaveCount(2);
  await page.getByTestId('roll-button').click();
  await expect(page.locator('[data-testid^="staged-die-"]')).toHaveCount(0);

  await page.getByTestId('tray-mode-summed').click();
  await expect(page.getByTestId('tray-adv-advantage')).toHaveText('Drop Lowest');

  // Expanding swaps to the full tray, which mounts the same controls — so each
  // testid still resolves to exactly one element.
  await page.getByTestId('quick-sheet-expand-roll').click();
  await expect(page.getByTestId('tray-modifier')).toHaveCount(1);
  await expect(page.getByTestId('macro-name-input')).toHaveCount(1);
});

test('character quick sheet: no player name, no quick d20', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
  // Both were duplicates of what the top status bar and the Roll sheet carry.
  await expect(page.getByTestId('character-sheet-name')).toHaveCount(0);
  await expect(page.getByTestId('character-quick-d20')).toHaveCount(0);
  await expect(page.getByTestId('presence')).toBeVisible();
});

test('map tools: PNG export, its layer cutoff, Simplify and Add creature are expanded-only', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.getByTestId('quick-sheet-toggle-maptools').click();
  await expect(page.getByTestId('map-undo')).toBeVisible();
  await expect(page.getByTestId('map-export-png')).toHaveCount(0);
  await expect(page.getByTestId('map-export-max-layer')).toHaveCount(0);
  await expect(page.getByTestId('add-creature')).toHaveCount(0);
  // Simplify is fine-tuning, not per-stroke work.
  await expect(page.getByTestId('map-simplify')).toHaveCount(0);

  await page.getByTestId('quick-sheet-expand-maptools').click();
  await expect(page.getByTestId('map-export-png')).toBeVisible();
  await expect(page.getByTestId('map-export-max-layer')).toBeVisible();
  await expect(page.getByTestId('add-creature')).toBeVisible();
  await expect(page.getByTestId('map-simplify')).toBeVisible();
});

test('the map view keeps its pan and zoom across an activity round-trip', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Zoom in on the stage, then leave the Map view and come back. The camera is
  // remembered per map on the shared controller, so the view resumes instead of
  // snapping back to 1:1 (playtest feedback).
  const canvas = page.locator(VECTOR_CANVAS);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('map canvas not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -120);

  await openActivityDrawer(page);
  await page.getByTestId('activity-tab-encounter').click();
  await openActivityDrawer(page);
  await page.getByTestId('activity-tab-map').click();

  const camera = page.getByTestId('map-camera');
  await expect(camera).not.toHaveText('');
  const scale = Number((await camera.textContent())!.split(',')[2]);
  expect(scale).toBeGreaterThan(1);
});
