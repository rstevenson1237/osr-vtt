import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl, signInAsReferee } from './helpers';

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
  await signInAsReferee(page);
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
 * The chip keeps showing the previous roll until the new one lands (or until
 * its own hold expires; see `DiceOverlay`). So waiting for it to merely be
 * visible would happily read the **old** value back on the second and later
 * calls, and the caller would then assert the other context against a stale
 * number. Wait for the chip's roll identity to move instead. */
async function rollD20(page: Page): Promise<string> {
  const readout = page.getByTestId('last-roll-readout');
  const previousId =
    (await readout.count()) > 0 ? await readout.getAttribute('data-roll-id') : null;

  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('roll-button').click();

  // Key the wait on the roll *id*, not the displayed number: a d20 can
  // legitimately repeat its previous face, so the text alone cannot tell
  // "the new roll landed" from "the old one is still showing". The wait is on
  // the *persistent* readout, not the chip — the chip is a timed visual that
  // fades and unmounts, so keying off it would race its own hold.
  await expect
    .poll(async () => readout.getAttribute('data-roll-id'), { timeout: 8000 })
    .not.toBe(previousId);
  return (await page.getByTestId('last-roll-total').textContent()) ?? '';
}

test('a result chip clears as soon as it is clicked', async ({ page }) => {
  await createRoomAndJoin(page, 'The Dicing Hall', 'Referee');

  // Roll from the *docked* Roll sheet: no modal backdrop between the pointer
  // and the chip, and no dismissal step to spend part of the chip's ~4s hold
  // on before the click.
  await page.getByTestId('quick-sheet-toggle-roll').click();
  await page.getByTestId('quick-roll-d20').click();
  await page.getByTestId('roll-button').click();

  const chip = page.getByTestId('dice-result-chip');
  await expect(chip).toBeVisible();

  // A reader who is done with a result dismisses it rather than waiting the
  // hold out.
  await chip.click();
  await expect(chip).toHaveCount(0);
});

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

  // --- The chip holds ~4s, then fades out, releases the 3D canvas (R3.4) and
  // *unmounts*. It used to linger forever at opacity 0 — its entrance
  // animation's `both` fill kept re-asserting opacity 1 over the fade — so
  // removal, not a `data-faded` flag, is what's asserted now. ---
  await expect(player.getByTestId('dice-result-chip')).toHaveCount(0, { timeout: 12000 });

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

  // Nothing picked yet — but under SPEC-031 there is no "nothing". The seat was
  // assigned a palette colour when it was created, so the very first roll is
  // already tinted, and the quick sheet already reads one swatch as selected.
  await openActivity(page, 'characters');
  const selected = page.locator('[data-testid^="token-color-swatch-"].selected');
  await expect(selected).toHaveCount(1);
  const assigned = (await selected.getAttribute('aria-label')) ?? '';
  expect(assigned).toMatch(/^#[0-9a-f]{6}$/i);

  await openActivity(page, 'dice');
  await page.getByTestId('tray-mode-summed').click();
  await rollD20(page);
  await expect(page.getByTestId('dice-face-colors')).toHaveText(assigned);

  // Now pick a *different* colour, so the assertion below cannot pass on the
  // assigned one by accident. The swatch's own hex is its aria-label; wait for
  // it to read back as selected, which only happens once the write has
  // round-tripped through the store — the roll below would otherwise race it.
  await openActivity(page, 'characters');
  const first = page.getByTestId('token-color-swatch-0');
  const swatch =
    (await first.getAttribute('aria-label')) === assigned
      ? page.getByTestId('token-color-swatch-1')
      : first;
  const picked = (await swatch.getAttribute('aria-label')) ?? '';
  expect(picked).toMatch(/^#[0-9a-f]{6}$/i);
  expect(picked).not.toBe(assigned);
  await swatch.click();
  await expect(swatch).toHaveClass(/selected/);

  // Every die of the next roll carries exactly that hex — not a per-die-kind
  // palette color, and not a seat-id hash.
  await openActivity(page, 'dice');
  await rollD20(page);
  await expect(page.getByTestId('dice-face-colors')).toHaveText(picked);

  // There is no Clear button any more (SPEC-031 §4) — the unset state it
  // returned to no longer exists, so the control has nothing to do.
  await openActivity(page, 'characters');
  await expect(page.getByTestId('token-color-clear')).toHaveCount(0);
  await expect(swatch).toHaveClass(/selected/);
});

/**
 * The character quick sheet's header shows and edits the seat's
 * `displayName` (IN-024, DEC-030) instead of the old static "Character"
 * label. Double-click opens an inline editor; Enter or blurring outside it
 * commits through `renamePlayer`, Escape discards the draft.
 */
test('character quick sheet header shows and edits the seat name', async ({ page }) => {
  await createRoomAndJoin(page, 'The Rename', 'Original Name');

  await openActivity(page, 'characters');
  const name = page.getByTestId('dock-name');
  await expect(name).toHaveText('Original Name');

  // Escape discards the draft.
  await name.dblclick();
  const editor = page.getByTestId('dock-name-edit');
  await editor.fill('Discarded');
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(name).toHaveText('Original Name');

  // Enter commits.
  await name.dblclick();
  await page.getByTestId('dock-name-edit').fill('Renamed by Enter');
  await page.getByTestId('dock-name-edit').press('Enter');
  await expect(name).toHaveText('Renamed by Enter');

  // Blurring outside the editor (clicking another control) also commits.
  await name.dblclick();
  await page.getByTestId('dock-name-edit').fill('Renamed by Blur');
  await page.getByTestId('token-snap-mode').click();
  await expect(name).toHaveText('Renamed by Blur');

  // The write round-tripped through the store, not just local UI state.
  await page.reload();
  await openActivity(page, 'characters');
  await expect(page.getByTestId('dock-name')).toHaveText('Renamed by Blur');
});
