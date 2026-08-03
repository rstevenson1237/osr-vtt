import { describe, expect, it } from 'vitest';
import {
  assignedCharacterColor,
  CHARACTER_COLOR_PALETTE,
  type PlayerSeat,
  type ProfileInstance,
} from '@osr-vtt/shared';
import { characterDiceColor, characterDiceColorForUid } from './seat-color';

function profile(seatId: string, color?: string): ProfileInstance {
  return { seatId, values: {}, ...(color !== undefined ? { color } : {}) };
}

function seat(uid: string, seatId: string): PlayerSeat {
  return { uid, seatId, displayName: uid, role: 'player' };
}

describe('characterDiceColor (the one source of a die color)', () => {
  it('uses the character color when the seat has chosen one', () => {
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColor('seat-1', profiles)).toBe('#3366cc');
  });

  it('falls back to the seat’s assigned colour rather than to nothing (SPEC-031)', () => {
    // Absence used to mean "paint the `--dice-face` neutral". Under SPEC-031 a
    // character always has a colour, so both a profile with no stored colour
    // and no profile at all resolve to the same deterministic palette swatch.
    const expected = assignedCharacterColor('seat-1');
    expect(CHARACTER_COLOR_PALETTE).toContain(expected);
    expect(characterDiceColor('seat-1', [])).toBe(expected);
    expect(characterDiceColor('seat-1', [profile('seat-1')])).toBe(expected);
  });

  it('does not leak one seat color onto another seat', () => {
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColor('seat-2', profiles)).toBe(assignedCharacterColor('seat-2'));
    expect(characterDiceColor('seat-2', profiles)).not.toBe('#3366cc');
  });
});

describe('characterDiceColorForUid (solo rolls)', () => {
  it("resolves a roll's authorUid through its seat to the character color", () => {
    const players = [seat('uid-1', 'seat-1')];
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColorForUid('uid-1', players, profiles)).toBe('#3366cc');
  });

  it('assigns a colour when the seat is known but has none stored', () => {
    const players = [seat('uid-1', 'seat-1')];
    expect(characterDiceColorForUid('uid-1', players, [])).toBe(assignedCharacterColor('seat-1'));
  });

  it('returns undefined for an unknown seat instead of hashing the uid', () => {
    // Hashing the uid produced a stable-but-wrong colour whenever `players`
    // hadn't loaded yet — a colour that matched nothing the player picked.
    // This is the one remaining path to the `--dice-face` neutral (SPEC-031
    // §5): a die with no seat behind it has no character to take a colour from.
    expect(characterDiceColorForUid('uid-9', [], [])).toBeUndefined();
  });
});
