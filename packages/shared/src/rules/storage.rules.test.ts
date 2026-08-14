import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, listAll, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  roomUploadFolder,
  roomUploadPath,
} from '../store/upload-containment.js';

/**
 * Storage Security Rules tests (SPEC-034 §§2–4, RULE-004 — "rule changes ship
 * with rule tests"). Runs against the Storage **and** Firestore emulators
 * together: `firebase/storage.rules` reaches across services to check room
 * membership, so the seat roster has to really exist for the check to mean
 * anything.
 *
 * Invoke via `pnpm test:rules`, which must run inside `firebase emulators:exec`
 * (see root `package.json` → `test:all:emulators`).
 *
 * What these pin is the boundary and only the boundary. The client-side soft
 * cap has no counterpart here on purpose — it is friction, it is unenforceable
 * without a trusted writer (RULE-010), and a rules test asserting it would be
 * claiming a guarantee that does not exist. Its unit tests live in
 * `../store/upload-containment.test.ts`.
 */

const STORAGE_RULES_PATH = fileURLToPath(
  new URL('../../../../firebase/storage.rules', import.meta.url),
);
const FIRESTORE_RULES_PATH = fileURLToPath(
  new URL('../../../../firebase/firestore.rules', import.meta.url),
);

/**
 * **The project id here is load-bearing, unlike every other rules test.**
 *
 * `firebase/storage.rules` reaches across services, and the Storage emulator
 * resolves that lookup against the project the *emulator* was started with
 * (`firebase-tools`' `fetchFirestoreDocument` builds `projects/${projectId}…`
 * from the CLI's project, not from the bucket's). Give this environment its own
 * invented project id — the way `firestore.rules.test.ts` does — and the seat
 * fixtures land in one project while the rules read another: every membership
 * check silently returns false, and *only the allow cases fail*, which reads
 * exactly like a too-strict ruleset. Pinning to `GCLOUD_PROJECT` (set by
 * `emulators:exec`, `.firebaserc`'s default otherwise) is what makes the
 * cross-service check see the fixtures at all.
 */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'osr-vtt';

const GM_UID = 'gm-uid';
const PLAYER_UID = 'player-uid';
const OUTSIDER_UID = 'outsider-uid';
const ROOM_ID = 'room-1';

const PNG = 'image/png';

let testEnv: RulesTestEnvironment;

/** A payload of an exact byte length, so the size rule can be probed on both
 * sides of its limit without materialising anything large twice. */
function bytes(length: number): Uint8Array {
  return new Uint8Array(length);
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  // Fixture setup, not the thing under test: a room with a GM and one player
  // seat. `OUTSIDER_UID` deliberately gets no seat — it is a signed-in stranger
  // holding the room id, which is exactly the threat RULE-012 leaves standing.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`rooms/${ROOM_ID}`).set({
      name: 'Test Room',
      gmUid: GM_UID,
      schemaVersion: 1,
      createdAt: Date.now(),
    });
    await db.doc(`rooms/${ROOM_ID}/players/${GM_UID}`).set({ seatId: GM_UID, role: 'gm' });
    await db.doc(`rooms/${ROOM_ID}/players/${PLAYER_UID}`).set({
      seatId: PLAYER_UID,
      role: 'player',
    });
  });
});

/** Puts an object in place with the rules off, so a read/delete test starts
 * from an object that exists regardless of whether the write rule allows it. */
async function seedObject(path: string, contentType = PNG, size = 32): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), bytes(size), { contentType });
  });
}

describe('storage rules — membership is the write gate (SPEC-034 §2)', () => {
  it('lets a seated player upload an image under their own uid', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'goblin.png');
    await assertSucceeds(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });

  it('lets the GM upload under their own uid', async () => {
    const storage = testEnv.authenticatedContext(GM_UID).storage();
    const path = roomUploadPath(ROOM_ID, GM_UID, 'map.png');
    await assertSucceeds(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });

  it('refuses a signed-in stranger with no seat — a leaked room id is not an upload capability', async () => {
    const storage = testEnv.authenticatedContext(OUTSIDER_UID).storage();
    const path = roomUploadPath(ROOM_ID, OUTSIDER_UID, 'spam.png');
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });

  it('refuses an unauthenticated upload outright', async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'anon.png');
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });

  it('refuses a member writing under ANOTHER seat’s uid — every object stays attributable', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, GM_UID, 'impersonated.png');
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });

  it('refuses a member of one room uploading into a room they have no seat in', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath('some-other-room', PLAYER_UID, 'elsewhere.png');
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });
});

describe('storage rules — path shape (SPEC-034 §2)', () => {
  it('refuses an object outside the room/uploads tree entirely', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, 'loose/whatever.png'), bytes(64), { contentType: PNG }),
    );
  });

  it('refuses an object directly under a room, bypassing the uploads prefix', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, `rooms/${ROOM_ID}/${PLAYER_UID}.png`), bytes(64), {
        contentType: PNG,
      }),
    );
  });

  it('refuses an extra path segment below the object id', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = `${roomUploadPath(ROOM_ID, PLAYER_UID, 'nested')}/deeper.png`;
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: PNG }));
  });
});

describe('storage rules — per-object size (SPEC-034 §2)', () => {
  it('accepts an object at exactly the limit', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'at-limit.png');
    await assertSucceeds(
      uploadBytes(ref(storage, path), bytes(MAX_UPLOAD_BYTES), { contentType: PNG }),
    );
  });

  it('refuses one byte over the limit', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'over-limit.png');
    await assertFails(
      uploadBytes(ref(storage, path), bytes(MAX_UPLOAD_BYTES + 1), { contentType: PNG }),
    );
  });
});

describe('storage rules — content type (SPEC-034 §2)', () => {
  for (const contentType of ALLOWED_UPLOAD_CONTENT_TYPES) {
    it(`accepts ${contentType}`, async () => {
      const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
      const path = roomUploadPath(ROOM_ID, PLAYER_UID, `ok-${contentType.replace('/', '-')}`);
      await assertSucceeds(uploadBytes(ref(storage, path), bytes(64), { contentType }));
    });
  }

  it('refuses image/svg+xml — an SVG is a script-bearing document, not inert pixels', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'vector.svg');
    await assertFails(uploadBytes(ref(storage, path), bytes(64), { contentType: 'image/svg+xml' }));
  });

  it('refuses a non-image content type', async () => {
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'payload.zip');
    await assertFails(
      uploadBytes(ref(storage, path), bytes(64), { contentType: 'application/zip' }),
    );
  });
});

describe('storage rules — overwrite carries the same bounds as create', () => {
  it('refuses an oversized overwrite of an object that already exists', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'swap.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, path), bytes(MAX_UPLOAD_BYTES + 1), { contentType: PNG }),
    );
  });

  it('refuses a disallowed content type on overwrite', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'swap-type.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, path), bytes(64), { contentType: 'application/zip' }),
    );
  });
});

describe('storage rules — reads and enumeration (RULE-012, SPEC-034 §4)', () => {
  it('lets any signed-in client read an object — the roomId is the capability', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'shared.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(OUTSIDER_UID).storage();
    await assertSucceeds(getBytes(ref(storage, path)));
  });

  it('refuses an unauthenticated read', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'shared.png');
    await seedObject(path);
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, path)));
  });

  it('lets the GM list a room’s whole uploads folder — the enumeration deleteRoom needs', async () => {
    await seedObject(roomUploadPath(ROOM_ID, PLAYER_UID, 'a.png'));
    await seedObject(roomUploadPath(ROOM_ID, GM_UID, 'b.png'));
    const storage = testEnv.authenticatedContext(GM_UID).storage();
    await assertSucceeds(listAll(ref(storage, roomUploadFolder(ROOM_ID))));
  });
});

describe('storage rules — deletion (SPEC-034 §4)', () => {
  it('lets a player delete their own object', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'mine.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, path)));
  });

  it('lets the GM delete another seat’s object — so deleteRoom can finish the job', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'theirs.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(GM_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, path)));
  });

  it('refuses one member deleting another member’s object', async () => {
    const path = roomUploadPath(ROOM_ID, GM_UID, 'gm-art.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(PLAYER_UID).storage();
    await assertFails(deleteObject(ref(storage, path)));
  });

  it('refuses a stranger deleting anything', async () => {
    const path = roomUploadPath(ROOM_ID, PLAYER_UID, 'target.png');
    await seedObject(path);
    const storage = testEnv.authenticatedContext(OUTSIDER_UID).storage();
    await assertFails(deleteObject(ref(storage, path)));
  });
});
