import { describe, expect, it } from 'vitest';
import {
  ActivityThrottle,
  ROOM_ACTIVITY_THROTTLE_MS,
  STALE_ROOM_DAYS,
  dormantDismissalUntil,
  isRoomDormant,
} from './campaign-store.js';
import { MemoryStore } from './memory-store.js';
import type { MyRoomEntry } from '../types.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Room lifecycle rules (R25.1/R25.2). Every decision in this feature is one of
 * two questions — "may this write go out?" and "is this room dormant?" — and
 * both are pure, so they are pinned here rather than through a backend.
 */

describe('ActivityThrottle (R25.1)', () => {
  it('lets N rapid settled writes through exactly once (Gate 27)', () => {
    const throttle = new ActivityThrottle();
    const t0 = 1_000_000;
    // 50 settled writes inside one throttle window — a busy carve/drag minute.
    const allowed = Array.from({ length: 50 }, (_, i) =>
      throttle.shouldWrite('room-1', t0 + i * 1000),
    ).filter(Boolean);
    expect(allowed).toHaveLength(1);
  });

  it('allows the next write once the window has elapsed', () => {
    const throttle = new ActivityThrottle();
    const t0 = 1_000_000;
    expect(throttle.shouldWrite('room-1', t0)).toBe(true);
    expect(throttle.shouldWrite('room-1', t0 + ROOM_ACTIVITY_THROTTLE_MS - 1)).toBe(false);
    expect(throttle.shouldWrite('room-1', t0 + ROOM_ACTIVITY_THROTTLE_MS)).toBe(true);
  });

  it('throttles per room, not globally', () => {
    const throttle = new ActivityThrottle();
    const t0 = 1_000_000;
    expect(throttle.shouldWrite('room-1', t0)).toBe(true);
    expect(throttle.shouldWrite('room-2', t0)).toBe(true);
  });

  it('re-opens the window after `forget` (a failed write must not cost 5 minutes of silence)', () => {
    const throttle = new ActivityThrottle();
    const t0 = 1_000_000;
    expect(throttle.shouldWrite('room-1', t0)).toBe(true);
    throttle.forget('room-1');
    expect(throttle.shouldWrite('room-1', t0 + 1)).toBe(true);
  });
});

function gmEntry(over: Partial<MyRoomEntry> = {}): MyRoomEntry {
  return { roomId: 'r1', name: 'Keep on the Borderlands', role: 'gm', lastSeenAt: 0, ...over };
}

describe('isRoomDormant (R25.2)', () => {
  const now = 1_800_000_000_000;
  const old = now - (STALE_ROOM_DAYS + 1) * DAY;
  const recent = now - (STALE_ROOM_DAYS - 1) * DAY;

  it('surfaces a GM room whose activity clock is older than the threshold', () => {
    expect(isRoomDormant(gmEntry(), { lastActivityAt: old }, now)).toBe(true);
  });

  it('leaves a room active within the threshold alone', () => {
    expect(isRoomDormant(gmEntry(), { lastActivityAt: recent }, now)).toBe(false);
  });

  it('never surfaces a room the user merely joined — it is not theirs to delete', () => {
    expect(isRoomDormant(gmEntry({ role: 'player' }), { lastActivityAt: old }, now)).toBe(false);
    expect(isRoomDormant(gmEntry({ role: 'viewer' }), { lastActivityAt: old }, now)).toBe(false);
  });

  it('treats an unknown activity clock as not-dormant, never as abandoned', () => {
    expect(isRoomDormant(gmEntry(), {}, now)).toBe(false);
    expect(isRoomDormant(gmEntry(), null, now)).toBe(false);
  });

  it('honours a live "Keep" dismissal, and expires it', () => {
    const dismissed = gmEntry({ dormantDismissedUntil: dormantDismissalUntil(now) });
    expect(isRoomDormant(dismissed, { lastActivityAt: old }, now)).toBe(false);
    // ...and the row comes back once the dismissal window closes.
    expect(
      isRoomDormant(dismissed, { lastActivityAt: old }, now + (STALE_ROOM_DAYS + 1) * DAY),
    ).toBe(true);
  });
});

describe('the activity clock through a store (R25.1)', () => {
  it('stamps the room on a settled write, once per window', async () => {
    const store = new MemoryStore();
    await store.ensureAuth();
    const roomId = await store.createRoom({ name: 'Room', profileTemplate: [] });

    const created = await store.getRoom(roomId);
    expect(created?.lastActivityAt).toBeGreaterThan(0);

    const tokenId = await store.createToken(roomId, {
      pos: { x: 0, y: 0 },
      size: 1,
      layer: 'tokens',
      imageRef: 'gen:letter:A',
    });
    const first = (await store.getRoom(roomId))?.lastActivityAt;

    // A burst of settled writes inside the window leaves the stamp untouched —
    // the whole point of the throttle.
    for (let i = 0; i < 20; i++) {
      await store.moveToken(roomId, tokenId, { x: i, y: i });
    }
    expect((await store.getRoom(roomId))?.lastActivityAt).toBe(first);
  });

  it('records a "Keep" dismissal on the caller\'s own index entry', async () => {
    const store = new MemoryStore();
    await store.ensureAuth();
    const roomId = await store.createRoom({ name: 'Room', profileTemplate: [] });

    const until = dormantDismissalUntil();
    await store.dismissRoomDormancy(roomId, until);

    const rooms = await new Promise<MyRoomEntry[]>((resolve) => {
      const unsub = store.subscribeMyRooms((r) => {
        if (r.length > 0) {
          resolve(r);
          queueMicrotask(() => unsub());
        }
      });
    });
    expect(rooms.find((r) => r.roomId === roomId)?.dormantDismissedUntil).toBe(until);
  });

  it('is a no-op for a room the caller has no index entry for', async () => {
    const store = new MemoryStore();
    await store.ensureAuth();
    await expect(store.dismissRoomDormancy('not-mine', Date.now())).resolves.toBeUndefined();
  });
});
