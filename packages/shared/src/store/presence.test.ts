import { describe, expect, it } from 'vitest';
import {
  ABANDONED_SEAT_DAYS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STALE_MS,
  abandonedSeatUids,
  isPresent,
  presentUids,
  type PresenceEntry,
} from './campaign-store.js';

/**
 * Presence & seat lifecycle (R26) — the pure rules.
 *
 * These pin the two distinctions the whole feature turns on, both of which are
 * easy to collapse by accident:
 *
 *  - **present vs. disconnected** is a staleness question about an ephemeral
 *    node, and carries no data consequence;
 *  - **disconnected vs. abandoned** is a durable question about
 *    `lastPresentAt`, and is the only one that may ever suggest deleting
 *    something.
 */

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function entry(uid: string, ageMs: number): PresenceEntry {
  return { uid, name: uid, ts: NOW - ageMs };
}

describe('isPresent (R26.2)', () => {
  it('treats a fresh heartbeat as present', () => {
    expect(isPresent(entry('a', 0), NOW)).toBe(true);
    expect(isPresent(entry('a', PRESENCE_HEARTBEAT_MS), NOW)).toBe(true);
  });

  it('tolerates exactly one missed beat', () => {
    // One missed beat is a hiccup — a dropped packet, a busy tab. Failing a
    // player over at 45s would make the panel flicker constantly.
    expect(isPresent(entry('a', PRESENCE_STALE_MS), NOW)).toBe(true);
  });

  it('treats a stale heartbeat as disconnected', () => {
    expect(isPresent(entry('a', PRESENCE_STALE_MS + 1), NOW)).toBe(false);
  });

  it('treats an absent node as disconnected', () => {
    // The normal path: `onDisconnect` removed it when the tab closed. Staleness
    // is the backstop for a client killed hard enough to skip that.
    expect(isPresent(undefined, NOW)).toBe(false);
  });
});

describe('presentUids (R26.2)', () => {
  it('keeps only live entries', () => {
    const uids = presentUids([entry('live', 0), entry('stale', PRESENCE_STALE_MS + 1)], NOW);
    expect([...uids]).toEqual(['live']);
  });

  it('is empty for an empty channel', () => {
    expect(presentUids([], NOW).size).toBe(0);
  });
});

describe('abandonedSeatUids (R26.3)', () => {
  const present = new Set<string>();

  it('offers a seat that has been quiet past the cutoff', () => {
    const seats = [{ uid: 'gone', lastPresentAt: NOW - (ABANDONED_SEAT_DAYS + 1) * DAY }];
    expect([...abandonedSeatUids(seats, present, NOW)]).toEqual(['gone']);
  });

  it('does not offer a seat seen inside the cutoff', () => {
    const seats = [{ uid: 'recent', lastPresentAt: NOW - (ABANDONED_SEAT_DAYS - 1) * DAY }];
    expect(abandonedSeatUids(seats, present, NOW).size).toBe(0);
  });

  it('NEVER offers a seat with live presence, however old its stamp', () => {
    // The hard guarantee in R26.3: "never touches a seat with live presence."
    // A player who reconnects after a year is present, full stop.
    const seats = [{ uid: 'back', lastPresentAt: NOW - 400 * DAY }];
    expect(abandonedSeatUids(seats, new Set(['back']), NOW).size).toBe(0);
  });

  it('NEVER offers a seat that has no lastPresentAt at all', () => {
    // The migration decision, pinned. Seats written before the field existed
    // carry no value, and "we have never observed this seat" must not read as
    // "this seat is dead" — otherwise shipping the feature would offer up
    // every existing campaign's players at once.
    const seats = [{ uid: 'legacy' }];
    expect(abandonedSeatUids(seats, present, NOW).size).toBe(0);
  });

  it('respects an overridden cutoff, so the rule is testable apart from the number', () => {
    const seats = [{ uid: 'x', lastPresentAt: NOW - 10 * DAY }];
    expect(abandonedSeatUids(seats, present, NOW, 5).size).toBe(1);
    expect(abandonedSeatUids(seats, present, NOW, 20).size).toBe(0);
  });

  it('sorts nothing and mutates nothing — it is a pure set of uids', () => {
    const seats = [
      { uid: 'a', lastPresentAt: NOW - 90 * DAY },
      { uid: 'b', lastPresentAt: NOW - 1 * DAY },
    ];
    const copy = structuredClone(seats);
    abandonedSeatUids(seats, present, NOW);
    expect(seats).toEqual(copy);
  });
});
