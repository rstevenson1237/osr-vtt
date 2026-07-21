import { expect, type Page, test } from '@playwright/test';
import { addCreature, openActivity, roomIdFromUrl } from './helpers';

/**
 * R6 acceptance (Master Plan v2 — Roadmap Gate 10). Covers, over the real
 * Firebase Emulator Suite:
 *  - GM room deletion removes every subcollection (asserted via an admin-context
 *    REST count, bypassing rules with `Authorization: Bearer owner`) and the
 *    ephemeral RTDB node, and the room goes unreachable for players;
 *  - "My Rooms" lists and reopens rooms;
 *  - players still join anonymously with zero prompts — the identity affordance
 *    is optional, never a login wall.
 *
 * The remaining Gate 10 leg — Google link → sign out → recover the same uid +
 * GM seat on a fresh context — is exercised at the emulator/store level in
 * `packages/shared/src/store/account-recovery.emulator.test.ts`. The app links
 * via `linkWithPopup` (production-correct), whose Auth-emulator popup loads
 * `apis.google.com` (gapi); that host is unreachable from this headless sandbox,
 * so the popup UI cannot be driven here. The store-level test proves the same
 * observable outcome (uid preserved in place; a fresh Google sign-in recovers
 * the uid, GM seat, and My Rooms) against the real Auth emulator.
 */

const PROJECT_ID = 'osr-vtt';
const RTDB_NS = `${PROJECT_ID}-default-rtdb`;
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const RTDB_BASE = 'http://127.0.0.1:9000';
// The Firestore/RTDB emulators grant rules-bypassing admin access to any REST
// request carrying this bearer token — the e2e's "admin context" (Gate 10).
const ADMIN = { Authorization: 'Bearer owner' };

async function adminRoomExists(roomId: string): Promise<boolean> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}`, { headers: ADMIN });
  return res.status === 200;
}

async function adminCount(roomId: string, collection: string): Promise<number> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}/${collection}`, { headers: ADMIN });
  if (res.status !== 200) return 0;
  const body = (await res.json()) as { documents?: unknown[] };
  return body.documents?.length ?? 0;
}

async function adminRtdbNodeExists(roomId: string): Promise<boolean> {
  const res = await fetch(`${RTDB_BASE}/rooms/${roomId}.json?ns=${RTDB_NS}`, { headers: ADMIN });
  const text = (await res.text()).trim();
  return text !== 'null' && text !== '';
}

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

test('Gate 10: GM room deletion — unreachable for players, every subcollection + RTDB node gone', async ({
  browser,
}) => {
  const gmCtx = await browser.newContext();
  const playerCtx = await browser.newContext();
  const gm = await gmCtx.newPage();
  const player = await playerCtx.newPage();

  const roomId = await createRoomAndJoin(gm, 'Doomed Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Doomed Vault');

  // Seed Firestore subcollections (a token) and the ephemeral RTDB node (a live
  // cursor, published as the GM moves the pointer over the map).
  await addCreature(gm);
  await expect(player.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
  const canvas = gm.getByTestId('vector-map-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await gm.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await gm.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 5 });
  }

  await expect.poll(() => adminRoomExists(roomId)).toBe(true);
  await expect.poll(() => adminCount(roomId, 'tokens')).toBeGreaterThan(0);
  await expect.poll(() => adminRtdbNodeExists(roomId)).toBe(true);

  // Delete from the Session config danger zone.
  await openActivity(gm, 'session');
  await gm.getByTestId('delete-room-start').click();
  await gm.getByTestId('delete-room-run').click();

  // The GM is returned to the Lobby; the deleted room is not in My Rooms.
  await gm.waitForURL((url) => !/#\/r\//.test(url.hash));
  await expect(gm.getByTestId(`my-room-${roomId}`)).toHaveCount(0);

  // The room is now unreachable for the player — the room doc is gone, so the
  // shell falls back to its loading state and the room name disappears.
  await expect(player.getByTestId('room-name')).toHaveCount(0);

  // Admin context: room doc gone, every subcollection empty, RTDB node gone.
  await expect.poll(() => adminRoomExists(roomId)).toBe(false);
  await expect.poll(() => adminCount(roomId, 'tokens')).toBe(0);
  await expect.poll(() => adminCount(roomId, 'players')).toBe(0);
  await expect.poll(() => adminCount(roomId, 'profiles')).toBe(0);
  await expect.poll(() => adminRtdbNodeExists(roomId)).toBe(false);

  await gmCtx.close();
  await playerCtx.close();
});

test('Gate 10: My Rooms lists a created room and reopens it; players join anonymously with zero prompts', async ({
  browser,
}) => {
  const gmCtx = await browser.newContext();
  const gm = await gmCtx.newPage();
  const roomId = await createRoomAndJoin(gm, 'Hall of Records', 'Referee');

  // Back in the Lobby, the room the GM just made is listed under My Rooms with
  // a Referee badge and reopens straight into the room.
  await gm.goto('/');
  const row = gm.getByTestId(`my-room-${roomId}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('Hall of Records');
  await expect(row).toContainText('Referee');
  await gm.getByTestId(`my-room-open-${roomId}`).click();
  await gm.waitForURL(new RegExp(`#/r/${roomId}`));
  await expect(gm.getByTestId('room-name')).toHaveText('Hall of Records');
  await gmCtx.close();

  // A brand-new player follows the room link and joins with only a display
  // name — no account, no password, no login wall (the identity affordance is
  // present but entirely optional).
  const playerCtx = await browser.newContext();
  const player = await playerCtx.newPage();
  await player.goto(`/#/r/${roomId}`);
  await expect(player.getByTestId('join-display-name')).toBeVisible();
  await expect(player.getByTestId('account-link')).toHaveCount(0); // no login wall on the gate
  await player.getByTestId('join-display-name').fill('Anon Adventurer');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('room-name')).toHaveText('Hall of Records');
  // In-room, saving an identity is offered but was never required to play.
  await expect(player.getByTestId('account-link')).toBeVisible();
  await playerCtx.close();
});
