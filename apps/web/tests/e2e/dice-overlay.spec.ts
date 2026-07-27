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
  await expect(page.getByTestId('room-name')).toBeVisible();
}

/** Rolls a single d20 in Summed mode (so total === the kept face) and returns
 * the value shown on this page's result chip.
 *
 * The chip is the *persistent* readout — it keeps showing the previous roll
 * until the new one lands (that is the point of it; see `DiceOverlay`). So
 * waiting for it to merely be visible would happily read the **old** value back
 * on the second and later calls, and the caller would then assert the other
 * context against a stale number. Wait for the chip's roll identity to move
 * instead. */
async function rollD20(page: Page): Promise<string> {
  const chip = page.getByTestId('dice-result-chip');
  const previousId = (await chip.count()) > 0 ? await chip.getAttribute('data-roll-id') : null;

  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('roll-button').click();

  // Key the wait on the roll *id*, not the displayed number: a d20 can
  // legitimately repeat its previous face, so the text alone cannot tell
  // "the new roll landed" from "the old one is still showing".
  await expect(chip).toBeVisible();
  await expect
    .poll(async () => chip.getAttribute('data-roll-id'), { timeout: 8000 })
    .not.toBe(previousId);
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

/**
 * Die color has exactly one source: the character quick sheet's picker
 * (`ProfileInstance.color`). This guards the plumbing that was broken — the
 * pick reaching the renderer — for both roll paths (solo, keyed by
 * `authorUid`, and shared, keyed by `seatId`). The pick → *pixel* half is
 * covered by the pure `faceColor`/`inkFor` unit tests in
 * `src/lib/dice/textures.test.ts`: the WebGL canvas has no
 * `preserveDrawingBuffer`, so Playwright cannot read the rendered dice back.
 */
test('dice render in the color picked on the character quick sheet', async ({ page }) => {
  await createRoomAndJoin(page, 'The Palette', 'Referee');

  // No pick yet: the renderer is handed nothing and paints the one neutral.
  await openActivity(page, 'dice');
  await page.getByTestId('tray-mode-summed').click();
  await rollD20(page);
  await expect(page.getByTestId('dice-face-colors')).toHaveText('');

  // Pick a color on the character quick sheet. The swatch's own hex is its
  // aria-label; wait for the swatch to read back as selected, which only
  // happens once the write has round-tripped through the store — the roll
  // below would otherwise race the pick.
  await openActivity(page, 'characters');
  const swatch = page.getByTestId('token-color-swatch-0');
  const picked = (await swatch.getAttribute('aria-label')) ?? '';
  expect(picked).toMatch(/^#[0-9a-f]{6}$/i);
  await swatch.click();
  await expect(swatch).toHaveClass(/selected/);

  // Every die of the next roll carries exactly that hex — not a per-die-kind
  // palette color, and not a seat-id hash.
  await openActivity(page, 'dice');
  await rollD20(page);
  await expect(page.getByTestId('dice-face-colors')).toHaveText(picked);

  // Clearing it returns to the neutral rather than to some other color.
  await openActivity(page, 'characters');
  await page.getByTestId('token-color-clear').click();
  await expect(swatch).not.toHaveClass(/selected/);
  await openActivity(page, 'dice');
  await rollD20(page);
  await expect(page.getByTestId('dice-face-colors')).toHaveText('');
});
