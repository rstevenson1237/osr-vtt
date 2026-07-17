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

  // --- Typed doors (R11.2): the Door tool stamps the palette's selected type
  // on a segment (no more cycling). A secret door is hidden from the player's
  // render while still syncing to both (only the render decision differs). ---
  await gm.getByTestId('map-tool-door').click();
  const doorX = box.x + 100 + CELL; // an edge inside the carved rectangle
  const doorY = box.y + 100 + CELL * 0.5;
  // Default type is 'single' — a normal door everyone can see.
  await gm.mouse.click(doorX, doorY);
  await expect(gm.getByTestId('wall-count')).toHaveText('1');
  await expect(player.getByTestId('wall-count')).toHaveText('1');
  await expect(gm.getByTestId('visible-door-count')).toHaveText('1');
  await expect(player.getByTestId('visible-door-count')).toHaveText('1');
  // Switch to Secret and re-stamp the same segment: the GM still sees it, the
  // player's render hides the passage, but the wall doc itself still syncs.
  await gm.getByTestId('door-type').selectOption('secret');
  await gm.mouse.click(doorX, doorY);
  await expect(gm.getByTestId('visible-door-count')).toHaveText('1'); // GM always sees it
  await expect(player.getByTestId('visible-door-count')).toHaveText('0'); // hidden from the player's render
  await expect(player.getByTestId('wall-count')).toHaveText('1'); // the doc itself still synced

  // --- Undo/redo re-commits through the same store path, so the result
  // syncs to peers exactly like a fresh edit (Gate 1). ---
  await gm.getByTestId('map-undo').click(); // undoes the secret re-stamp -> single
  await gm.getByTestId('map-undo').click(); // undoes the door placement -> no wall
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

test('token status ring: black by default, white on selection, group color for a grouped token — synced live to a second client (WI-24 / Gate 24)', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Ring Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Ring Vault');

  const gmCanvas = gm.locator('[data-testid="map-canvas"] canvas');
  const box = await gmCanvas.boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-select').click();

  // --- Ungrouped token: black by default, white while selected, back to
  // black on deselect. Selection is per-client local-only state, so the
  // player's own view of the same token is unaffected. ---
  await addCreature(gm);
  const tokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(tokenPos).toHaveCount(1);
  const tokenId = (await tokenPos.getAttribute('data-testid'))!.replace('token-pos-', '');
  const gmRing = gm.getByTestId(`token-ring-${tokenId}`);
  const playerRing = player.getByTestId(`token-ring-${tokenId}`);

  await expect(gmRing).toHaveText('#000000');
  await expect(playerRing).toHaveText('#000000');

  await gm.mouse.click(box.x + 160, box.y + 160); // STARTER_DROP_POS
  await expect(gmRing).toHaveText('#ffffff');
  await expect(playerRing).toHaveText('#000000');

  await gm.mouse.click(box.x + 40, box.y + 450); // empty cell: deselect
  await expect(gmRing).toHaveText('#000000');

  // --- A grouped pair of tokens rings in the same group color, on both
  // clients, distinct from black/white. ---
  await addCreature(gm, { count: 2, bundledRef: 'goblin', groupName: 'Goblins' });
  const allTokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(allTokenPos).toHaveCount(3); // the earlier ungrouped token + 2 goblins
  const allIds = await allTokenPos.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid')!.replace('token-pos-', '')),
  );
  const goblinIds = allIds.filter((id) => id !== tokenId);
  expect(goblinIds).toHaveLength(2);

  const ringColor = await gm.getByTestId(`token-ring-${goblinIds[0]}`).textContent();
  expect(ringColor).toMatch(/^hsl\(/);
  expect(ringColor).not.toBe('#000000');
  expect(ringColor).not.toBe('#ffffff');
  // Every member of the group shares the same ring color, on both clients.
  await expect(gm.getByTestId(`token-ring-${goblinIds[1]}`)).toHaveText(ringColor ?? '');
  await expect(player.getByTestId(`token-ring-${goblinIds[0]}`)).toHaveText(ringColor ?? '');
  await expect(player.getByTestId(`token-ring-${goblinIds[1]}`)).toHaveText(ringColor ?? '');

  await gmContext.close();
  await playerContext.close();
});
