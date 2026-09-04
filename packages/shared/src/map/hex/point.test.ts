import { describe, expect, it } from 'vitest';
import { type Axial, axialKey, axialToPixel, hexCorners, parseAxialKey } from './axial.js';
import {
  HEX_CORNER_OFFSETS,
  HEX_POINT_ORIGIN,
  type HexPoint,
  axialToHexPoint,
  hexPointAdd,
  hexPointCorners,
  hexPointEquals,
  hexPointKey,
  hexPointToAxial,
  hexPointToPixel,
  isHexCentre,
  isHexCorner,
  parseHexPointKey,
  pixelToHexPoint,
  snapHexPoint,
} from './point.js';

/** The same spread `axial.test.ts` uses, plus a wide patch for the sweeps. */
const SAMPLE: Axial[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 3, r: -7 },
  { q: -12, r: 5 },
  { q: 40, r: 40 },
  { q: -33, r: -21 },
];

/** DEC-081's numeric check ran over an 81-hex patch; so does this file. */
const PATCH: Axial[] = [];
for (let q = -4; q <= 4; q += 1) {
  for (let r = -4; r <= 4; r += 1) PATCH.push({ q, r });
}

const SIZES = [20, 32, 48, 64];
const SIZE = 48;

describe('HexPoint — the thirds lattice (SPEC-047 §1, DEC-081)', () => {
  it('is not the hex-addressing space: a HexPoint is not an Axial', () => {
    // The two differ by a factor of three, so mixing them renders at the wrong
    // scale rather than failing loudly (RULE-006). This is the assertion that
    // a later refactor cannot quietly make them interchangeable.
    const point: HexPoint = { q: 2, r: -1 };
    // @ts-expect-error thirds are not whole hex steps
    const asHex: Axial = point;
    void asHex;
    const hex: Axial = { q: 1, r: 2 };
    // @ts-expect-error whole hex steps are not thirds
    const asPoint: HexPoint = hex;
    void asPoint;
  });

  it('puts the origin where the hex space does', () => {
    expect(HEX_POINT_ORIGIN).toEqual({ q: 0, r: 0 });
    expect(hexPointToPixel(HEX_POINT_ORIGIN, SIZE)).toEqual({ x: 0, y: 0 });
    expect(hexPointToAxial(HEX_POINT_ORIGIN)).toEqual({ q: 0, r: 0 });
  });

  it('adds component-wise and compares by value', () => {
    expect(hexPointAdd({ q: 2, r: -3 }, { q: -5, r: 1 })).toEqual({ q: -3, r: -2 });
    expect(hexPointEquals({ q: 4, r: -1 }, { q: 4, r: -1 })).toBe(true);
    expect(hexPointEquals({ q: 4, r: -1 }, { q: -1, r: 4 })).toBe(false);
  });
});

describe('the finding: every corner is an exact integer third', () => {
  it('reproduces hexCorners exactly, at every hex and every size', () => {
    // DEC-081's claim, checked the way it was found: the six offsets are
    // constant, independent of `size`, and land on the same pixels the
    // renderer already draws.
    for (const hex of PATCH) {
      for (const size of SIZES) {
        const drawn = hexCorners(hex, size);
        const thirds = hexPointCorners(hex);
        expect(thirds).toHaveLength(6);
        for (let i = 0; i < 6; i += 1) {
          const p = hexPointToPixel(thirds[i]!, size);
          expect(p.x).toBeCloseTo(drawn[i]!.x, 9);
          expect(p.y).toBeCloseTo(drawn[i]!.y, 9);
        }
      }
    }
  });

  it('has the six offsets SPEC-047 §1 lists, all integers', () => {
    expect(HEX_CORNER_OFFSETS).toEqual([
      { q: 2, r: -1 },
      { q: 1, r: 1 },
      { q: -1, r: 2 },
      { q: -2, r: 1 },
      { q: -1, r: -1 },
      { q: 1, r: -2 },
    ]);
    for (const offset of HEX_CORNER_OFFSETS) {
      expect(Number.isInteger(offset.q)).toBe(true);
      expect(Number.isInteger(offset.r)).toBe(true);
    }
  });

  it('adjacent hexes agree exactly on the corners they share', () => {
    // This is what the road tool is built on, and the reason thirds are stored
    // as integers rather than floats: shared corners must be `===`, not close.
    const byKey = new Map<string, number>();
    for (const hex of PATCH) {
      for (const corner of hexPointCorners(hex)) {
        byKey.set(hexPointKey(corner), (byKey.get(hexPointKey(corner)) ?? 0) + 1);
      }
    }
    // Every interior corner is reached by exactly three hexes of the patch.
    const interior = hexPointCorners({ q: 0, r: 0 }).map(hexPointKey);
    for (const key of interior) expect(byKey.get(key)).toBe(3);
  });

  it('is exact where floats are not', () => {
    // The measured divergence DEC-081 rejected alternative (b) on: the same
    // corner computed from three different hexes.
    const shared = hexPointCorners({ q: 0, r: 0 })[0]!;
    const fromEast = hexPointCorners({ q: 1, r: -1 })[2]!;
    const fromSouthEast = hexPointCorners({ q: 1, r: 0 })[4]!;
    expect(hexPointEquals(shared, fromEast)).toBe(true);
    expect(hexPointEquals(shared, fromSouthEast)).toBe(true);
    expect(hexPointKey(shared)).toBe(hexPointKey(fromSouthEast));
    // The float form of the same three, for contrast: not one value.
    const floats = [2 / 3, 1 - 1 / 3, 1 / 3 + 1 / 3];
    expect(new Set(floats).size).toBeGreaterThan(1);
  });
});

describe('classification is a mod-3 test', () => {
  it('calls (q + r) mod 3 === 0 a centre and everything else a corner', () => {
    for (const hex of PATCH) {
      const centre = axialToHexPoint(hex);
      expect((((centre.q + centre.r) % 3) + 3) % 3).toBe(0);
      expect(isHexCentre(centre)).toBe(true);
      expect(isHexCorner(centre)).toBe(false);
      for (const corner of hexPointCorners(hex)) {
        expect((((corner.q + corner.r) % 3) + 3) % 3).not.toBe(0);
        expect(isHexCorner(corner)).toBe(true);
        expect(isHexCentre(corner)).toBe(false);
      }
    }
  });

  it('works in the negative quadrant, where % alone would not', () => {
    // JS `%` keeps the sign of the dividend: (-4 + 1) % 3 is -0, and -1 % 3 is
    // -1. Both branches have to normalise, and this is the pin for it.
    expect(isHexCentre({ q: -3, r: 0 })).toBe(true);
    expect(isHexCentre({ q: -4, r: 1 })).toBe(true);
    expect(isHexCorner({ q: -4, r: 0 })).toBe(true);
    expect(isHexCorner({ q: -1, r: -1 })).toBe(true);
  });

  it('calls a free point neither', () => {
    const free = pixelToHexPoint({ x: 13, y: -7 }, SIZE);
    expect(Number.isInteger(free.q) && Number.isInteger(free.r)).toBe(false);
    expect(isHexCentre(free)).toBe(false);
    expect(isHexCorner(free)).toBe(false);
  });
});

describe('conversions', () => {
  it('round-trips a hex through thirds and back, keyed identically', () => {
    for (const hex of SAMPLE) {
      const point = axialToHexPoint(hex);
      expect(hexPointToAxial(point)).toEqual({ q: hex.q, r: hex.r });
      // The same document `hexTiles` is already keyed by.
      expect(axialKey(hexPointToAxial(point)!)).toBe(axialKey(hex));
    }
  });

  it('refuses to name a hex for a corner or a free point', () => {
    expect(hexPointToAxial({ q: 2, r: -1 })).toBeNull();
    expect(hexPointToAxial({ q: 1.5, r: 0 })).toBeNull();
  });

  it('crosses the render boundary exactly where axialToPixel does', () => {
    for (const hex of SAMPLE) {
      for (const size of SIZES) {
        const viaThirds = hexPointToPixel(axialToHexPoint(hex), size);
        const direct = axialToPixel(hex, size);
        expect(viaThirds.x).toBeCloseTo(direct.x, 9);
        expect(viaThirds.y).toBeCloseTo(direct.y, 9);
      }
    }
  });

  it('inverts the pixel conversion without rounding', () => {
    for (const size of SIZES) {
      for (const pixel of [
        { x: 0, y: 0 },
        { x: 13, y: -7 },
        { x: -211.5, y: 88.25 },
      ]) {
        const back = hexPointToPixel(pixelToHexPoint(pixel, size), size);
        expect(back.x).toBeCloseTo(pixel.x, 9);
        expect(back.y).toBeCloseTo(pixel.y, 9);
      }
    }
  });
});

describe('snapHexPoint', () => {
  it('leaves a lattice point exactly where it is', () => {
    for (const hex of PATCH) {
      const centre = axialToHexPoint(hex);
      expect(snapHexPoint(centre)).toEqual({ q: centre.q, r: centre.r });
      for (const corner of hexPointCorners(hex)) {
        expect(snapHexPoint(corner)).toEqual({ q: corner.q, r: corner.r });
      }
    }
  });

  it('always lands on the lattice, and on the nearest point of it', () => {
    // Nearest in pixels, which is why this is cube rounding and not a pair of
    // Math.round calls: near a triangle's corner the two disagree.
    const candidates: HexPoint[] = [];
    for (let q = -12; q <= 12; q += 1) {
      for (let r = -12; r <= 12; r += 1) candidates.push({ q, r });
    }
    for (let i = 0; i < 200; i += 1) {
      // A deterministic scatter across a couple of hexes' worth of pixels.
      const x = ((i * 37) % 173) - 86.5;
      const y = ((i * 53) % 149) - 74.5;
      const snapped = snapHexPoint(pixelToHexPoint({ x, y }, SIZE));
      expect(Number.isInteger(snapped.q)).toBe(true);
      expect(Number.isInteger(snapped.r)).toBe(true);
      expect(isHexCentre(snapped) || isHexCorner(snapped)).toBe(true);

      const distance = (p: HexPoint): number => {
        const px = hexPointToPixel(p, SIZE);
        return Math.hypot(px.x - x, px.y - y);
      };
      const best = Math.min(...candidates.map(distance));
      expect(distance(snapped)).toBeCloseTo(best, 9);
    }
  });

  it('snaps a point just off a corner onto that corner', () => {
    const corner = hexPointCorners({ q: 0, r: 0 })[0]!;
    const px = hexPointToPixel(corner, SIZE);
    const nudged = pixelToHexPoint({ x: px.x + 1.5, y: px.y - 1.5 }, SIZE);
    expect(snapHexPoint(nudged)).toEqual({ q: corner.q, r: corner.r });
  });

  it('never returns -0, so a key is never "-0,0"', () => {
    const snapped = snapHexPoint(pixelToHexPoint({ x: -0.01, y: -0.01 }, SIZE));
    expect(hexPointKey(snapped)).toBe('0,0');
    expect(Object.is(snapped.q, -0)).toBe(false);
    expect(Object.is(snapped.r, -0)).toBe(false);
  });
});

describe('hexPointKey / parseHexPointKey', () => {
  it('round-trips every lattice point of the patch', () => {
    for (const hex of PATCH) {
      for (const point of [axialToHexPoint(hex), ...hexPointCorners(hex)]) {
        const key = hexPointKey(point);
        expect(key).toMatch(/^-?\d+,-?\d+$/);
        expect(parseHexPointKey(key)).toEqual({ q: point.q, r: point.r });
      }
    }
  });

  it('normalises -0 the way axialKey has to', () => {
    expect(hexPointKey({ q: -0, r: -0 })).toBe('0,0');
    expect(parseHexPointKey('-0,-0')).toEqual({ q: 0, r: 0 });
    expect(Object.is(parseHexPointKey('-0,0')!.q, -0)).toBe(false);
  });

  it('rejects anything that is not a key, rather than rounding onto one', () => {
    for (const bad of ['', '0', '0,', ',0', '0,0,0', '1.5,0', '1e3,0', 'a,b', '0, 0', ' 0,0']) {
      expect(parseHexPointKey(bad)).toBeNull();
    }
    expect(parseHexPointKey('9007199254740993,0')).toBeNull();
  });

  it('is a different key space from axialKey, and says so by value', () => {
    // `"3,0"` is hex (3,0) to `parseAxialKey` and hex (1,0)'s centre to
    // `parseHexPointKey`. The strings collide; the meanings do not, which is
    // why nothing may read one with the other's parser.
    expect(parseAxialKey('3,0')).toEqual({ q: 3, r: 0 });
    expect(hexPointToAxial(parseHexPointKey('3,0')!)).toEqual({ q: 1, r: 0 });
  });
});
