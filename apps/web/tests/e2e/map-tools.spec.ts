import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { addCreature, roomIdFromUrl } from './helpers';

/**
 * Phase 1 acceptance test (Plan §7, VTT_Map_Tooling_Spec.md). Two independent
 * browser contexts against the real Firebase Emulator Suite, exercising the
 * cellular map editor end to end: carve syncs with RTDB-preview /
 * commit-on-release, wall+door placement (with secret-door render gating),
 * undo/redo re-commit, the ruler, ping + live cursors, the manual FoW
 * eraser, and the token scale slider.
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

test('GM and player stay in sync across the cellular map tools', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');

  const gmCanvas = gm.locator('[data-testid="map-canvas"] canvas');
  const box = await gmCanvas.boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  const gmFloorCount = gm.getByTestId('floor-cell-count');
  const playerFloorCount = player.getByTestId('floor-cell-count');

  // --- Carve: RTDB preview streams while dragging; ONE Firestore chunk
  // commit lands on release, never per-cell (Spec §7 write discipline). ---
  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 100, box.y + 100);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 100 + CELL * 3, box.y + 100 + CELL * 2, { steps: 8 });
  // Still mid-drag: nothing has committed to Firestore yet on either client.
  await expect(gmFloorCount).toHaveText('0');
  await expect(playerFloorCount).toHaveText('0');
  await gm.mouse.up();
  await expect(playerFloorCount).not.toHaveText('0');
  const carvedCount = await playerFloorCount.textContent();
  await expect(gmFloorCount).toHaveText(carvedCount ?? '');
  expect(Number(carvedCount)).toBeGreaterThan(0);

  // --- Wall + door, including a secret door hidden from the player's own
  // render (data still syncs to both — only the render decision differs). ---
  await gm.getByTestId('map-tool-door').click();
  const doorX = box.x + 100 + CELL; // an edge inside the carved rectangle
  const doorY = box.y + 100 + CELL * 0.5;
  await gm.mouse.click(doorX, doorY); // -> closed, not secret
  await expect(gm.getByTestId('wall-count')).toHaveText('1');
  await expect(player.getByTestId('wall-count')).toHaveText('1');
  await gm.mouse.click(doorX, doorY); // -> open, not secret
  await gm.mouse.click(doorX, doorY); // -> closed, secret
  await expect(gm.getByTestId('visible-door-count')).toHaveText('1'); // GM always sees it
  await expect(player.getByTestId('visible-door-count')).toHaveText('0'); // hidden from the player's render
  await expect(player.getByTestId('wall-count')).toHaveText('1'); // the doc itself still synced

  // --- Undo/redo re-commits through the same store path, so the result
  // syncs to peers exactly like a fresh edit (Gate 1). ---
  await gm.getByTestId('map-undo').click(); // undoes the secret-door cycle
  await gm.getByTestId('map-undo').click(); // undoes the open-door cycle
  await gm.getByTestId('map-undo').click(); // undoes the wall/door placement entirely
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  await expect(player.getByTestId('wall-count')).toHaveText('0');
  await gm.getByTestId('map-redo').click();
  await expect(gm.getByTestId('wall-count')).toHaveText('1');
  await expect(player.getByTestId('wall-count')).toHaveText('1');

  // Undo the redo back to no wall, then undo the carve itself, then redo it
  // — proves carve -> undo -> redo all sync (Gate 1 "draw -> undo -> redo").
  await gm.getByTestId('map-undo').click();
  await gm.getByTestId('map-undo').click(); // back to zero floor cells
  await expect(playerFloorCount).toHaveText('0');
  await gm.getByTestId('map-redo').click(); // carve returns
  await expect(playerFloorCount).toHaveText(carvedCount ?? '');
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  await expect(player.getByTestId('wall-count')).toHaveText('0');

  // --- Ruler measures in grid units (default 10/feet — Master Plan v2, R9.3
  // deliberately replaces the old implicit 5-ft assumption). ---
  await gm.getByTestId('map-tool-ruler').click();
  await gm.mouse.move(box.x + 400, box.y + 200);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 400 + CELL * 3, box.y + 200, { steps: 4 });
  await expect(gm.getByTestId('ruler-distance')).toHaveText('3 sq / 30 feet');
  await gm.mouse.up();

  // --- Ping + live cursor ride RTDB. ---
  await gm.getByTestId('map-tool-ping').click();
  await gm.mouse.click(box.x + 400, box.y + 250);
  await expect(gm.getByTestId('ping-count')).not.toHaveText('0');
  await expect(player.getByTestId('ping-count')).not.toHaveText('0');
  await gm.mouse.move(box.x + 420, box.y + 260);
  await expect(player.getByTestId('peer-cursor-count')).toHaveText('1');

  // --- Manual FoW eraser reveals only where erased. ---
  await gm.getByTestId('map-tool-fogEraser').click();
  await expect(gm.getByTestId('revealed-count')).toHaveText('0');
  await gm.mouse.move(box.x + 105, box.y + 105);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 105 + CELL, box.y + 105, { steps: 4 });
  await gm.mouse.up();
  await expect(gm.getByTestId('revealed-count')).not.toHaveText('0');
  const revealedCount = await gm.getByTestId('revealed-count').textContent();
  await expect(player.getByTestId('revealed-count')).toHaveText(revealedCount ?? '');
  expect(Number(revealedCount)).toBeLessThan(Number(carvedCount)); // only swept cells, not the whole room

  // --- Token scale slider (1x1-3x3), synced to the peer. ---
  await gm.getByTestId('map-tool-select').click();
  await addCreature(gm);
  const tokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(tokenPos).toHaveCount(1);
  const tokenTestId = await tokenPos.getAttribute('data-testid'); // "token-pos-<id>"
  const tokenId = tokenTestId?.replace('token-pos-', '') ?? '';
  await gm.mouse.click(box.x + 160, box.y + 160); // STARTER_DROP_POS
  const slider = gm.getByTestId('token-scale-slider');
  await expect(slider).toBeVisible();
  await slider.focus();
  await gm.keyboard.press('ArrowRight'); // min=1 max=3 step=1 -> 1 to 2
  await expect(gm.getByTestId('selected-token-size')).toHaveText('2');
  await expect(gm.getByTestId(`token-size-${tokenId}`)).toHaveText('2');
  await expect(player.getByTestId(`token-size-${tokenId}`)).toHaveText('2');

  await gmContext.close();
  await playerContext.close();
});
