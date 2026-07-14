import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
} from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import { createFirebaseClient, type FirebaseClient } from '../firebase-config.js';
import { FirebaseStore } from './firebase-store.js';
import type { MyRoomEntry } from '../types.js';
import type { Unsubscribe } from './campaign-store.js';

/**
 * Google account recovery over the real Auth/Firestore emulators (Master Plan
 * v2, R6.1 / Roadmap Gate 10): "link → sign out → Google sign-in on a fresh
 * context recovers the same uid and GM seat (emulator supports this)."
 *
 * The app UI performs the link/sign-in via `linkWithPopup`/`signInWithPopup`
 * (the production-correct choice). Those popups require the Auth emulator's
 * IDP-login iframe, which loads `apis.google.com` (gapi) — unreachable from a
 * headless/sandboxed test runner — so this test drives the credential-level
 * equivalent (`linkWithCredential`/`signInWithCredential`) instead. The
 * observable outcome is identical to the popup flow: the anonymous uid is
 * upgraded *in place* (same uid, gains a Google provider), and a fresh client
 * signing in with the same Google identity resolves to that very uid — which
 * is precisely the recovery the gate asserts.
 *
 * Runs inside `firebase emulators:exec` via `pnpm test:store` (see
 * `vitest.store.config.ts`).
 */

let counter = 0;
function makeClient(): FirebaseClient {
  counter += 1;
  return createFirebaseClient({
    config: {
      apiKey: 'demo-api-key',
      authDomain: 'osr-vtt.firebaseapp.com',
      projectId: 'osr-vtt',
      databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
      appId: '1:0:web:demo',
    },
    useEmulators: true,
    appName: `recovery-${counter}`,
  });
}

/** An unsigned fake Google ID token the Auth emulator accepts (it never
 * verifies the signature). `sub` is the stable federated id that maps a
 * Google identity to one Firebase uid — the same `sub` recovers the same uid. */
function fakeGoogleIdToken(sub: string, email: string): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64url({ alg: 'none', type: 'JWT' })}.${b64url({ sub, email, email_verified: true })}.`;
}

async function waitFor<T>(
  subscribe: (cb: (value: T) => void) => Unsubscribe,
  predicate: (value: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let unsub: Unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('waitFor: timed out'));
    }, timeoutMs);
    unsub = subscribe((value) => {
      if (predicate(value)) {
        clearTimeout(timer);
        unsub();
        resolve(value);
      }
    });
  });
}

describe('Google account recovery (Master Plan v2, R6.1 / Gate 10)', () => {
  it('links in place, and a fresh client recovers the same uid, GM seat, and My Rooms', async () => {
    const sub = `google-sub-${Date.now()}`;
    const email = `ref-${Date.now()}@example.com`;
    const token = fakeGoogleIdToken(sub, email);

    // --- Client A: anonymous GM of a fresh room ---
    const clientA = makeClient();
    const storeA = new FirebaseStore(clientA);
    const anonUid = await storeA.ensureAuth();
    const roomId = await storeA.createRoom({ name: 'Recovery Vault', profileTemplate: [] });
    await storeA.joinRoom(roomId, 'Referee'); // GM seat + a My Rooms entry under anonUid

    // --- Link Google in place (same uid) — the popup flow's observable result ---
    const linked = await linkWithCredential(
      clientA.auth.currentUser!,
      GoogleAuthProvider.credential(token),
    );
    expect(linked.user.uid).toBe(anonUid); // R6.1: "upgrades the existing uid in place"
    expect(linked.user.isAnonymous).toBe(false);

    // --- Sign out → a brand-new anonymous identity, no longer the GM ---
    const newAnon = await storeA.signOutToAnonymous();
    expect(newAnon).not.toBe(anonUid);
    expect(storeA.currentUid()).toBe(newAnon);

    // --- Client B (fresh): Google sign-in recovers the linked uid ---
    const clientB = makeClient();
    const storeB = new FirebaseStore(clientB);
    const recovered = await signInWithCredential(
      clientB.auth,
      GoogleAuthProvider.credential(token),
    );
    expect(recovered.user.uid).toBe(anonUid); // GM recovery: same uid on a fresh client
    expect(storeB.currentUid()).toBe(anonUid);

    // GM seat recovered: the room's gmUid is B's recovered uid.
    const room = await storeB.getRoom(roomId);
    expect(room?.gmUid).toBe(storeB.currentUid());

    // My Rooms recovered — the index was written under the uid linking preserved.
    const mine = await waitFor<MyRoomEntry[]>(
      (cb) => storeB.subscribeMyRooms(cb),
      (rooms) => rooms.some((r) => r.roomId === roomId),
    );
    expect(mine.find((r) => r.roomId === roomId)?.role).toBe('gm');
  });
});
