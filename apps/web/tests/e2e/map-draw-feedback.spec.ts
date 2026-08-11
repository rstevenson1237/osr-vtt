import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  closeQuickSheet,
  expandQuickSheet,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
  switchToEditMode,
  VECTOR_CANVAS,
  signInAsReferee,
} from './helpers';

/**
 * Drawing feedback on the vector map: the live dimension chip shown while a
 * click-and-drag shape is being dragged, and the freehand Carve brush whose
 * shape follows the snap level.
 *
 * The chip is drawn on the Pixi canvas, so — following the house convention
 * for canvas-rendered state — it is asserted through its mirrored hidden
 * readout, `stroke-dimensions`.
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

test('a dragged room reports its size while drawing, and stops when it commits', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-room');

  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;
  const readout = page.getByTestId('stroke-dimensions');

  // Nothing to report before a drag starts.
  await expect(readout).toHaveText('');

  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });

  // Mid-drag: `w × h` in the map's measure units (10 feet per square by
  // default), with the unit named once.
  await expect(readout).toHaveText(/^\d+(\.\d)? × \d+(\.\d)? feet$/);

  await page.mouse.up();

  // Committing clears it — the chip belongs to the stroke, not the shape.
  await expect(readout).toHaveText('');
  await expect(page.getByTestId('floor-region-count')).not.toHaveText('0');
});

test('the n-gon reports a diameter rather than a bounding box', async ({ page }) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-ngon');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 280, { steps: 8 });

  // SPEC-028: the authored dimension is the across-flats diameter, so that is
  // what the chip reports.
  await expect(page.getByTestId('stroke-dimensions')).toHaveText(/^⌀ \d+(\.\d)? feet$/);

  await page.mouse.up();
  await expect(page.getByTestId('stroke-dimensions')).toHaveText('');
});

/** Picks a tool and leaves the Map tools sheet *open*, so the tool's contextual
 * parameter controls stay in the DOM — `selectMapTool` closes the sheet, which
 * is right for canvas work and wrong for asserting on the params. */
async function selectMapToolKeepingSheetOpen(page: Page, toolTestId: string): Promise<void> {
  await openMapToolSheet(page);
  await page.getByTestId(toolTestId).click();
}

test('SPEC-028: the n-gon offers Circle plus 3-8 sides, defaulting to Circle', async ({ page }) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapToolKeepingSheetOpen(page, 'vector-tool-ngon');

  const sides = page.getByTestId('ngon-sides');
  await expect(sides).toHaveValue('1');
  await expect(sides.locator('option')).toHaveText(['Circle', '3', '4', '5', '6', '7', '8']);

  // The old free-form Sides number input is gone, and the shared brush Width
  // control never applied to the n-gon in the first place.
  await expect(page.getByTestId('map-toolbar').locator('input[type="number"]')).toHaveCount(0);

  await sides.selectOption('4');
  await closeQuickSheet(page, 'maptools');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('floor-region-count')).not.toHaveText('0');
});

test('SPEC-028 §7: Corridor and Path share one width set, defaulting by snap mode', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapToolKeepingSheetOpen(page, 'vector-tool-corridor');

  const width = page.getByTestId('band-width');
  await expect(width.locator('option')).toHaveText(['⅛', '¼', '½', '1', '2']);
  // Cell snap is the map default, so the band opens at two cells (DEC-032).
  await expect(width).toHaveValue('2');

  // Switching to half snap is switching to half-cell work; the width follows.
  await page.getByTestId('map-snap-mode').selectOption('half');
  await expect(width).toHaveValue('0.5');

  // ...and back again, unconditionally (DEC-028) — even though ½ was showing
  // because the mode chose it rather than because anyone picked it.
  await page.getByTestId('map-snap-mode').selectOption('free');
  await expect(width).toHaveValue('2');

  // The Path tool reads and writes the very same control (WI-051): it is one
  // width vocabulary now, not two. Carve keeps the free-form number input.
  await page.getByTestId('map-snap-mode').selectOption('full');
  await width.selectOption('0.125');
  await page.getByTestId('vector-tool-path').click();
  await expect(page.getByTestId('band-width')).toHaveValue('0.125');
  await expect(page.getByTestId('map-width')).toHaveCount(0);
  await page.getByTestId('vector-tool-carve').click();
  await expect(page.getByTestId('band-width')).toHaveCount(0);
  await expect(page.getByTestId('map-width')).toBeVisible();
});

test('SPEC-028 §7: a snapped right-angle Path carves the same floor as the Corridor', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  const count = page.getByTestId('floor-region-count');

  // Path is cell-anchored under Cell snap now, so a two-click right-angle run
  // lays exactly the corridor's band — squared caps, whole cells, no rounded
  // ends. Committing it at all is the check that the snapped collector works
  // off raw points end to end (the old vertex-snapped path is gone).
  await selectMapTool(page, 'vector-tool-path');
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.click(box.x + 320, box.y + 200);
  await page.mouse.click(box.x + 320, box.y + 320);
  await page.keyboard.press('Enter');
  await expect(count).not.toHaveText('0');

  // Undo puts the map back — the snapped path rides the same op stack.
  await page.keyboard.press('Control+z');
  await expect(count).toHaveText('0');
});

test('SPEC-028 §6/WI-052: the Corridor/Path indicator shows the band actually carved, not the whole tile', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapToolKeepingSheetOpen(page, 'vector-tool-corridor');
  await page.getByTestId('band-width').selectOption('1');
  await closeQuickSheet(page, 'maptools');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  const cellReadout = page.getByTestId('snap-cell-readout');
  const bandReadout = page.getByTestId('snap-band-readout');

  // Room's whole-tile indicator has no reading for Corridor — it moved to its
  // own band indicator at WI-052.
  await page.mouse.move(box.x + 310, box.y + 310);
  await expect(cellReadout).toHaveText('');
  await expect(bandReadout).not.toHaveText('');

  // At width 1 under cell snap the band coincides with the tile exactly, so
  // the two readouts would agree if Room's still applied here.
  const atWidthOne = await bandReadout.textContent();
  expect(atWidthOne).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)? @1$/);

  // A sub-step width insets evenly inside the same tile rather than sitting
  // flush with an edge (SPEC-028 §7's centring rule, extended to the
  // indicator).
  await openMapToolSheet(page);
  await page.getByTestId('band-width').selectOption('0.5');
  await closeQuickSheet(page, 'maptools');
  await page.mouse.move(box.x + 305, box.y + 305);
  await page.mouse.move(box.x + 310, box.y + 310);
  await expect(bandReadout).toHaveText(/ @0\.5$/);
  expect(await bandReadout.textContent()).not.toBe(atWidthOne);

  // Free snap has no tile to inset inside, so the indicator becomes a circle
  // of the chosen width — never empty, unlike Room's cell indicator. Changing
  // snap mode resets the width unconditionally (DEC-028), so free snap first
  // shows its own default before re-selecting the sub-step width.
  await openMapToolSheet(page);
  await page.getByTestId('map-snap-mode').selectOption('free');
  await closeQuickSheet(page, 'maptools');
  await page.mouse.move(box.x + 360, box.y + 360);
  await expect(bandReadout).toHaveText(/^⌀ 2$/);

  await openMapToolSheet(page);
  await page.getByTestId('band-width').selectOption('0.5');
  await closeQuickSheet(page, 'maptools');
  await page.mouse.move(box.x + 355, box.y + 355);
  await page.mouse.move(box.x + 360, box.y + 360);
  await expect(bandReadout).toHaveText(/^⌀ 0\.5$/);

  // The Path tool reads the same shared control and gets the same treatment.
  // Switching snap mode back to Cell resets the width again (DEC-028).
  await openMapToolSheet(page);
  await page.getByTestId('vector-tool-path').click();
  await page.getByTestId('map-snap-mode').selectOption('full');
  await page.getByTestId('band-width').selectOption('0.5');
  await closeQuickSheet(page, 'maptools');
  await page.mouse.move(box.x + 305, box.y + 305);
  await page.mouse.move(box.x + 310, box.y + 310);
  await expect(bandReadout).toHaveText(/ @0\.5$/);
});

test('SPEC-028: Room targets a whole cell, and a click with no drag starts a 1×1', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-room');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  const readout = page.getByTestId('snap-cell-readout');

  // The targeted cell is highlighted on hover, before any button goes down.
  await page.mouse.move(box.x + 310, box.y + 310);
  await expect(readout).not.toHaveText('');
  const hovered = await readout.textContent();

  // Anywhere else in the same cell targets the same cell — that is the whole
  // difference from vertex snapping.
  await page.mouse.move(box.x + 315, box.y + 315);
  await expect(readout).toHaveText(hovered!);

  // Pressing without moving starts a 1×1 shape rather than a zero-size one —
  // the drag grows it from there, and (per the tool's existing
  // click-to-start/click-to-end gesture) a second click commits it.
  await page.mouse.down();
  await expect(page.getByTestId('stroke-dimensions')).toHaveText('10 × 10 feet');
  await page.mouse.up();
  await expect(page.getByTestId('floor-region-count')).toHaveText('0');
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('floor-region-count')).toHaveText('1');

  // Free snap has no cell to target, so the indicator goes away.
  await openMapToolSheet(page);
  await page.getByTestId('map-snap-mode').selectOption('free');
  await closeQuickSheet(page, 'maptools');
  await page.mouse.move(box.x + 360, box.y + 360);
  await expect(readout).toHaveText('');
});

test('the carve brush paints floor freehand, and Escape abandons a stroke', async ({ page }) => {
  await createRoomAndJoin(page, 'The Weeping Stair');

  // Cell snap: the brush lays down whole lattice cells along the drag.
  await selectMapTool(page, 'vector-tool-carve');
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;

  await page.mouse.move(box.x + 100, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 300, { steps: 6 });
  await page.mouse.move(box.x + 260, box.y + 360, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByTestId('floor-region-count')).not.toHaveText('0');

  // The brush is a shape tool, so it carries the usual carve/snap/width
  // parameters rather than a set of its own.
  await openMapToolSheet(page);
  await expect(page.getByTestId('carve-mode')).toBeVisible();
  await page.getByTestId('quick-sheet-close-maptools').click();

  // Undo puts the map back, so the brush rides the same op stack as every
  // other carve.
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('floor-region-count')).toHaveText('0');
});

test('WI-042: a snapped carve dab at width 1 paints the cell it was clicked in', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapToolKeepingSheetOpen(page, 'vector-tool-carve');

  // The defect (IN-012): under cell snap, the brush painted from a
  // vertex-rounded point, so at width <= 1 the radius never reached any
  // cell's centre and a plain click (a "dab") committed nothing.
  await page.getByTestId('map-width').fill('1');
  await closeQuickSheet(page, 'maptools');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await expect(page.getByTestId('floor-region-count')).toHaveText('0');

  // A single click, no drag.
  await page.mouse.move(box.x + 310, box.y + 310);
  await page.mouse.down();
  await page.mouse.up();

  await expect(page.getByTestId('floor-region-count')).toHaveText('1');
});

test('the Measure tool reads a distance while dragging and drops it on release', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-measure');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  const readout = page.getByTestId('measure-readout');

  await expect(readout).toHaveText('');

  await page.mouse.move(box.x + 140, box.y + 140);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260, { steps: 8 });

  // Same units and rounding as the drag dimension chip — one span, with the
  // unit named.
  await expect(readout).toHaveText(/^\d+(\.\d)? feet$/);

  // Measuring is not authoring: nothing is committed and nothing lingers.
  await page.mouse.up();
  await expect(readout).toHaveText('');
  await expect(page.getByTestId('floor-region-count')).toHaveText('0');
  await expect(page.getByTestId('drawing-count')).toHaveText('0');
});

test('hovering a room label shows its long description, and only when it has one', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');

  // A label needs floor under it to sit in, the way a real map is authored.
  await selectMapTool(page, 'vector-tool-room');
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 340, box.y + 340, { steps: 8 });
  await page.mouse.up();

  await selectMapTool(page, 'vector-tool-label');
  await page.mouse.click(box.x + 200, box.y + 200);
  await expect(page.getByTestId('label-edit-input')).toBeVisible();
  await page.getByTestId('label-edit-input').fill('Entry Hall');
  await page.getByTestId('label-edit-input').press('Tab');
  await expect(page.getByTestId('label-edit-input')).toHaveCount(0);

  const roomTestId = await page
    .locator('[data-testid^="maproom-name-"]')
    .first()
    .getAttribute('data-testid');
  const mapRoomId = roomTestId!.replace('maproom-name-', '');

  // With no note written, hovering shows nothing — an empty popover beside
  // every unannotated label would be pure noise.
  await page.mouse.move(box.x + 200, box.y + 200);
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);

  // The long description is the room's players' notes, written from the Room
  // quick sheet — there is no `MapRoom.description` field.
  await expandQuickSheet(page, 'room');
  await page.getByTestId(`room-key-${mapRoomId}`).click();
  await page.getByTestId(`room-notes-${mapRoomId}-input`).fill('Two braziers, one dead rat.');
  await closeQuickSheet(page, 'room');

  await page.mouse.move(box.x + 260, box.y + 260);
  await page.mouse.move(box.x + 200, box.y + 200);
  await expect(page.getByTestId('map-label-tooltip')).toContainText('one dead rat');

  // Off the label again and it goes away.
  await page.mouse.move(box.x + 320, box.y + 320);
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);
});

test('IN-031: the View toggle locks the carve/edit tools and drops any armed draw gesture', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-room');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  const before = await page.getByTestId('floor-region-count').textContent();

  await openMapToolSheet(page);
  // Flipping to View while Room is armed drops back to Pan, so a click on the
  // canvas afterwards can't finish a stroke that was never cancelled. One
  // binary button now (DEC-064) — a click toggles Edit -> View.
  await page.getByTestId('map-mode-toggle').click();
  await expect(page.getByTestId('vector-tool-pan')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('vector-tool-room')).toBeDisabled();
  await expect(page.getByTestId('vector-tool-carve')).toBeDisabled();
  // The View group stays live — it never carves anything.
  await expect(page.getByTestId('vector-tool-measure')).toBeEnabled();
  await page.getByTestId('quick-sheet-close-maptools').click();

  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('floor-region-count')).toHaveText(before ?? '0');

  // Edit re-enables the palette; the tool the lock parked on (Pan) stays put.
  await openMapToolSheet(page);
  await page.getByTestId('map-mode-toggle').click();
  await expect(page.getByTestId('vector-tool-room')).toBeEnabled();
  await page.getByTestId('vector-tool-room').click();
  await page.getByTestId('quick-sheet-close-maptools').click();

  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('floor-region-count')).not.toHaveText(before ?? '0');
});
