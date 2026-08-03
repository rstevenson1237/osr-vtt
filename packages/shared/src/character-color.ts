import { CHARACTER_COLOR_PALETTE } from './store/asset-store.js';
import type { ProfileInstance } from './types.js';

/**
 * Character colour is always set (SPEC-031, IN-025, DEC-033).
 *
 * `ProfileInstance.color` used to be a *meaningful* absence — "this character
 * deliberately has no custom colour", which made its dice render one theme-wide
 * neutral. Under SPEC-031 there is no unset state: every character has a
 * colour, and an absent stored value is only a **provenance marker** ("written
 * before this rule, needs backfill").
 *
 * Two ways a colour comes into being, and they are deliberately different:
 *
 *  - **At seat creation** (`joinRoom`) a colour is drawn **at random** from
 *    `CHARACTER_COLOR_PALETTE` and persisted, so two seats joining the same room
 *    are unlikely to collide and an auto-assigned colour is indistinguishable
 *    from a hand-picked one.
 *  - **For a seat that predates the rule** the colour is derived
 *    **deterministically from the seat id** (`assignedCharacterColor`). It has
 *    to be deterministic rather than random, because there is no single place
 *    that could roll the die once for everybody: `migrateRoom` only ever sees
 *    the room doc (profiles are subcollection docs), and a seat may have no
 *    profile document at all — colour-before-any-sheet-field is only one of the
 *    ways a profile doc comes to exist, and joining a room is not one of them
 *    historically. Deriving from the seat id means every client and every
 *    re-run agrees without anyone writing anything.
 */

/** FNV-1a over the seat id. Same construction as `asset-store.ts`'s private
 * `hashSeed` — duplicated rather than shared because that one exists to spread
 * *hues* around a 360° wheel, and this one indexes a fixed six-entry palette;
 * coupling them would make either free to change out from under the other. */
function hashSeatId(seatId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seatId.length; i++) {
    h ^= seatId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The colour a seat carrying no stored one is understood to have. A pure
 * function of the seat id, so every client resolves the same colour for the
 * same character with no write and no coordination. */
export function assignedCharacterColor(seatId: string): string {
  const palette = CHARACTER_COLOR_PALETTE;
  return palette[hashSeatId(seatId) % palette.length] as string;
}

/** A fresh colour for a newly created seat, drawn at random from the same
 * palette. Random rather than seat-id-derived so two seats created in one room
 * are unlikely to land on the same swatch — `assignedCharacterColor` has no
 * such freedom, since it must reproduce the same answer everywhere. */
export function randomCharacterColor(): string {
  const palette = CHARACTER_COLOR_PALETTE;
  return palette[Math.floor(Math.random() * palette.length)] as string;
}

/** A character's colour, resolved. **Never `undefined`** — the whole point of
 * SPEC-031. Falls through to `assignedCharacterColor` both when the seat has a
 * profile with no stored colour and when it has no profile document at all.
 *
 * Takes a **seat** id, not any actor id (SPEC-032 §2, DEC-042). Profiles are
 * keyed by an actor since v21, so a creature's profile lives in the same
 * collection — but "always has a colour" is a guarantee about characters, and
 * a creature has none to make it about. Call this with a seat id; a creature's
 * colour is whatever `ProfileInstance.color` actually holds, `undefined`
 * included, exactly as `Token.color` already works. */
export function resolveCharacterColor(
  seatId: string,
  profiles: readonly ProfileInstance[],
): string {
  return profiles.find((p) => p.actorId === seatId)?.color ?? assignedCharacterColor(seatId);
}
