import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { closeQuickSheet, expandQuickSheet, openActivity, roomIdFromUrl } from './helpers';

/**
 * Phase 4 acceptance test (Plan §7 — Gate 4). Two independent browser contexts
 * against the real Firebase Emulator Suite. Covers the referee-engine gate
 * conditions:
 *  1. a hidden roll is unreadable by players, permanently (this replaced the
 *     Blind Drawer, which had the same `gmPrivate` transport plus a reveal);
 *  2. a nested random table resolves and pushes to chat (the Action Log);
 *  3. the global Difficulty + Danger Die widgets update for everyone.
 *
 * (The original condition 4 — `.uvtt` import + dynamic-LoS fog — was removed
 * with the vector map cutover, SPEC §4; see the note at the end of the test.)
 */

async function createRoomAndJoin(
  page: Page,
  roomName: string,
  displayName: string,
): Promise<string> {
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

test('Gate 4: referee engine — hidden rolls, nested tables, and tension widgets', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Howling Deep', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Howling Deep');

  // --- 3. Difficulty + Danger widgets update for everyone ---
  // They are now ordinary encounter-template fields (seeded by default) shown
  // in the top status bar: the referee edits them in place, players read them.
  await gm.getByTestId('field-input-difficulty').selectOption('d8');
  await expect(gm.getByTestId('field-value-difficulty')).toHaveText('d8');
  await expect(player.getByTestId('field-value-difficulty')).toHaveText('d8');

  // The default Clock field is a 6-segment counter.
  await gm.getByTestId('field-up-clock').click();
  await expect(gm.getByTestId('field-value-clock')).toHaveText('1/6');
  await expect(player.getByTestId('field-value-clock')).toHaveText('1/6');

  // Players get the values, never the controls.
  await expect(player.getByTestId('field-input-difficulty')).toHaveCount(0);
  await expect(player.getByTestId('field-up-clock')).toHaveCount(0);
  await expect(player.getByTestId('session-shortcut')).toHaveCount(0);

  // --- 2. A nested table resolves and pushes to chat ---
  // Random tables are a referee-only quick sheet now, not an Encounter-view
  // panel — a wandering-monster check comes up while looking at the map at
  // least as often as at the board. A player has no toggle for it at all.
  await expect(player.getByTestId('quick-sheet-toggle-tables')).toHaveCount(0);
  await expandQuickSheet(gm, 'tables');
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

  // --- 1. A hidden roll never reaches the players ---
  // This replaced the Blind Drawer: the same `gmPrivate` transport (which
  // Security Rules deny players outright), driven from the die roller the
  // referee is already using, with no reveal — a hidden roll stays hidden.
  await closeQuickSheet(gm, 'tables');
  await expandQuickSheet(gm, 'roll');

  // Hidden is referee-only: on the player's own Roll sheet there is one button.
  // Checked with their sheet actually open — a bare `toHaveCount(0)` while the
  // sheet is unmounted would pass no matter what the sheet contained.
  await expandQuickSheet(player, 'roll');
  await expect(player.getByTestId('roll-button')).toHaveCount(1);
  await expect(player.getByTestId('roll-hidden-button')).toHaveCount(0);
  await closeQuickSheet(player, 'roll');
  await openActivity(player, 'log');

  const publicLogLength = async (): Promise<string> =>
    (await player.getByTestId('action-log').textContent()) ?? '';
  const before = await publicLogLength();

  await gm.getByTestId('quick-roll-d20').click();
  await gm.getByTestId('roll-hidden-button').click();

  // The referee gets the result in their own list…
  const hiddenList = gm.getByTestId('hidden-roll-list');
  await expect(hiddenList).toBeVisible();
  await expect(hiddenList.locator('[data-testid^="hidden-roll-"]')).toHaveCount(1);
  const secret = (await hiddenList.textContent())!.trim();
  expect(secret.length).toBeGreaterThan(0);

  // …and nothing at all lands in the shared log the player is watching.
  await expect(player.getByTestId('action-log')).toHaveText(before);
  await expect(player.getByTestId('hidden-roll-list')).toHaveCount(0);

  // A normal roll from the same sheet still publishes, so which button was
  // pressed is the only thing that changes where a roll goes.
  await gm.getByTestId('quick-roll-d20').click();
  await gm.getByTestId('roll-button').click();
  await expect(player.getByTestId('action-log')).not.toHaveText(before);

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
