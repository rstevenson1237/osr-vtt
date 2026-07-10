import { expect, test } from '@playwright/test';
import { dragCanvas, roomIdFromUrl } from './helpers';

/**
 * Phase 0 vertical slice acceptance test (Plan §8 Acceptance).
 * Two independent browser contexts (separate Anonymous Auth identities)
 * against the real Firebase Emulator Suite:
 *  - GM creates + joins a room; player joins the same room.
 *  - GM drops and drags a token — player sees it sync on Map View + Board.
 *  - The dock renders the room's profileTemplate generically; a `roll`
 *    field stages its die and rolls it — both tabs render the same face
 *    and the same log resultClass.
 *  - Reloading the player tab restores everything via onSnapshot.
 */
test('GM and player stay in sync end to end', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  // --- GM creates the room ---
  await gm.goto('/');
  await gm.getByTestId('create-room-name').fill('The Sunless Vault');
  await gm.getByTestId('create-room-submit').click();
  await gm.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(gm.url());

  await gm.getByTestId('join-display-name').fill('Referee');
  await gm.getByTestId('join-submit').click();
  await expect(gm.getByTestId('room-name')).toHaveText('The Sunless Vault');
  await expect(gm.getByTestId('my-role')).toHaveText('gm');

  // --- Player joins the same room via its ID ---
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');
  await expect(player.getByTestId('my-role')).toHaveText('player');

  // --- GM drops the starter token; player sees it on Map View ---
  await gm.getByTestId('drop-token').click();
  const gmTokenPos = gm.locator('[data-testid^="token-pos-"]');
  const playerTokenPos = player.locator('[data-testid^="token-pos-"]');
  await expect(gmTokenPos).toHaveCount(1);
  await expect(playerTokenPos).toHaveCount(1);
  await expect(playerTokenPos).toHaveText('160,160');

  // --- GM drags the token; player sees the same settled position ---
  await dragCanvas(gm, '[data-testid="map-canvas"] canvas', { x: 160, y: 160 }, { x: 320, y: 260 });
  await expect(gmTokenPos).not.toHaveText('160,160');
  const settledPos = await gmTokenPos.textContent();
  await expect(playerTokenPos).toHaveText(settledPos ?? '');

  // --- Encounter Board reflects the same token at the same position ---
  await player.getByTestId('stage-tab-board').click();
  await expect(player.locator('[data-testid^="board-token-pos-"]')).toHaveText(settledPos ?? '');

  // --- Dock renders the profileTemplate generically ---
  await expect(player.getByTestId('profile-field-name')).toBeVisible();
  await expect(player.getByTestId('profile-field-torches')).toBeVisible();
  await expect(player.getByTestId('profile-field-combat')).toBeVisible();

  await player.getByTestId('field-input-name').fill('Bram the Bold');
  await player.getByTestId('profile-counter-inc-torches').click();
  await expect(player.getByTestId('profile-counter-value-torches')).toHaveText('4');

  // --- Tapping the roll field stages its die in the tray ---
  await player.getByTestId('profile-roll-combat').click();
  await expect(player.locator('[data-testid^="staged-die-"]')).toHaveCount(1);

  // --- Rolling: both tabs render the same face + the same log class ---
  await player.getByTestId('roll-button').click();

  const playerResult = player.getByTestId('last-roll-result');
  const gmResult = gm.getByTestId('last-roll-result');
  await expect(playerResult).toBeVisible();
  const resultText = await playerResult.textContent();
  await expect(gmResult).toHaveText(resultText ?? '');

  const resultClass = await player
    .getByTestId('log-entry')
    .last()
    .getAttribute('data-result-class');
  expect(resultClass).toMatch(/^(success|complication|failure)$/);
  await expect(gm.getByTestId('log-entry').last()).toHaveAttribute(
    'data-result-class',
    resultClass ?? '',
  );

  // --- Reloading the player tab restores everything via onSnapshot ---
  await player.reload();
  await expect(player.getByTestId('room-name')).toHaveText('The Sunless Vault');
  await expect(player.locator('[data-testid^="token-pos-"]')).toHaveText(settledPos ?? '');
  await expect(player.getByTestId('profile-counter-value-torches')).toHaveText('4');
  await expect(player.getByTestId('field-input-name')).toHaveValue('Bram the Bold');
  await expect(player.getByTestId('log-entry').last()).toHaveAttribute(
    'data-result-class',
    resultClass ?? '',
  );

  await gmContext.close();
  await playerContext.close();
});
