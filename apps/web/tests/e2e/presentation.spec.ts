import { expect, type Page, test } from '@playwright/test';
import {
  roomIdFromUrl,
  selectMapTool,
  switchToEditMode,
  signInAsReferee,
  VECTOR_CANVAS,
} from './helpers';

/**
 * Full-screen and standalone are one presentation model (SPEC-033 §5, WI-064).
 *
 * Two things are CI-checkable here. First, the control claims the **app frame**
 * — the document root — rather than the map canvas, which is what keeps the
 * toolbars on screen. Second, the invariant the work item's gate names: the
 * Pixi stage survives the resize either route causes **with its camera intact**.
 *
 * The camera assertion is driven by a viewport change rather than by entering
 * full-screen, because a headless browser is already the size of its display —
 * entering full-screen there resizes nothing, so it could not tell a surviving
 * camera from a reset one. `setViewportSize` resizes the Pixi host exactly the
 * way a full-screen or standalone transition does.
 *
 * The installed-standalone half (manifest, iOS meta tags, the control hiding
 * itself when the app already owns the display) needs a real home-screen
 * launch, and stays [HUMAN].
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

test('SPEC-033 §5: the control full-screens the app frame, and gives it back', async ({ page }) => {
  await createRoomAndJoin(page, 'The Lantern Vault');

  const toggle = page.getByTestId('fullscreen-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  // The element that went full-screen is the document root — the whole frame,
  // toolbars included — not the map canvas.
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
    .toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // The shell is still the shell: the rail and the bottom bar came along.
  await expect(page.getByTestId('shell-rail')).toBeVisible();
  await expect(page.getByTestId('log-open')).toBeVisible();

  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('SPEC-033 §5: the Pixi stage survives a frame resize with its camera intact', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Lantern Vault');

  // The targeted-cell readout is the camera made observable: which lattice cell
  // a given point on the canvas lands in is a pure function of the world
  // container's pan and zoom.
  await selectMapTool(page, 'vector-tool-room');
  const canvas = page.locator(VECTOR_CANVAS);
  const readout = page.getByTestId('snap-cell-readout');

  const before = (await canvas.boundingBox())!;
  // Measured from the canvas's top-left corner, which the frame keeps put when
  // the viewport grows — so the same offset is the same point on the stage
  // before and after, and lands on the same lattice cell iff the camera did
  // not move.
  await page.mouse.move(before.x + 305, before.y + 305);
  await expect(readout).not.toHaveText('');
  const cell = await readout.textContent();

  await page.setViewportSize({ width: 1500, height: 1000 });
  await expect.poll(async () => (await canvas.boundingBox())!.height).not.toBe(before.height);
  const after = (await canvas.boundingBox())!;

  // Read somewhere else first: the readout holds its last value, so without
  // this the assertion below could pass on a stale reading.
  await page.mouse.move(after.x + 120, after.y + 120);
  await expect(readout).not.toHaveText(cell!);

  // Same point on the canvas, same cell underneath it — pan and zoom came
  // through the resize unchanged. A reset camera would land elsewhere.
  await page.mouse.move(after.x + 305, after.y + 305);
  await expect(readout).toHaveText(cell!);
});
