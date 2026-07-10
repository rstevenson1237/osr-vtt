import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';

/** RTDB rules tests for the ephemeral cursor/drag/ping channels (Plan §2.2, §4). */

const RULES_PATH = fileURLToPath(
  new URL('../../../../firebase/database.rules.json', import.meta.url),
);

const ROOM_ID = 'room-1';
const PLAYER_UID = 'player-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'osr-vtt-rules-test',
    database: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('RTDB ephemeral channels', () => {
  it('lets an authenticated user write their own cursor position', async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertSucceeds(
      db.ref(`rooms/${ROOM_ID}/cursors/${PLAYER_UID}`).set({ x: 1, y: 2, ts: 1 }),
    );
  });

  it("denies writing another user's cursor position", async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertFails(db.ref(`rooms/${ROOM_ID}/cursors/someone-else`).set({ x: 1, y: 2, ts: 1 }));
  });

  it('denies an unauthenticated context from reading cursors', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.ref(`rooms/${ROOM_ID}/cursors`).get());
  });

  it('lets any authenticated room participant write a drag frame', async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertSucceeds(db.ref(`rooms/${ROOM_ID}/dragging/token-1`).set({ x: 5, y: 5 }));
  });

  it('lets any authenticated room participant publish a ping', async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertSucceeds(db.ref(`rooms/${ROOM_ID}/pings/ping-1`).set({ x: 1, y: 2, ts: 1 }));
  });

  it('lets an authenticated user write their own map-carve draft', async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertSucceeds(
      db.ref(`rooms/${ROOM_ID}/mapDraft/${PLAYER_UID}`).set({ cells: [{ x: 0, y: 0 }] }),
    );
  });

  it("denies writing another user's map-carve draft", async () => {
    const db = testEnv.authenticatedContext(PLAYER_UID).database();
    await assertFails(db.ref(`rooms/${ROOM_ID}/mapDraft/someone-else`).set({ cells: [] }));
  });

  // Regression: `onValue()`/`.get()` always listens at the PARENT collection
  // node (e.g. `rooms/{roomId}/pings`), never at a specific `$key` child. A
  // `.read` rule declared only on the `$key` wildcard does NOT cascade up to
  // grant read access to that parent — RTDB rules cascade down, not up — so
  // `subscribeCursors`/`subscribePings`/`subscribeMapDraft` would silently
  // never fire without an explicit `.read` at the collection level itself.
  describe('parent-collection reads (what subscribeX actually listens at)', () => {
    it('can read the parent cursors node', async () => {
      const db = testEnv.authenticatedContext(PLAYER_UID).database();
      await assertSucceeds(db.ref(`rooms/${ROOM_ID}/cursors`).get());
    });

    it('can read the parent dragging node', async () => {
      const db = testEnv.authenticatedContext(PLAYER_UID).database();
      await assertSucceeds(db.ref(`rooms/${ROOM_ID}/dragging`).get());
    });

    it('can read the parent pings node', async () => {
      const db = testEnv.authenticatedContext(PLAYER_UID).database();
      await assertSucceeds(db.ref(`rooms/${ROOM_ID}/pings`).get());
    });

    it('can read the parent mapDraft node', async () => {
      const db = testEnv.authenticatedContext(PLAYER_UID).database();
      await assertSucceeds(db.ref(`rooms/${ROOM_ID}/mapDraft`).get());
    });
  });
});
