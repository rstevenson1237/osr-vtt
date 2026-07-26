import type { PlayerSeat, ProfileInstance } from '@osr-vtt/shared';

/**
 * Stable per-seat color for shared rolls (Master Plan v2, R3.6.4 — "dice
 * tinted per seat color"). No new schema: every client derives the same
 * color for the same seatId from a pure hash, so nothing needs to be synced.
 */

const HUE_STEP = 47; // coprime-ish with 360 so nearby hashes still spread out

function hashSeatId(seatId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seatId.length; i++) {
    h ^= seatId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable `hsl()` color string for a seat/slot id. */
export function seatColor(seatId: string): string {
  const hue = (hashSeatId(seatId) * HUE_STEP) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

/** A roller's dice tint (Master Plan v2 addendum, quick-sheet token/color
 * split): the character's own color (`ProfileInstance.color`, the same
 * `#rrggbb` the quick sheet writes and mirrors onto the owner's map token)
 * when they've chosen one, else the existing `seatColor(seatId)` hash — so
 * every roller still gets a stable tint even if they've never set a custom
 * color. */
export function characterDiceColor(seatId: string, profiles: readonly ProfileInstance[]): string {
  return profiles.find((p) => p.seatId === seatId)?.color ?? seatColor(seatId);
}

/** The same tint, resolved from a roll's `authorUid` instead of a seat id — a
 * solo `Roll` records who rolled it by uid, while profiles (and shared-roll
 * parts) are keyed by `seatId`. Falls back to treating the uid as the seat id
 * when the seat isn't in `players` yet, so a tint is always produced. */
export function characterDiceColorForUid(
  authorUid: string,
  players: readonly PlayerSeat[],
  profiles: readonly ProfileInstance[],
): string {
  const seatId = players.find((p) => p.uid === authorUid)?.seatId ?? authorUid;
  return characterDiceColor(seatId, profiles);
}
