import type { PlayerSeat, ProfileInstance } from '@osr-vtt/shared';

/**
 * Dice color resolution. There is exactly **one** source of a die's color:
 * `ProfileInstance.color`, the `#rrggbb` a player picks on the character quick
 * sheet (`CharacterDock`'s `token-color-control`), which the sheet also mirrors
 * onto their map token.
 *
 * When a character hasn't picked one, dice fall back to a single theme-wide
 * neutral (`--dice-face`, resolved in `textures.ts` as `DiceTheme.face`) —
 * *not* to a per-seat value. An earlier version hashed the seat id into an
 * `hsl()` hue here, which meant a second, invisible color source that the quick
 * sheet couldn't reach and that emitted a different color format from the one
 * the picker writes.
 */

/** A roller's dice color: their character color when they've chosen one, else
 * `undefined` so the renderer applies the theme neutral. Also drives the seat
 * swatches beside shared-roll parts, so the swatch and the die always agree. */
export function characterDiceColor(
  seatId: string,
  profiles: readonly ProfileInstance[],
): string | undefined {
  return profiles.find((p) => p.seatId === seatId)?.color;
}

/** The same color, resolved from a roll's `authorUid` instead of a seat id — a
 * solo `Roll` records who rolled it by uid, while profiles (and shared-roll
 * parts) are keyed by `seatId`. Returns `undefined` when the seat isn't in
 * `players` yet, rather than inventing a color for an unknown roller. */
export function characterDiceColorForUid(
  authorUid: string,
  players: readonly PlayerSeat[],
  profiles: readonly ProfileInstance[],
): string | undefined {
  const seatId = players.find((p) => p.uid === authorUid)?.seatId;
  return seatId === undefined ? undefined : characterDiceColor(seatId, profiles);
}
