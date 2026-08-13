import { describe, expect, it } from 'vitest';
import { hexPillFontPx, hexPillsReadable } from './vector-engine';

/** `DEFAULT_HEX_GRID_CONFIG.size` — what `createMap({ gridKind: 'hex' })` makes. */
const SIZE = 48;

describe('hexPillFontPx (SPEC-030 §1 coordinate pills)', () => {
  it('scales with the hex, so a pill keeps its proportion at any hex size', () => {
    expect(hexPillFontPx(SIZE) / SIZE).toBeCloseTo(hexPillFontPx(SIZE * 3) / (SIZE * 3), 9);
  });

  it('leaves a pill comfortably inside its hex', () => {
    // A "q,r" label is at most ~6 characters wide at this font size; the hex is
    // 2·size across. The pill has to read as belonging to one hex, not as a
    // band across three.
    expect(hexPillFontPx(SIZE) * 6 * 0.6).toBeLessThan(2 * SIZE);
  });
});

describe('hexPillsReadable', () => {
  it('draws pills at the default zoom', () => {
    expect(hexPillsReadable(SIZE, 1)).toBe(true);
  });

  it('drops them once the zoom takes them below legibility', () => {
    // The pills exist to be read (they are the map's addressing scheme, SPEC-030
    // §1); several hundred sub-pixel ones are noise, so far-out zooms get the
    // bare grid instead.
    expect(hexPillsReadable(SIZE, 0.2)).toBe(false);
  });

  it('is a screen-size rule, not a zoom rule — a bigger hex survives further out', () => {
    const scale = 0.4;
    expect(hexPillsReadable(SIZE, scale)).toBe(false);
    expect(hexPillsReadable(SIZE * 3, scale)).toBe(true);
  });

  it('is monotonic in the zoom', () => {
    // Zooming out never brings a pill back once it has gone.
    let gone = false;
    for (const scale of [6, 3, 2, 1, 0.8, 0.6, 0.4, 0.2]) {
      const visible = hexPillsReadable(SIZE, scale);
      if (gone) expect(visible).toBe(false);
      if (!visible) gone = true;
    }
    expect(gone).toBe(true);
  });
});
