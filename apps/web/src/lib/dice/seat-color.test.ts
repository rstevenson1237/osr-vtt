import { describe, expect, it } from 'vitest';
import type { PlayerSeat, ProfileInstance } from '@osr-vtt/shared';
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

  it('returns undefined rather than inventing a per-seat color', () => {
    // The renderer paints the single `--dice-face` neutral for these. There
    // used to be a seat-id hash here, which was a second colour source the
    // quick sheet could not reach.
    expect(characterDiceColor('seat-1', [])).toBeUndefined();
    expect(characterDiceColor('seat-1', [profile('seat-1')])).toBeUndefined();
  });

  it('does not leak one seat color onto another seat', () => {
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColor('seat-2', profiles)).toBeUndefined();
  });
});

describe('characterDiceColorForUid (solo rolls)', () => {
  it("resolves a roll's authorUid through its seat to the character color", () => {
    const players = [seat('uid-1', 'seat-1')];
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColorForUid('uid-1', players, profiles)).toBe('#3366cc');
  });

  it('returns undefined when the seat has no chosen color', () => {
    const players = [seat('uid-1', 'seat-1')];
    expect(characterDiceColorForUid('uid-1', players, [])).toBeUndefined();
  });

  it('returns undefined for an unknown seat instead of hashing the uid', () => {
    // Hashing the uid produced a stable-but-wrong colour whenever `players`
    // hadn't loaded yet — a colour that matched nothing the player picked.
    expect(characterDiceColorForUid('uid-9', [], [])).toBeUndefined();
  });
});
