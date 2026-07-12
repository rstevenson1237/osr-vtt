import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

// Run the dice specs under prefers-reduced-motion: this exercises Gate 4's
// reduced-motion path (the tumble is skipped; the die is placed at its settled
// orientation and the chip shown) and keeps the suite fast + deterministic —
// the full software-WebGL tumble over two contexts is otherwise slow and is a
// human-playtest gate, not an automated one.
test.use({ reducedMotion: 'reduce' });

/**
 * Dice renderer v2 acceptance (Master Plan v2, R3 / Gate 4 / WI-4). The 3D
 * tumble is decorative; the authoritative readout is the result chip, which
 * every client re-derives from the roll's seed. This exercises the parts a
 * headless run can assert deterministically:
 *
 *   - two independent contexts settle a d20 on the *same* value (the
 *     seed-authoritative invariant the whole design protects);
 *   - a fresh roll supersedes the previous one (latest wins — the overlay
 *     rebuilds its world per roll, so old dice can't linger);
 *   - the result chip anchors, then fades and releases (R3.4).
 *
 * The visual guarantees Gate 4 also lists — no post-settle face flip, crisp
 * HiDPI, every shape rendered, previous dice physically cleared — are verified
 * in the human Chromebook playtest that gates the merge; they aren't stable to
 * assert against a software-rendered headless canvas.
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
  await expect(page.getByTestId('room-name')).toBeVisible();
}

/** Rolls a single d20 in Summed mode (so total === the kept face) and returns
 * the value shown on this page's result chip. */
async function rollD20(page: Page): Promise<string> {
  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('roll-button').click();
  await expect(page.getByTestId('last-roll-total')).toBeVisible();
  return (await page.getByTestId('last-roll-total').textContent()) ?? '';
}

test('a d20 settles on the same value in both contexts; new rolls win; the chip fades', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Dicing Hall', 'Referee');
  await joinRoom(player, roomId, 'Player One');

  await openActivity(player, 'dice');
  await player.getByTestId('tray-mode-summed').click();

  // --- Two-context value agreement: the player rolls a d20; the GM's overlay,
  // re-deriving from the synced seed, shows the identical value. The result
  // chip anchors on the roller's screen right after the roll. ---
  const first = await rollD20(player);
  await expect(player.getByTestId('dice-result-chip')).toBeVisible();
  await expect(gm.getByTestId('last-roll-total')).toHaveText(first);

  // --- Latest wins: a second roll supersedes the first on both clients. ---
  const second = await rollD20(player);
  await expect(player.getByTestId('last-roll-total')).toHaveText(second);
  await expect(gm.getByTestId('last-roll-total')).toHaveText(second);

  // --- The chip holds ~4s then fades, releasing the 3D canvas (R3.4). It stays
  // in the DOM as the persistent readout, so the fade is observed via its
  // data-faded flag flipping to "true" rather than removal. (Asserting the
  // transient opaque state is intentionally omitted — it races the slow
  // two-context emulator sync; that the chip fades at all is the point.) ---
  await expect(player.getByTestId('dice-result-chip')).toHaveAttribute('data-faded', 'true', {
    timeout: 12000,
  });

  await gmContext.close();
  await playerContext.close();
});
