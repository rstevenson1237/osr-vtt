import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * Phase 4 acceptance test (Plan §7 — Gate 4). Two independent browser contexts
 * against the real Firebase Emulator Suite. Covers the four gate conditions:
 *  1. a Blind-Drawer result stays unreadable by players until revealed;
 *  2. a nested random table resolves and pushes to chat (the Action Log);
 *  3. the global Difficulty + Danger Die widgets update for everyone;
 *  4. an imported `.uvtt` blocks vision behind its walls (dynamic LoS fog).
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

async function joinRoom(page: Page, roomId: string, displayName: string): Promise<void> {
  await page.goto(`/#/r/${roomId}`);
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
}

test('Gate 4: referee engine — blind draws, nested tables, tension widgets, and .uvtt LoS', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Howling Deep', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Howling Deep');

  // Both to the Encounter Board.
  await gm.getByTestId('stage-tab-board').click();
  await player.getByTestId('stage-tab-board').click();

  // --- 3. Difficulty + Danger widgets update for everyone ---
  await gm.getByTestId('difficulty-die-select').selectOption('d8');
  await expect(gm.getByTestId('difficulty-die-value')).toHaveText('d8');
  await expect(player.getByTestId('difficulty-die-value')).toHaveText('d8');

  await gm.getByTestId('danger-clock-size-4').click();
  await gm.getByTestId('danger-clock-advance').click();
  await expect(gm.getByTestId('danger-clock-count')).toHaveText('1/4');
  await expect(player.getByTestId('danger-clock-count')).toHaveText('1/4');

  // Players cannot drive the widgets (GM-only controls).
  await expect(player.getByTestId('difficulty-die-select')).toHaveCount(0);

  // --- 2. A nested table resolves and pushes to chat ---
  await gm.getByTestId('load-sample-tables').click();
  const wanderingRow = gm.locator('[data-testid^="table-row-"]', { hasText: 'Wandering Monsters' });
  await expect(wanderingRow).toHaveCount(1);
  await wanderingRow.locator('[data-testid^="table-roll-"]').click();

  // The resolved result lands in the shared Action Log for the player, with
  // every nested `[[…]]` token expanded (no raw tokens survive).
  await expect(player.getByTestId('action-log')).toContainText('Wandering Monsters:');
  await expect(player.getByTestId('action-log')).not.toContainText('[[');

  // --- 1. A Blind-Drawer result is hidden from players until revealed ---
  const SECRET = 'XYZZY-SECRET-AMBUSH';
  // The Blind Drawer panel is GM-only; a player never even sees the control.
  await expect(player.getByTestId('blind-drawer')).toHaveCount(0);

  await gm.getByTestId('blind-draw-title').fill('Ambush check');
  await gm.getByTestId('blind-draw-note').fill(SECRET);
  await gm.getByTestId('blind-draw-note-add').click();

  // GM sees the stashed result; the player's page contains it nowhere yet.
  await expect(gm.getByText(SECRET)).toHaveCount(1);
  await expect(player.getByTestId('action-log')).not.toContainText(SECRET);
  await expect(player.locator('body')).not.toContainText(SECRET);

  // Reveal → it is copied into the shared log and becomes readable by the player.
  await gm.locator('[data-testid^="blind-draw-reveal-"]').first().click();
  await expect(player.getByTestId('action-log')).toContainText(SECRET);

  // --- 4. An imported .uvtt blocks vision behind walls (dynamic LoS) ---
  await gm.getByTestId('stage-tab-map').click();
  await player.getByTestId('stage-tab-map').click();

  // GM drops a viewpoint token, then switches fog to dynamic line-of-sight.
  await gm.getByTestId('drop-token').click();
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
  await gm.getByTestId('fog-mode-select').selectOption('dynamic');

  // Before any walls: with a viewpoint and an open map, nothing is hidden.
  await expect(player.getByTestId('fog-mode')).toHaveText('dynamic');
  await expect(player.getByTestId('sight-wall-count')).toHaveText('0');
  await expect(player.getByTestId('los-hidden-count')).toHaveText('0');

  // Import the bundled sample dungeon — its wall now blocks sight.
  await gm.getByTestId('import-sample-uvtt').click();
  await expect(player.getByTestId('sight-wall-count')).not.toHaveText('0');
  await expect(player.getByTestId('los-hidden-count')).not.toHaveText('0');

  await gmContext.close();
  await playerContext.close();
});
