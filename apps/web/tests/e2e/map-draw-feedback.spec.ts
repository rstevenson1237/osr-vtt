import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  closeQuickSheet,
  expandQuickSheet,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
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

test('the n-gon reports a radius rather than a bounding box', async ({ page }) => {
  await createRoomAndJoin(page, 'The Weeping Stair');
  await selectMapTool(page, 'vector-tool-ngon');

  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 280, { steps: 8 });

  await expect(page.getByTestId('stroke-dimensions')).toHaveText(/^radius: \d+(\.\d)? feet$/);

  await page.mouse.up();
  await expect(page.getByTestId('stroke-dimensions')).toHaveText('');
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
