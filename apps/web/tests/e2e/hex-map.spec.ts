import { expect, type Page, test } from '@playwright/test';
import {
  closeQuickSheet,
  openActivity,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
  signInAsReferee,
  switchToEditMode,
  VECTOR_CANVAS,
} from './helpers';

/**
 * Hex crawl rendering (SPEC-030 §1, WI-039). The grid itself and its
 * coordinate pills are Pixi-drawn, so what a spec can see is the introspection
 * readout (`map-grid-kind` / `map-hex-size` — which grid the renderer was
 * handed) plus the palette the map offers. Between them they cover the two
 * things that could actually go wrong here: the square lattice rendering on a
 * hex map, and a square-lattice carve tool staying reachable on one (RULE-006).
 *
 * The two tests at the bottom cover the authoring half (SPEC-030 §§4–5,
 * WI-041): picking a hex, painting it from the hex-tile sheet, and reading its
 * note back off the map.
 */

async function createRoomAndJoin(page: Page, roomName: string): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill('Referee');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  await switchToEditMode(page);
  return roomId;
}

/**
 * Switches the room onto a freshly created hex crawl and lands on the Map view.
 * Every hex test needs this preamble; the two grid-kind tests below spell parts
 * of it out because the intermediate states are what they are asserting.
 */
async function switchToNewHexMap(page: Page): Promise<void> {
  await openActivity(page, 'assets');
  await page.getByTestId('maps-add-hex').click();
  await expect(page.locator('[data-testid^="map-kind-"]', { hasText: 'Hex' })).toHaveCount(1);
  await page.locator('[data-testid^="map-switch-"]').click();
  await openActivity(page, 'map');
  await expect(page.getByTestId('map-grid-kind')).toHaveText('hex');
}

/** Clicks the middle of the map canvas. A hex crawl with no remembered camera
 * opens centred on `0,0` (SPEC-030 §1), so this is a click on the origin hex. */
async function clickCanvasCentre(page: Page): Promise<void> {
  const box = await page.locator(VECTOR_CANVAS).boundingBox();
  if (!box) throw new Error('map canvas not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('a hex crawl renders the hex grid and offers the View tools only', async ({ page }) => {
  await createRoomAndJoin(page, 'The Bitter Reach');

  // The room's starter map is an ordinary square-grid one.
  await expect(page.getByTestId('map-grid-kind')).toHaveText('square');
  await expect(page.getByTestId('map-hex-size')).toHaveText('');

  await openActivity(page, 'assets');
  await page.getByTestId('maps-add-hex').click();

  // The new map is listed as a hex crawl.
  const hexBadge = page.locator('[data-testid^="map-kind-"]', { hasText: 'Hex' });
  await expect(hexBadge).toHaveCount(1);

  // Exactly one map is not the active one: the hex crawl just created.
  // (Creation leaves its name in the inline editor; clicking away blurs it,
  // which saves the unchanged name — the same thing a real referee does.)
  const switchButton = page.locator('[data-testid^="map-switch-"]');
  await expect(switchButton).toHaveCount(1);
  await switchButton.click();

  await openActivity(page, 'map');

  // The renderer was handed the hex grid, with `hex.size` — not
  // `grid.cellSize` — as its multiplier (RULE-006).
  await expect(page.getByTestId('map-grid-kind')).toHaveText('hex');
  await expect(page.getByTestId('map-hex-size')).toHaveText('48');

  // SPEC-030 §5: Select and the View tools, and nothing else. No carve tool,
  // because there is no carved floor — and no overlay tool either, because a
  // symbol/label/door/pen stores square-lattice geometry, which is not this
  // map's coordinate space (RULE-006).
  await openMapToolSheet(page);
  await expect(page.getByTestId('vector-tool-pan')).toBeVisible();
  await expect(page.getByTestId('vector-tool-select')).toBeVisible();
  for (const tool of ['room', 'carve', 'wall', 'symbol', 'label', 'door', 'pen']) {
    await expect(page.getByTestId(`vector-tool-${tool}`)).toHaveCount(0);
  }
});

test('switching back to a square-grid map restores the square lattice', async ({ page }) => {
  await createRoomAndJoin(page, 'The Kingdom of Nothing');

  await openActivity(page, 'assets');
  await page.getByTestId('maps-add-hex').click();
  await expect(page.locator('[data-testid^="map-kind-"]', { hasText: 'Hex' })).toHaveCount(1);
  await page.locator('[data-testid^="map-switch-"]').click();
  await openActivity(page, 'map');
  await expect(page.getByTestId('map-grid-kind')).toHaveText('hex');

  // Back to the starter map. The grid kind is a property of the map, so the
  // square lattice — and its whole tool catalog — comes back with it.
  await openActivity(page, 'assets');
  await page.locator('[data-testid^="map-switch-"]').click();
  await openActivity(page, 'map');
  await expect(page.getByTestId('map-grid-kind')).toHaveText('square');
  await openMapToolSheet(page);
  await expect(page.getByTestId('vector-tool-room')).toBeVisible();
});

/**
 * The hex-tile quick sheet and per-hex notes (SPEC-030 §§4–5, WI-041). The hex
 * itself is Pixi-drawn, so what a spec can see is the picked coordinate
 * (`map-selected-hex`), how many hexes carry anything at all
 * (`map-hex-tile-count` — the collection is sparse), and the note tooltip.
 */
test('Select picks a hex, and the sheet paints its terrain, contents and note', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Wilderlands');
  await switchToNewHexMap(page);

  // Nothing is picked, and nothing is painted: an infinite plane starts empty.
  await expect(page.getByTestId('map-selected-hex')).toHaveText('');
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('0');

  await openMapToolSheet(page);
  await expect(page.getByTestId('hex-tile-empty')).toBeVisible();
  await closeQuickSheet(page, 'maptools');

  // A hex map opens centred on `0,0`, so the middle of the canvas is the
  // origin hex.
  await selectMapTool(page, 'vector-tool-select');
  await clickCanvasCentre(page);
  await expect(page.getByTestId('map-selected-hex')).toHaveText('0,0');

  await openMapToolSheet(page);
  await expect(page.getByTestId('hex-tile-coord')).toHaveText('0,0');

  // Terrain and contents are independent fields on one document, so setting
  // each leaves the other alone — and the hex is one document either way.
  await page.getByTestId('hex-terrain-forest').click();
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('1');
  await page.getByTestId('hex-contents-castle').click();
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('1');
  await expect(page.getByTestId('hex-terrain-forest')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('hex-contents-castle')).toHaveAttribute('aria-pressed', 'true');

  // The note is committed on blur — one settled write per edit (RULE-003),
  // not one per keystroke.
  await page.getByTestId('hex-note-input').fill('Bandits hold the keep.');
  await page.getByTestId('hex-tile-coord').click();
  await expect(page.getByTestId('hex-note-input')).toContainText('Bandits hold the keep.');

  // Picking the kind a hex already carries clears it; the note keeps the
  // document alive on its own until it too is cleared (SPEC-030 §4).
  await page.getByTestId('hex-terrain-forest').click();
  await expect(page.getByTestId('hex-terrain-forest')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('hex-contents-castle').click();
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('1');
  await page.getByTestId('hex-note-input').fill('');
  await page.getByTestId('hex-tile-coord').click();
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('0');
});

test('a hex with a note shows it on hover, through the label tooltip', async ({ page }) => {
  await createRoomAndJoin(page, 'The Bleak Marches');
  await switchToNewHexMap(page);

  await selectMapTool(page, 'vector-tool-select');
  await clickCanvasCentre(page);
  await openMapToolSheet(page);
  await page.getByTestId('hex-note-input').fill('A **standing stone**, humming.');
  await page.getByTestId('hex-tile-coord').click();
  await expect(page.getByTestId('map-hex-tile-count')).toHaveText('1');
  await closeQuickSheet(page, 'maptools');

  // Nothing showing until the pointer is over the hex that carries the note.
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);

  const box = await page.locator(VECTOR_CANVAS).boundingBox();
  if (!box) throw new Error('map canvas not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('map-label-tooltip')).toContainText('standing stone');

  // Off the noted hex and the tooltip goes with it. Two hexes east is well
  // clear of the origin at the default hex size.
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2);
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);
});
