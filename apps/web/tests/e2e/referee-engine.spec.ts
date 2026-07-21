import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

/**
 * Phase 4 acceptance test (Plan §7 — Gate 4). Two independent browser contexts
 * against the real Firebase Emulator Suite. Covers the referee-engine gate
 * conditions:
 *  1. a Blind-Drawer result stays unreadable by players until revealed;
 *  2. a nested random table resolves and pushes to chat (the Action Log);
 *  3. the global Difficulty + Danger Die widgets update for everyone.
 *
 * (The original condition 4 — `.uvtt` import + dynamic-LoS fog — was removed
 * with the vector map cutover, SPEC §4; see the note at the end of the test.)
 */

async function createRoomAndJoin(page: Page, roomName: string, displayName: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

async function joinRoom(page: Page, roomId: string, displayName: string): Promise<void> {
  await page.goto(`/#/r/${roomId}`);
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
}

test('Gate 4: referee engine — blind draws, nested tables, and tension widgets', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Howling Deep', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Howling Deep');

  // Both to the Encounter activity (tension widgets, tables, blind drawer).
  await openActivity(gm, 'encounter');
  await openActivity(player, 'encounter');

  // --- 3. Difficulty + Danger widgets update for everyone ---
  await gm.getByTestId('difficulty-die-select').selectOption('d8');
  await expect(gm.getByTestId('difficulty-die-value')).toHaveText('d8');
  await expect(player.getByTestId('difficulty-die-value')).toHaveText('d8');

  await gm.getByTestId('danger-clock-size-4').click();
  await gm.getByTestId('danger-clock-advance').click();
  await expect(gm.getByTestId('danger-clock-count')).toHaveText('1/4');
  await expect(player.getByTestId('danger-clock-count')).toHaveText('1/4');

  // Players cannot drive the widgets (GM-only controls).
  await expect(player.getByTestId('difficulty-die-select')).toHaveCount(0);

  // --- 2. A nested table resolves and pushes to chat ---
  await gm.getByTestId('load-sample-tables').click();
  const wanderingRow = gm.locator('[data-testid^="table-row-"]', { hasText: 'Wandering Monsters' });
  await expect(wanderingRow).toHaveCount(1);
  await wanderingRow.locator('[data-testid^="table-roll-"]').click();

  // The full Action Log now lives in the Log activity (re-housed off the old
  // sidebar). The player opens it to watch the shared log; the GM keeps the
  // Encounter tools on stage.
  await openActivity(player, 'log');

  // The resolved result lands in the shared Action Log for the player, with
  // every nested `[[…]]` token expanded (no raw tokens survive).
  await expect(player.getByTestId('action-log')).toContainText('Wandering Monsters:');
  await expect(player.getByTestId('action-log')).not.toContainText('[[');

  // --- 1. A Blind-Drawer result is hidden from players until revealed ---
  const SECRET = 'XYZZY-SECRET-AMBUSH';
  // The Blind Drawer panel is GM-only; a player never even sees the control.
  await expect(player.getByTestId('blind-drawer')).toHaveCount(0);

  await gm.getByTestId('blind-draw-title').fill('Ambush check');
  await gm.getByTestId('blind-draw-note').fill(SECRET);
  await gm.getByTestId('blind-draw-note-add').click();

  // GM sees the stashed result; the player's page contains it nowhere yet.
  await expect(gm.getByText(SECRET)).toHaveCount(1);
  await expect(player.getByTestId('action-log')).not.toContainText(SECRET);
  await expect(player.locator('body')).not.toContainText(SECRET);

  // Reveal → it is copied into the shared log and becomes readable by the player.
  await gm.locator('[data-testid^="blind-draw-reveal-"]').first().click();
  await expect(player.getByTestId('action-log')).toContainText(SECRET);

  // NOTE: the original condition 4 — an imported `.uvtt` blocking vision via
  // dynamic-LoS *fog* — was removed with the vector map cutover (SPEC §4: fog
  // and `.uvtt` import are gone; there is no fog visibility masking). Vector
  // line-of-sight itself (walls/doors → sight segments, and the Eye-tool
  // visibility polygon) is covered by the shared unit tests
  // (`buildSightSegments`, `store/vector-los`, `vectorMap.visibilityPolygon`),
  // not this e2e, since it renders to the Pixi canvas with no fog-mask DOM to
  // assert against.

  await gmContext.close();
  await playerContext.close();
});
