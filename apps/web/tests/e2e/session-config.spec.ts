import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

/**
 * Gate 6 acceptance tests (Master Plan v2, R4 — Session Config + player
 * management). Two independent browser contexts (GM, player) against the
 * real Firebase Emulator Suite, plus a second same-context GM tab where a
 * setting's sync needs to be observed by a *second client* without leaving
 * the GM-only Session activity:
 *  1. every Session setting round-trips and syncs to a second client;
 *  2. removing a player ejects their live session to the join gate;
 *  3. GM transfer: old GM loses gmOnly UI, new GM gains it — nothing
 *     GM-only leaks to players.
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

async function joinRoom(page: Page, roomId: string, displayName: string): Promise<void> {
  await page.goto(`/#/r/${roomId}`);
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
}

test('Gate 6: every Session setting round-trips and syncs to a second client', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');

  // A second tab in the *same* browser context shares the GM's anonymous auth
  // session (same uid, already a seated GM) — a genuine second client that
  // can still reach the GM-only Session activity.
  const gm2 = await gmContext.newPage();
  await gm2.goto(`/#/r/${roomId}`);
  await expect(gm2.getByTestId('room-name')).toHaveText('The Sunless Vault');

  await openActivity(gm, 'session');
  await openActivity(gm2, 'session');

  // --- Room: name, theme ---
  await gm.getByTestId('session-room-name').fill('The Sunlit Vault');
  await gm.getByTestId('session-room-name').blur();
  await expect(gm2.getByTestId('session-room-name')).toHaveValue('The Sunlit Vault');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunlit Vault');

  await gm.getByTestId('session-theme-select').selectOption('keyed-blue');
  await expect(gm2.getByTestId('session-theme-select')).toHaveValue('keyed-blue');
  await expect(player.locator('html')).toHaveAttribute('data-theme', 'keyed-blue');

  // --- Grid & measurement ---
  await gm.getByTestId('session-grid-w').fill('96');
  await gm.getByTestId('session-grid-h').fill('48');
  await gm.getByTestId('session-grid-cellsize').fill('50');
  await gm.getByTestId('session-grid-apply').click();
  await expect(gm2.getByTestId('session-grid-w')).toHaveValue('96');
  await expect(gm2.getByTestId('session-grid-h')).toHaveValue('48');
  await expect(gm2.getByTestId('session-grid-cellsize')).toHaveValue('50');

  await gm.getByTestId('grid-subdivide-toggle').check();
  await expect(gm2.getByTestId('grid-subdivide-toggle')).toBeChecked();
  await openActivity(player, 'map');
  await expect(player.getByTestId('grid-subdivide')).toHaveText('true');

  await gm.getByTestId('measure-per-square').fill('3');
  await gm.getByTestId('measure-unit').fill('meters');
  await gm.getByTestId('measure-apply').click();
  await expect(gm2.getByTestId('measure-per-square')).toHaveValue('3');
  await expect(gm2.getByTestId('measure-unit')).toHaveValue('meters');
  await expect(player.getByTestId('measure-summary')).toHaveText('3/meters');

  // --- Tension defaults ---
  await gm.getByTestId('session-difficulty-die').fill('d8');
  await gm.getByTestId('session-danger-die').fill('d10');
  await gm.getByTestId('session-tension-apply').click();
  await expect(gm2.getByTestId('session-difficulty-die')).toHaveValue('d8');
  await expect(gm2.getByTestId('session-danger-die')).toHaveValue('d10');

  await gmContext.close();
  await playerContext.close();
});

test('Gate 19: GM can change and remove the managed background, and it syncs to a second GM client', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const gm2 = await gmContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await gm2.goto(`/#/r/${roomId}`);
  await expect(gm2.getByTestId('room-name')).toHaveText('The Sunless Vault');

  await openActivity(gm, 'session');
  await openActivity(gm2, 'session');

  // A fresh room seeds the starter map as its managed background (post-migration
  // default), and the Remove button is enabled while a background is set.
  await expect(gm.getByTestId('session-background-current')).toHaveText('maps/starter-room.svg');
  await expect(gm.getByTestId('session-background-remove')).toBeEnabled();

  // Change → the bundled picker exposes the starter map; picking it re-sets the
  // background and closes the picker.
  await gm.getByTestId('session-background-change').click();
  await gm.getByTestId('session-background-pick-Starter map').click();
  await expect(gm.getByTestId('session-background-picker')).toHaveCount(0);
  await expect(gm.getByTestId('session-background-current')).toHaveText('maps/starter-room.svg');

  // Remove → background clears to null (bare rock); the readout syncs to the
  // second GM client and the Remove button disables (nothing left to clear).
  await gm.getByTestId('session-background-remove').click();
  await expect(gm.getByTestId('session-background-current')).toHaveText('None (bare rock)');
  await expect(gm2.getByTestId('session-background-current')).toHaveText('None (bare rock)');
  await expect(gm.getByTestId('session-background-remove')).toBeDisabled();

  await gmContext.close();
});

test('Gate 13: Session section-nav stays on the room URL and theme syncs to a second client', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const gm2 = await gmContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await gm2.goto(`/#/r/${roomId}`);
  await expect(gm2.getByTestId('room-name')).toHaveText('The Sunless Vault');

  await openActivity(gm, 'session');

  const sectionIds = [
    'session-room',
    'session-grid',
    'session-template',
    'session-tension',
    'session-players',
    'session-maintenance',
  ];
  for (const id of sectionIds) {
    await gm.getByTestId(`session-nav-${id}`).click();
    await expect(gm).toHaveURL(new RegExp(`#/r/${roomId}$`));
  }

  await gm.getByTestId('session-theme-select').selectOption('keyed-blue');
  await expect(gm2.locator('html')).toHaveAttribute('data-theme', 'keyed-blue');

  await gmContext.close();
});

test('Gate 6: removing a player ejects their live session to the join gate', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');

  await openActivity(gm, 'session');
  const removeButton = gm.locator('[data-testid^="player-remove-"]:not([data-testid*="confirm"])');
  await removeButton.click();
  await gm.locator('[data-testid^="player-remove-confirm-yes-"]').click();

  // The removed player's own client falls back to the join gate reactively —
  // no reload, no explicit "kick" signal, just their seat doc disappearing.
  await expect(player.getByTestId('join-display-name')).toBeVisible({ timeout: 10_000 });

  await gmContext.close();
  await playerContext.close();
});

test('Gate 6: GM transfer — old GM loses gmOnly UI, new GM gains it; nothing GM-only leaks to players', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');
  await expect(gm.getByTestId('my-role')).toHaveText('gm');
  await expect(player.getByTestId('my-role')).toHaveText('player');

  // Nothing GM-only leaks to players: the Session settings gear, and the map's
  // GM-only "Add creature" control, are both absent before any transfer. (The
  // vector *editing* toolbar itself is intentionally shared — SPEC §1's "all
  // room members can write" trust model — so token creation is the GM-only map
  // control we assert on here, replacing the old cellular `referee-map-tools`
  // group that the hard cutover removed.)
  await expect(player.getByTestId('session-shortcut')).toHaveCount(0);
  await expect(player.getByTestId('add-creature')).toHaveCount(0);
  await expect(gm.getByTestId('session-shortcut')).toHaveCount(1);

  await openActivity(gm, 'session');
  await gm.locator('[data-testid^="player-transfer-"]').first().click();
  await gm.getByTestId('confirm-dialog-confirm').click(); // first confirm
  await gm.getByTestId('confirm-dialog-confirm').click(); // second confirm

  // The old GM is immediately demoted: role flips, the gear disappears, and
  // the open Session settings modal is force-closed (RoomShell's
  // player-must-never-see-Session effect now also applies to them).
  await expect(gm.getByTestId('my-role')).toHaveText('player');
  await expect(gm.getByTestId('session-shortcut')).toHaveCount(0);
  await expect(gm.getByTestId('session-overlay')).toHaveCount(0);

  // The new GM gains the gear and every GM-only control behind it.
  await expect(player.getByTestId('my-role')).toHaveText('gm');
  await expect(player.getByTestId('session-shortcut')).toHaveCount(1);
  await openActivity(player, 'session');
  await expect(player.getByTestId('players-panel')).toBeVisible();

  await gmContext.close();
  await playerContext.close();
});
