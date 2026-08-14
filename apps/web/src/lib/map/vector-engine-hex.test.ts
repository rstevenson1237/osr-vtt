import { describe, expect, it } from 'vitest';
import {
  hexContentsArtPx,
  hexPillFontPx,
  hexPillsReadable,
  hexTerrainArtPx,
} from './vector-engine';

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

describe('painted-hex art sizing (SPEC-030 §§2–3)', () => {
  /** Centre-to-edge of a flat-top hex — the tightest dimension a centred square
   * box has to fit inside, and the one a box sized off the circumradius can
   * overshoot without ever looking obviously wrong at a single hex. */
  const inradius = (size: number) => (size * Math.sqrt(3)) / 2;
  /** Half-diagonal of a centred square box of side `box`. */
  const halfDiagonal = (box: number) => (box * Math.SQRT2) / 2;

  it('keeps a terrain overlay inside its own hex', () => {
    // Art that crossed the hex boundary would read as belonging to the
    // neighbour — and on a hex crawl, which hex a thing is in *is* the datum
    // (SPEC-030 §1 makes coordinates the addressing scheme).
    expect(halfDiagonal(hexTerrainArtPx(SIZE))).toBeLessThan(inradius(SIZE));
  });

  it('keeps a contents icon inside its own hex, and smaller than the terrain', () => {
    expect(halfDiagonal(hexContentsArtPx(SIZE))).toBeLessThan(inradius(SIZE));
    // §3's icon sits *on* the terrain; the same size would read as more terrain.
    expect(hexContentsArtPx(SIZE)).toBeLessThan(hexTerrainArtPx(SIZE));
  });

  it('scales both with the hex, so the composition holds at any hex size', () => {
    for (const size of [12, 24, 48, 120]) {
      expect(hexTerrainArtPx(size) / size).toBeCloseTo(hexTerrainArtPx(SIZE) / SIZE, 9);
      expect(hexContentsArtPx(size) / size).toBeCloseTo(hexContentsArtPx(SIZE) / SIZE, 9);
      expect(halfDiagonal(hexTerrainArtPx(size))).toBeLessThan(inradius(size));
    }
  });
});
