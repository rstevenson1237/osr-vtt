import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * Gate 27 — room lifecycle (R25.1/R25.2).
 *
 * Two things only this level can show: that a room whose activity clock has
 * gone quiet actually surfaces the dormant affordance in My Rooms, and that
 * Delete from *that* row is the same well-tested recursive delete as everywhere
 * else (asserted through the Gate 10 admin REST context).
 *
 * The clock itself is seeded through the admin context rather than by waiting
 * 90 days; the write path that maintains it is unit- and contract-tested.
 */

const PROJECT_ID = 'osr-vtt';
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner' };
const DAY = 24 * 60 * 60 * 1000;

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

/** Backdates the room's activity clock, bypassing rules (the room's GM could
 * write this too — the admin context is just the shortest path to a value 90+
 * days old). */
async function adminSetLastActivity(roomId: string, ts: number): Promise<void> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}?updateMask.fieldPaths=lastActivityAt`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { lastActivityAt: { integerValue: String(ts) } } }),
  });
  expect(res.status).toBe(200);
}

async function createRoom(page: Page, roomName: string): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill('Referee');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

/** Back to the Lobby with a fresh read of every room doc (the dormancy check
 * runs off the same existence read the "room gone" row uses). */
async function backToLobby(page: Page): Promise<void> {
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByTestId('my-rooms')).toBeVisible();
}

test('Gate 27: a dormant room surfaces Export/Delete/Keep, and Keep dismisses it', async ({
  page,
}) => {
  const roomId = await createRoom(page, 'Quiet Barrow');

  // A room that has just been played in is not dormant.
  await backToLobby(page);
  await expect(page.getByTestId(`my-room-${roomId}`)).toBeVisible();
  await expect(page.getByTestId(`my-room-dormant-${roomId}`)).toHaveCount(0);

  await adminSetLastActivity(roomId, Date.now() - 120 * DAY);
  await backToLobby(page);
  await expect(page.getByTestId(`my-room-dormant-${roomId}`)).toBeVisible();
  await expect(page.getByTestId(`my-room-dormant-export-${roomId}`)).toBeVisible();
  await expect(page.getByTestId(`my-room-dormant-delete-${roomId}`)).toBeVisible();

  // "Keep" is a dismissal, not a deletion: the row stays, the affordance goes,
  // and the room is untouched.
  await page.getByTestId(`my-room-dormant-keep-${roomId}`).click();
  await expect(page.getByTestId(`my-room-dormant-${roomId}`)).toHaveCount(0);
  await expect(page.getByTestId(`my-room-${roomId}`)).toBeVisible();
  expect(await adminRoomExists(roomId)).toBe(true);

  // ...and it survives a reload, because it is stored on the index entry.
  await backToLobby(page);
  await expect(page.getByTestId(`my-room-${roomId}`)).toBeVisible();
  await expect(page.getByTestId(`my-room-dormant-${roomId}`)).toHaveCount(0);
});

test('Gate 27: Delete from the dormant row removes the room and every subcollection', async ({
  page,
}) => {
  const roomId = await createRoom(page, 'Abandoned Keep');
  await expect.poll(() => adminCount(roomId, 'players')).toBeGreaterThan(0);

  await adminSetLastActivity(roomId, Date.now() - 120 * DAY);
  await backToLobby(page);

  await page.getByTestId(`my-room-dormant-delete-${roomId}`).click();
  // The same confirm + recursive delete the ordinary row uses — no new
  // destructive code path (R25.2).
  await page.getByTestId(`my-room-delete-confirm-${roomId}`).click();

  await expect(page.getByTestId(`my-room-${roomId}`)).toHaveCount(0);
  await expect.poll(() => adminRoomExists(roomId)).toBe(false);
  await expect.poll(() => adminCount(roomId, 'players')).toBe(0);
  await expect.poll(() => adminCount(roomId, 'maps')).toBe(0);
});
