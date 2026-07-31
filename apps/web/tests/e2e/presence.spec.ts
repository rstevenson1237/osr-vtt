import { expect, type Page, test } from '@playwright/test';
import { claimOwnToken, openActivity, roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * Presence & seat lifecycle (R26 / Gate 26).
 *
 * The whole feature turns on one distinction, and it is the thing these tests
 * exist to pin: **disconnecting is a display state and must have no data
 * consequence.** A player who closes their laptop comes back to their seat,
 * their character and their tokens exactly as they left them. So every
 * assertion about a seat going away is paired with an assertion that the seat
 * doc is still there.
 *
 * Timing note: R26.2 says a seat reads as disconnected within ~2× the 45 s
 * heartbeat, which is the *worst* case — a client killed hard enough to skip
 * its `onDisconnect`. Closing a browser context drops the RTDB connection
 * cleanly, so the node is removed server-side almost immediately and these
 * tests do not have to wait 90 s. The staleness path is unit-tested instead
 * (`presence.test.ts`), where time can be controlled rather than endured.
 */

const PROJECT_ID = 'osr-vtt';
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner' };

/** Reads a seat doc through the rules-bypassing admin REST context, so "the
 * seat survived" is asserted against the database rather than the UI that is
 * under test. */
async function adminSeatExists(roomId: string, uid: string): Promise<boolean> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}/players/${uid}`, { headers: ADMIN });
  return res.status === 200;
}

async function uidOf(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const record = await new Promise<{ value?: { uid?: string } } | undefined>((resolve) => {
      const open = indexedDB.open('firebaseLocalStorageDb');
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const db = open.result;
        const req = db
          .transaction('firebaseLocalStorage')
          .objectStore('firebaseLocalStorage')
          .getAll();
        req.onsuccess = () => resolve(req.result[0] as { value?: { uid?: string } });
        req.onerror = () => resolve(undefined);
      };
    });
    return record?.value?.uid ?? '';
  });
}

test('Gate 26: presence goes live, drops on disconnect without touching the seat, and returns', async ({
  browser,
}) => {
  const gmCtx = await browser.newContext();
  const gm = await gmCtx.newPage();
  await signInAsReferee(gm, 'presence-gm');
  await gm.getByTestId('create-room-name').fill('The Waiting Hall');
  await gm.getByTestId('create-room-submit').click();
  await gm.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(gm.url());
  await gm.getByTestId('join-display-name').fill('Referee');
  await gm.getByTestId('join-submit').click();
  await expect(gm.getByTestId('room-name')).toHaveText('The Waiting Hall');

  // --- A player joins anonymously (unchanged by R24.1) ---
  let playerCtx = await browser.newContext();
  let player = await playerCtx.newPage();
  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('room-name')).toHaveText('The Waiting Hall');
  const playerUid = await uidOf(player);
  expect(playerUid).not.toBe('');

  // --- Both contexts show each other as present ---
  await openActivity(gm, 'session');
  const playerDot = gm.getByTestId(`player-presence-${playerUid}`);
  await expect(playerDot).toHaveAttribute('data-present', 'true', { timeout: 20_000 });

  // The referee's own row reads present too — GM membership is not a special
  // case for presence, only for authority.
  const gmUid = await uidOf(gm);
  await expect(gm.getByTestId(`player-presence-${gmUid}`)).toHaveAttribute('data-present', 'true');

  // --- The player's token is undimmed while they are here ---
  // No overlay dismissal needed: `claimOwnToken` routes through `openActivity`,
  // which clears any backdrop first. (A bare `click()` on a locator that may
  // not exist waits out the whole *test* timeout, not the expect timeout —
  // never reach for one as a "just in case".)
  const tokenId = await claimOwnToken(player);
  await openActivity(gm, 'map');
  await expect(gm.getByTestId(`token-away-${tokenId}`)).toHaveText('false', { timeout: 20_000 });

  // --- The player closes their tab ---
  await playerCtx.close();

  // Presence drops...
  await openActivity(gm, 'session');
  await expect(playerDot).toHaveAttribute('data-present', 'false', { timeout: 30_000 });

  // ...and this is the assertion the whole feature is built around: the seat
  // doc is untouched. Disconnecting is a display state, nothing more.
  expect(await adminSeatExists(roomId, playerUid)).toBe(true);
  await expect(gm.getByTestId(`player-row-${playerUid}`)).toBeVisible();
  // Their controls stay live — a disconnected player is still administrable.
  await expect(gm.getByTestId(`player-remove-${playerUid}`)).toBeEnabled();

  // The map dims their token rather than hiding or moving it.
  await openActivity(gm, 'map');
  await expect(gm.getByTestId(`token-away-${tokenId}`)).toHaveText('true', { timeout: 30_000 });
  await expect(gm.getByTestId(`token-pos-${tokenId}`)).toBeVisible();

  // --- They come back ---
  playerCtx = await browser.newContext();
  player = await playerCtx.newPage();
  await player.goto(`/#/r/${roomId}`);
  // A returning player gets a fresh anonymous uid in a fresh context, so this
  // re-joins as a new seat; what matters for the gate is that presence flips
  // back to live and the ORIGINAL seat is still sitting there untouched.
  await player.getByTestId('join-display-name').fill('Player One Returns');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('room-name')).toHaveText('The Waiting Hall');
  const returningUid = await uidOf(player);

  await openActivity(gm, 'session');
  await expect(gm.getByTestId(`player-presence-${returningUid}`)).toHaveAttribute(
    'data-present',
    'true',
    { timeout: 30_000 },
  );
  expect(await adminSeatExists(roomId, playerUid)).toBe(true);

  await playerCtx.close();
  await gmCtx.close();
});

test('Gate 26: the inactive-seat prune is absent when no seat qualifies', async ({ browser }) => {
  // The negative case, which is the one a referee actually meets: a healthy
  // room shows no prune block at all rather than an empty danger-zone control
  // inviting a click that does nothing.
  const ctx = await browser.newContext();
  const gm = await ctx.newPage();
  await signInAsReferee(gm, 'presence-quiet');
  await gm.getByTestId('create-room-name').fill('Freshly Dug');
  await gm.getByTestId('create-room-submit').click();
  await gm.waitForURL(/#\/r\//);
  await gm.getByTestId('join-display-name').fill('Referee');
  await gm.getByTestId('join-submit').click();
  // Wait for the shell before reaching for its chrome: `openActivity`'s gear
  // lookup uses `count()`, which does not auto-wait, so calling it mid-join
  // silently falls through to the mobile testid and then hangs.
  await expect(gm.getByTestId('room-name')).toHaveText('Freshly Dug');

  await openActivity(gm, 'session');
  await expect(gm.getByTestId('session-maintenance')).toBeVisible();
  await expect(gm.getByTestId('inactive-seats')).toHaveCount(0);

  await ctx.close();
});
