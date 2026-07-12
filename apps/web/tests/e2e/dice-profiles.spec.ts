import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

// The dice renderer v2 overlay (WI-4) is a full-viewport 3D canvas; run this
// roll-heavy flow under prefers-reduced-motion so the decorative tumble is
// skipped (settled frame + chip only). The roll values are unchanged — this
// only skips the animation, keeping the suite fast/deterministic in the
// software-rendered CI browser.
test.use({ reducedMotion: 'reduce' });

/**
 * Phase 3 acceptance test (Plan §7, VTT_Encounter_Screen_Spec.md — Gate 3).
 * Two independent browser contexts against the real Firebase Emulator Suite:
 *  - GM adds a field to the room's profileTemplate; the dock re-renders
 *    generically for both tabs.
 *  - The dynamic tray: multiple dice + a flat modifier in Summed mode
 *    (matching total on both tabs); multiple dice in Separate mode (each
 *    flagged); Advantage noted on the settled roll.
 *  - A saved macro replays into the tray.
 *  - Linking a token to a seat surfaces that Profile's roll shortcut on its
 *    actor card, and selecting the card raises the Dock on that profile.
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

test('dynamic tray, macros, template editing, and actor-card roll links', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunless Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');

  // --- GM adds a profile template field via the Session activity; both docks
  // re-render generically in the Characters activity ---
  await openActivity(gm, 'session');
  await gm.getByTestId('template-new-label').fill('Armor Class');
  await gm.getByTestId('template-new-type').selectOption('number');
  await gm.getByTestId('template-new-default').fill('14');
  await gm.getByTestId('template-add-field').click();

  await openActivity(gm, 'characters');
  await expect(gm.getByTestId('profile-field-armor-class')).toBeVisible();
  await openActivity(player, 'characters');
  await expect(player.getByTestId('profile-field-armor-class')).toBeVisible();
  await expect(player.getByTestId('field-input-armor-class')).toHaveValue('14');

  // --- Player fills in a name (so we can later prove the Dock switches profiles) ---
  await player.getByTestId('field-input-name').fill('Bram the Bold');

  // --- Summed mode: d20 + d6 + a flat modifier (Dice activity) ---
  await openActivity(player, 'dice');
  await player.getByTestId('tray-add-d20').click();
  await player.getByTestId('tray-add-d6').click();
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(2);
  await player.getByTestId('tray-modifier').fill('3');
  await player.getByTestId('tray-mode-summed').click();
  await player.getByTestId('roll-button').click();

  await expect(player.getByTestId('last-roll-total')).toBeVisible();
  const playerTotal = await player.getByTestId('last-roll-total').textContent();
  await expect(gm.getByTestId('last-roll-total')).toHaveText(playerTotal ?? '');
  // Rolling clears the staged dice but keeps the mode/modifier settings.
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(0);

  // --- Separate mode: two dice, each flagged on its own ---
  await player.getByTestId('tray-mode-separate').click();
  await player.getByTestId('tray-add-d6').click();
  await player.getByTestId('tray-add-d6').click();
  await player.getByTestId('roll-button').click();
  await expect(player.locator('[data-testid="last-roll-result"] .badge')).toHaveCount(2);

  // --- Advantage: rolling a single d20 notes ADV on the settled roll ---
  await player.getByTestId('tray-adv-advantage').click();
  await player.getByTestId('tray-add-d20').click();
  await player.getByTestId('roll-button').click();
  await expect(player.getByTestId('last-roll-advantage')).toHaveText('ADV');
  await player.getByTestId('tray-adv-normal').click();

  // --- Save the current tray as a macro, then replay it ---
  await player.getByTestId('tray-add-d6').click();
  await player.getByTestId('macro-name-input').fill('Torch Check');
  await player.getByTestId('macro-save').click();
  const macroRow = player.locator('[data-testid^="macro-row-"]');
  await expect(macroRow).toHaveCount(1);
  await player.getByTestId('roll-button').click(); // roll + clear the tray
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(0);

  const macroTestId = await macroRow.getAttribute('data-testid');
  const macroId = macroTestId!.replace('macro-row-', '');
  await player.getByTestId(`macro-replay-${macroId}`).click();
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(1);
  await player.getByTestId('roll-button').click();

  // --- GM drops a token (Map activity), then links it to the player's seat ---
  await openActivity(gm, 'map');
  await gm.getByTestId('drop-token').click();
  const gmTokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(gmTokenPos).toHaveCount(1);
  const tokenTestId = await gmTokenPos.getAttribute('data-testid');
  const tokenId = tokenTestId!.replace('token-pos-', '');

  await openActivity(gm, 'encounter');
  await openActivity(player, 'encounter');

  await gm.getByTestId(`ownership-select-${tokenId}`).selectOption({ label: 'Player One' });

  // --- The linked Profile's roll field surfaces as a card shortcut ---
  await expect(player.getByTestId(`board-roll-${tokenId}-combat`)).toBeVisible();
  await player.getByTestId(`board-roll-${tokenId}-combat`).click();
  // The staged die shows in the Dice mini-card (opened over the Encounter stage).
  await openActivity(player, 'dice');
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(1);
  await player.getByTestId('roll-button').click();

  // --- The roll strip picks up recent rolls, on both tabs ---
  await expect(player.locator('[data-testid^="roll-strip-entry-"]').first()).toBeVisible();
  await expect(gm.locator('[data-testid^="roll-strip-entry-"]').first()).toBeVisible();

  // --- Selecting the linked card raises the Dock on that profile ---
  // GM's own sheet is empty (Characters mini-card); close it so the Encounter
  // stage is clickable again (an open mini-card scrims stage clicks).
  await openActivity(gm, 'characters');
  await expect(gm.getByTestId('field-input-name')).toHaveValue('');
  await openActivity(gm, 'characters'); // toggle the mini-card closed

  // Selecting the linked actor card on the board raises the dock on its profile.
  await gm.getByTestId(`board-token-${tokenId}`).click();
  await openActivity(gm, 'characters');
  await expect(gm.getByTestId('dock-back-to-mine')).toBeVisible();
  await expect(gm.getByTestId('field-input-name')).toHaveValue('Bram the Bold');
  await gm.getByTestId('dock-back-to-mine').click();
  await expect(gm.getByTestId('dock-back-to-mine')).toHaveCount(0);
  await expect(gm.getByTestId('field-input-name')).toHaveValue('');

  // --- Reloading preserves the template edit and the profile value ---
  await player.reload();
  await openActivity(player, 'characters');
  await expect(player.getByTestId('profile-field-armor-class')).toBeVisible();
  await expect(player.getByTestId('field-input-name')).toHaveValue('Bram the Bold');

  await gmContext.close();
  await playerContext.close();
});
