import { type Auth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { type FirebaseClient, createFirebaseClient } from '../firebase-config.js';
import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { FirebaseStore } from './firebase-store.js';
import { CURRENT_SCHEMA_VERSION } from '../types.js';

/**
 * The other half of Gate 6's abstraction proof (Plan §7 Phase 6, Roadmap
 * Gate 6): the exact same contract suite that exercises `MemoryStore`
 * (`memory-store.test.ts`) runs here against `FirebaseStore` itself, over
 * the real Firestore/Auth/RTDB emulators — `MemoryStore` passing alone would
 * only prove *its own* internal consistency, not that the interface is a
 * faithful abstraction over the implementation everything actually ships
 * with.
 *
 * Needs the Firestore + Auth + Realtime Database emulators running
 * (`singleProjectMode`, so the project id must match `.firebaserc`'s
 * "osr-vtt" — see `firebase.json`). Invoke via `pnpm test:store`, which must
 * run inside `firebase emulators:exec` (see root package.json
 * `test:all:emulators`) — same requirement as the Security Rules tests.
 */

let clientCounter = 0;

/** An unsigned fake Google ID token the Auth emulator accepts (it never
 * verifies the signature) — same device the account-recovery test uses. `sub`
 * is the stable federated id, so a distinct `sub` per client yields a distinct
 * uid, preserving the "separate browser tab" property each simulated client
 * relies on. */
function fakeGoogleIdToken(sub: string): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64url({ alg: 'none', type: 'JWT' })}.${b64url({
    sub,
    email: `${sub}@example.com`,
    email_verified: true,
  })}.`;
}

/**
 * A `FirebaseStore` whose identity is a Google-provider one rather than
 * anonymous.
 *
 * Why this exists: R24.1 gates `rooms/{roomId}` creation on a non-anonymous
 * sign-in provider, and this suite's fixtures start by creating a room. The
 * suite deliberately tests the *data-plumbing* contract, not access control
 * (Security Rules have their own suite), so the right move is to give these
 * clients the identity a real referee has rather than to weaken the rule or to
 * assert rule behaviour here.
 *
 * Overriding `ensureAuth` — rather than signing in eagerly in the synchronous
 * factory — is what makes it race-free: every store entry point already awaits
 * `ensureAuth()`, so the first one to run blocks on this promise instead of
 * racing an in-flight sign-in and falling through to `signInAnonymously`.
 */
class GoogleAuthedFirebaseStore extends FirebaseStore {
  #signIn: Promise<string> | null = null;
  readonly #auth: Auth;
  readonly #sub: string;

  constructor(client: FirebaseClient, sub: string) {
    super(client);
    // The base class keeps `client` private, so hold the one handle we need.
    this.#auth = client.auth;
    this.#sub = sub;
  }

  override async ensureAuth(): Promise<string> {
    const existing = this.#auth.currentUser;
    if (existing) return existing.uid;
    this.#signIn ??= signInWithCredential(
      this.#auth,
      GoogleAuthProvider.credential(fakeGoogleIdToken(this.#sub)),
    ).then((cred) => cred.user.uid);
    return this.#signIn;
  }
}

/** The seeding client, kept so the legacy-background hook below can write a
 * raw map doc through the same emulator project the suite runs against. */
let seedClient: FirebaseClient | null = null;

defineCampaignStoreContract(
  'FirebaseStore (emulators)',
  (count) => {
    return Array.from({ length: count }, () => {
      clientCounter += 1;
    // A distinct Firebase App per simulated "client" (Plan §1.3) — each gets
    // its own Auth session/uid, exactly like a separate browser tab, all
    // against the one emulator-backed "osr-vtt" project.
      const client = createFirebaseClient({
        config: {
          apiKey: 'demo-api-key',
          authDomain: 'osr-vtt.firebaseapp.com',
          projectId: 'osr-vtt',
          databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
          appId: '1:0:web:demo',
        },
        useEmulators: true,
        appName: `store-contract-${clientCounter}`,
      });
      seedClient ??= client;
      return new GoogleAuthedFirebaseStore(client, `contract-sub-${Date.now()}-${clientCounter}`);
    });
  },
  // A pre-v23 `background: { ref }` written straight onto the map doc
  // (SPEC-038 §1). No converter — `GameMapSchema` no longer accepts an image
  // ref, which is exactly why `migrateMapBackgrounds` has to read raw.
  async (roomId, mapId, ref) => {
    if (!seedClient) throw new Error('seedLegacyMapBackground: no client created yet');
    await updateDoc(doc(seedClient.db, 'rooms', roomId, 'maps', mapId), { background: { ref } });
  },
  // A pre-v27 background document (SPEC-039 §1) — no converter, because the
  // point of the shape is the *absence* of `locked`, and `addBackground` now
  // always writes it.
  async (roomId, mapId, background) => {
    if (!seedClient) throw new Error('seedUnlockedBackground: no client created yet');
    await setDoc(
      doc(seedClient.db, 'rooms', roomId, 'maps', mapId, 'backgrounds', background.id),
      { ...background },
    );
  },
);

/**
 * The Firestore half of the v32->v33 removal (SPEC-057 §3, DEC-116). The
 * converter drops `password` on read, which every store shares; only this
 * store keeps the raw document a stranger holding the room id can read, so
 * only here does "deleted" need a write — the stamp write on the referee's
 * next open. `MemoryStore`/`LocalStore` rooms can only arrive through
 * `createRoom` or an import, both of which already come out without one.
 */
describe('FirebaseStore room password removal (emulators, SPEC-057 §3, v33)', () => {
  it('deletes a stored password from the room document on the next open', async () => {
    clientCounter += 1;
    const client = createFirebaseClient({
      config: {
        apiKey: 'demo-api-key',
        authDomain: 'osr-vtt.firebaseapp.com',
        projectId: 'osr-vtt',
        databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
        appId: '1:0:web:demo',
      },
      useEmulators: true,
      appName: `store-password-${clientCounter}`,
    });
    const store = new GoogleAuthedFirebaseStore(client, `password-sub-${Date.now()}`);
    const roomId = await store.createRoom({ name: 'Locked Vault', profileTemplate: [] });
    const roomRef = doc(client.db, 'rooms', roomId);
    // A room as a pre-v33 build left it: a plaintext password, walked to v32.
    await updateDoc(roomRef, { password: 'hunter2', collectionsMigratedTo: 32 });

    // The read path already hides it ...
    expect(await store.getRoom(roomId)).not.toHaveProperty('password');
    // ... and the open deletes it from the stored document.
    await store.migrateRoomCollections(roomId);
    const raw = (await getDoc(roomRef)).data()!;
    expect(raw).not.toHaveProperty('password');
    expect(raw['collectionsMigratedTo']).toBe(CURRENT_SCHEMA_VERSION);
  });
});
