import { describe, expect, it } from 'vitest';
import {
  colorLuminance,
  HEX_CONTENTS_CATALOG,
  HEX_CONTENTS_TONE,
  HEX_OVERLAY_DARK,
  HEX_OVERLAY_LIGHT,
  HEX_TERRAIN_CATALOG,
  hexContentsEntry,
  hexOverlayTone,
  hexTerrainEntry,
  isKnownHexContents,
  isKnownHexTerrain,
  UNKNOWN_HEX_KIND,
} from './catalog.js';

describe('hex terrain catalog (SPEC-030 §2)', () => {
  it('carries the kinds the spec names, each with a colour and an overlay', () => {
    const kinds = HEX_TERRAIN_CATALOG.map((e) => e.kind);
    for (const named of ['plains', 'forest', 'hills', 'mountains', 'swamp', 'jungle']) {
      expect(kinds).toContain(named);
    }
    for (const entry of HEX_TERRAIN_CATALOG) {
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.ref).toMatch(/^hex\/.+\.svg$/);
    }
  });

  it('has unique kinds and a stable lookup', () => {
    const kinds = HEX_TERRAIN_CATALOG.map((e) => e.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const entry of HEX_TERRAIN_CATALOG) {
      expect(hexTerrainEntry(entry.kind)).toBe(entry);
    }
  });

  it('resolves an unrecognized kind to `unknown` rather than throwing', () => {
    // A hex painted by a newer build must still draw (see UNKNOWN_SYMBOL_KIND).
    expect(hexTerrainEntry('archipelago-of-tomorrow').kind).toBe(UNKNOWN_HEX_KIND);
    expect(hexTerrainEntry('').kind).toBe(UNKNOWN_HEX_KIND);
    expect(isKnownHexTerrain('archipelago-of-tomorrow')).toBe(false);
    expect(isKnownHexTerrain(UNKNOWN_HEX_KIND)).toBe(false);
    expect(isKnownHexTerrain('forest')).toBe(true);
  });
});

describe('hex contents catalog (SPEC-030 §3)', () => {
  it('carries the kinds the spec names', () => {
    const kinds = HEX_CONTENTS_CATALOG.map((e) => e.kind);
    for (const named of ['castle', 'town', 'fort', 'cave', 'danger', 'temple']) {
      expect(kinds).toContain(named);
    }
    for (const entry of HEX_CONTENTS_CATALOG) {
      expect(entry.ref).toMatch(/^hex\/.+\.svg$/);
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('has unique kinds, a stable lookup, and an `unknown` fallback', () => {
    const kinds = HEX_CONTENTS_CATALOG.map((e) => e.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const entry of HEX_CONTENTS_CATALOG) {
      expect(hexContentsEntry(entry.kind)).toBe(entry);
    }
    expect(hexContentsEntry('citadel-of-tomorrow').kind).toBe(UNKNOWN_HEX_KIND);
    expect(isKnownHexContents('castle')).toBe(true);
    expect(isKnownHexContents('citadel-of-tomorrow')).toBe(false);
  });

  it('is black on every terrain (§3), which is not the terrain overlay tone', () => {
    expect(HEX_CONTENTS_TONE).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorLuminance(HEX_CONTENTS_TONE)).toBeLessThan(0.15);
  });
});

describe('hexOverlayTone (SPEC-030 §2 — the contrasting light/dark tone)', () => {
  it('picks the dark tone on a light terrain and the light tone on a dark one', () => {
    expect(hexOverlayTone('#ffffff')).toBe(HEX_OVERLAY_DARK);
    expect(hexOverlayTone('#000000')).toBe(HEX_OVERLAY_LIGHT);
    expect(hexOverlayTone('#dfe6ea')).toBe(HEX_OVERLAY_DARK); // tundra
    expect(hexOverlayTone('#3f6f42')).toBe(HEX_OVERLAY_LIGHT); // forest
  });

  it('gives every catalog terrain an overlay that contrasts with its own fill', () => {
    // The rule that matters: whichever tone is chosen, it must be on the other
    // side of mid-grey from the fill it is drawn on. A terrain re-coloured in
    // this file can never be left with the tone its old colour needed.
    for (const entry of HEX_TERRAIN_CATALOG) {
      const fill = colorLuminance(entry.color);
      const tone = colorLuminance(hexOverlayTone(entry.color));
      expect(Math.abs(fill - tone)).toBeGreaterThan(0.3);
    }
  });

  it('reads an unparseable colour as mid-grey and falls back to the dark tone', () => {
    expect(colorLuminance('not-a-colour')).toBe(0.5);
    expect(hexOverlayTone('not-a-colour')).toBe(HEX_OVERLAY_DARK);
  });

  it('expands the three-digit form', () => {
    expect(colorLuminance('#fff')).toBeCloseTo(1, 5);
    expect(colorLuminance('#000')).toBe(0);
  });
});
