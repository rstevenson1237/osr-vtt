import { expect, type Page, test } from '@playwright/test';
import { dragCanvas, openActivity, roomIdFromUrl, signInAsReferee, VECTOR_CANVAS } from './helpers';

/**
 * SPEC-038 §§3–5 acceptance (WI-081). Background management is the Assets
 * activity's, not Session config's — this file carries the assertions Gate 19
 * used to make against the retired `session-background-*` block, re-pointed at
 * its `BackgroundsPanel` successor, plus the placement gestures that block
 * never had:
 *  1. a GM places an image, sees it listed, and a second GM client syncs;
 *  2. the solid colour is independent of the images and round-trips;
 *  3. a selected image moves and resizes on the canvas, and a resize keeps the
 *     image's native aspect ratio (§3 — never stretched).
 */

/** The starter map's own pixel dimensions (`public/assets/maps/starter-room.svg`
 * is 1280×960), which is the ratio every resize must preserve. */
const STARTER_ASPECT = 1280 / 960;

/** A deliberately small grid, so the whole placed image — including its
 * bottom-right resize handle — fits inside the canvas the drags run on. At the
 * default 64×64 @ 70px the handle sits thousands of pixels off screen. */
const GRID_CELLS = 6;
const CELL_PX = 40;

async function createRoomAndJoin(page: Page, roomName: string): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill('Referee');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

async function setSmallGrid(page: Page): Promise<void> {
  await openActivity(page, 'session');
  await page.getByTestId('session-grid-w').fill(String(GRID_CELLS));
  await page.getByTestId('session-grid-h').fill(String(GRID_CELLS));
  await page.getByTestId('session-grid-cellsize').fill(String(CELL_PX));
  await page.getByTestId('session-grid-apply').click();
  await page.getByTestId('overlay-close').click();
  await page.getByTestId('session-overlay').waitFor({ state: 'hidden' });
}

/** The id of the single placed background, read off its list row. */
async function onlyBackgroundId(page: Page): Promise<string> {
  const row = page.locator('[data-testid^="background-row-"]');
  await expect(row).toHaveCount(1);
  const testid = await row.getAttribute('data-testid');
  return testid!.replace('background-row-', '');
}

/** Parses the panel's `x, y · w × h` readout back into numbers. */
async function readRect(
  page: Page,
  id: string,
): Promise<{ x: number; y: number; w: number; h: number }> {
  const text = (await page.getByTestId(`background-rect-${id}`).textContent()) ?? '';
  const m = text.match(/^\s*(-?[\d.]+),\s*(-?[\d.]+)\s*·\s*([\d.]+)\s*×\s*([\d.]+)\s*$/);
  if (!m) throw new Error(`Unreadable background rect: ${JSON.stringify(text)}`);
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

test('Gate 19: the GM places, lists and removes background images from the Assets activity, and a second GM client syncs', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const gm2 = await gmContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault');
  await gm2.goto(`/#/r/${roomId}`);
  await expect(gm2.getByTestId('room-name')).toHaveText('The Sunless Vault');

  await openActivity(gm, 'assets');
  await openActivity(gm2, 'assets');

  // A fresh room places no background at all (WI-073): no images, and the
  // solid colour is unset, so the map shows bare rock.
  await expect(gm.getByTestId('backgrounds-empty')).toBeVisible();
  await expect(gm.getByTestId('background-color-current')).toHaveText('None (bare rock)');
  await expect(gm.getByTestId('background-color-clear')).toBeDisabled();

  // Add → the bundled picker offers the starter map; placing it closes the
  // picker and selects the new image for adjusting, which puts the map back on
  // stage (SPEC-038 §5 — selection here, the gesture on the canvas).
  await gm.getByTestId('background-add').click();
  await gm.getByTestId('background-pick-Starter map').click();
  await expect(gm.getByTestId('vector-map-canvas')).toBeVisible();

  await openActivity(gm, 'assets');
  const id = await onlyBackgroundId(gm);
  await expect(gm.getByTestId(`background-label-${id}`)).toHaveText('maps/starter-room.svg');
  // Placed at its native ratio, fitted to the grid — never stretched to the
  // grid's own shape (SPEC-038 §3).
  const placed = await readRect(gm, id);
  expect(placed.w / placed.h).toBeCloseTo(STARTER_ASPECT, 2);

  // The second GM client sees the same placement without reloading.
  await expect(gm2.getByTestId(`background-row-${id}`)).toBeVisible();

  // Fit → the whole grid, the placement the pre-v23 fold gives an upgraded
  // room, and this panel's recovery path from a bad drag.
  await gm.getByTestId(`background-fit-${id}`).click();
  await expect(gm.getByTestId(`background-rect-${id}`)).toHaveText('0, 0 · 64 × 64');

  // The solid colour is independent of the images (SPEC-038 §1): setting it
  // leaves the placed image alone, and it syncs like everything else.
  await gm.getByTestId('background-pick-color-#5582CA').click();
  await expect(gm.getByTestId('background-color-current')).toHaveText('#5582CA');
  await expect(gm2.getByTestId('background-color-current')).toHaveText('#5582CA');
  await expect(gm.getByTestId(`background-row-${id}`)).toBeVisible();
  await gm.getByTestId('background-color-clear').click();
  await expect(gm.getByTestId('background-color-current')).toHaveText('None (bare rock)');
  await expect(gm2.getByTestId('background-color-current')).toHaveText('None (bare rock)');

  // Remove → the image is gone on both clients and the empty hint is back.
  await gm.getByTestId(`background-remove-${id}`).click();
  await expect(gm.getByTestId('backgrounds-empty')).toBeVisible();
  await expect(gm2.getByTestId(`background-row-${id}`)).toHaveCount(0);

  await gmContext.close();
});

test('SPEC-038 §3: a selected background moves on the canvas, and resizing it keeps its native aspect ratio', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'The Sunless Vault');
  await setSmallGrid(gm);

  await openActivity(gm, 'assets');
  await gm.getByTestId('background-add').click();
  await gm.getByTestId('background-pick-Starter map').click();
  // Adding selects the new image and returns to the map, which is where the
  // alignment grid and the move/resize gesture live (SPEC-038 §§3–4).
  await expect(gm.getByTestId('vector-map-canvas')).toBeVisible();

  await openActivity(gm, 'assets');
  const id = await onlyBackgroundId(gm);
  const start = await readRect(gm, id);
  expect(start).toMatchObject({ x: 0, y: 0 });
  // 6 cells wide at the starter map's 4:3 => 6 x 4.5 lattice, 240 x 180 px.
  const handlePx = { x: start.w * CELL_PX, y: start.h * CELL_PX };

  // --- resize: drag the one handle on the bottom-right corner ---
  await openActivity(gm, 'map');
  await dragCanvas(gm, VECTOR_CANVAS, handlePx, { x: handlePx.x + 100, y: handlePx.y + 75 });

  await openActivity(gm, 'assets');
  const resized = await readRect(gm, id);
  expect(resized.w).toBeGreaterThan(start.w);
  // The guarantee the single handle exists to make: both dimensions scaled
  // together from the image's own 4:3, never one of them alone.
  expect(resized.w / resized.h).toBeCloseTo(STARTER_ASPECT, 2);
  expect(resized).toMatchObject({ x: 0, y: 0 });

  // --- move: drag from inside the image; x/y travel, w/h do not ---
  await openActivity(gm, 'map');
  await dragCanvas(gm, VECTOR_CANVAS, { x: 60, y: 50 }, { x: 140, y: 110 });

  await openActivity(gm, 'assets');
  const moved = await readRect(gm, id);
  expect(moved.x).toBeGreaterThan(0);
  expect(moved.y).toBeGreaterThan(0);
  expect(moved.w).toBeCloseTo(resized.w, 5);
  expect(moved.h).toBeCloseTo(resized.h, 5);

  await gmContext.close();
});
