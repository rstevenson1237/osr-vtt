import { describe, expect, it } from 'vitest';
import {
  blendHexColors,
  colorLuminance,
  contrastRatio,
  HEX_CONTENTS_CATALOG,
  HEX_CONTENTS_TONE,
  HEX_LINE_CATALOG,
  HEX_LINE_WIDTHS,
  HEX_TERRAIN_CATALOG,
  HEX_TERRAIN_CONTRAST_MIN,
  HEX_TERRAIN_OVERLAY_ALPHA,
  hexContentsEntry,
  hexLineEntry,
  hexLineShade,
  hexLineWidth,
  hexTerrainEntry,
  isKnownHexContents,
  isKnownHexLine,
  isKnownHexTerrain,
  paintableHexContentsCatalog,
  UNKNOWN_HEX_KIND,
} from './catalog.js';

describe('hex terrain catalog (SPEC-030 §2, amended SPEC-047 §8)', () => {
  it('carries the kinds the spec names, each with a colour, a label and an ink', () => {
    const kinds = HEX_TERRAIN_CATALOG.map((e) => e.kind);
    for (const named of ['plains', 'forest', 'hills', 'mountains', 'swamp', 'jungle']) {
      expect(kinds).toContain(named);
    }
    for (const entry of HEX_TERRAIN_CATALOG) {
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.label.length).toBeGreaterThan(0);
      // `water` is the one background-only kind: no overlay, so no ref and no ink.
      if (entry.kind === 'water') {
        expect(entry.ref).toBeNull();
        expect(entry.ink).toBeNull();
      } else {
        expect(entry.ref).toMatch(/^hex\/.+\.svg$/);
        expect(entry.ink).toMatch(/^#[0-9a-f]{6}$/);
      }
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

  it('keeps every alias resolving to real art (RULE-007 — alias, never rename)', () => {
    // SPEC-047 §8: these six now draw identical art to another kind, retired
    // from a new-authoring picker but never removed from the catalog.
    for (const kind of ['grass', 'scrub', 'tundra', 'ice-floe', 'palm', 'plateau']) {
      const entry = hexTerrainEntry(kind);
      expect(entry.kind).toBe(kind);
      expect(entry.ref).toMatch(/^hex\/.+\.svg$/);
    }
  });

  it('keeps `volcano` in both the terrain and contents catalogs, unrenamed', () => {
    expect(isKnownHexTerrain('volcano')).toBe(true);
    expect(isKnownHexContents('volcano')).toBe(true);
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

  it('is black on every terrain (§3), which is not a terrain overlay ink', () => {
    expect(HEX_CONTENTS_TONE).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorLuminance(HEX_CONTENTS_TONE)).toBeLessThan(0.15);
  });

  it('retires `ruins` and `tower` to their pack near-neighbours\' art (§10, WI-123)', () => {
    // Rows and kind strings survive unchanged (RULE-007) — only `ref` moves,
    // and both are excluded from a paintable picker.
    expect(hexContentsEntry('ruins').ref).toBe(hexContentsEntry('ruin').ref);
    expect(hexContentsEntry('tower').ref).toBe(hexContentsEntry('tower-keep').ref);
    expect(isKnownHexContents('ruins')).toBe(true);
    expect(isKnownHexContents('tower')).toBe(true);
    const paintableKinds = paintableHexContentsCatalog().map((e) => e.kind);
    expect(paintableKinds).not.toContain('ruins');
    expect(paintableKinds).not.toContain('tower');
    // `danger` keeps its own art and its palette slot (DEC-091 (c)).
    expect(paintableKinds).toContain('danger');
    expect(hexContentsEntry('danger').ref).toBe('hex/contents/danger.svg');
  });
});

describe('colour helpers (SPEC-030 §2, DEC-089)', () => {
  it('computes relative luminance, expanding the three-digit form', () => {
    expect(colorLuminance('#fff')).toBeCloseTo(1, 5);
    expect(colorLuminance('#000')).toBe(0);
  });

  it('reads an unparseable colour as mid-grey', () => {
    expect(colorLuminance('not-a-colour')).toBe(0.5);
  });

  it('computes a WCAG contrast ratio, symmetric and always >= 1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 5);
  });

  it('blends a foreground over a background at alpha, exact at the extremes', () => {
    expect(blendHexColors('#ff0000', '#0000ff', 1)).toBe('#ff0000');
    expect(blendHexColors('#ff0000', '#0000ff', 0)).toBe('#0000ff');
    expect(blendHexColors('#ffffff', '#000000', 0.5)).toBe('#808080');
  });
});

// The ~41 kinds DEC-089/WI-119 actually authored a color/ink pair for and
// judged on the reference sheet (`docs/completed/wi-119/palette.json`'s
// `catalog` array) — the guard below is DEC-089's mechanism, scoped to DEC-089's
// own stated scope ("the ~42 concrete pairs remain WI-119's deliverable").
// Excluded, deliberately: the six aliases (SPEC-047 §8 keeps their *old*
// `color` unchanged and only borrows another kind's `ref`/`ink` — `grass` and
// `scrub` are WI-119's own flagged near-misses, §4, left for a future lightness
// bump rather than blocking this item) and the eight kinds this pack does not
// touch at all, whose baked-in `ink` is today's `hexOverlayTone` output, a
// weaker (luminance-gap) guarantee than DEC-089's, kept because WI-119 asked
// for "no behaviour change for anything this section doesn't touch".
const AUTHORED_PALETTE_KINDS = new Set([
  'forest',
  'forest-heavy',
  'forest-mixed',
  'forest-mixed-heavy',
  'forest-mixed-hills',
  'forest-mixed-mountain',
  'forest-mixed-mountains',
  'forested-hills',
  'forested-mountain',
  'forested-mountains',
  'evergreen',
  'evergreen-heavy',
  'evergreen-hills',
  'evergreen-mountain',
  'evergreen-mountains',
  'jungle',
  'jungle-heavy',
  'jungle-hills',
  'jungle-mountain',
  'jungle-mountains',
  'marsh',
  'swamp',
  'hills',
  'desert',
  'dunes',
  'desert-rocky',
  'cactus',
  'cactus-heavy',
  'cultivatedfarmland',
  'mountains',
  'mountain',
  'mountain-snow',
  'mountains-snow',
  'volcano',
  'volcano-dormant',
  'badlands',
  'brokenlands',
  'deadforest',
  'reefs',
  'grassland',
  'snowfields',
]);

describe('terrain contrast guard (DEC-089 — an authored pair, mechanically checked)', () => {
  it('has an authored-palette kind for every catalog row with an ink, minus the known exceptions', () => {
    const withInk = HEX_TERRAIN_CATALOG.filter((e) => e.ink).map((e) => e.kind);
    expect(withInk.length - AUTHORED_PALETTE_KINDS.size).toBe(14); // 6 aliases + 8 untouched
  });

  it('gives every authored terrain a color/ink pair that clears the minimum contrast', () => {
    // The raw pair, exactly as DEC-089 asked for.
    for (const entry of HEX_TERRAIN_CATALOG) {
      if (!AUTHORED_PALETTE_KINDS.has(entry.kind)) continue;
      expect(contrastRatio(entry.color, entry.ink!)).toBeGreaterThanOrEqual(
        HEX_TERRAIN_CONTRAST_MIN,
      );
    }
  });

  it('keeps the black contents icon legible over the *blended* overlay, not just the raw ink', () => {
    // WI-119 §6: the ink is drawn at HEX_TERRAIN_OVERLAY_ALPHA over `color`, and
    // the black contents icon sits on that blend, not on raw `ink` — a pair that
    // only clears the minimum at full strength can still under-serve contents
    // legibility once actually rendered.
    for (const entry of HEX_TERRAIN_CATALOG) {
      if (!AUTHORED_PALETTE_KINDS.has(entry.kind)) continue;
      const blended = blendHexColors(entry.ink!, entry.color, HEX_TERRAIN_OVERLAY_ALPHA);
      expect(contrastRatio(blended, HEX_CONTENTS_TONE)).toBeGreaterThanOrEqual(
        HEX_TERRAIN_CONTRAST_MIN,
      );
    }
  });

  it('gives `water` no ink to guard, since it has no overlay to draw', () => {
    const water = hexTerrainEntry('water');
    expect(water.ink).toBeNull();
    expect(water.ref).toBeNull();
  });
});

describe('hex line catalog — roads and rivers (SPEC-047 §2)', () => {
  it('carries exactly the two kinds, three shades each, with their join styles', () => {
    expect(HEX_LINE_CATALOG.map((entry) => entry.kind)).toEqual(['road', 'river']);
    for (const entry of HEX_LINE_CATALOG) {
      expect(entry.shades).toHaveLength(3);
      for (const shade of entry.shades) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
    }
    // §4's table: roads mitre, rivers round. The document carries this — the
    // catalog only says what the tool starts it at.
    expect(hexLineEntry('road').join).toBe('mitre');
    expect(hexLineEntry('river').join).toBe('round');
  });

  it('offers three widths, increasing, as multiples of hex.size', () => {
    // Multiples, not pixels (RULE-006): the render boundary is crossed once,
    // by the circumradius, exactly as it is for every other hex measurement.
    expect(HEX_LINE_WIDTHS).toHaveLength(3);
    expect([...HEX_LINE_WIDTHS]).toEqual([...HEX_LINE_WIDTHS].sort((a, b) => a - b));
    for (const width of HEX_LINE_WIDTHS) {
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(1);
    }
  });

  it('resolves a stored kind + index to a colour, and never the other way', () => {
    expect(hexLineShade('road', 0)).toBe(HEX_LINE_CATALOG[0]!.shades[0]);
    expect(hexLineShade('river', 2)).toBe(HEX_LINE_CATALOG[1]!.shades[2]);
    expect(hexLineWidth(1)).toBe(HEX_LINE_WIDTHS[1]);
    // A road's browns and a river's blues are different palettes: the same
    // index under a different kind is a different colour.
    expect(hexLineShade('road', 1)).not.toBe(hexLineShade('river', 1));
  });

  it('clamps an out-of-range index rather than dropping the line', () => {
    // A document written by a build with a longer palette still draws — the
    // same posture `hexTerrainEntry` takes with an unknown kind.
    expect(hexLineShade('road', 99)).toBe(HEX_LINE_CATALOG[0]!.shades[2]);
    expect(hexLineShade('road', -1)).toBe(HEX_LINE_CATALOG[0]!.shades[0]);
    expect(hexLineWidth(99)).toBe(HEX_LINE_WIDTHS[2]);
    expect(hexLineWidth(Number.NaN)).toBe(HEX_LINE_WIDTHS[0]);
  });

  it('falls back to the first kind for a kind this build does not know', () => {
    // There is no `unknown` line kind: a line has to have a colour and a width
    // to exist at all, so the fallback is a real entry rather than a grey one.
    expect(hexLineEntry('canal')).toBe(HEX_LINE_CATALOG[0]);
    expect(isKnownHexLine('canal')).toBe(false);
    expect(isKnownHexLine('river')).toBe(true);
  });
});
