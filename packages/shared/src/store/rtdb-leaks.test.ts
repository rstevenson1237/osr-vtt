import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * RTDB leak closure (R25.3) — Gate 27's "ping and drag `onDisconnect`
 * registered exactly once per node".
 *
 * These assert *arming*, which is the part that can only be got wrong here: the
 * removal itself happens server-side when the connection drops, and there is
 * nothing in-process to observe. Both cases are a counting question —
 * `publishDrag` is a per-frame path, so arming per frame would send one RTDB
 * registration per pointer move, and `publishPing` pushes a fresh node each
 * time, so *not* arming per push would leak the node the timeout never reached.
 *
 * The Firebase database module is mocked rather than run against the emulator
 * because "how many registrations did the SDK receive" is not observable
 * through a real connection.
 */

const refs = new Map<string, { path: string }>();
const onDisconnectCalls: string[] = [];
let pushCounter = 0;

vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => {
    const existing = refs.get(path);
    if (existing) return existing;
    const made = { path };
    refs.set(path, made);
    return made;
  },
  push: (parent: { path: string }) => {
    pushCounter += 1;
    const made = { path: `${parent.path}/push-${pushCounter}` };
    refs.set(made.path, made);
    return made;
  },
  set: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(() => () => {}),
  onDisconnect: (target: { path: string }) => {
    return {
      remove: () => {
        onDisconnectCalls.push(target.path);
        return Promise.resolve();
      },
    };
  },
  serverTimestamp: vi.fn(),
}));

const { FirebaseStore } = await import('./firebase-store.js');

function makeStore(uid = 'uid-1'): InstanceType<typeof FirebaseStore> {
  return new FirebaseStore({
    app: {},
    auth: { currentUser: { uid } },
    db: {},
    rtdb: {},
  } as never);
}

beforeEach(() => {
  refs.clear();
  onDisconnectCalls.length = 0;
  pushCounter = 0;
});

describe('publishDrag onDisconnect (R25.3)', () => {
  it('arms exactly once across a whole drag run', () => {
    const store = makeStore();
    for (let i = 0; i < 60; i++) store.publishDrag('room-1', 'token-1', { x: i, y: i });

    expect(onDisconnectCalls.filter((p) => p === 'rooms/room-1/dragging/token-1')).toHaveLength(1);
  });

  it('arms once per token, not once per client', () => {
    const store = makeStore();
    store.publishDrag('room-1', 'token-1', { x: 0, y: 0 });
    store.publishDrag('room-1', 'token-2', { x: 0, y: 0 });
    store.publishDrag('room-1', 'token-1', { x: 1, y: 1 });

    expect(onDisconnectCalls).toEqual([
      'rooms/room-1/dragging/token-1',
      'rooms/room-1/dragging/token-2',
    ]);
  });
});

describe('publishPing onDisconnect (R25.3)', () => {
  it('arms exactly once for each pushed ping node', () => {
    vi.useFakeTimers();
    try {
      const store = makeStore();
      store.publishPing('room-1', { x: 1, y: 2 });
      store.publishPing('room-1', { x: 3, y: 4 });

      // One registration per node — a fresh `push()` id each time, so there is
      // nothing to de-duplicate and nothing armed twice.
      expect(onDisconnectCalls).toEqual(['rooms/room-1/pings/push-1', 'rooms/room-1/pings/push-2']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('publishCursor onDisconnect (unchanged by R25.3)', () => {
  it('still arms exactly once per room+uid', () => {
    const store = makeStore();
    for (let i = 0; i < 30; i++) store.publishCursor('room-1', { x: i, y: i });

    expect(onDisconnectCalls).toEqual(['rooms/room-1/cursors/uid-1']);
  });
});
