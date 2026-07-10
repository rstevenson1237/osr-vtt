import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Security Rules tests (Plan §3, §9). Runs against the Firestore emulator —
 * invoke via `pnpm test:rules`, which must run inside
 * `firebase emulators:exec` (see root package.json `test:all:emulators`).
 *
 * The one rule that MUST have a test (Plan §8 acceptance): a player context
 * cannot read a `gmPrivate` doc.
 */

const RULES_PATH = fileURLToPath(new URL('../../../../firebase/firestore.rules', import.meta.url));

const GM_UID = 'gm-uid';
const PLAYER_UID = 'player-uid';
const OTHER_PLAYER_UID = 'other-player-uid';
const ROOM_ID = 'room-1';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'osr-vtt-rules-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed baseline room state with rules disabled — this is fixture setup,
  // not the thing under test.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`rooms/${ROOM_ID}`).set({
      name: 'Test Room',
      gmUid: GM_UID,
      schemaVersion: 1,
      difficultyDie: 'd6',
      dangerDie: 'd6',
      createdAt: Date.now(),
      profileTemplate: [],
    });
    await db.doc(`rooms/${ROOM_ID}/players/${GM_UID}`).set({
      displayName: 'GM',
      seatId: GM_UID,
      role: 'gm',
    });
    await db.doc(`rooms/${ROOM_ID}/players/${PLAYER_UID}`).set({
      displayName: 'Player One',
      seatId: PLAYER_UID,
      role: 'player',
    });
    await db.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'fog of war state' });
  });
});

describe('gmPrivate — the one hard boundary (Plan §3)', () => {
  it('denies a player context read on a gmPrivate doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
  });

  it('denies a player context write on a gmPrivate doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'tampered' }),
    );
  });

  it('denies an unauthenticated context read on a gmPrivate doc', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(anonDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
  });

  it('allows the GM to read and write their own gmPrivate doc', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).get());
    await assertSucceeds(
      gmDb.doc(`rooms/${ROOM_ID}/gmPrivate/secret`).set({ hidden: 'updated fog' }),
    );
  });
});

describe('room-level access', () => {
  it('lets any authenticated member read the room doc', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(playerDb.doc(`rooms/${ROOM_ID}`).get());
  });

  it('denies a player updating room-level fields (e.g. profileTemplate)', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(playerDb.doc(`rooms/${ROOM_ID}`).update({ profileTemplate: [] }));
  });

  it('allows the GM to update room-level fields', async () => {
    const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
    await assertSucceeds(gmDb.doc(`rooms/${ROOM_ID}`).update({ dangerDie: 'd8' }));
  });
});

describe('profiles — owning seat or GM only (Plan §2.5)', () => {
  it('lets a player write their own profile instance', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/profiles/${PLAYER_UID}`).set({ values: { name: 'Bram' } }),
    );
  });

  it("denies a player writing another player's profile instance", async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertFails(
      playerDb
        .doc(`rooms/${ROOM_ID}/profiles/${OTHER_PLAYER_UID}`)
        .set({ values: { name: 'Hijacked' } }),
    );
  });
});

describe('shared table state — any authenticated room member (trust model)', () => {
  it('lets a room member create a token', async () => {
    const playerDb = testEnv.authenticatedContext(PLAYER_UID).firestore();
    await assertSucceeds(
      playerDb.doc(`rooms/${ROOM_ID}/tokens/token-1`).set({
        pos: { x: 0, y: 0 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      }),
    );
  });

  it('denies a non-member (no players/{uid} doc) from writing a token', async () => {
    const strangerDb = testEnv.authenticatedContext('stranger-uid').firestore();
    await assertFails(
      strangerDb.doc(`rooms/${ROOM_ID}/tokens/token-2`).set({
        pos: { x: 0, y: 0 },
        size: 1,
        layer: 'tokens',
        imageRef: 'tokens/goblin.png',
      }),
    );
  });
});

it('sanity: seeded fixtures are present', async () => {
  const gmDb = testEnv.authenticatedContext(GM_UID).firestore();
  const room = await gmDb.doc(`rooms/${ROOM_ID}`).get();
  expect(room.data()?.['gmUid']).toBe(GM_UID);
});
