import { expect, type Page, test } from '@playwright/test';
import * as Y from 'yjs';
import { addCreature, openActivity, roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * Phase 5 acceptance (Plan §7 — Gate 5), split into the two flows it was
 * always two of. Both run against the real Firebase Emulator Suite.
 *
 *  1. **Live sync** (two browser contexts): a revealed handout reaches
 *     players, and two clients editing Notes at once converge with no stomp.
 *  2. **Portability** (one context): export -> a fresh import yields identical
 *     state, and the import path exercises the schema migration through
 *     `archiveToSnapshot`/`migrateRoom` (unit-tested in
 *     `packages/shared/src/portability/vttcamp.test.ts` — this e2e proves the
 *     same current-version path end to end over real Firestore/RTDB).
 *
 * This file was quarantined under `test.fixme` (2026-07-21): as one flow it
 * drove the imported room's UI to check what had round-tripped, which meant
 * activity-tab clicks against a Pixi/WebGL stage that had just been torn down
 * and remounted by the post-import navigation. In headless CI that
 * intermittently hung until the 180s timeout — a map-lifecycle artifact, never
 * a portability failure. The fix is to stop asking the UI what landed: after
 * the import the assertions read Firestore and RTDB directly, over the
 * emulators' rules-bypassing admin REST surface (the same "admin context" used
 * by `accounts-rooms.spec.ts`, `presence.spec.ts` and `room-lifecycle.spec.ts`).
 *
 * That is both stabler and stricter. `importRoom` writes every collection back
 * verbatim, preserving each document's original id, so round-trip fidelity is
 * an exact comparison of the two rooms' stored documents — not the handful of
 * spot-checks the rendered UI could reach.
 */

const HANDOUT_REF = 'maps/starter-room.svg';
const HANDOUT_TITLE = 'The Vault Door';
const SECRET_LOG_TEXT = 'XYZZY-EXPORT-CHECK';

const PROJECT_ID = 'osr-vtt';
const RTDB_NS = `${PROJECT_ID}-default-rtdb`;
const FS_BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const RTDB_BASE = 'http://127.0.0.1:9000';
// The Firestore/RTDB emulators grant rules-bypassing admin access to any REST
// request carrying this bearer token. That is what lets these assertions read
// `gmPrivate/**` (GM-only under the shipped rules) without impersonating a GM.
const ADMIN = { Authorization: 'Bearer owner' };

// ---- Firestore REST value decoding ------------------------------------------
// The REST surface returns typed values (`{stringValue: "x"}`, `{mapValue:
// {fields: …}}`); collapse them to plain JS so two rooms' documents can be
// compared with a single `toEqual`.

type FirestoreValue = Record<string, unknown>;

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function decodeValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value['stringValue'];
  if ('booleanValue' in value) return value['booleanValue'];
  // Firestore returns integers as decimal *strings* to survive JSON's 53-bit
  // number range; every id/timestamp/count this suite compares is well inside
  // it, so normalising to a number keeps both rooms' shapes identical.
  if ('integerValue' in value) return Number(value['integerValue']);
  if ('doubleValue' in value) return value['doubleValue'];
  if ('timestampValue' in value) return value['timestampValue'];
  if ('mapValue' in value) {
    const map = value['mapValue'] as { fields?: Record<string, FirestoreValue> };
    return decodeFields(map.fields);
  }
  if ('arrayValue' in value) {
    const array = value['arrayValue'] as { values?: FirestoreValue[] };
    return (array.values ?? []).map(decodeValue);
  }
  return null;
}

function decodeFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decodeValue(v)]));
}

async function adminDoc(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${FS_BASE}/${path}`, { headers: ADMIN });
  if (!res.ok) throw new Error(`admin GET ${path} failed (${res.status}): ${await res.text()}`);
  return decodeFields(((await res.json()) as FirestoreDocument).fields);
}

/** Every document in a collection, decoded and sorted by id so the comparison
 * does not depend on the emulator's listing order. */
async function adminCollection(
  path: string,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const res = await fetch(`${FS_BASE}/${path}?pageSize=300`, { headers: ADMIN });
  // An empty collection is a 200 with no `documents` key; a missing parent is a 404.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`admin GET ${path} failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { documents?: FirestoreDocument[] };
  return (body.documents ?? [])
    .map((d) => ({ id: d.name?.split('/').pop() ?? '', ...decodeFields(d.fields) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The shared Notes as actually stored: the Yjs state living at RTDB
 * `rooms/{id}/yjs/notes`, decoded back to the plain markdown the editor keeps
 * in its `Y.Text` (see `NotesPanel.svelte`). */
async function adminNotes(roomId: string): Promise<string> {
  const res = await fetch(`${RTDB_BASE}/rooms/${roomId}/yjs/notes.json?ns=${RTDB_NS}`, {
    headers: ADMIN,
  });
  if (!res.ok) throw new Error(`admin GET notes failed (${res.status}): ${await res.text()}`);
  const state = (await res.json()) as string | null;
  if (!state) return '';
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(Buffer.from(state, 'base64')));
  return doc.getText('notes').toString();
}

/**
 * Everything a `.vttcamp` round-trip must preserve, read straight out of the
 * emulators.
 *
 * Deliberately excludes what an import is *supposed* to change or what a live
 * client keeps touching: the room id, `gmUid` (forced to the importer by
 * `importRoom`, so Security Rules can never resurrect the old GM), the
 * `lastActivityAt` clock, and the `players` collection (presence writes
 * `lastPresentAt` on every heartbeat). Those are asserted separately, or
 * covered by the `CampaignStore` contract suite.
 */
interface PortableFacts {
  name: unknown;
  schemaVersion: unknown;
  handout: unknown;
  profileTemplate: unknown;
  tokens: Array<Record<string, unknown>>;
  log: Array<Record<string, unknown>>;
  gmPrivate: Array<Record<string, unknown>>;
  maps: Array<Record<string, unknown>>;
  notes: string;
}

async function portableFacts(roomId: string): Promise<PortableFacts> {
  const room = await adminDoc(`rooms/${roomId}`);
  const [tokens, log, gmPrivate, maps, notes] = await Promise.all([
    adminCollection(`rooms/${roomId}/tokens`),
    adminCollection(`rooms/${roomId}/log`),
    adminCollection(`rooms/${roomId}/gmPrivate`),
    adminCollection(`rooms/${roomId}/maps`),
    adminNotes(roomId),
  ]);
  return {
    name: room['name'],
    schemaVersion: room['schemaVersion'],
    handout: room['handout'],
    profileTemplate: room['profileTemplate'],
    tokens,
    log,
    gmPrivate,
    maps,
    notes,
  };
}

// ---- shared UI steps --------------------------------------------------------

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
}

/** Publishes a handout from the GM-only Session activity and reveals it to the
 * table. Leaves the Session overlay open. */
async function revealHandout(gm: Page): Promise<void> {
  await openActivity(gm, 'session');
  await gm.getByTestId('handout-title').fill(HANDOUT_TITLE);
  await gm.getByTestId('handout-ref').fill(HANDOUT_REF);
  await gm.getByTestId('handout-save').click();
  await gm.locator('[data-testid^="handout-reveal-"]').first().click();
}

/** Opens the Log overlay's Notes tab and returns its editor surface. */
async function openNotes(page: Page) {
  await openActivity(page, 'log');
  await page.getByTestId('log-tab-notes').click();
  return page.getByTestId('notes-input');
}

// ---- 1. live sync -----------------------------------------------------------

test('Gate 5: a revealed handout reaches players, and concurrent Notes converge', async ({
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

  // --- a revealed handout reaches players ---
  // The handout overlay renders over the Map (and Encounter) stage, which is
  // where a joining player already is — no activity switch needed on either
  // side beyond the GM's Session overlay.
  await expect(player.getByTestId('handout-viewer')).toHaveCount(0);
  await revealHandout(gm);

  await expect(player.getByTestId('handout-image')).toBeVisible();
  await expect(player.getByTestId('handout-image')).toHaveAttribute('src', new RegExp(HANDOUT_REF));

  // --- two clients editing Notes at once converge with no stomp ---
  const gmNotes = await openNotes(gm);
  const playerNotes = await openNotes(player);
  await gmNotes.click();
  await playerNotes.click();
  await Promise.all([
    gmNotes.pressSequentially('GM entry. ', { delay: 15 }),
    playerNotes.pressSequentially('Player entry. ', { delay: 15 }),
  ]);

  // The notes field is a WYSIWYG `contenteditable` surface, not a textarea, so
  // its content is read as text rather than a form value.
  await expect(async () => {
    const gmVal = (await gmNotes.innerText()).trim();
    const playerVal = (await playerNotes.innerText()).trim();
    expect(gmVal).toBe(playerVal);
    expect(gmVal).toContain('GM entry.');
    expect(gmVal).toContain('Player entry.');
  }).toPass({ timeout: 15_000 });

  // Both edits are in the *stored* CRDT state, not just in two views that
  // happen to agree — this is the no-last-write-wins-stomp guarantee.
  await expect
    .poll(
      async () => {
        const stored = await adminNotes(roomId);
        return stored.includes('GM entry.') && stored.includes('Player entry.');
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  await gmContext.close();
  await playerContext.close();
});

// ---- 2. portability ---------------------------------------------------------

test('Gate 5: portability — .vttcamp export/import round-trips the room', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();

  const roomName = 'The Sunless Vault';
  const roomId = await createRoomAndJoin(gm, roomName, 'Referee');

  // --- fixture state the round-trip has to preserve ---
  await addCreature(gm);
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(1);

  // A log entry for the export to carry. This used to be a revealed blind
  // draw; the Blind Drawer is gone (hidden rolls replaced it and never reach
  // the log by design), so a plain line of table talk stands in — what is
  // being checked here is that `log` round-trips, not how the entry got there.
  await gm.getByTestId('chat-text-bar').fill(SECRET_LOG_TEXT);
  await gm.getByTestId('chat-send-bar').click();

  const notes = await openNotes(gm);
  await notes.click();
  await notes.pressSequentially('Vault notes. ', { delay: 15 });
  // Notes live in RTDB, and `exportRoom` reads them from there — wait for the
  // provider's publish to land before exporting, or the archive races it.
  await expect.poll(() => adminNotes(roomId), { timeout: 15_000 }).toContain('Vault notes.');

  await revealHandout(gm);

  // --- export -> a fresh import yields identical state ---
  // Export/import live in the Session activity's Room section (Master Plan v2,
  // R4) — Session is GM-only, so only the room's GM can reach them (a
  // *different* member becoming the new room's owner via import is covered at
  // the store layer by the `CampaignStore` contract suite's "importer as
  // gmUid" test, which imports from a distinct client identity).
  const [download] = await Promise.all([
    gm.waitForEvent('download'),
    gm.getByTestId('session-export-room').click(),
  ]);
  const archivePath = await download.path();
  if (!archivePath) throw new Error('session-export-room did not produce a downloaded file');

  const exported = await portableFacts(roomId);
  expect(exported.tokens).toHaveLength(1);
  expect(exported.log.map((entry) => entry['text'])).toContain(SECRET_LOG_TEXT);
  expect(exported.handout).toEqual({ ref: HANDOUT_REF, title: HANDOUT_TITLE });

  await gm.getByTestId('session-import-room').setInputFiles(archivePath);
  // gm is already on a `#/r/...` URL (the room they exported from), so matching
  // that pattern alone would resolve immediately — wait for the roomId
  // specifically to change once the async import + navigate lands.
  await gm.waitForURL((url) => {
    const match = /^#\/r\/([^/]+)/.exec(url.hash);
    return !!match?.[1] && match[1] !== roomId;
  });
  const importedRoomId = roomIdFromUrl(gm.url());
  expect(importedRoomId).not.toBe(roomId);
  await expect(gm.getByTestId('room-name')).toHaveText(roomName);

  // Everything `importRoom` writes is committed before it resolves, and it
  // resolves before the navigate above — so the imported room is settled here
  // and the assertions below need no polling. Close the browser first: with no
  // client attached, nothing can touch the room mid-comparison, and the heavy
  // Pixi stage this test is done with is released rather than left running.
  await gmContext.close();

  const imported = await portableFacts(importedRoomId);
  expect(imported).toEqual(exported);
});
