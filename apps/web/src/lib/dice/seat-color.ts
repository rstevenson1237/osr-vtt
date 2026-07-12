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
