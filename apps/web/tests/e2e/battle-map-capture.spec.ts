import { expect, test } from '@playwright/test';
import {
  dragCanvas,
  expandQuickSheet,
  closeQuickSheet,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
  VECTOR_CANVAS,
  signInAsReferee,
} from './helpers';

/**
 * Battle map capture tool (SPEC-029 §1) — referee-only, click-and-drag (or
 * click, then second click) whole-cell bounding box, rendered like a Room
 * carve but in its own colour. Authoring only: nothing here writes a
 * `GameMap.battle` document yet (WI-036's Start button does that) — what
 * commits is `MapToolController.pendingBattleCapture`, mirrored to the DOM
 * via `battle-capture-rect` the same way the drag dimension chip is mirrored
 * via `stroke-dimensions` (house convention: the canvas isn't queryable).
 */

async function createRoomAndJoin(page: import('@playwright/test').Page, roomName: string) {
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

test('a dragged capture reports whole cells while drawing and commits on release', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Sundered Ward');
  await selectMapTool(page, 'vector-tool-capture');

  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;
  const readout = page.getByTestId('stroke-dimensions');
  const rectReadout = page.getByTestId('battle-capture-rect');

  // Nothing captured yet, nothing to report before a drag starts.
  await expect(readout).toHaveText('');
  await expect(rectReadout).toHaveText('');

  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 220, { steps: 8 });

  // Mid-drag: whole cells, unit named once — never the map's real-world
  // measure (a source-map foot count would describe a grid that's about to
  // change, SPEC-029 §4).
  await expect(readout).toHaveText(/^\d+ × \d+ cells$/);

  await page.mouse.up();

  // Committing clears the drag chip — same as every other click-and-drag
  // tool — but leaves the committed rect behind, unlike Room (which has real
  // floor geometry to show instead; Capture writes nothing to the map yet).
  await expect(readout).toHaveText('');
  await expect(rectReadout).not.toHaveText('');
  await expect(rectReadout).toHaveText(/^-?\d+,-?\d+,-?\d+,-?\d+$/);
});

test('click, then click again at the same spot, captures exactly one cell', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sundered Ward');
  await selectMapTool(page, 'vector-tool-capture');

  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;
  const rectReadout = page.getByTestId('battle-capture-rect');

  // Same click-to-start/click-to-end gesture as Room: the first click with no
  // movement arms it rather than committing a degenerate shape, and the
  // second click (here, at the same point) finishes it.
  await page.mouse.click(box.x + 150, box.y + 150);
  await page.mouse.click(box.x + 150, box.y + 150);

  const [minX, minY, maxX, maxY] = (await rectReadout.textContent())!.split(',').map(Number);
  expect(maxX - minX).toBe(1);
  expect(maxY - minY).toBe(1);
});

test('the capture rect always lands on whole cells, even under Free snap', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sundered Ward');

  // Free snap is set on the shared controller from Room's own Snap
  // selector — Capture doesn't offer one at all (it "ignores the snap mode
  // and always snaps to whole cells"), so this proves the tool ignores
  // whatever mode was left active by whichever tool set it last.
  await openMapToolSheet(page);
  await page.getByTestId('vector-tool-room').click();
  await page.getByTestId('map-snap-mode').selectOption('free');
  await page.getByTestId('vector-tool-capture').click();
  await page.getByTestId('quick-sheet-close-maptools').click();

  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;
  const rectReadout = page.getByTestId('battle-capture-rect');

  await page.mouse.move(box.x + 133, box.y + 147);
  await page.mouse.down();
  await page.mouse.move(box.x + 291, box.y + 233, { steps: 8 });
  await page.mouse.up();

  const [minX, minY, maxX, maxY] = (await rectReadout.textContent())!.split(',').map(Number);
  for (const n of [minX, minY, maxX, maxY]) expect(Number.isInteger(n)).toBe(true);
});

test('the capture tool is referee-only', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sundered Ward');
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('my-role')).toHaveText('player');

  await expandQuickSheet(gm, 'maptools');
  await expect(gm.getByTestId('vector-tool-capture')).toBeVisible();
  await closeQuickSheet(gm, 'maptools');

  // A player who could cut their own battle map out of the shared map was
  // never the point of the tool — the same "referee prep" reasoning fog's
  // carve modes and bulk actions already get.
  await expandQuickSheet(player, 'maptools');
  await expect(player.getByTestId('vector-tool-capture')).toHaveCount(0);
  await closeQuickSheet(player, 'maptools');

  await gmContext.close();
  await playerContext.close();
});
