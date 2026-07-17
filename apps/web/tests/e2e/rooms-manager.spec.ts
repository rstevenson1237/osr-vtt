import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

/**
 * WI-20 acceptance (Master Plan v2, Gate 20 · R17.2 / R13.3). The Rooms
 * manager in the Assets activity lets a GM rename, renumber, reorder, jump-to
 * and delete `MapRoom`s; renumber keeps keys unique and is undoable; a second
 * client sees the changes sync.
 */

const CELL = 70; // Room.grid.cellSize default (DEFAULT_GRID_CONFIG)

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

/** Carves a small region and drops a keyed label at the given cell-center. */
async function addLabel(page: Page, box: { x: number; y: number }, at: { x: number; y: number }, name: string): Promise<void> {
  await page.getByTestId('map-tool-label').click();
  await page.mouse.click(box.x + at.x, box.y + at.y);
  await expect(page.getByTestId('prompt-dialog')).toBeVisible();
  await page.getByTestId('prompt-input').fill(name);
  await page.getByTestId('prompt-confirm').click();
  await expect(page.getByTestId('prompt-dialog')).toHaveCount(0);
}

test('GM renames, renumbers, jumps-to and deletes rooms; renumber stays unique + undoable; syncs', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Dungeon of WI-20', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Dungeon of WI-20');

  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  // Carve a floor region, then drop two keyed labels → two MapRooms (1, 2).
  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 140, box.y + 140);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 140 + CELL * 4, box.y + 140 + CELL * 4, { steps: 10 });
  await gm.mouse.up();
  await expect(gm.getByTestId('floor-cell-count')).not.toHaveText('0');

  await addLabel(gm, box, { x: 175, y: 175 }, 'Entry Hall');
  await addLabel(gm, box, { x: 315, y: 315 }, 'Guard Post');

  // Open the Rooms manager in the Assets activity — both rooms are listed.
  await openActivity(gm, 'assets');
  await expect(gm.getByTestId('rooms-panel')).toBeVisible();
  const row1 = gm.locator('[data-testid^="room-key-"]', { hasText: '1' }).first();
  await expect(row1).toBeVisible();
  await expect(gm.locator('[data-testid^="room-name-"]').filter({ hasText: 'Entry Hall' })).toHaveCount(1);
  await expect(gm.locator('[data-testid^="room-name-"]').filter({ hasText: 'Guard Post' })).toHaveCount(1);

  // Resolve the two rows' ids from their name testids.
  const entryId = (await gm
    .locator('[data-testid^="room-name-"]')
    .filter({ hasText: 'Entry Hall' })
    .getAttribute('data-testid'))!.replace('room-name-', '');
  const guardId = (await gm
    .locator('[data-testid^="room-name-"]')
    .filter({ hasText: 'Guard Post' })
    .getAttribute('data-testid'))!.replace('room-name-', '');

  // ---- Rename (Entry Hall → Grand Foyer) ----
  await gm.getByTestId(`room-edit-${entryId}`).click();
  await gm.getByTestId(`room-edit-name-${entryId}`).fill('Grand Foyer');
  await gm.getByTestId(`room-edit-save-${entryId}`).click();
  await expect(gm.getByTestId(`room-name-${entryId}`)).toHaveText('Grand Foyer');
  // Syncs to the player's manager.
  await openActivity(player, 'assets');
  await expect(player.getByTestId(`room-name-${entryId}`)).toHaveText('Grand Foyer');

  // ---- Renumber: a duplicate key is rejected; a free key is accepted ----
  await gm.getByTestId(`room-edit-${entryId}`).click();
  await gm.getByTestId(`room-edit-key-${entryId}`).fill('2'); // Guard Post already holds 2
  await expect(gm.getByTestId(`room-edit-error-${entryId}`)).toBeVisible();
  await expect(gm.getByTestId(`room-edit-save-${entryId}`)).toBeDisabled();
  await gm.getByTestId(`room-edit-key-${entryId}`).fill('5'); // free
  await expect(gm.getByTestId(`room-edit-error-${entryId}`)).toHaveCount(0);
  await gm.getByTestId(`room-edit-save-${entryId}`).click();
  await expect(gm.getByTestId(`room-key-${entryId}`)).toHaveText('5');

  // Undo the renumber (panel-local history) — the key returns to 1.
  await gm.getByTestId('rooms-undo').click();
  await expect(gm.getByTestId(`room-key-${entryId}`)).toHaveText('1');
  await gm.getByTestId('rooms-redo').click();
  await expect(gm.getByTestId(`room-key-${entryId}`)).toHaveText('5');

  // ---- Jump-to switches to the Map activity ----
  await gm.getByTestId(`room-jump-${guardId}`).click();
  await expect(gm.getByTestId('map-canvas')).toBeVisible();
  await expect(gm.getByTestId('rooms-panel')).toHaveCount(0);

  // ---- Delete (with confirm), then undo restores it ----
  await openActivity(gm, 'assets');
  await gm.getByTestId(`room-delete-${guardId}`).click();
  await expect(gm.getByTestId('confirm-dialog')).toBeVisible();
  await gm.getByTestId('confirm-dialog-confirm').click();
  await expect(gm.getByTestId(`room-name-${guardId}`)).toHaveCount(0);

  await gm.getByTestId('rooms-undo').click();
  await expect(gm.getByTestId(`room-name-${guardId}`)).toHaveText('Guard Post');

  await gmContext.close();
  await playerContext.close();
});
