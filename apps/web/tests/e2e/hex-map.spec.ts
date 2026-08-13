import { expect, type Page, test } from '@playwright/test';
import {
  openActivity,
  openMapToolSheet,
  roomIdFromUrl,
  signInAsReferee,
  switchToEditMode,
} from './helpers';

/**
 * Hex crawl rendering (SPEC-030 §1, WI-039). The grid itself and its
 * coordinate pills are Pixi-drawn, so what a spec can see is the introspection
 * readout (`map-grid-kind` / `map-hex-size` — which grid the renderer was
 * handed) plus the palette the map offers. Between them they cover the two
 * things that could actually go wrong here: the square lattice rendering on a
 * hex map, and a square-lattice carve tool staying reachable on one (RULE-006).
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

  // SPEC-030 §5: no carve tool on a map with no carved floor. Pan survives.
  await openMapToolSheet(page);
  await expect(page.getByTestId('vector-tool-pan')).toBeVisible();
  await expect(page.getByTestId('vector-tool-room')).toHaveCount(0);
  await expect(page.getByTestId('vector-tool-carve')).toHaveCount(0);
  await expect(page.getByTestId('vector-tool-wall')).toHaveCount(0);
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
