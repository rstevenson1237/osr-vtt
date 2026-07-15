import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * WI-12 hardening: broadened e2e coverage over the Activity Shell itself
 * (Master Plan v2, R1 / WI-2/WI-3, Gate 12) rather than any single activity's
 * content. The feature specs (dice-profiles, two-context, session-config,
 * etc.) already exercise flyouts and activity switches incidentally as a means
 * to an end; this suite targets the shell mechanics directly: every activity
 * tab, the keyboard digit shortcuts, mini-card flyout open/toggle/replace/
 * dismiss (scrim + Escape), the Tools rail and Log drawer collapse state
 * (persisted to localStorage, Plan R1.3), and the shortcuts sheet.
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

test('desktop shell: every activity tab switches the stage', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  // Stage-switching activities (no mini-card): map, encounter, log, assets,
  // session (GM-only).
  await page.getByTestId('activity-tab-encounter').click();
  await expect(page.getByTestId('encounter-board')).toBeVisible();

  await page.getByTestId('activity-tab-log').click();
  await expect(page.getByTestId('log-activity')).toBeVisible();

  await page.getByTestId('activity-tab-assets').click();
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await page.getByTestId('activity-tab-session').click();
  await expect(page.getByTestId('session-activity')).toBeVisible();

  await page.getByTestId('activity-tab-map').click();
  await expect(page.locator('[data-testid="map-canvas"] canvas')).toBeVisible();
});

test('desktop shell: 1-7 keyboard shortcuts switch activity in rail order', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Rail order for a GM: map, assets, encounter, dice, log, characters, session.
  const order: { digit: string; stageTestId: string }[] = [
    { digit: '2', stageTestId: 'assets-activity' },
    { digit: '5', stageTestId: 'log-activity' },
    { digit: '7', stageTestId: 'session-activity' },
    { digit: '1', stageTestId: 'map-canvas' },
  ];
  for (const { digit, stageTestId } of order) {
    await page.keyboard.press(digit);
    if (stageTestId === 'map-canvas') {
      await expect(page.locator('[data-testid="map-canvas"] canvas')).toBeVisible();
    } else {
      await expect(page.getByTestId(stageTestId)).toBeVisible();
    }
  }
});

test('desktop shell: mini-card flyouts toggle, replace each other, and dismiss via scrim/Escape', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Opening a mini-card activity while a different activity is on stage docks
  // its flyout without leaving the current stage.
  await page.getByTestId('activity-tab-dice').click();
  await expect(page.getByTestId('activity-tab-dice')).toHaveClass(/open/);
  await expect(page.locator('[data-testid="map-canvas"] canvas')).toBeVisible();

  // Clicking the same tab again toggles the flyout closed.
  await page.getByTestId('activity-tab-dice').click();
  await expect(page.getByTestId('activity-tab-dice')).not.toHaveClass(/open/);

  // Opening a second mini-card activity replaces the first — exactly one
  // flyout open per rail (R1.3).
  await page.getByTestId('activity-tab-dice').click();
  await expect(page.getByTestId('activity-tab-dice')).toHaveClass(/open/);
  await page.getByTestId('activity-tab-characters').click();
  await expect(page.getByTestId('activity-tab-characters')).toHaveClass(/open/);
  await expect(page.getByTestId('activity-tab-dice')).not.toHaveClass(/open/);

  // The stage-scrim (shown behind an open flyout) closes it on click.
  await page.locator('.stage-scrim').click();
  await expect(page.getByTestId('activity-tab-characters')).not.toHaveClass(/open/);

  // Escape closes an open flyout too.
  await page.getByTestId('activity-tab-dice').click();
  await expect(page.getByTestId('activity-tab-dice')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('activity-tab-dice')).not.toHaveClass(/open/);
});

test('desktop shell: Tools rail and Log drawer collapse state persists across reload', async ({ page }) => {
  const roomId = await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  // Map is on stage by default and publishes tools, so the Tools rail starts
  // expanded (Gate 2).
  await expect(page.getByTestId('tools-rail')).not.toHaveClass(/collapsed/);
  await page.getByTestId('tools-collapse').click();
  await expect(page.getByTestId('tools-rail')).toHaveClass(/collapsed/);

  // The Log drawer (peek ticker) expands on toggle.
  await page.getByTestId('log-ticker').click();
  await expect(page.getByTestId('log-peek')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('room-name')).toHaveText('The Glass Ossuary');
  await expect(page.getByTestId('tools-rail')).toHaveClass(/collapsed/);
  await expect(page.getByTestId('log-peek')).toBeVisible();

  // Toggling back off also persists.
  await page.getByTestId('tools-expand').click();
  await page.getByTestId('log-peek-collapse').click();
  await page.reload();
  await expect(page.getByTestId('room-name')).toHaveText('The Glass Ossuary');
  await expect(page.getByTestId('tools-rail')).not.toHaveClass(/collapsed/);
  await expect(page.getByTestId('log-peek')).toHaveCount(0);
  void roomId;
});

test('desktop shell: "?" opens the shortcut sheet, Escape closes it', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcut-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0);
});

test('desktop shell: "L" focuses the chat input, expanding the drawer if needed', async ({ page }) => {
  await createRoomAndJoin(page, 'The Glass Ossuary', 'Referee');

  await expect(page.getByTestId('log-peek')).toHaveCount(0);
  await page.keyboard.press('l');
  await expect(page.getByTestId('log-peek')).toBeVisible();
  await expect(page.getByTestId('chat-text-drawer')).toBeFocused();
});
