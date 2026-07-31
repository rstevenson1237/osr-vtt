import { describe, expect, it } from 'vitest';
import { MAX_ROOMS_SOFT, atRoomSoftCap, countGmRooms } from './campaign-store.js';
import type { MyRoomEntry } from '../types.js';

/**
 * Soft room cap (R24.3). These pin the *counting rule*, which is the only part
 * of the cap that is a decision rather than a number: rooms you joined are not
 * rooms you created, and must not consume your allowance.
 *
 * What these deliberately do NOT test is that the cap holds against a
 * determined user — it cannot, and pretending otherwise is the failure mode the
 * spec calls out. The index it counts is the user's own document.
 */

function entry(role: MyRoomEntry['role'], roomId = Math.random().toString(36)): MyRoomEntry {
  return { roomId, name: `Room ${roomId}`, role, lastSeenAt: Date.now() };
}

function gmRooms(n: number): MyRoomEntry[] {
  return Array.from({ length: n }, (_, i) => entry('gm', `gm-${i}`));
}

describe('countGmRooms (R24.3)', () => {
  it('counts only rooms the user created', () => {
    const rooms = [entry('gm'), entry('player'), entry('gm'), entry('viewer')];
    expect(countGmRooms(rooms)).toBe(2);
  });

  it('is zero for a user who has only ever joined rooms', () => {
    expect(countGmRooms([entry('player'), entry('player'), entry('viewer')])).toBe(0);
  });

  it('is zero for an empty index', () => {
    expect(countGmRooms([])).toBe(0);
  });
});

describe('atRoomSoftCap (R24.3)', () => {
  it('permits creation below the cap', () => {
    expect(atRoomSoftCap(gmRooms(MAX_ROOMS_SOFT - 1))).toBe(false);
  });

  it('blocks the 13th room — creation stops AT the cap, not past it', () => {
    // The user-visible promise is "you have 12 rooms": the 12 already exist and
    // the next attempt is refused, so the boundary is >=, not >.
    expect(MAX_ROOMS_SOFT).toBe(12);
    expect(atRoomSoftCap(gmRooms(MAX_ROOMS_SOFT))).toBe(true);
  });

  it('stays blocked above the cap (an index that outran the client)', () => {
    expect(atRoomSoftCap(gmRooms(MAX_ROOMS_SOFT + 5))).toBe(true);
  });

  it('ignores joined rooms entirely — a player in many rooms may still create', () => {
    const rooms = [...gmRooms(2), ...Array.from({ length: 50 }, () => entry('player'))];
    expect(atRoomSoftCap(rooms)).toBe(false);
  });

  it('accepts an override cap so the rule is testable independently of the number', () => {
    expect(atRoomSoftCap(gmRooms(3), 3)).toBe(true);
    expect(atRoomSoftCap(gmRooms(2), 3)).toBe(false);
  });
});
