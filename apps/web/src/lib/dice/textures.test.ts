import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { DiceTheme } from './textures';
import { bodyMaterial, faceColor, inkFor, luminance, shade } from './textures';

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

describe('bodyMaterial (the bevel seam)', () => {
  // SPEC-045 §4 names this the first thing to verify, before any bevel tuning.
  // The body is a flat `material.color`; the face beside it is a `CanvasTexture`
  // whose background is painted with the *same hex string*. They land on the
  // same colour only if colour management agrees end to end — an sRGB/linear
  // mismatch between the two shows as a visible ring all the way round every
  // face, which no amount of bevel-width tuning would explain.
  const theme: DiceTheme = {
    id: 'seam',
    face: '#3f5fb0',
    ink: '#f6f1e6',
    inkDark: '#221c14',
  };
  /** What an `SRGBColorSpace` `CanvasTexture` sample of `hex` decodes to. */
  const asTextureSample = (hex: string): number[] =>
    [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });

  it('parses the face colour into the same linear triple the face texture samples', () => {
    // `THREE.Color` only decodes sRGB while colour management is on; with it off
    // the body would carry raw sRGB components against the texture's decoded
    // ones, and the seam would show. This is the load-bearing half of the check.
    expect(THREE.ColorManagement.enabled).toBe(true);
    for (const face of ['#3f5fb0', '#f0e0c0', '#101010', '#ffffff']) {
      const mat = bodyMaterial(theme, face, 'normal');
      const [r, g, b] = asTextureSample(faceColor(theme, face, 'normal'));
      expect(mat.color.r).toBeCloseTo(r!, 6);
      expect(mat.color.g).toBeCloseTo(g!, 6);
      expect(mat.color.b).toBeCloseTo(b!, 6);
    }
  });

  it("follows a d100 tens die's derived shade, so its bevel darkens with its faces", () => {
    const tens = bodyMaterial(theme, '#3f5fb0', 'tens');
    const [r, g, b] = asTextureSample(faceColor(theme, '#3f5fb0', 'tens'));
    expect(tens.color.r).toBeCloseTo(r!, 6);
    expect(tens.color.g).toBeCloseTo(g!, 6);
    expect(tens.color.b).toBeCloseTo(b!, 6);
    expect(tens.color.equals(bodyMaterial(theme, '#3f5fb0', 'normal').color)).toBe(false);
  });

  it("shades smooth where the value faces stay flat (DEC-079's per-material split)", () => {
    expect(bodyMaterial(theme, '#3f5fb0', 'normal').flatShading).toBe(false);
  });

  it('carries no map to multiply, which is why a colour here is not the tint bug', () => {
    const mat = bodyMaterial(theme, '#3f5fb0', 'normal');
    expect(mat.map).toBeNull();
    expect(mat.normalMap).toBeNull();
  });
});
