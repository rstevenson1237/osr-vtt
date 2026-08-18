import { expect, type Page, test } from '@playwright/test';
import {
  dragCanvas,
  openActivity,
  roomIdFromUrl,
  selectMapTool,
  signInAsReferee,
  switchToEditMode,
  VECTOR_CANVAS,
} from './helpers';

/**
 * SPEC-038 §§3–5 acceptance (WI-081), amended by SPEC-039 §§1–3 (WI-084,
 * WI-085, WI-086). Background management is the Assets activity's, not
 * Session config's — this file carries the assertions Gate 19 used to make
 * against the retired `session-background-*` block, re-pointed at its
 * `BackgroundsPanel` successor, plus the placement gestures that block never
 * had:
 *  1. a GM places an image, sees it listed, and a second GM client syncs;
 *  2. the solid colour is independent of the images and round-trips;
 *  3. the Select tool picks an unlocked background up on the canvas — a press
 *     selects and starts moving or resizing it in one gesture; a corner
 *     resize keeps the image's native aspect ratio (never stretched), and an
 *     edge resize moves one dimension only (stretching it).
 *
 * SPEC-039 §1 (WI-084) adds a fourth: the per-row lock toggle, a *stored*
 * property of the image that both referee clients see the same way.
 *
 * SPEC-039 §2 (WI-085) retired `background-adjust-{id}` and the
 * `MapToolController.selectedBackgroundId` panel⇄canvas bridge it drove
 * (DEC-070): the assertions the third case used to make against that button
 * now drive the Select tool directly (RULE-005).
 *
 * SPEC-039 §3 (WI-086) reverses SPEC-038 §3's single ratio-locked handle with
 * eight: four corners (still ratio-locked) and four edge midpoints (free on
 * their one axis) — the capability an edge case below exercises.
 */

/** The starter map's own pixel dimensions (`public/assets/maps/starter-room.svg`
 * is 1280×960), which is the ratio every corner resize must preserve. */
const STARTER_ASPECT = 1280 / 960;

/** A deliberately small grid, so the whole placed image — including its
 * resize handles — fits inside the canvas the drags run on. At the default
 * 64×64 @ 70px a handle sits thousands of pixels off screen. */
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
  // picker and puts the map back on stage (SPEC-038 §5) — navigation only
  // since WI-085; the Select tool is what picks the image up (SPEC-039 §2).
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

  // Lock → a stored property of the image (SPEC-039 §1), not a per-viewer
  // mode: a newly placed image starts unlocked, the toggle pins it, and the
  // second GM client sees the same state without reloading.
  await expect(gm.getByTestId(`background-lock-${id}`)).toHaveText('🔓 Unlocked');
  await expect(gm2.getByTestId(`background-lock-${id}`)).toHaveText('🔓 Unlocked');
  await gm.getByTestId(`background-lock-${id}`).click();
  await expect(gm.getByTestId(`background-lock-${id}`)).toHaveText('🔒 Locked');
  await expect(gm2.getByTestId(`background-lock-${id}`)).toHaveText('🔒 Locked');
  // Unlocking is the only override — there is no modifier key (SPEC-039 §4).
  await gm.getByTestId(`background-lock-${id}`).click();
  await expect(gm.getByTestId(`background-lock-${id}`)).toHaveText('🔓 Unlocked');
  await expect(gm2.getByTestId(`background-lock-${id}`)).toHaveText('🔓 Unlocked');

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

test('SPEC-039 §2: the Select tool picks an unlocked background up on the canvas, and resizing it keeps its native aspect ratio', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'The Sunless Vault');
  await setSmallGrid(gm);

  await openActivity(gm, 'assets');
  await gm.getByTestId('background-add').click();
  await gm.getByTestId('background-pick-Starter map').click();
  // Add returns to the map — navigation only (DEC-070): it no longer selects
  // the image, since Select is what picks it up now, not the retired "Adjust
  // on map" button.
  await expect(gm.getByTestId('vector-map-canvas')).toBeVisible();

  await openActivity(gm, 'assets');
  const id = await onlyBackgroundId(gm);
  const start = await readRect(gm, id);
  expect(start).toMatchObject({ x: 0, y: 0 });
  // 6 cells wide at the starter map's 4:3 => 6 x 4.5 lattice, 240 x 180 px.
  const handlePx = { x: start.w * CELL_PX, y: start.h * CELL_PX };

  await openActivity(gm, 'map');
  await switchToEditMode(gm);
  await selectMapTool(gm, 'vector-tool-select');

  // --- resize: drag the one handle on the bottom-right corner. The image
  // isn't selected yet — the press itself picks it up and starts the resize
  // in the same gesture, one click one gesture like every other Select
  // object (SPEC-039 §2). ---
  await dragCanvas(gm, VECTOR_CANVAS, handlePx, { x: handlePx.x + 100, y: handlePx.y + 75 });
  await expect(gm.getByTestId('selected-object')).toHaveText(`background:${id}`);

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

test('SPEC-039 §3: dragging an edge handle stretches one axis only, breaking the native ratio', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'The Sunless Vault');
  await setSmallGrid(gm);

  await openActivity(gm, 'assets');
  await gm.getByTestId('background-add').click();
  await gm.getByTestId('background-pick-Starter map').click();
  await openActivity(gm, 'assets');
  const id = await onlyBackgroundId(gm);
  const start = await readRect(gm, id);
  // The east edge midpoint — free on w alone, unlike either corner.
  const edgePx = { x: start.w * CELL_PX, y: (start.h / 2) * CELL_PX };

  await openActivity(gm, 'map');
  await switchToEditMode(gm);
  await selectMapTool(gm, 'vector-tool-select');

  await dragCanvas(gm, VECTOR_CANVAS, edgePx, { x: edgePx.x + 80, y: edgePx.y });
  await expect(gm.getByTestId('selected-object')).toHaveText(`background:${id}`);

  await openActivity(gm, 'assets');
  const stretched = await readRect(gm, id);
  // w grew, h is untouched, and the ratio no longer matches the native 4:3 —
  // the capability that did not exist under the single ratio-locked handle.
  expect(stretched.w).toBeGreaterThan(start.w);
  expect(stretched.h).toBeCloseTo(start.h, 5);
  expect(stretched.w / stretched.h).not.toBeCloseTo(STARTER_ASPECT, 1);
  expect(stretched).toMatchObject({ x: 0, y: 0 });

  await gmContext.close();
});

test('SPEC-039 §2/§4: a locked background is not a Select object — the press falls through to open canvas instead', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  await createRoomAndJoin(gm, 'The Sunless Vault');
  await setSmallGrid(gm);

  await openActivity(gm, 'assets');
  await gm.getByTestId('background-add').click();
  await gm.getByTestId('background-pick-Starter map').click();
  await openActivity(gm, 'assets');
  const id = await onlyBackgroundId(gm);
  const before = await readRect(gm, id);
  await gm.getByTestId(`background-lock-${id}`).click();
  await expect(gm.getByTestId(`background-lock-${id}`)).toHaveText('🔒 Locked');

  await openActivity(gm, 'map');
  await switchToEditMode(gm);
  await selectMapTool(gm, 'vector-tool-select');
  // A press-and-drag inside the locked image's rect is not a Select pick —
  // it falls straight through to open canvas, which starts (and here,
  // finishes) an empty lasso rather than moving or resizing the image.
  await dragCanvas(gm, VECTOR_CANVAS, { x: 60, y: 50 }, { x: 140, y: 110 });
  await expect(gm.getByTestId('selected-object')).toHaveText('');

  await openActivity(gm, 'assets');
  expect(await readRect(gm, id)).toEqual(before);

  await gmContext.close();
});
