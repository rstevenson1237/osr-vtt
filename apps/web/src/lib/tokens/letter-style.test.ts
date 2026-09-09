import { describe, expect, it } from 'vitest';
import type { Token } from '@osr-vtt/shared';
import { LETTER_BASE_PX, letterGlyphs, letterStyleFor } from './letter-style.js';

function token(over: Partial<Token> = {}): Token {
  return {
    id: 't1',
    pos: { x: 0, y: 0 },
    size: 1,
    layer: 'tokens',
    ...over,
  };
}

describe('letterGlyphs', () => {
  it('caps at three glyphs', () => {
    expect(letterGlyphs('ABCD')).toBe('ABC');
    expect(letterGlyphs('AB')).toBe('AB');
  });

  it('counts in code points, so one emoji is one glyph', () => {
    // Three astral-plane glyphs survive whole; a fourth is dropped.
    expect(letterGlyphs('🐍🐍🐍🐍')).toBe('🐍🐍🐍');
    expect(Array.from(letterGlyphs('🐍')).length).toBe(1);
  });
});

describe('letterStyleFor', () => {
  it('draws nothing when the letter is absent — a legitimate state', () => {
    expect(letterStyleFor(token())).toBeNull();
  });

  it('draws nothing for an empty or whitespace-only letter', () => {
    expect(letterStyleFor(token({ letter: '' }))).toBeNull();
    expect(letterStyleFor(token({ letter: '  ' }))).toBeNull();
  });

  it("is white on black for a token with a seat: it is somebody's character", () => {
    const style = letterStyleFor(token({ letter: 'A', ownerSeatId: 'seat-1' }))!;
    expect(style.mode).toBe('character');
    expect(style.fill).toBe(0xf6f1e6);
    expect(style.stroke).toBe(0x1a1a1a);
  });

  it('is black on white for a token with no seat — a creature or scenery', () => {
    const style = letterStyleFor(token({ letter: 'A' }))!;
    expect(style.mode).toBe('creature');
    expect(style.fill).toBe(0x1a1a1a);
    expect(style.stroke).toBe(0xf6f1e6);
  });

  it('keys off the seat, not the disc colour — the lightness flip is gone', () => {
    const onLight = letterStyleFor(token({ letter: 'A', color: '#ffffff' }))!;
    const onDark = letterStyleFor(token({ letter: 'A', color: '#101010' }))!;
    expect(onLight.fill).toBe(onDark.fill);
    expect(onLight.stroke).toBe(onDark.stroke);
  });

  it('always carries a real outline, which is what keeps the glyph legible', () => {
    for (const seat of [undefined, 'seat-1']) {
      const style = letterStyleFor(token({ letter: 'A', ownerSeatId: seat }))!;
      expect(style.strokeWidth).toBeGreaterThanOrEqual(3);
      expect(style.stroke).not.toBe(style.fill);
    }
  });

  it('shrinks the glyph as the label grows, matching the disc it replaces', () => {
    const one = letterStyleFor(token({ letter: 'A' }))!.fontSize;
    const two = letterStyleFor(token({ letter: 'AB' }))!.fontSize;
    const three = letterStyleFor(token({ letter: 'ABC' }))!.fontSize;
    expect(one).toBe(Math.round((LETTER_BASE_PX * 30) / 64));
    expect(two).toBeLessThan(one);
    expect(three).toBeLessThan(two);
  });

  it('scales with the token size', () => {
    const small = letterStyleFor(token({ letter: 'A' }))!;
    const large = letterStyleFor(token({ letter: 'A', size: 2 }))!;
    expect(large.fontSize).toBe(Math.round((LETTER_BASE_PX * 2 * 30) / 64));
    expect(large.fontSize).toBeGreaterThan(small.fontSize);
    expect(large.strokeWidth).toBeGreaterThan(small.strokeWidth);
  });

  it('caps the drawn glyphs at the render cap', () => {
    expect(letterStyleFor(token({ letter: 'ABCD' }))!.glyphs).toBe('ABC');
  });
});
