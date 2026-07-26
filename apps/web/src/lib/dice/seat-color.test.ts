import { describe, expect, it } from 'vitest';
import type { PlayerSeat, ProfileInstance } from '@osr-vtt/shared';
import { characterDiceColor, characterDiceColorForUid, seatColor } from './seat-color';

function profile(seatId: string, color?: string): ProfileInstance {
  return { seatId, values: {}, ...(color !== undefined ? { color } : {}) };
}

function seat(uid: string, seatId: string): PlayerSeat {
  return { uid, seatId, displayName: uid, role: 'player' };
}

describe('characterDiceColor (quick-sheet token/color split)', () => {
  it('uses the character color when the seat has chosen one', () => {
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColor('seat-1', profiles)).toBe('#3366cc');
  });

  it('falls back to seatColor(seatId) when no profile/color is set', () => {
    expect(characterDiceColor('seat-1', [])).toBe(seatColor('seat-1'));
    expect(characterDiceColor('seat-1', [profile('seat-1')])).toBe(seatColor('seat-1'));
  });

  it('falls back for a seat that is not the one with a custom color', () => {
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColor('seat-2', profiles)).toBe(seatColor('seat-2'));
  });
});

describe('characterDiceColorForUid (solo rolls)', () => {
  it("resolves a roll's authorUid through its seat to the character color", () => {
    const players = [seat('uid-1', 'seat-1')];
    const profiles = [profile('seat-1', '#3366cc')];
    expect(characterDiceColorForUid('uid-1', players, profiles)).toBe('#3366cc');
  });

  it('falls back to the seat hash when the seat has no custom color', () => {
    const players = [seat('uid-1', 'seat-1')];
    expect(characterDiceColorForUid('uid-1', players, [])).toBe(seatColor('seat-1'));
  });

  it('treats the uid as the seat id when the seat is unknown', () => {
    expect(characterDiceColorForUid('uid-9', [], [])).toBe(seatColor('uid-9'));
  });
});
