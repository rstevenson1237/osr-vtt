import { expect, test } from '@playwright/test';
import {
  addCreature,
  closeQuickSheet,
  dragCanvas,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
  VECTOR_CANVAS,
  vectorCarve,
} from './helpers';

/**
 * Fog of war (VectorMapSystem_Spec.md §4) — the vector-native rebuild.
 *
 * The load-bearing claim is that a player does not see what the referee hasn't
 * shown them. Fog itself renders to the Pixi bitmap, so what's asserted here is
 * the state that drives it (`fog-enabled` / `fog-region-count`) plus the one
 * consequence that *is* queryable as DOM: a token standing in fog is not in the
 * player's `renderableTokens` at all, while the GM still sees it.
 */

async function createRoomAsGm(page: import('@playwright/test').Page, name: string) {
  await page.goto('/');
  await page.getByTestId('create-room-name').fill(name);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill('Referee');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('my-role')).toHaveText('gm');
  return roomId;
}

/** Turns fog on from the GM-only fog group in the Map tools sheet. */
async function enableFog(page: import('@playwright/test').Page): Promise<void> {
  await openMapToolSheet(page);
  await page.getByTestId('fog-enabled-toggle').check();
  await closeQuickSheet(page, 'maptools');
  await expect(page.getByTestId('fog-enabled')).toHaveText('true');
}

test('the fog toggle and reveal/hide tools are referee-only', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAsGm(gm, 'Fog Keep');
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('my-role')).toHaveText('player');

  // The GM has the whole fog group.
  await openMapToolSheet(gm);
  await expect(gm.getByTestId('map-fog-tools')).toBeVisible();
  await expect(gm.getByTestId('fog-enabled-toggle')).toBeVisible();
  await closeQuickSheet(gm, 'maptools');

  // The player has none of it — a player who could reveal the map to
  // themselves is the whole thing fog exists to prevent.
  await openMapToolSheet(player);
  await expect(player.getByTestId('map-fog-tools')).toHaveCount(0);
  await expect(player.getByTestId('map-tool-reveal')).toHaveCount(0);
  await expect(player.getByTestId('map-tool-hide')).toHaveCount(0);
  await closeQuickSheet(player, 'maptools');

  await gmContext.close();
  await playerContext.close();
});

test('reveal/hide tools are hidden until fog is enabled for the map', async ({ page }) => {
  await createRoomAsGm(page, 'Fog Off');
  await openMapToolSheet(page);
  await expect(page.getByTestId('fog-enabled-toggle')).not.toBeChecked();
  await expect(page.getByTestId('map-tool-reveal')).toHaveCount(0);
  await page.getByTestId('fog-enabled-toggle').check();
  await expect(page.getByTestId('map-tool-reveal')).toBeVisible();
  await expect(page.getByTestId('map-tool-hide')).toBeVisible();
});

test('clicking a carved room with Reveal reveals that whole region, and Hide takes it back', async ({
  page,
}) => {
  await createRoomAsGm(page, 'Fog Reveal');
  await vectorCarve(page, { x: 120, y: 120 }, { x: 320, y: 300 });
  await expect(page.getByTestId('floor-region-count')).toHaveText('1');

  await enableFog(page);
  await expect(page.getByTestId('fog-region-count')).toHaveText('0');

  // A plain click inside the carved area reveals the whole region — the
  // referee's actual unit of work, not a rectangle drag.
  await selectMapTool(page, 'map-tool-reveal');
  await page.locator(VECTOR_CANVAS).click({ position: { x: 220, y: 210 } });
  await expect(page.getByTestId('fog-region-count')).toHaveText('1');

  // Hide is the exact inverse.
  await selectMapTool(page, 'map-tool-hide');
  await page.locator(VECTOR_CANVAS).click({ position: { x: 220, y: 210 } });
  await expect(page.getByTestId('fog-region-count')).toHaveText('0');
});

test('a Reveal drag reveals a rectangle, and undo takes it back', async ({ page }) => {
  await createRoomAsGm(page, 'Fog Drag');
  await vectorCarve(page, { x: 100, y: 100 }, { x: 400, y: 340 });
  await enableFog(page);

  await selectMapTool(page, 'map-tool-reveal');
  await dragCanvas(page, VECTOR_CANVAS, { x: 140, y: 140 }, { x: 260, y: 240 });
  await expect(page.getByTestId('fog-region-count')).toHaveText('1');

  // Reveal rides the same undo stack as every other vector edit.
  await openMapToolSheet(page);
  await page.getByTestId('map-undo').click();
  await expect(page.getByTestId('fog-region-count')).toHaveText('0');
});

test('Reveal all shows the whole floor; Reset fog closes it again', async ({ page }) => {
  await createRoomAsGm(page, 'Fog Bulk');
  await vectorCarve(page, { x: 100, y: 100 }, { x: 240, y: 220 });
  await vectorCarve(page, { x: 320, y: 260 }, { x: 440, y: 360 });
  await expect(page.getByTestId('floor-region-count')).toHaveText('2');

  await enableFog(page);
  await openMapToolSheet(page);
  await page.getByTestId('fog-reveal-all').click();
  await expect(page.getByTestId('fog-region-count')).toHaveText('2');

  await page.getByTestId('fog-reset').click();
  await expect(page.getByTestId('fog-region-count')).toHaveText('0');
});

test('a token in fog is invisible to players and still visible to the GM', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAsGm(gm, 'Fog Sync');
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('my-role')).toHaveText('player');

  // Carve a room around the starter drop position (160,160) and put a
  // creature in it. Both tabs see it while there is no fog.
  await vectorCarve(gm, { x: 80, y: 80 }, { x: 400, y: 340 });
  await addCreature(gm);
  const gmToken = gm.locator('[data-testid^="token-pos-"]');
  const playerToken = player.locator('[data-testid^="token-pos-"]');
  await expect(gmToken).toHaveCount(1);
  await expect(playerToken).toHaveCount(1);

  // Fog on, nothing revealed: the player loses the token; the GM keeps it.
  await enableFog(gm);
  await expect(player.getByTestId('fog-enabled')).toHaveText('true');
  await expect(playerToken).toHaveCount(0);
  await expect(gmToken).toHaveCount(1);

  // Reveal the room the token is standing in — the player gets it back.
  await selectMapTool(gm, 'map-tool-reveal');
  await gm.locator(VECTOR_CANVAS).click({ position: { x: 200, y: 180 } });
  await expect(gm.getByTestId('fog-region-count')).toHaveText('1');
  await expect(player.getByTestId('fog-region-count')).toHaveText('1');
  await expect(playerToken).toHaveCount(1);

  await gmContext.close();
  await playerContext.close();
});
