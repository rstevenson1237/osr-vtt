import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

/**
 * WI-5b acceptance (Master Plan v2, R9.4/R9.6/R9.7 + shape carves). Exercises
 * the new map-geometry surface against the real emulator, across two clients:
 * an ellipse-drag carve rasterizes to floor cells and syncs; the half-grid
 * subdivision toggle is a GM room-doc setting that reaches the player; and the
 * token snap-mode control is present in the tools rail. The rasterizer/snap/
 * natural-render math itself is covered by unit tests (pure functions).
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

test('ellipse carve, half-grid toggle, and snap control (WI-5b)', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Rounded Cave', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Rounded Cave');

  const gmCanvas = gm.locator('[data-testid="map-canvas"] canvas');
  const box = await gmCanvas.boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  const gmFloorCount = gm.getByTestId('floor-cell-count');
  const playerFloorCount = player.getByTestId('floor-cell-count');

  // --- Ellipse carve: drag a bounding box; on release the inscribed ellipse
  // rasterizes to floor cells (a rounded blob, not the full rectangle) and
  // syncs to the peer via the same commit-on-release path as brush carve. ---
  await gm.getByTestId('map-tool-ellipse').click();
  await gm.mouse.move(box.x + 120, box.y + 120);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 120 + CELL * 6, box.y + 120 + CELL * 6, { steps: 8 });
  await expect(gmFloorCount).toHaveText('0'); // nothing commits mid-drag
  await gm.mouse.up();
  await expect(playerFloorCount).not.toHaveText('0');
  const carved = Number(await playerFloorCount.textContent());
  await expect(gmFloorCount).toHaveText(String(carved));
  // Rounded: fewer cells than the full 7×7 bounding rectangle would carve.
  expect(carved).toBeGreaterThan(0);
  expect(carved).toBeLessThan(49);

  // --- Half-grid subdivision: a GM room-doc setting that reaches the player.
  // The toggle now lives in Session Config (Master Plan v2, R4). ---
  await expect(gm.getByTestId('grid-subdivide')).toHaveText('false');
  await expect(player.getByTestId('grid-subdivide')).toHaveText('false');
  await openActivity(gm, 'session');
  await gm.getByTestId('grid-subdivide-toggle').check();
  await openActivity(gm, 'map');
  await expect(gm.getByTestId('grid-subdivide')).toHaveText('true');
  await expect(player.getByTestId('grid-subdivide')).toHaveText('true');

  // --- Token snap-mode control (R9.7): cell by default, selectable to half/free. ---
  const snap = gm.getByTestId('token-snap-mode');
  await expect(snap).toHaveValue('cell');
  await snap.selectOption('half');
  await expect(snap).toHaveValue('half');

  await gmContext.close();
  await playerContext.close();
});
