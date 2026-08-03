import { resolveCharacterColor, type PlayerSeat, type ProfileInstance } from '@osr-vtt/shared';

/**
 * Dice color resolution. There is exactly **one** source of a die's color:
 * `ProfileInstance.color`, the `#rrggbb` a player picks on the character quick
 * sheet (`CharacterDock`'s `token-color-control`), which the sheet also mirrors
 * onto their map token.
 *
 * Under SPEC-031 that color is **always set** — a character with no stored one
 * resolves through `assignedCharacterColor(seatId)`, deterministically, so no
 * *seat* can reach the theme-wide `--dice-face` neutral any more. The neutral
 * is not gone: it is still what a die with **no seat behind it** renders, which
 * is why `characterDiceColorForUid` can still answer `undefined`.
 *
 * An earlier version hashed the seat id into an `hsl()` hue here, which meant a
 * second, invisible color source that the quick sheet couldn't reach and that
 * emitted a different color format from the one the picker writes. The
 * SPEC-031 fallback is deliberately not that: it draws from
 * `CHARACTER_COLOR_PALETTE`, the same six `#rrggbb` swatches the picker offers,
 * so an assigned color is indistinguishable from a chosen one and reads back as
 * a selected swatch on the sheet.
 */

/** A roller's dice color. Never `undefined`: their chosen character color, or
 * the one assigned to that seat id. Also drives the seat swatches beside
 * shared-roll parts, so the swatch and the die always agree. */
export function characterDiceColor(
  seatId: string,
  profiles: readonly ProfileInstance[],
): string {
  return resolveCharacterColor(seatId, profiles);
}

/** The same color, resolved from a roll's `authorUid` instead of a seat id — a
 * solo `Roll` records who rolled it by uid, while profiles (and shared-roll
 * parts) are keyed by `seatId`. Returns `undefined` when the seat isn't in
 * `players` yet, rather than inventing a color for an unknown roller — the one
 * remaining path to the `--dice-face` neutral (SPEC-031 §5). */
export function characterDiceColorForUid(
  authorUid: string,
  players: readonly PlayerSeat[],
  profiles: readonly ProfileInstance[],
): string | undefined {
  const seatId = players.find((p) => p.uid === authorUid)?.seatId;
  return seatId === undefined ? undefined : characterDiceColor(seatId, profiles);
}
