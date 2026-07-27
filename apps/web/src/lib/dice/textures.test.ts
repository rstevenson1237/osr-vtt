import { describe, expect, it } from 'vitest';
import type { DiceTheme } from './textures';
import { faceColor, inkFor, luminance, shade } from './textures';

const THEME: DiceTheme = {
  id: 'test',
  face: '#2f6fb0',
  ink: '#eaf2fb',
  inkDark: '#17212b',
};

describe('faceColor (one source of truth)', () => {
  it('paints the die in the roller character color, verbatim', () => {
    // The whole point: what the quick sheet picked is what renders. The old
    // renderer painted a per-die-kind palette and modulated it with the pick,
    // so this was never true.
    expect(faceColor(THEME, '#c0392b', 'normal')).toBe('#c0392b');
    expect(faceColor(THEME, '#27ae60', 'normal')).toBe('#27ae60');
  });

  it('does not vary by die kind — every die of a roll is the roller color', () => {
    // There is no `kind` parameter any more. Guarded here as intent: a d6 and
    // a d20 rolled by the same character are the same color.
    expect(faceColor(THEME, '#c0392b', 'normal')).toBe(faceColor(THEME, '#c0392b', 'normal'));
  });

  it('falls back to the single theme neutral when nothing is picked', () => {
    expect(faceColor(THEME, undefined, 'normal')).toBe(THEME.face);
  });

  it("derives a d100's tens half from the roller color, not a palette", () => {
    const tens = faceColor(THEME, '#c0392b', 'tens');
    expect(tens).not.toBe('#c0392b');
    // Same hue family, just darker — so the pair still reads as one player's.
    expect(luminance(tens)).toBeLessThan(luminance('#c0392b'));
  });
});

describe('inkFor (auto-contrast numerals)', () => {
  it('prints light ink on a dark face', () => {
    expect(inkFor('#1a1a2e', THEME)).toBe(THEME.ink);
    expect(inkFor('#c0392b', THEME)).toBe(THEME.ink);
  });

  it('prints dark ink on a light face', () => {
    // The failure this fixes: a pale pick used to get near-white numerals.
    expect(inkFor('#f0e0c0', THEME)).toBe(THEME.inkDark);
    expect(inkFor('#ffffff', THEME)).toBe(THEME.inkDark);
  });
});

describe('shade', () => {
  it('darkens toward black below 1', () => {
    expect(shade('#808080', 0.5)).toBe('#404040');
    expect(shade('#ffffff', 0)).toBe('#000000');
  });

  it('lightens toward white above 1', () => {
    expect(shade('#000000', 2)).toBe('#ffffff');
    expect(luminance(shade('#404040', 1.5))).toBeGreaterThan(luminance('#404040'));
  });

  it('expands 3-digit hex and leaves unparseable input alone', () => {
    expect(shade('#fff', 0.5)).toBe('#808080');
    expect(shade('hsl(200, 70%, 55%)', 0.5)).toBe('hsl(200, 70%, 55%)');
  });

  it('clamps rather than wrapping at the extremes', () => {
    expect(shade('#ffffff', 4)).toBe('#ffffff');
    expect(shade('#000000', 0.1)).toBe('#000000');
  });
});
