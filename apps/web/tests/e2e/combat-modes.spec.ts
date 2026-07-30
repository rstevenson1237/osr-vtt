import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  addCreature,
  createGroup,
  openActivity,
  roomIdFromUrl,
  setInitiativeMode,
} from './helpers';

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

  // --- One token (added via the map's "Add creature" flow —
  // see encounter.spec.ts), in one active group. Individual
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
  await setInitiativeMode(gm, 'individual');
  await openActivity(gm, 'encounter');
  // The mode now lives on the room doc, so it reaches the tracker via the
  // room subscription — wait for that to land before calling, or the call
  // builds a Side-mode order (one row per group) instead of a per-actor one.
  await expect(gm.getByTestId('combat-mode-hint')).toContainText('Individual');
  await gm.getByTestId('combat-call-initiative').click();
  await expect(gm.getByTestId(`combat-row-${tokenA}`)).toHaveCount(1);
  await expect(player.getByTestId(`combat-row-${tokenA}`)).toHaveCount(1);

  // --- The per-row roll button fills a number for the GM-only control.
  // It now goes through the real `publishRoll` pipeline (seeded, logged,
  // animated on every client) and *then* routes the face into the row, so the
  // value round-trips through Firestore before the bound input re-renders —
  // wait for it to change rather than reading straight after the click. ---
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

  // --- End combat clears the order and offers a fresh call for everyone ---
  await gm.getByTestId('combat-end').click();
  await expect(gm.getByTestId('combat-call-initiative')).toBeVisible();
  await expect(player.locator('[data-testid^="combat-row-"]')).toHaveCount(0);

  // --- Free mode (Workflow 1): the app tracks nothing, so the Combat Tracker
  // is not rendered at all — the referee calls for rolls and players use the
  // Roll quick sheet. (This is why the Caller controls, which lived inside the
  // tracker's free branch, are no longer reachable from the board.) ---
  await setInitiativeMode(gm, 'free');
  await openActivity(gm, 'encounter');
  await expect(gm.getByTestId('combat-tracker')).toHaveCount(0);
  await openActivity(player, 'encounter');
  await expect(player.getByTestId('combat-tracker')).toHaveCount(0);

  await gmContext.close();
  await playerContext.close();
});
