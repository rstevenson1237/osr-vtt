import { expect, test } from '@playwright/test';
import { roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * SPEC-070 — a room a newer build has opened stops the stale tab.
 *
 * The newer build is simulated by raising `schemaVersion` on the stored room
 * doc through the rules-bypassing admin REST context, while a referee tab has
 * the room open. The contract suite covers the store half; this proves the
 * shell replaces the room view and that Reload brings the tab back.
 */

const PROJECT_ID = 'osr-vtt';
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner' };

async function adminSetSchemaVersion(roomId: string, version: number): Promise<void> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}?updateMask.fieldPaths=schemaVersion`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { schemaVersion: { integerValue: String(version) } } }),
  });
  expect(res.status).toBe(200);
}

async function adminGetSchemaVersion(roomId: string): Promise<number> {
  const res = await fetch(`${FS_BASE}/rooms/${roomId}`, { headers: ADMIN });
  const body = (await res.json()) as { fields: { schemaVersion: { integerValue: string } } };
  return Number(body.fields.schemaVersion.integerValue);
}

test('a stale referee tab shows the Reload panel when a newer build opens its room', async ({
  page,
}) => {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill('Newer Room Keep');
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await expect(page.getByTestId('room-name')).toHaveText('Newer Room Keep');
  await expect(page.getByTestId('newer-room-panel')).toHaveCount(0);

  const stamped = await adminGetSchemaVersion(roomId);
  await adminSetSchemaVersion(roomId, stamped + 5);

  await expect(page.getByTestId('newer-room-panel')).toBeVisible();
  await expect(page.getByTestId('newer-room-reload')).toBeVisible();
  await expect(page.getByTestId('room-name')).toHaveCount(0);

  // The panel stops writes, so the stored stamp is exactly what the "newer
  // build" left. Reload re-opens the room, which is still newer, so the panel
  // comes straight back.
  expect(await adminGetSchemaVersion(roomId)).toBe(stamped + 5);
  await page.getByTestId('newer-room-reload').click();
  await expect(page.getByTestId('newer-room-panel')).toBeVisible();

  // The subscription stays open: once the stamp is no longer newer, the room
  // view returns on its own (SPEC-070 §2).
  await adminSetSchemaVersion(roomId, stamped);
  await expect(page.getByTestId('room-name')).toHaveText('Newer Room Keep');
  await expect(page.getByTestId('newer-room-panel')).toHaveCount(0);
});
