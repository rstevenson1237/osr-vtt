import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { addCreature, openActivity, roomIdFromUrl } from './helpers';

/**
 * WI-5a acceptance tests (Master Plan v2, Gate 5a). Spec: R9.2, R9.3, R9.5
 * (+ U12 space-pan, U17 cursor-anchored bounded zoom). Two independent
 * browser contexts against the real Firebase Emulator Suite, covering the
 * gate's four required checks:
 *  1. drag a 6-edge wall run in one gesture (batch-committed on release);
 *  2. place a diagonal wall that blocks LoS;
 *  3. the ruler reflects configured measurement units;
 *  4. a multiline label renders centered on its anchor cell.
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

test('drags a 6-edge wall run in one gesture, batch-committed on release, and erase mode reverses it', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Vault of Runs', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Vault of Runs');

  const gmCanvas = gm.locator('[data-testid="map-canvas"] canvas');
  const box = await gmCanvas.boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-wall').click();

  const startX = box.x + 100;
  const startY = box.y + 100;
  await gm.mouse.move(startX, startY);
  await gm.mouse.down();
  await gm.mouse.move(startX + CELL * 6, startY, { steps: 10 });
  // Still mid-drag: nothing has committed to Firestore yet on either client
  // (same write-discipline invariant the carve stroke already proves).
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  await expect(player.getByTestId('wall-count')).toHaveText('0');
  await gm.mouse.up();

  // One gesture -> exactly 6 edges, synced to the peer.
  await expect(gm.getByTestId('wall-count')).toHaveText('6');
  await expect(player.getByTestId('wall-count')).toHaveText('6');

  // Erase mode drags the same run and removes it, also as one gesture.
  await gm.getByTestId('wall-erase-toggle').check();
  await gm.mouse.move(startX, startY);
  await gm.mouse.down();
  await gm.mouse.move(startX + CELL * 6, startY, { steps: 10 });
  await gm.mouse.up();
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  await expect(player.getByTestId('wall-count')).toHaveText('0');

  await gmContext.close();
  await playerContext.close();
});

test('a wall drag-run carries the selected wall style (not just diagonal walls)', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'Dashed Corridor', 'Referee');
  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-wall').click();
  await gm.getByTestId('wall-style').selectOption('dashed');

  const startX = box.x + 100;
  const startY = box.y + 100;
  await gm.mouse.move(startX, startY);
  await gm.mouse.down();
  await gm.mouse.move(startX + CELL * 3, startY, { steps: 8 });
  await gm.mouse.up();

  // Every edge in the run carries the toolbar's selected style, not just
  // diagonal (vector) walls — previously only the diagonal-wall path
  // recorded a style, so a straight run always fell back to the room
  // default/masonry and never rendered as dashed.
  await expect(gm.getByTestId('wall-count')).toHaveText('3');
  await expect(gm.getByTestId('dashed-wall-count')).toHaveText('3');

  await gmContext.close();
});

test('places a diagonal wall via the Wall tool that blocks dynamic line-of-sight', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Diagonal Crypt', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Diagonal Crypt');

  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  // A viewpoint token + dynamic fog, with no walls yet — nothing is hidden.
  await gm.getByTestId('map-tool-select').click();
  await addCreature(gm);
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(1);

  // Fog mode now lives in Session Config (Master Plan v2, R4).
  await openActivity(gm, 'session');
  await gm.getByTestId('fog-mode-select').selectOption('dynamic');
  await openActivity(gm, 'map');
  await expect(player.getByTestId('fog-mode')).toHaveText('dynamic');
  await expect(player.getByTestId('sight-wall-count')).toHaveText('0');
  await expect(player.getByTestId('los-hidden-count')).toHaveText('0');

  // Drag a non-axis-aligned run with the Wall tool — stored as a diagonal
  // vector wall (SightWall.visible/style), not decomposed into grid edges.
  await gm.getByTestId('map-tool-wall').click();
  await gm.mouse.move(box.x + 100, box.y + 100);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 100 + CELL * 3, box.y + 100 + CELL * 2, { steps: 10 });
  await gm.mouse.up();

  await expect(gm.getByTestId('sight-wall-count')).toHaveText('1');
  await expect(player.getByTestId('sight-wall-count')).toHaveText('1');
  // No grid-aligned walls were written for a diagonal drag.
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  // The diagonal already blocks LoS — some cells become hidden.
  await expect(player.getByTestId('los-hidden-count')).not.toHaveText('0');

  await gmContext.close();
  await playerContext.close();
});

test('a circular wall blocks dynamic LoS and syncs; cutting a gap edits it in place (WI-14, R10.5)', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Ring Chamber', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Ring Chamber');

  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  // A viewpoint token + dynamic fog, no walls yet — nothing is hidden.
  await gm.getByTestId('map-tool-select').click();
  await addCreature(gm);
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
  await openActivity(gm, 'session');
  await gm.getByTestId('fog-mode-select').selectOption('dynamic');
  await openActivity(gm, 'map');
  await expect(player.getByTestId('fog-mode')).toHaveText('dynamic');
  await expect(player.getByTestId('circle-wall-count')).toHaveText('0');
  await expect(player.getByTestId('los-hidden-count')).toHaveText('0');

  // Circle Wall tool: pointer-down = center (snapped), drag = radius, release
  // commits. Placed away from the token so the ring occludes cells behind it.
  const cx = box.x + 100 + CELL * 3;
  const cy = box.y + 100 + CELL * 3;
  await gm.getByTestId('map-tool-wallCircle').click();
  await gm.mouse.move(cx, cy);
  await gm.mouse.down();
  await gm.mouse.move(cx + CELL * 2, cy, { steps: 10 });
  await gm.mouse.up();

  // One ring, synced to the peer, and it blocks LoS (some cells hidden).
  await expect(gm.getByTestId('circle-wall-count')).toHaveText('1');
  await expect(player.getByTestId('circle-wall-count')).toHaveText('1');
  await expect(gm.getByTestId('wall-count')).toHaveText('0');
  await expect(player.getByTestId('los-hidden-count')).not.toHaveText('0');

  // Cut-gap (erase) mode: dragging across the ring erases an arc — an in-place
  // edit of the same doc (count stays 1), not a new/removed ring. The gap
  // passing LoS is proven rigorously in the shared unit tests.
  await gm.getByTestId('wall-erase-toggle').check();
  await gm.mouse.move(cx - CELL * 2, cy);
  await gm.mouse.down();
  await gm.mouse.move(cx + CELL * 2, cy, { steps: 10 });
  await gm.mouse.up();
  await expect(gm.getByTestId('circle-wall-count')).toHaveText('1');
  await expect(player.getByTestId('circle-wall-count')).toHaveText('1');

  await gmContext.close();
  await playerContext.close();
});

test('ruler reflects the room-configured measurement units', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'Metric Vault', 'Referee');
  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  // Defaults, before any change (Master Plan v2, R9.3).
  await expect(gm.getByTestId('measure-summary')).toHaveText('10/feet');

  // Measurement settings now live in Session Config (Master Plan v2, R4).
  await openActivity(gm, 'session');
  await gm.getByTestId('measure-per-square').fill('3');
  await gm.getByTestId('measure-unit').fill('meters');
  await gm.getByTestId('measure-apply').click();
  await openActivity(gm, 'map');
  await expect(gm.getByTestId('measure-summary')).toHaveText('3/meters');

  await gm.getByTestId('map-tool-ruler').click();
  await gm.mouse.move(box.x + 400, box.y + 200);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 400 + CELL * 2, box.y + 200, { steps: 4 });
  await expect(gm.getByTestId('ruler-distance')).toHaveText('2 sq / 6 meters');
  await gm.mouse.up();

  await gmContext.close();
});

test('a multiline label renders centered on its anchor cell', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'Chapel of Echoes', 'Referee');
  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 200, box.y + 200);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 200 + CELL * 3, box.y + 200 + CELL * 3, { steps: 8 });
  await gm.mouse.up();
  await expect(gm.getByTestId('floor-cell-count')).not.toHaveText('0');

  // Click exactly on a cell center — cell (3,3) at 70px cells — so the
  // expected centered pixel position is a clean, known value.
  await gm.getByTestId('map-tool-label').click();
  await gm.mouse.click(box.x + 245, box.y + 245);
  await expect(gm.getByTestId('label-edit-input')).toBeVisible();
  await gm.getByTestId('label-edit-input').fill('Old Chapel\nRuined Nave');
  await gm.getByTestId('label-edit-input').press('Tab');
  await expect(gm.getByTestId('label-edit-input')).toHaveCount(0);

  const nameEl = gm.locator('[data-testid^="maproom-name-"]');
  await expect(nameEl).toHaveCount(1);
  await expect(nameEl).toContainText('Old Chapel');
  await expect(nameEl).toContainText('Ruined Nave');

  const testId = await nameEl.getAttribute('data-testid');
  const mrId = testId?.replace('maproom-name-', '') ?? '';
  // The label container is positioned at the anchor cell's exact center —
  // the R9.5 fix for the old top-left-anchored, single-line rendering (U6).
  await expect(gm.getByTestId(`maproom-label-x-${mrId}`)).toHaveText('245');
  await expect(gm.getByTestId(`maproom-label-y-${mrId}`)).toHaveText('245');

  await gmContext.close();
});

test('a label edits in place on double-click, persists on blur, and deletes with undo (WI-17, R13.1-2)', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'Sunken Archive', 'Referee');
  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 200, box.y + 200);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 200 + CELL * 3, box.y + 200 + CELL * 3, { steps: 8 });
  await gm.mouse.up();
  await expect(gm.getByTestId('floor-cell-count')).not.toHaveText('0');

  await gm.getByTestId('map-tool-label').click();
  await gm.mouse.click(box.x + 245, box.y + 245);
  await expect(gm.getByTestId('label-edit-input')).toBeVisible();
  await gm.getByTestId('label-edit-input').fill('Old Stacks');
  await gm.getByTestId('label-edit-input').press('Tab');
  await expect(gm.getByTestId('label-edit-input')).toHaveCount(0);

  const nameEl = gm.locator('[data-testid^="maproom-name-"]');
  await expect(nameEl).toHaveText('Old Stacks');

  // Double-click the label (no modal) opens an inline overlay editor.
  await gm.getByTestId('map-tool-select').click();
  await gm.mouse.click(box.x + 245, box.y + 245, { clickCount: 2 });
  await expect(gm.getByTestId('label-edit-input')).toBeVisible();

  // Edit and commit on blur (Tab moves focus away) — no modal in the path.
  await gm.getByTestId('label-edit-input').fill('New Stacks');
  await gm.getByTestId('label-edit-input').press('Tab');
  await expect(gm.getByTestId('label-edit-input')).toHaveCount(0);
  await expect(nameEl).toHaveText('New Stacks');

  // Undo restores the prior name; the edit is a real undoable op.
  await gm.getByTestId('map-undo').click();
  await expect(nameEl).toHaveText('Old Stacks');
  await gm.getByTestId('map-redo').click();
  await expect(nameEl).toHaveText('New Stacks');

  // Delete from the inline editor removes the label; undo brings it back.
  await gm.mouse.click(box.x + 245, box.y + 245, { clickCount: 2 });
  await expect(gm.getByTestId('label-edit-input')).toBeVisible();
  await gm.getByTestId('label-delete').click();
  await expect(gm.locator('[data-testid^="maproom-name-"]')).toHaveCount(0);

  await gm.getByTestId('map-undo').click();
  await expect(nameEl).toHaveText('New Stacks');

  await gmContext.close();
});

test('editing a multiline label inline preserves its embedded line break (WI-17)', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'Twin Halls', 'Referee');
  const box = await gm.locator('[data-testid="map-canvas"] canvas').boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 200, box.y + 200);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 200 + CELL * 3, box.y + 200 + CELL * 3, { steps: 8 });
  await gm.mouse.up();
  await expect(gm.getByTestId('floor-cell-count')).not.toHaveText('0');

  await gm.getByTestId('map-tool-label').click();
  await gm.mouse.click(box.x + 245, box.y + 245);
  await gm.getByTestId('label-edit-input').fill('Upper Hall\nLower Hall');
  await gm.getByTestId('label-edit-input').press('Tab');

  const nameEl = gm.locator('[data-testid^="maproom-name-"]');
  await expect(nameEl).toContainText('Upper Hall');
  await expect(nameEl).toContainText('Lower Hall');

  // Double-click opens the inline editor (a `<textarea>`, not `<input>` —
  // a plain text input silently strips embedded `\n` from its value the
  // moment the user types anything, corrupting a multiline name).
  await gm.getByTestId('map-tool-select').click();
  await gm.mouse.click(box.x + 245, box.y + 245, { clickCount: 2 });
  const editor = gm.getByTestId('label-edit-input');
  await expect(editor).toBeVisible();
  // Append to the end rather than replacing the whole value, exercising the
  // same live-typing path that would corrupt a sanitized <input> value.
  await editor.press('End');
  await editor.pressSequentially('!');
  await editor.press('Tab');
  await expect(editor).toHaveCount(0);

  const text = await nameEl.textContent();
  expect(text).toContain('\n');
  await expect(nameEl).toContainText('Upper Hall');
  await expect(nameEl).toContainText('Lower Hall!');

  await gmContext.close();
});
