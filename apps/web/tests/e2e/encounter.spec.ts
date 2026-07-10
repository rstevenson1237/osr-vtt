import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * Phase 2 acceptance test (Plan §7, VTT_Encounter_Screen_Spec.md — Gate 2).
 * Two independent browser contexts against the real Firebase Emulator Suite:
 *  - Groups roster: creating a group and flipping its `[Map]`/`[Board]`
 *    toggles shows/hides the token on the correct surface for the player,
 *    while the GM still sees a hidden actor (flagged) on the board.
 *  - `[Active]` adds a group to the shared initiative pool.
 *  - A full Side/Group-mode round: type initiative, sort, advance through
 *    both sides, wrap into round 2 — round counter and current-turn
 *    highlight (tracker row + Map View tint + TurnStrip) all agree.
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

/** Creates a group via the GM-only GroupsPanel (must already be on the
 * Encounter Board) and returns its Firestore-assigned id. */
async function createGroup(page: Page, name: string, memberTokenIds: string[]): Promise<string> {
  const rows = page.locator('[data-testid^="group-row-"]');
  const before = await rows.count();
  await page.getByTestId('new-group-name').fill(name);
  for (const tokenId of memberTokenIds) {
    await page.getByTestId(`new-group-member-${tokenId}`).check();
  }
  await page.getByTestId('create-group-submit').click();
  await expect(rows).toHaveCount(before + 1);
  const row = page.locator('[data-testid^="group-row-"]', { hasText: name });
  const testId = await row.getAttribute('data-testid');
  if (!testId) throw new Error(`Could not find group row for "${name}"`);
  return testId.replace('group-row-', '');
}

test('groups toggles gate visibility + initiative; a full side-based round advances', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');

  // --- GM drops a token on Map View ---
  await gm.getByTestId('drop-token').click();
  const gmTokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(gmTokenPos).toHaveCount(1);
  const tokenTestId = await gmTokenPos.getAttribute('data-testid');
  const tokenId = tokenTestId!.replace('token-pos-', '');

  // --- Both switch to the Encounter Board ---
  await gm.getByTestId('stage-tab-board').click();
  await player.getByTestId('stage-tab-board').click();

  // Ungrouped tokens are visible on the board by default.
  await expect(player.getByTestId(`board-token-${tokenId}`)).toHaveCount(1);

  // --- Groups roster: Party (has the token) and Monsters (empty side) ---
  const partyId = await createGroup(gm, 'Party', [tokenId]);
  const monstersId = await createGroup(gm, 'Monsters', []);

  // A freshly created group defaults every toggle off — the token is now
  // hidden from the player's board, but the GM still sees it, flagged.
  await expect(player.getByTestId(`board-token-${tokenId}`)).toHaveCount(0);
  await expect(gm.getByTestId(`board-token-hidden-${tokenId}`)).toHaveCount(1);

  // --- [Board] toggle reveals it to the player ---
  await gm.getByTestId(`group-toggle-board-${partyId}`).click();
  await expect(player.getByTestId(`board-token-${tokenId}`)).toHaveCount(1);
  await expect(gm.getByTestId(`board-token-hidden-${tokenId}`)).toHaveCount(0);

  // --- [Map] toggle gates the Map View render independently ---
  await gm.getByTestId('stage-tab-map').click();
  await player.getByTestId('stage-tab-map').click();
  await expect(player.locator(`[data-testid="token-pos-${tokenId}"]`)).toHaveCount(0);

  await gm.getByTestId('stage-tab-board').click();
  await gm.getByTestId(`group-toggle-map-${partyId}`).click();
  await expect(player.locator(`[data-testid="token-pos-${tokenId}"]`)).toHaveCount(1);
  await player.getByTestId('stage-tab-board').click();

  // --- [Active] adds each side to the shared initiative pool ---
  await gm.getByTestId(`group-toggle-active-${partyId}`).click();
  await gm.getByTestId(`group-toggle-active-${monstersId}`).click();

  // --- Start a Side/Group-mode encounter ---
  await gm.getByTestId('combat-mode-side').check();
  await gm.getByTestId('combat-start').click();
  await expect(gm.getByTestId(`combat-row-${partyId}`)).toHaveCount(1);
  await expect(gm.getByTestId(`combat-row-${monstersId}`)).toHaveCount(1);
  await expect(player.getByTestId(`combat-row-${partyId}`)).toHaveCount(1);
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 1');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 1');

  // --- Type initiative per side, then sort high -> low ---
  await gm.getByTestId(`combat-init-input-${partyId}`).fill('6');
  await gm.getByTestId(`combat-init-input-${monstersId}`).fill('2');
  await gm.getByTestId('combat-sort').click();

  await expect(gm.getByTestId('combat-current-label')).toContainText('Party');
  await expect(player.getByTestId('combat-current-label')).toContainText('Party');
  await expect(gm.getByTestId(`combat-row-${partyId}`)).toHaveClass(/current/);

  // The current-turn highlight also reaches Map View (tint + TurnStrip).
  await gm.getByTestId('stage-tab-map').click();
  await expect(gm.getByTestId(`token-current-${tokenId}`)).toHaveText('true');
  await expect(gm.getByTestId('turn-strip-round')).toHaveText('Round 1');
  await expect(gm.getByTestId('turn-strip-current')).toContainText('Party');
  await gm.getByTestId('stage-tab-board').click();

  // --- Advance through a full round: Monsters up next, then wraps into
  // round 2 with Party up again and acted flags cleared ---
  await gm.getByTestId('combat-advance').click();
  await expect(gm.getByTestId('combat-current-label')).toContainText('Monsters');
  await expect(player.getByTestId('combat-current-label')).toContainText('Monsters');

  await gm.getByTestId('combat-advance').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 2');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 2');
  await expect(gm.getByTestId('combat-current-label')).toContainText('Party');
  await expect(gm.getByTestId(`combat-row-${partyId}`)).toHaveClass(/current/);

  await gmContext.close();
  await playerContext.close();
});
