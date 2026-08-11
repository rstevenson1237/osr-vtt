import { expect, test } from '@playwright/test';
import {
  armCaptureTool,
  closeQuickSheet,
  dragCanvas,
  expandQuickSheet,
  openMapToolSheet,
  roomIdFromUrl,
  switchToEditMode,
  vectorCarve,
  VECTOR_CANVAS,
  signInAsReferee,
} from './helpers';

/**
 * Battle map lifecycle — Start and Exit (SPEC-029 §5). `battle-map-capture.spec.ts`
 * covers the capture tool alone; nothing there writes a `GameMap.battle` document.
 * This is the producer: Start cuts the temporary map (with the source's floor
 * geometry copied over, SPEC-029 §2) and switches every client to it; Exit
 * switches back and drops it.
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
  await switchToEditMode(page);
  return roomId;
}

test('Start cuts a battle map with the source geometry and the render differences; Exit returns and drops it', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Sundered Ward');

  // Carve a floor region so there is something for the battle map to inherit
  // (SPEC-029 §2 — floor is copied, not re-derived).
  await vectorCarve(page, { x: 80, y: 80 }, { x: 260, y: 220 });
  await expect(page.getByTestId('floor-region-count')).toHaveText('1');
  const measureBefore = await page.getByTestId('measure-summary').textContent();

  await armCaptureTool(page);
  await dragCanvas(page, VECTOR_CANVAS, { x: 60, y: 60 }, { x: 280, y: 240 });

  await expandQuickSheet(page, 'battle');
  await expect(page.getByTestId('battle-preview')).toBeVisible();
  await page.getByTestId('battle-start').click();

  // The stage swaps to the new temporary map: the carved floor came along,
  // the grid doubles (`measure-summary` halves — SPEC-029 §4), and the Exit
  // button replaces Start.
  await expect(page.getByTestId('floor-region-count')).toHaveText('1');
  await expect
    .poll(() => page.getByTestId('measure-summary').textContent())
    .not.toBe(measureBefore);
  await expect(page.getByTestId('battle-exit')).toBeVisible();
  await closeQuickSheet(page, 'battle');

  // The tool palette drops to View-only on a battle map (SPEC-029 §4).
  await openMapToolSheet(page);
  await expect(page.getByTestId('vector-tool-pan')).toBeVisible();
  await expect(page.getByTestId('vector-tool-room')).toHaveCount(0);
  await closeQuickSheet(page, 'maptools');

  await expandQuickSheet(page, 'battle');
  await page.getByTestId('battle-exit').click();

  // Back on the source map: original grid density, full palette, the
  // temporary map is gone, and there is nothing left for the sheet to act on.
  await expect
    .poll(() => page.getByTestId('measure-summary').textContent())
    .toBe(measureBefore);
  await expect(page.getByTestId('battle-sheet-no-capture')).toBeVisible();
  await closeQuickSheet(page, 'battle');

  await openMapToolSheet(page);
  await expect(page.getByTestId('vector-tool-room')).toBeVisible();
  await closeQuickSheet(page, 'maptools');
});

test('Starting a battle map switches every player, not just the referee', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sundered Ward');
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('my-role')).toHaveText('player');

  const measureBefore = await player.getByTestId('measure-summary').textContent();

  await armCaptureTool(gm);
  await dragCanvas(gm, VECTOR_CANVAS, { x: 60, y: 60 }, { x: 280, y: 240 });
  await expandQuickSheet(gm, 'battle');
  await expect(gm.getByTestId('battle-preview')).toBeVisible();
  await gm.getByTestId('battle-start').click();
  await closeQuickSheet(gm, 'battle');

  // The player never touched a control — the map change is a room-level
  // write (`Room.activeMapId`), so their own client follows it.
  await expect
    .poll(() => player.getByTestId('measure-summary').textContent())
    .not.toBe(measureBefore);
  // A player never sees the referee-only Battle map sheet toggle at all.
  await expect(player.getByTestId('quick-sheet-toggle-battle')).toHaveCount(0);

  await gmContext.close();
  await playerContext.close();
});
