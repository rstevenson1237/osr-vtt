import { type Auth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { type FirebaseClient, createFirebaseClient } from '../firebase-config.js';
import { defineCampaignStoreContract } from './campaign-store.contract.js';
import { FirebaseStore } from './firebase-store.js';

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

defineCampaignStoreContract('FirebaseStore (emulators)', (count) => {
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
    return new GoogleAuthedFirebaseStore(client, `contract-sub-${Date.now()}-${clientCounter}`);
  });
});
