import { type Auth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { type FirebaseClient, createFirebaseClient } from '../firebase-config.js';
import { FirebaseStore, YJS_COMPACT_AT } from './firebase-store.js';

/**
 * `FirebaseStore`'s Yjs transport as stored in RTDB (SPEC-065): a snapshot `s`
 * plus a `push()` log `u`, compacted every `YJS_COMPACT_AT` entries, with
 * today's bare-string node migrated in place on first use.
 *
 * Not in the `CampaignStore` contract suite: what is at stake is the RTDB node
 * and what one callback costs, and neither exists in `MemoryStore` or
 * `LocalStore`. The contract suite (`collab.contract.ts`) pins the part every
 * store shares — applying every callback converges.
 *
 * Needs the Auth + Firestore + RTDB emulators (`pnpm test:all:emulators`).
 */

function fakeGoogleIdToken(sub: string): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64url({ alg: 'none', type: 'JWT' })}.${b64url({
    sub,
    email: `${sub}@example.com`,
    email_verified: true,
  })}.`;
}

/** R24.1 gates room creation on a non-anonymous provider — same device the
 * contract suite and `room-uploads.emulator.test.ts` use. */
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

let counter = 0;

/** A separate simulated browser tab: its own Firebase App, uid and store. */
function makeClient(): { store: FirebaseStore; client: FirebaseClient } {
  counter += 1;
  const client = createFirebaseClient({
    config: {
      apiKey: 'demo-api-key',
      authDomain: 'osr-vtt.firebaseapp.com',
      projectId: 'osr-vtt',
      databaseURL: 'https://osr-vtt-default-rtdb.firebaseio.com',
      appId: '1:0:web:demo',
    },
    useEmulators: true,
    appName: `yjs-transport-${counter}`,
  });
  const store = new GoogleAuthedFirebaseStore(
    client,
    client.auth,
    `yjs-transport-${Date.now()}-${counter}`,
  );
  return { store, client };
}

/** A room both clients belong to. */
async function sharedRoom(a: FirebaseStore, b: FirebaseStore): Promise<string> {
  const roomId = await a.createRoom({ name: 'Yjs transport', profileTemplate: [] });
  await b.joinRoom(roomId, 'Bram');
  return roomId;
}

type RawNode = { s?: string; u?: Record<string, string> } | string | null;

async function rawNode(client: FirebaseClient, roomId: string): Promise<RawNode> {
  return (await get(ref(client.rtdb, `rooms/${roomId}/yjs/notes`))).val() as RawNode;
}

async function storedText(store: FirebaseStore, roomId: string): Promise<string> {
  const doc = new Y.Doc();
  const state = await store.getYState(roomId, 'notes');
  if (state) Y.applyUpdate(doc, state);
  return doc.getText('notes').toString();
}

/** Subscribes, applying every callback to one doc, and records each one. */
function follow(store: FirebaseStore, roomId: string) {
  const doc = new Y.Doc();
  const sizes: number[] = [];
  const unsubscribe = store.subscribeYState(roomId, 'notes', (update) => {
    if (!update) return;
    sizes.push(update.byteLength);
    Y.applyUpdate(doc, update);
  });
  const text = () => doc.getText('notes').toString();
  return { doc, sizes, text, unsubscribe };
}

async function until(check: () => boolean | Promise<boolean>, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('until: timed out');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Appends `text` to `doc` and returns just that edit as an update. */
function edit(doc: Y.Doc, text: string): Uint8Array {
  const before = Y.encodeStateVector(doc);
  const ytext = doc.getText('notes');
  ytext.insert(ytext.length, text);
  return Y.encodeStateAsUpdate(doc, before);
}

describe('FirebaseStore Yjs transport (emulators, SPEC-065)', () => {
  it('ships one small edit to a listener as a small update, not the whole document', async () => {
    const a = makeClient();
    const b = makeClient();
    const roomId = await sharedRoom(a.store, b.store);

    // ~50 KB of notes, as WI-174 measured.
    const writer = new Y.Doc();
    const big = Array.from({ length: 5_000 }, (_, i) => `line ${i};`).join(' ');
    await a.store.mergeYUpdate(roomId, 'notes', edit(writer, big));
    expect(big.length).toBeGreaterThan(50_000);

    const reader = follow(b.store, roomId);
    await until(() => reader.text() === big);
    const before = reader.sizes.length;

    await a.store.mergeYUpdate(roomId, 'notes', edit(writer, ' Torches: 3'));
    await until(() => reader.text().endsWith(' Torches: 3'));
    reader.unsubscribe();

    const delivered = reader.sizes.slice(before);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toBeLessThan(1024);
  });

  it(`folds the log into the snapshot at ${YJS_COMPACT_AT} pushes, and the text survives`, async () => {
    const a = makeClient();
    const b = makeClient();
    const roomId = await sharedRoom(a.store, b.store);
    const reader = follow(b.store, roomId);

    const writer = new Y.Doc();
    for (let i = 0; i < YJS_COMPACT_AT - 1; i++) {
      await a.store.mergeYUpdate(roomId, 'notes', edit(writer, `[${i}]`));
    }
    const before = await rawNode(a.client, roomId);
    expect(typeof before === 'object' && before?.s).toBeFalsy();
    expect(Object.keys((before as { u: object }).u)).toHaveLength(YJS_COMPACT_AT - 1);

    await a.store.mergeYUpdate(roomId, 'notes', edit(writer, `[${YJS_COMPACT_AT - 1}]`));
    const after = (await rawNode(a.client, roomId)) as { s?: string; u?: object };
    expect(after.s).toBeTruthy();
    expect(after.u).toBeUndefined();

    const expected = writer.getText('notes').toString();
    expect(await storedText(a.store, roomId)).toBe(expected);
    await until(() => reader.text() === expected);
    reader.unsubscribe();

    // A fresh listener after compaction gets the snapshot alone.
    const late = follow(b.store, roomId);
    await until(() => late.text() === expected);
    late.unsubscribe();
  });

  it('loses no edit when two clients compact at the same time', async () => {
    const a = makeClient();
    const b = makeClient();
    const roomId = await sharedRoom(a.store, b.store);
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Each client crosses its own threshold on the same round, so both
    // compaction transactions race each other and the other's pushes.
    await Promise.all([
      (async () => {
        for (let i = 0; i < YJS_COMPACT_AT; i++) {
          await a.store.mergeYUpdate(roomId, 'notes', edit(docA, `<a${i}>`));
        }
      })(),
      (async () => {
        for (let i = 0; i < YJS_COMPACT_AT; i++) {
          await b.store.mergeYUpdate(roomId, 'notes', edit(docB, `<b${i}>`));
        }
      })(),
    ]);

    const text = await storedText(a.store, roomId);
    for (let i = 0; i < YJS_COMPACT_AT; i++) {
      expect(text).toContain(`<a${i}>`);
      expect(text).toContain(`<b${i}>`);
    }
    const node = (await rawNode(a.client, roomId)) as { s?: string; u?: object };
    expect(node.s).toBeTruthy();
    expect(Object.keys(node.u ?? {}).length).toBeLessThan(YJS_COMPACT_AT);
  });

  it('compacts a long log it finds on subscribe', async () => {
    const a = makeClient();
    const b = makeClient();
    const roomId = await sharedRoom(a.store, b.store);

    // A log no instance of this build would leave: written raw, so no pusher's
    // own counter ever reaches the threshold.
    const writer = new Y.Doc();
    const log: Record<string, string> = {};
    for (let i = 0; i < YJS_COMPACT_AT; i++) {
      log[`k${String(i).padStart(3, '0')}`] = Buffer.from(edit(writer, `(${i})`)).toString(
        'base64',
      );
    }
    await set(ref(a.client.rtdb, `rooms/${roomId}/yjs/notes`), { u: log });

    const reader = follow(b.store, roomId);
    const expected = writer.getText('notes').toString();
    await until(() => reader.text() === expected);
    await until(async () => {
      const node = (await rawNode(a.client, roomId)) as { s?: string; u?: object };
      return !!node.s && node.u === undefined;
    });
    reader.unsubscribe();
    expect(await storedText(a.store, roomId)).toBe(expected);
  });

  it('migrates a pre-SPEC-065 string node in place; its text survives a subscribe, a push and a compaction', async () => {
    const a = makeClient();
    const b = makeClient();
    const roomId = await sharedRoom(a.store, b.store);

    // The node as every room written before this change holds it: one
    // base64 string of the full merged state.
    const legacy = new Y.Doc();
    legacy.getText('notes').insert(0, 'Room 3: trapped.');
    await set(
      ref(a.client.rtdb, `rooms/${roomId}/yjs/notes`),
      Buffer.from(Y.encodeStateAsUpdate(legacy)).toString('base64'),
    );
    expect(await storedText(a.store, roomId)).toBe('Room 3: trapped.');

    // Subscribe: the listener sees the legacy text, and the node is now an object.
    const reader = follow(b.store, roomId);
    await until(() => reader.text() === 'Room 3: trapped.');
    const migrated = (await rawNode(a.client, roomId)) as { s?: string };
    expect(typeof migrated).toBe('object');
    expect(migrated.s).toBeTruthy();

    // Push: appends under the migrated node rather than replacing it.
    await a.store.mergeYUpdate(roomId, 'notes', edit(legacy, ' Torches: 3.'));
    await until(() => reader.text() === 'Room 3: trapped. Torches: 3.');

    // Compaction: up to the threshold, then the whole text is still there.
    for (let i = 1; i < YJS_COMPACT_AT; i++) {
      await a.store.mergeYUpdate(roomId, 'notes', edit(legacy, `.`));
    }
    const compacted = (await rawNode(a.client, roomId)) as { s?: string; u?: object };
    expect(compacted.u).toBeUndefined();
    const expected = legacy.getText('notes').toString();
    expect(expected.startsWith('Room 3: trapped. Torches: 3.')).toBe(true);
    expect(await storedText(a.store, roomId)).toBe(expected);
    await until(() => reader.text() === expected);
    reader.unsubscribe();
  });
});
