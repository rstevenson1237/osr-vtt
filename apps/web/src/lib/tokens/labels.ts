import { buildGenTokenRef, genColorToken, letterLabel, type PlayerSeat, type Token } from '@osr-vtt/shared';

/** Seats ordered by join time (Master Plan v2, R7.1 — "players A, B, C… by
 * seat join order"). Seats written before `joinedAt` existed sort last, by
 * uid, rather than crashing on a missing field. */
export function seatOrder(players: PlayerSeat[]): PlayerSeat[] {
  return [...players].sort((a, b) => {
    const at = a.joinedAt ?? Number.POSITIVE_INFINITY;
    const bt = b.joinedAt ?? Number.POSITIVE_INFINITY;
    return at - bt || a.uid.localeCompare(b.uid);
  });
}

/** A seat's default letter, purely from its position in join order — the
 * same letter every client derives independently from `players` alone, no
 * extra state to sync. */
export function seatLetterFor(players: PlayerSeat[], seatId: string): string {
  const ordered = seatOrder(players);
  const idx = ordered.findIndex((p) => p.seatId === seatId || p.uid === seatId);
  return letterLabel(idx < 0 ? 0 : idx);
}

/** The `gen:disc:` ref a seat's portrait/token falls back to until the
 * player (or the GM) picks something else via "My token" (R7.3). */
export function defaultPortraitRef(players: PlayerSeat[], seatId: string): string {
  const label = seatLetterFor(players, seatId);
  return buildGenTokenRef(label, seatId);
}

const CREATURE_GEN_RE = /^gen:disc:([a-z]+)\d+:/;

/** The next unused creature-*type* letter (Plan R7.1 — "referee creatures
 * a1, a2… per creature type letter"): scans existing unowned tokens for
 * `gen:disc:` refs already following the creature convention (lowercase
 * leading letters + a number, e.g. "a1"), and returns the next letter after
 * however many distinct type-letters are already in use. Explicit
 * bundled/URL refs never carry a type letter, so they don't consume one. */
export function nextCreatureTypeLetter(tokens: Token[]): string {
  const used = new Set<string>();
  for (const token of tokens) {
    if (token.ownerSeatId) continue;
    const m = CREATURE_GEN_RE.exec(token.imageRef);
    if (m) used.add(m[1]!);
  }
  return letterLabel(used.size).toLowerCase();
}

/** Builds `count` default creature refs for one "Add creature" batch (Plan
 * R7.1/R7.3 — "GM adds 3 goblins… grouped"): all share one type letter and
 * one color, numbered a1, a2, a3… within the batch. */
export function defaultCreatureRefs(count: number, tokens: Token[]): string[] {
  const typeLetter = nextCreatureTypeLetter(tokens);
  const color = genColorToken(typeLetter);
  return Array.from({ length: count }, (_, i) => buildGenTokenRef(`${typeLetter}${i + 1}`, color));
}
