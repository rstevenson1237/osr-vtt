import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

// The `/r` overlay roll rides the dice renderer; run under reduced motion so the
// tumble is skipped and the result chip settles deterministically (same rationale
// as dice-overlay.spec.ts).
test.use({ reducedMotion: 'reduce' });

/**
 * Log activity + chat acceptance (Master Plan v2, R5 / Gate 7 / WI-7):
 *  - a player's chat line reaches the GM with a resolved author + timestamp;
 *  - `/r 2d6` runs a real roll — overlay + log entry, identical on both clients;
 *  - per-type filter chips and search operate over the loaded entries.
 *
 * "Load older" pagination across the 200 boundary is proven in the store
 * contract suite (writing 200+ entries is impractical over two live browsers);
 * here we cover the UI wiring a headless run can assert deterministically.
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

test('chat + /r reach both clients with author/time; filters and search work', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Whispering Keep', 'Referee');
  await joinRoom(player, roomId, 'Player One');

  await openActivity(player, 'log');
  await openActivity(gm, 'log');

  // --- A player chat line reaches the GM with author + time (Gate 7) ---
  await player.getByTestId('chat-text-stage').fill('Hail and well met');
  await player.getByTestId('chat-send-stage').click();

  const gmChat = gm.getByTestId('log-entry').filter({ hasText: 'Hail and well met' });
  await expect(gmChat).toBeVisible();
  await expect(gmChat).toHaveAttribute('data-log-type', 'chat');
  await expect(gmChat.getByTestId('log-author')).toHaveText('Player One');
  await expect(gmChat.getByTestId('log-time')).toBeVisible();

  // --- `/r 2d6` produces an overlay roll + a log entry identical on both
  // clients. The overlay total (summed) is the shared, seed-derived truth. ---
  await player.getByTestId('chat-text-stage').fill('/r 2d6');
  await player.getByTestId('chat-send-stage').click();

  await expect(player.getByTestId('last-roll-total')).toBeVisible();
  const total = (await player.getByTestId('last-roll-total').textContent()) ?? '';
  await expect(gm.getByTestId('last-roll-total')).toHaveText(total);

  // Both logs get the same roll entry text (a `roll`-typed entry).
  const playerRoll = player.getByTestId('log-entry').filter({ hasText: '= ' }).last();
  await expect(playerRoll).toHaveAttribute('data-log-type', 'roll');
  const rollText = (await playerRoll.textContent()) ?? '';
  expect(rollText).toContain(`= ${total}`);
  await expect(
    gm
      .getByTestId('log-entry')
      .filter({ hasText: `= ${total}` })
      .last(),
  ).toHaveAttribute('data-log-type', 'roll');

  // --- An unknown command posts nothing and hints inline ---
  await player.getByTestId('chat-text-stage').fill('/bogus');
  await player.getByTestId('chat-send-stage').click();
  await expect(player.getByTestId('chat-hint-stage')).toBeVisible();
  await expect(player.getByTestId('log-entry').filter({ hasText: '/bogus' })).toHaveCount(0);

  // --- Filters operate over loaded entries: hiding Chat drops the chat line
  // but keeps the roll entry. ---
  await player.getByTestId('log-filter-chat').click();
  await expect(
    player.getByTestId('log-entry').filter({ hasText: 'Hail and well met' }),
  ).toHaveCount(0);
  await expect(player.getByTestId('log-entry').filter({ hasText: '= ' })).toHaveCount(1);
  // Re-enable Chat for the search step.
  await player.getByTestId('log-filter-chat').click();

  // --- Search narrows the loaded set by substring ---
  await player.getByTestId('log-search').fill('Hail');
  await expect(
    player.getByTestId('log-entry').filter({ hasText: 'Hail and well met' }),
  ).toHaveCount(1);
  await expect(player.getByTestId('log-entry').filter({ hasText: '= ' })).toHaveCount(0);

  await gmContext.close();
  await playerContext.close();
});

test('the log opens at the newest entry, and stops following once you scroll up', async ({
  page,
}) => {
  // A short viewport, so a handful of entries is already more than the modal
  // (82vh) can show. Kept wide enough to stay on the desktop layout, which the
  // mobile breakpoint takes below 900px.
  await page.setViewportSize({ width: 1280, height: 460 });
  await createRoomAndJoin(page, 'The Long Ledger', 'Referee');
  await openActivity(page, 'log');

  // Numbered and padded: numbered so the first and last are identifiable, and
  // long enough that each entry wraps to several lines — the point is that the
  // scroller genuinely overflows, which is asserted below rather than assumed.
  const PAD = 'and then a great deal more happened besides, at length, in detail';
  for (let i = 1; i <= 20; i++) {
    await page.getByTestId('chat-text-stage').fill(`line ${i} — ${PAD}`);
    await page.getByTestId('chat-send-stage').click();
  }
  await expect(page.getByTestId('log-entry').filter({ hasText: 'line 20' })).toBeVisible();

  const surface = page.getByTestId('log-surface');
  const atBottom = async (): Promise<boolean> =>
    surface.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  const overflows = await surface.evaluate((el) => el.scrollHeight > el.clientHeight + 40);
  expect(overflows).toBe(true);

  // Reopening lands on the newest entry, not the oldest — entries render
  // oldest-first, so an unmanaged scroller would open at "line 1".
  await page.getByTestId('overlay-close').click();
  await openActivity(page, 'log');
  await expect.poll(atBottom).toBe(true);

  // Scrolling up to read history releases the pin: a new entry arriving must
  // not yank the reader back down.
  await surface.evaluate((el) => (el.scrollTop = 0));
  // The component learns the reader moved from the element's own scroll event,
  // so wait for the scroll to have settled at the top before posting.
  await expect.poll(() => surface.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByTestId('chat-text-stage').fill(`line 21 — ${PAD}`);
  await page.getByTestId('chat-send-stage').click();
  await expect(page.getByTestId('log-entry').filter({ hasText: 'line 21' })).toHaveCount(1);
  expect(await atBottom()).toBe(false);
});
