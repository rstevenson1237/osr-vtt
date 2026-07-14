import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { addCreature, openActivity, roomIdFromUrl } from './helpers';

/**
 * Phase 6 e2e coverage (Plan §7 Phase 6 — "broaden e2e coverage"). Gate 2's
 * own acceptance test (`encounter.spec.ts`) only drives Side/Group mode, but
 * the Encounter Screen Spec (§4) and Plan §7 Phase 2 scope Individual mode
 * equally, and Phase 4 adds Free/Caller mode — none of which had e2e
 * coverage: per-actor initiative rolling/acting, Previous-turn, End
 * combat/scene, and the Caller marker + round-only controls were all
 * untested. Two independent browser contexts against the real Firebase
 * Emulator Suite.
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

test('Individual-mode initiative (roll/acted/previous) and Free/Caller mode both work end to end', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunken Crypt', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunken Crypt');

  // --- One token (the app only ever offers one starter token via the UI —
  // see map-tools.spec.ts/encounter.spec.ts), in one active group. Individual
  // mode pulls its pool from active groups' MEMBERS, per-token rather than
  // per-group, so a single-token group is enough to prove the per-actor
  // controls; the round-wrap behavior of Advance/Previous is equally
  // meaningful with a one-entry pool (see initiative.ts). ---
  await addCreature(gm);
  const tokenLocators = gm.locator('[data-testid^="token-pos-"]');
  await expect(tokenLocators).toHaveCount(1);
  const tokenTestId = await tokenLocators.getAttribute('data-testid');
  const tokenA = tokenTestId!.replace('token-pos-', '');

  await openActivity(gm, 'encounter');
  await openActivity(player, 'encounter');
  const groupId = await createGroup(gm, 'Adventurers', [tokenA]);
  await gm.getByTestId(`group-toggle-active-${groupId}`).click();

  // --- Individual mode: start, the per-actor row appears (refId = tokenId,
  // not groupId — the thing Side mode's own e2e coverage never exercises) ---
  await gm.getByTestId('combat-mode-individual').check();
  await gm.getByTestId('combat-start').click();
  await expect(gm.getByTestId(`combat-row-${tokenA}`)).toHaveCount(1);
  await expect(player.getByTestId(`combat-row-${tokenA}`)).toHaveCount(1);

  // --- Roll-for-initiative button fills a number for the GM-only control.
  // The value round-trips through Firestore (rollFor -> writeEncounter ->
  // subscribeEncounter) before the bound input re-renders, so wait for it
  // to actually change rather than reading it right after the click. ---
  const initInput = gm.getByTestId(`combat-init-input-${tokenA}`);
  await gm.getByTestId(`combat-roll-${tokenA}`).click();
  await expect(initInput).not.toHaveValue('');
  const rolledValue = await initInput.inputValue();
  expect(Number(rolledValue)).toBeGreaterThanOrEqual(1);
  expect(Number(rolledValue)).toBeLessThanOrEqual(6);

  // --- Mark-acted toggles the row's flag, visible to the player too ---
  await gm.getByTestId(`combat-acted-${tokenA}`).click();
  await expect(gm.getByTestId(`combat-row-${tokenA}`)).toHaveClass(/acted/);
  await expect(player.getByTestId(`combat-row-${tokenA}`)).toHaveClass(/acted/);

  // --- Advance past the last entry wraps to a new round and clears `acted`;
  // Previous symmetrically steps back a round ---
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 1');
  await gm.getByTestId('combat-advance').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 2');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 2');
  await expect(gm.getByTestId(`combat-row-${tokenA}`)).not.toHaveClass(/acted/);

  await gm.getByTestId('combat-previous').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 1');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 1');

  // --- End combat drops back to the mode-select screen for everyone ---
  await gm.getByTestId('combat-end').click();
  await expect(gm.getByTestId('combat-mode-side')).toBeVisible();
  await expect(player.locator('[data-testid^="combat-row-"]')).toHaveCount(0);

  // --- Free/Caller mode: no ordered pool, just round + Caller marker ---
  await gm.getByTestId('combat-mode-free').check();
  await gm.getByTestId('combat-start').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 1');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 1');
  await expect(gm.getByTestId('caller-name')).toHaveText('—');

  await gm.getByTestId('caller-select').selectOption({ label: 'Player One' });
  await expect(gm.getByTestId('caller-name')).toHaveText('Player One');
  await expect(player.getByTestId('caller-name')).toHaveText('Player One');

  await gm.getByTestId('caller-rotate').click();
  await expect(gm.getByTestId('caller-name')).toHaveText('Referee');

  await gm.getByTestId('combat-round-advance').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 2');
  await expect(player.getByTestId('combat-round')).toHaveText('Round 2');
  await gm.getByTestId('combat-round-back').click();
  await expect(gm.getByTestId('combat-round')).toHaveText('Round 1');

  await gm.getByTestId('combat-end').click();
  await expect(gm.getByTestId('combat-mode-side')).toBeVisible();

  await gmContext.close();
  await playerContext.close();
});
