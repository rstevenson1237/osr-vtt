import { describe, expect, it, vi } from 'vitest';
import {
  assignedCharacterColor,
  randomCharacterColor,
  resolveCharacterColor,
} from './character-color.js';
import { CHARACTER_COLOR_PALETTE } from './store/asset-store.js';
import type { ProfileInstance } from './types.js';

function profile(seatId: string, color?: string): ProfileInstance {
  return { seatId, values: {}, ...(color !== undefined ? { color } : {}) };
}

describe('assignedCharacterColor', () => {
  it('always answers with a palette swatch, for any seat id shape', () => {
    for (const seatId of ['a', 'seat-1', 'Xk3nQp0Zr9dLm2aB7c1D', '', '🎲', 'a'.repeat(200)]) {
      expect(CHARACTER_COLOR_PALETTE).toContain(assignedCharacterColor(seatId));
    }
  });

  it('is deterministic — the same seat id resolves to the same colour every time', () => {
    // This is the property the whole backfill rests on: nothing is written
    // anywhere, so every client has to derive the same answer independently.
    const first = assignedCharacterColor('seat-1');
    for (let i = 0; i < 50; i++) expect(assignedCharacterColor('seat-1')).toBe(first);
  });

  it('spreads nearby seat ids across the palette rather than clumping', () => {
    // Not a uniformity guarantee — just that consecutive ids (which is what
    // seeded test rooms and hand-written seats look like) don't all collide.
    const seen = new Set(
      Array.from({ length: 24 }, (_, i) => assignedCharacterColor(`seat-${i}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('randomCharacterColor', () => {
  it('draws from the palette', () => {
    for (let i = 0; i < 50; i++) {
      expect(CHARACTER_COLOR_PALETTE).toContain(randomCharacterColor());
    }
  });

  it('can reach every swatch, including the last one', () => {
    // A `Math.random()` near 1 must not index past the end of the palette.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    try {
      expect(randomCharacterColor()).toBe(CHARACTER_COLOR_PALETTE.at(-1));
      spy.mockReturnValue(0);
      expect(randomCharacterColor()).toBe(CHARACTER_COLOR_PALETTE[0]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('resolveCharacterColor (SPEC-031 — there is no unset state)', () => {
  it('prefers a stored colour', () => {
    expect(resolveCharacterColor('seat-1', [profile('seat-1', '#3366cc')])).toBe('#3366cc');
  });

  it('assigns one when the profile exists but carries no colour', () => {
    expect(resolveCharacterColor('seat-1', [profile('seat-1')])).toBe(
      assignedCharacterColor('seat-1'),
    );
  });

  it('assigns one when the seat has no profile document at all', () => {
    // The case a document-rewriting migration could never have covered: a seat
    // that has never had a profile doc created for it.
    expect(resolveCharacterColor('seat-1', [])).toBe(assignedCharacterColor('seat-1'));
  });

  it('never answers undefined', () => {
    for (const seatId of ['seat-1', 'seat-2', 'seat-3']) {
      expect(typeof resolveCharacterColor(seatId, [])).toBe('string');
    }
  });
});
