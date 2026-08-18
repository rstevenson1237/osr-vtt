import { type Auth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { beforeAll, describe, expect, it } from 'vitest';
import { type FirebaseClient, createFirebaseClient } from '../firebase-config.js';
import { FirebaseStore } from './firebase-store.js';
import { listRoomUploadRefs } from './firebase-asset-store.js';
import { roomUploadPath } from './upload-containment.js';
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage';

/**
 * `deleteRoom` sweeps the room's uploaded objects (SPEC-034 §4).
 *
 * This is not covered by the `CampaignStore` contract suite and cannot be:
 * `MemoryStore` has no bucket, and the contract is the thing both
 * implementations share. It is not covered by `storage.rules.test.ts` either —
 * that proves the GM is *permitted* to delete another seat's object, not that
 * anything actually does. What is at stake if this regresses is the exact
 * failure §4 names: "storage that nothing ever deletes is a bill that only
 * grows".
 *
 * Needs the Auth + Firestore + Storage emulators (`pnpm test:all:emulators`),
 * and the project id must match `.firebaserc`'s `osr-vtt` — the storage rules
 * reach across to Firestore for the membership check, and the Storage emulator
 * resolves that against the project it was started with (see the note in
 * `../rules/storage.rules.test.ts`).
 */

/** An unsigned fake Google ID token the Auth emulator accepts — R24.1 gates
 * room creation on a non-anonymous provider, same device the contract suite
 * and the account-recovery test use. */
function fakeGoogleIdToken(sub: string): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64url({ alg: 'none', type: 'JWT' })}.${b64url({
    sub,
    email: `${sub}@example.com`,
    email_verified: true,
  })}.`;
}

class GoogleAuthedFirebaseStore extends FirebaseStore {
  #signIn: Promise<string> | null = null;

  constructor(
    client: FirebaseClient,
    private readonly auth: Auth,
    private readonly sub: string,
  ) {
    super(client);
  }

  override async ensureAuth(): Promise<string> {
    const existing = this.auth.currentUser;
    if (existing) return existing.uid;
    this.#signIn ??= signInWithCredential(
      this.auth,
      GoogleAuthProvider.credential(fakeGoogleIdToken(this.sub)),
    ).then((cred) => cred.user.uid);
    return this.#signIn;
  }
}

let client: FirebaseClient;
let store: GoogleAuthedFirebaseStore;

beforeAll(() => {
  client = createFirebaseClient({
    config: {
      apiKey: 'demo-api-key',
      authDomain: 'osr-vtt.firebaseapp.com',
      projectId: 'osr-vtt',
      databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
      storageBucket: 'osr-vtt.appspot.com',
      appId: '1:0:web:demo',
    },
    useEmulators: true,
    // The switch under test: without it there is no bucket handle and
    // `deleteRoom` has nothing to sweep, which is exactly the Spark-tier state.
    storageUploads: true,
    appName: `room-uploads-${Date.now()}`,
  });
  store = new GoogleAuthedFirebaseStore(client, client.auth, `uploads-sub-${Date.now()}`);
});

describe('deleteRoom sweeps uploaded objects (SPEC-034 §4)', () => {
  it('gives the client a storage handle only when uploads are switched on', () => {
    expect(client.storage).toBeDefined();
    const spark = createFirebaseClient({
      config: {
        apiKey: 'demo-api-key',
        authDomain: 'osr-vtt.firebaseapp.com',
        projectId: 'osr-vtt',
        databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
        appId: '1:0:web:demo',
      },
      useEmulators: true,
      appName: `room-uploads-spark-${Date.now()}`,
    });
    expect(spark.storage).toBeUndefined();
  });

  it(
    'removes the room’s objects, and leaves another room’s alone',
    async () => {
      const storage = client.storage!;

      const roomId = await store.createRoom({ name: 'Uploads Room', profileTemplate: [] });
      // The storage rules require a seat, and `createRoom` writes the room doc,
      // not a `players/{uid}` doc — the referee joins their own room like anyone
      // else.
      await store.joinRoom(roomId, 'Referee');
      const uid = store.currentUid()!;

      const keeperRoomId = await store.createRoom({ name: 'Untouched Room', profileTemplate: [] });
      await store.joinRoom(keeperRoomId, 'Referee');

      const doomed = roomUploadPath(roomId, uid, 'art.png');
      const keeper = roomUploadPath(keeperRoomId, uid, 'art.png');
      await uploadBytes(storageRef(storage, doomed), new Uint8Array(8), { contentType: 'image/png' });
      await uploadBytes(storageRef(storage, keeper), new Uint8Array(8), { contentType: 'image/png' });
      expect(await listRoomUploadRefs(storage, roomId)).toHaveLength(1);

      await store.deleteRoom(roomId);

      expect(await listRoomUploadRefs(storage, roomId)).toHaveLength(0);
      expect(await listRoomUploadRefs(storage, keeperRoomId)).toHaveLength(1);

      await deleteObject(storageRef(storage, keeper));
      await store.deleteRoom(keeperRoomId);
    },
    // Two rooms, two joins, two uploads, a delete-sweep verification and a
    // second cleanup — six-plus sequential emulator round trips that the
    // default 5s budget has no margin for once the Storage emulator's jar is
    // still downloading when the test starts (observed in CI, WI-085 PR #123:
    // a cold run raced the download and timed out with no assertion failure).
    // 15s still wasn't enough on a second cold run (WI-086 PR #124) — bumped
    // again, generously, rather than chase the download time a third time.
    30000,
  );
});
