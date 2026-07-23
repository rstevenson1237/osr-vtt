import { describe, expect, it } from 'vitest';
import type { ProfileInstance } from '@osr-vtt/shared';
import { characterDiceColor, seatColor } from './seat-color';

function profile(seatId: string, color?: string): ProfileInstance {
  return { seatId, values: {}, ...(color !== undefined ? { color } : {}) };
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
