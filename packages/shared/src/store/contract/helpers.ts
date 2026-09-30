import { expect } from 'vitest';
import * as Y from 'yjs';
import type { MapBackground } from '../../types.js';
import type { CampaignStore, Unsubscribe } from '../campaign-store.js';
/** Waits for a subscription to deliver a value matching `predicate`. Works
 * whether the store notifies synchronously-ish (MemoryStore, a microtask
 * away) or over real emulator round-trips (FirebaseStore, tens of ms) — the
 * timeout is generous specifically for the latter. 30s (well inside the 60s
 * vitest testTimeout) tolerates emulator-propagation spikes under CI runner
 * load, which flaked the FirebaseStore contract tests at the old 10s. */
export async function waitFor<T>(
  subscribe: (cb: (value: T) => void) => Unsubscribe,
  predicate: (value: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let unsub: Unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('waitFor: timed out waiting for predicate to hold'));
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

/** A real 1×1 WebP, base64 — the smallest body a portrait image document can
 * carry (SPEC-057 §6). No store inspects the pixels; it is real so a reader of
 * a failing test is not left wondering whether the fixture is the problem. */
export const TINY_WEBP_BASE64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

export async function createTestRoom(store: CampaignStore, name = 'Test Room'): Promise<string> {
  return store.createRoom({ name, profileTemplate: [] });
}

/** A freshly created room's active `GameMap` id (Master Plan v2, R17.3) —
 * `createRoom` always seeds one inline, so this never has to wait. */
export async function activeMapId(store: CampaignStore, roomId: string): Promise<string> {
  const room = await store.getRoom(roomId);
  if (!room?.activeMapId) throw new Error(`activeMapId: room ${roomId} has no active map`);
  return room.activeMapId;
}

/**
 * WI-183 (SPEC-056 §5.1): subscribes and resolves once the first callback
 * arrives, carrying a running tally of every callback since — so a caller can
 * pin "fired once with the current contents" against `first`/`calls`, and
 * later prove "no callback survives unsubscribe" by checking `calls` stays
 * the same length after `unsubscribe()` is called.
 */
export function subscribeAndWaitForFirst<V>(
  subscribe: (cb: (value: V) => void) => Unsubscribe,
  timeoutMs = 30_000,
): Promise<{ first: V; calls: V[]; unsubscribe: Unsubscribe }> {
  return new Promise((resolve, reject) => {
    const calls: V[] = [];
    let unsub: Unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('subscribeAndWaitForFirst: timed out waiting for the first callback'));
    }, timeoutMs);
    unsub = subscribe((value) => {
      calls.push(value);
      if (calls.length === 1) {
        clearTimeout(timer);
        resolve({ first: value, calls, unsubscribe: unsub });
      }
    });
  });
}

/**
 * WI-183 (SPEC-056 §5.1 item 1): pins, for one array-shaped `subscribeX`,
 * that the first callback after subscribing already carries the CURRENT
 * contents — `startLength` items, empty included, never an empty/stale
 * snapshot corrected by a second call — and that once unsubscribed, the
 * listener never fires again.
 *
 * `startLength` defaults to 0 (a fresh room/map's collection). Pass
 * `'unknown'` for an account-scoped collection that already carries state
 * from earlier tests in this run (`subscribeMyRooms`) — the "fires once"
 * shape is still pinned, just not against a known starting count.
 *
 * `addItem` must grow the collection on its first call; its second call only
 * has to cause *some* write — proof, via a fresh second subscription over
 * the same data, that the unsubscribed listener's silence is the guarantee
 * holding and not just "nothing happened yet".
 */
export async function pinArrayListener<T>(
  subscribe: (cb: (items: T[]) => void) => Unsubscribe,
  addItem: () => Promise<unknown>,
  startLength: number | 'unknown' = 0,
): Promise<void> {
  const before = await subscribeAndWaitForFirst<T[]>(subscribe);
  expect(before.calls).toHaveLength(1);
  if (startLength !== 'unknown') expect(before.first).toHaveLength(startLength);
  before.unsubscribe();

  await addItem();

  const after = await subscribeAndWaitForFirst<T[]>(subscribe);
  expect(after.calls).toHaveLength(1);
  const baseline = startLength === 'unknown' ? before.first.length : startLength;
  expect(after.first.length).toBeGreaterThan(baseline);

  const callsAtUnsub = after.calls.length;
  after.unsubscribe();
  await addItem();
  const confirm = await subscribeAndWaitForFirst<T[]>(subscribe);
  confirm.unsubscribe();
  expect(after.calls).toHaveLength(callsAtUnsub);
}

/**
 * WI-183 (SPEC-056 §5.1 item 1): the same two guarantees as
 * `pinArrayListener`, for a single nullable-document `subscribeX`.
 * `isCurrent`/`isAfterMutate` let each call site say what "current" and
 * "after one write" mean for its own doc shape; `mutate` is called twice —
 * once to move the doc into the "after" state, once more (safe to repeat)
 * as the confirming write behind the unsubscribe check.
 */
export async function pinSingleListener<V>(
  subscribe: (cb: (value: V) => void) => Unsubscribe,
  isCurrent: (value: V) => boolean,
  mutate: () => Promise<unknown>,
  isAfterMutate: (value: V) => boolean,
): Promise<void> {
  const before = await subscribeAndWaitForFirst<V>(subscribe);
  expect(before.calls).toHaveLength(1);
  expect(isCurrent(before.first)).toBe(true);
  before.unsubscribe();

  await mutate();

  const after = await subscribeAndWaitForFirst<V>(subscribe);
  expect(after.calls).toHaveLength(1);
  expect(isAfterMutate(after.first)).toBe(true);

  const callsAtUnsub = after.calls.length;
  after.unsubscribe();
  await mutate();
  const confirm = await subscribeAndWaitForFirst<V>(subscribe);
  confirm.unsubscribe();
  expect(after.calls).toHaveLength(callsAtUnsub);
}
export function notesUpdate(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText('notes').insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}

/** What every per-domain contract file needs from the runner (`defineCampaignStoreContract`).
 * The clients are created in the runner's `beforeAll`, so they are read lazily. */
export interface ContractContext {
  label: string;
  clientA(): CampaignStore;
  clientB(): CampaignStore;
  seedLegacyMapBackground: (roomId: string, mapId: string, ref: string) => Promise<void>;
  seedUnlockedBackground: (
    roomId: string,
    mapId: string,
    background: Omit<MapBackground, 'locked'>,
  ) => Promise<void>;
}
