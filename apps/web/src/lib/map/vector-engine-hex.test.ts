import { describe, expect, it } from 'vitest';
import { hexMap } from '@osr-vtt/shared';
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

describe('painted-hex art sizing and the terrain clip (SPEC-030 §§2–3, SPEC-047 §13)', () => {
  /** Centre-to-edge of a flat-top hex — the tightest dimension a centred square
   * box has to fit inside, and the one a box sized off the circumradius can
   * overshoot without ever looking obviously wrong at a single hex. */
  const inradius = (size: number) => (size * Math.sqrt(3)) / 2;
  /** Half-diagonal of a centred square box of side `box`. */
  const halfDiagonal = (box: number) => (box * Math.SQRT2) / 2;

  /** The clip polygon in world pixels around a hex of circumradius `size`:
   * `hexTerrainClipPolygon` is expressed in the art box's own unit square, so
   * this is the shape actually baked, in the space the hex lives in. */
  const clipInWorld = (size: number) => {
    const box = hexTerrainArtPx(size);
    return hexMap.hexTerrainClipPolygon().map((p) => ({
      x: (p.x - 0.5) * box,
      y: (p.y - 0.5) * box,
    }));
  };

  /** Even-odd point-in-polygon. Used to ask the only question this section's
   * assertion is about: would art at this point survive the clip? */
  const insideClip = (size: number, x: number, y: number): boolean => {
    const poly = clipInWorld(size);
    let inside = false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + poly.length - 1) % poly.length]!;
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  };

  it('draws the terrain overlay at the box SPEC-047 §13 asks for', () => {
    // 1.8× is WI-119's figure, kept when DEC-092 was amended (user,
    // 2026-09-11). It is not a tuning knob: it is what the reference material
    // was looked at against, and it is deliberately larger than the hex.
    expect(hexTerrainArtPx(SIZE)).toBeCloseTo(SIZE * 1.8, 9);
  });

  it('is a box the hex does not contain — which is what the clip is for', () => {
    // The old assertion here was the inverse: box small enough never to reach
    // the boundary (WI-122's unclipped 1.22× fallback). §13 replaces the small
    // box with a baked clip, so the box now overshoots on purpose and the
    // safety argument moves to the clip below.
    expect(halfDiagonal(hexTerrainArtPx(SIZE))).toBeGreaterThan(inradius(SIZE));
  });

  it('clips art outside the hex, corners included', () => {
    // The four box corners sit at 1.27 · size — far outside a hex whose own
    // corners are at 1.0 · size. They are exactly what the old fit assertion
    // existed to prevent, and trimming them is the clip earning its place.
    const half = hexTerrainArtPx(SIZE) / 2;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        expect(insideClip(SIZE, sx * half * 0.999, sy * half * 0.999)).toBe(false);
      }
    }
    // The flats overflow by 4% and are trimmed too: just past the inradius,
    // due north, is outside.
    expect(insideClip(SIZE, 0, -inradius(SIZE) * 1.01)).toBe(false);
    // ...and just inside it is kept, or the clip would be eating the picture.
    expect(insideClip(SIZE, 0, -inradius(SIZE) * 0.99)).toBe(true);
    expect(insideClip(SIZE, 0, 0)).toBe(true);
  });

  it('clips to the hex the grid actually draws, not to an inscribed circle', () => {
    // A circle inscribed in the hex touches the flats and clears the corners —
    // precisely the area this whole exercise exists to reach. The clip is the
    // map's own silhouette: `hexCorners`' six vertices at the circumradius, in
    // `hexCorners`' own flat-top orientation.
    const expected = hexMap.hexCorners({ q: 0, r: 0 }, SIZE);
    const actual = clipInWorld(SIZE);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expected[i]!.x, 9);
      expect(point.y).toBeCloseTo(expected[i]!.y, 9);
    });
  });

  it('leaves the hex east and west corner tips uncovered, as §13 accepts', () => {
    // The box's half-width is 0.9 · size and a hex corner is at 1.0 · size, so
    // the two tips are never reached by the art at all and keep showing bare
    // `color`. Accepted at 1.8×, not a defect — 2.0× would cover them and was
    // not chosen. Asserted so a later reader finds the decision, not a bug.
    expect(hexTerrainArtPx(SIZE) / 2).toBeLessThan(SIZE);
  });

  it('keeps a contents icon inside its own hex, and smaller than the terrain', () => {
    // Unclipped, unlike the terrain overlay: it fits its hex unaided, and §3's
    // icon sits *on* the terrain — the same size would read as more terrain.
    expect(halfDiagonal(hexContentsArtPx(SIZE))).toBeLessThan(inradius(SIZE));
    expect(hexContentsArtPx(SIZE)).toBeLessThan(hexTerrainArtPx(SIZE));
  });

  it('scales both with the hex, so the composition holds at any hex size', () => {
    for (const size of [12, 24, 48, 120]) {
      expect(hexTerrainArtPx(size) / size).toBeCloseTo(hexTerrainArtPx(SIZE) / SIZE, 9);
      expect(hexContentsArtPx(size) / size).toBeCloseTo(hexContentsArtPx(SIZE) / SIZE, 9);
      expect(halfDiagonal(hexContentsArtPx(size))).toBeLessThan(inradius(size));
      // The clip scales with it too — the baked texture is resolution- and
      // size-independent because it is expressed against the box, not the hex.
      expect(insideClip(size, 0, 0)).toBe(true);
      expect(insideClip(size, hexTerrainArtPx(size) / 2, hexTerrainArtPx(size) / 2)).toBe(false);
    }
  });
});
