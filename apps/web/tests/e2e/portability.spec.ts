import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl } from './helpers';

/**
 * Phase 5 acceptance test (Plan §7 — Gate 5). Two independent browser
 * contexts against the real Firebase Emulator Suite. Covers all four gate
 * conditions in one flow, mirroring the earlier phases' single-test style:
 *  1. a revealed handout image reaches players;
 *  2. two clients editing Notes at once converge with no stomp;
 *  3. export -> a fresh import yields identical state (name, tokens, the
 *     revealed log entry, the revealed handout, and the converged notes);
 *  4. the import path specifically exercises an old export's schema
 *     migration via `archiveToSnapshot`/`migrateRoom` (unit-tested in
 *     `packages/shared/src/portability/vttcamp.test.ts` — this e2e proves
 *     the same current-version path end to end over real Firestore/RTDB).
 */

const HANDOUT_REF = 'maps/starter-room.svg';
const SECRET_LOG_TEXT = 'XYZZY-EXPORT-CHECK';

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

test('Gate 5: portability — handout reveal, concurrent Notes, and .vttcamp export/import', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomName = 'The Sunless Vault';
  const roomId = await createRoomAndJoin(gm, roomName, 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText(roomName);

  // --- fixture state the export/import assertions will check for ---
  await gm.getByTestId('drop-token').click();
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
  await expect(player.locator('[data-testid^="token-pos-"]')).toHaveCount(1);

  // The Blind Drawer lives on the Encounter Board, not Map View (Plan §7 Phase 4).
  await gm.getByTestId('stage-tab-board').click();
  await gm.getByTestId('blind-draw-title').fill('Export check');
  await gm.getByTestId('blind-draw-note').fill(SECRET_LOG_TEXT);
  await gm.getByTestId('blind-draw-note-add').click();
  await gm.locator('[data-testid^="blind-draw-reveal-"]').first().click();
  await expect(player.getByTestId('action-log')).toContainText(SECRET_LOG_TEXT);

  // --- 1. Handout reveal reaches players ---
  await expect(player.getByTestId('handout-viewer')).toHaveCount(0);
  await gm.getByTestId('handout-title').fill('The Vault Door');
  await gm.getByTestId('handout-ref').fill(HANDOUT_REF);
  await gm.getByTestId('handout-save').click();
  await gm.locator('[data-testid^="handout-reveal-"]').first().click();

  await expect(player.getByTestId('handout-image')).toBeVisible();
  await expect(player.getByTestId('handout-image')).toHaveAttribute('src', new RegExp(HANDOUT_REF));

  // --- 2. Two clients editing Notes at once converge with no stomp ---
  const gmNotes = gm.getByTestId('notes-input');
  const playerNotes = player.getByTestId('notes-input');
  await gmNotes.click();
  await playerNotes.click();
  await Promise.all([
    gmNotes.pressSequentially('GM entry. ', { delay: 15 }),
    playerNotes.pressSequentially('Player entry. ', { delay: 15 }),
  ]);

  let convergedNotes = '';
  await expect(async () => {
    const gmVal = await gmNotes.inputValue();
    const playerVal = await playerNotes.inputValue();
    expect(gmVal).toBe(playerVal);
    expect(gmVal).toContain('GM entry.');
    expect(gmVal).toContain('Player entry.');
    convergedNotes = gmVal;
  }).toPass({ timeout: 15_000 });

  // --- 3. export -> a fresh import yields identical state ---
  const [download] = await Promise.all([
    gm.waitForEvent('download'),
    gm.getByTestId('export-room').click(),
  ]);
  const archivePath = await download.path();
  if (!archivePath) throw new Error('export-room did not produce a downloaded file');

  // Import from the player's tab — the control lives in any joined room's
  // shell (Plan §5), not just the exporting GM's. This also proves the
  // App-level route re-key (RoomShell must re-subscribe to the *new* room,
  // not keep showing the one the importer just left).
  await player.getByTestId('import-room-file').setInputFiles(archivePath);
  // player is already on a `#/r/...` URL (the room they imported from), so
  // matching that pattern alone would resolve immediately — wait for the
  // roomId specifically to change once the async import + navigate lands.
  await player.waitForURL((url) => {
    const match = /^#\/r\/([^/]+)/.exec(url.hash);
    return !!match?.[1] && match[1] !== roomId;
  });
  const importedRoomId = roomIdFromUrl(player.url());
  expect(importedRoomId).not.toBe(roomId);

  // No join-gate: `player` was already a member of the exported room, so
  // their own seat carried over verbatim (Plan §7 Phase 5 — export/import
  // preserves every doc's original id) and they land straight in the new
  // room's full UI.
  await expect(player.getByTestId('room-name')).toHaveText(roomName);

  // The imported room is fresh (different id), with `player` — the one who
  // ran the import — holding real GM authority over it (Plan §7 Phase 5:
  // `importRoom` forces `gmUid` to the importer). Proven by a GM-only panel
  // rendering, not the carried-over `players` doc's stale `role` label,
  // which still reads their old non-GM role from the exported room.
  await expect(player.getByTestId('handout-panel')).toBeVisible();
  await expect(player.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
  await expect(player.getByTestId('action-log')).toContainText(SECRET_LOG_TEXT);
  await expect(player.getByTestId('handout-image')).toBeVisible();
  await expect(player.getByTestId('handout-image')).toHaveAttribute('src', new RegExp(HANDOUT_REF));
  await expect(player.getByTestId('notes-input')).toHaveValue(convergedNotes);

  await gmContext.close();
  await playerContext.close();
});
