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
    // No per-test timeout: this file now runs under `vitest.store.config.ts`
    // (test:store), which gives every emulator-backed test 60s and `retry: 2`.
    // An inline value here would override that back down, which is the opposite
    // of what this test needs.
    //
    // The history is worth keeping, because the first two diagnoses were wrong.
    // The timeout was raised 5s → 15s → 30s across WI-085 (PR #123) and WI-086
    // (PR #124), both times blamed on a cold Storage-emulator jar download. It
    // is not slow startup: the CI log shows the run dying on a Firestore
    // `Listen` stream hitting `RESOURCE_EXHAUSTED` (a ~434 MiB message against
    // the 4 MiB gRPC cap), after which the client backs off to maximum and the
    // test cannot make progress at any timeout. `vitest.store.config.ts`
    // already recorded that failure mode for the contract suite's deletion
    // test; this file simply never reached that config.
  );
});
