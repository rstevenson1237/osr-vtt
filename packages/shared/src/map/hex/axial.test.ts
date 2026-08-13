import { describe, expect, it } from 'vitest';
import type { Point } from '../vector/types.js';
import {
  AXIAL_DIRECTIONS,
  HEX_ORIGIN,
  axialAdd,
  axialDistance,
  axialEquals,
  axialKey,
  axialNeighbor,
  axialNeighbors,
  axialRound,
  axialSubtract,
  axialToPixel,
  hexCorners,
  hexMetrics,
  parseAxialKey,
  pixelToAxial,
  type Axial,
} from './axial.js';

/** A spread of hexes covering both signs on both axes, plus the centre. */
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

const SIZE = 48;

describe('axial coordinates (SPEC-030 §1)', () => {
  it('puts the origin at the map centre with both axes running both ways', () => {
    // SPEC-030 §1: "0,0 is the map's centre; both axes run positive and
    // negative from there" — so the origin is pixel (0,0) and a hex and its
    // negation land symmetrically about it.
    expect(HEX_ORIGIN).toEqual({ q: 0, r: 0 });
    expect(axialToPixel(HEX_ORIGIN, SIZE)).toEqual({ x: 0, y: 0 });

    const hex = { q: 3, r: -7 };
    const there = axialToPixel(hex, SIZE);
    const back = axialToPixel({ q: -hex.q, r: -hex.r }, SIZE);
    expect(back.x).toBeCloseTo(-there.x, 9);
    expect(back.y).toBeCloseTo(-there.y, 9);
  });

  it('is not the square lattice: an Axial is not a Point', () => {
    // RULE-006 (amended by WI-037) forbids mixing the two spaces inside one
    // map. The type system carries that here — this is the assertion that a
    // later refactor cannot quietly make `Axial` structurally a `Point`.
    const hex: Axial = { q: 1, r: 2 };
    // @ts-expect-error a lattice Point is not an axial hex coordinate
    const asPoint: Point = hex;
    void asPoint;
    // @ts-expect-error an axial hex coordinate is not a lattice Point
    const asHex: Axial = { x: 1, y: 2 } satisfies Point;
    void asHex;
  });

  it('adds and subtracts component-wise', () => {
    expect(axialAdd({ q: 2, r: -3 }, { q: -5, r: 1 })).toEqual({ q: -3, r: -2 });
    expect(axialSubtract({ q: 2, r: -3 }, { q: -5, r: 1 })).toEqual({ q: 7, r: -4 });
  });

  it('compares by value, never by identity', () => {
    expect(axialEquals({ q: 4, r: -1 }, { q: 4, r: -1 })).toBe(true);
    expect(axialEquals({ q: 4, r: -1 }, { q: -1, r: 4 })).toBe(false);
  });
});

describe('neighbours', () => {
  it('has six distinct directions, each exactly one step away', () => {
    expect(AXIAL_DIRECTIONS).toHaveLength(6);
    expect(new Set(AXIAL_DIRECTIONS.map(axialKey)).size).toBe(6);
    for (const dir of AXIAL_DIRECTIONS) {
      expect(axialDistance(HEX_ORIGIN, dir)).toBe(1);
    }
  });

  it('returns the six neighbours of any hex, all one step away', () => {
    for (const hex of SAMPLE) {
      const neighbours = axialNeighbors(hex);
      expect(neighbours).toHaveLength(6);
      expect(new Set(neighbours.map(axialKey)).size).toBe(6);
      for (const n of neighbours) {
        expect(axialDistance(hex, n)).toBe(1);
        expect(axialNeighbors(n).some((back) => axialEquals(back, hex))).toBe(true);
      }
    }
  });

  it('wraps the direction index so a rotation never needs normalising', () => {
    const hex = { q: 2, r: 5 };
    expect(axialNeighbor(hex, 6)).toEqual(axialNeighbor(hex, 0));
    expect(axialNeighbor(hex, -1)).toEqual(axialNeighbor(hex, 5));
    expect(axialNeighbor(hex, 13)).toEqual(axialNeighbor(hex, 1));
  });

  it('neighbours are adjacent in pixels too: six centres at one hex width', () => {
    // The pixel spacing between adjacent centres is the flat-to-flat height,
    // which is what makes the drawn grid gapless.
    const { rowStep } = hexMetrics(SIZE);
    const centre = axialToPixel({ q: -2, r: 3 }, SIZE);
    for (const n of axialNeighbors({ q: -2, r: 3 })) {
      const p = axialToPixel(n, SIZE);
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeCloseTo(rowStep, 9);
    }
  });
});

describe('axialDistance', () => {
  it('is zero on itself and symmetric', () => {
    for (const hex of SAMPLE) {
      expect(axialDistance(hex, hex)).toBe(0);
      expect(axialDistance(hex, { q: 7, r: -2 })).toBe(axialDistance({ q: 7, r: -2 }, hex));
    }
  });

  it('counts hex steps, not lattice steps', () => {
    // Three steps due north is distance 3; the diagonal that a square lattice
    // would call one Chebyshev step is two hex steps.
    expect(axialDistance(HEX_ORIGIN, { q: 0, r: -3 })).toBe(3);
    expect(axialDistance(HEX_ORIGIN, { q: 1, r: 1 })).toBe(2);
    expect(axialDistance(HEX_ORIGIN, { q: -4, r: 2 })).toBe(4);
  });

  it('agrees with walking the grid one neighbour at a time', () => {
    const target = { q: 4, r: -6 };
    let hex = HEX_ORIGIN;
    let steps = 0;
    while (!axialEquals(hex, target) && steps < 50) {
      // Greedy descent: each step must strictly reduce the distance, which is
      // only true if the metric really is the step count.
      const next = axialNeighbors(hex).find(
        (n) => axialDistance(n, target) === axialDistance(hex, target) - 1,
      );
      expect(next).toBeDefined();
      hex = next!;
      steps += 1;
    }
    expect(steps).toBe(axialDistance(HEX_ORIGIN, target));
  });
});

describe('axialKey / parseAxialKey (the addressing scheme)', () => {
  it('round-trips every hex, negatives included', () => {
    for (const hex of SAMPLE) {
      expect(parseAxialKey(axialKey(hex))).toEqual(hex);
    }
    expect(axialKey({ q: -3, r: 12 })).toBe('-3,12');
  });

  it('produces a legal, spaceless document id', () => {
    for (const hex of SAMPLE) {
      const key = axialKey(hex);
      expect(key).not.toMatch(/[\s/]/);
      expect(key).not.toBe('.');
      expect(key).not.toBe('..');
    }
  });

  it('never emits a negative zero, so the centre has exactly one id', () => {
    expect(axialKey(axialRound({ q: -0.1, r: -0.1 }))).toBe('0,0');
    expect(axialKey(pixelToAxial({ x: -0.0001, y: -0.0001 }, SIZE))).toBe('0,0');
  });

  it('rejects anything that is not an integer pair', () => {
    for (const bad of ['', '0', '0,', ',0', '1, 2', '1.5,2', '1e3,2', 'a,b', '0,0,0', '+1,2']) {
      expect(parseAxialKey(bad)).toBeNull();
    }
  });
});

describe('the render boundary (RULE-006: the size is a multiplier, never stored)', () => {
  it('scales linearly with size and never leaks into a coordinate', () => {
    const hex = { q: 3, r: -2 };
    const a = axialToPixel(hex, 10);
    const b = axialToPixel(hex, 30);
    expect(b.x).toBeCloseTo(a.x * 3, 9);
    expect(b.y).toBeCloseTo(a.y * 3, 9);
    // Whatever the multiplier, the hex it maps back to is the same one.
    expect(pixelToAxial(a, 10)).toEqual(hex);
    expect(pixelToAxial(b, 30)).toEqual(hex);
  });

  it('reports flat-top metrics: 2·size wide, √3·size tall, columns interlocking', () => {
    const m = hexMetrics(SIZE);
    expect(m.width).toBeCloseTo(2 * SIZE, 9);
    expect(m.height).toBeCloseTo(Math.sqrt(3) * SIZE, 9);
    expect(m.colStep).toBeCloseTo(1.5 * SIZE, 9);
    expect(m.rowStep).toBeCloseTo(m.height, 9);
    // A column steps three quarters of a width, which is the interlock.
    expect(m.colStep).toBeCloseTo(0.75 * m.width, 9);
  });

  it('round-trips centre → pixel → hex for every sample', () => {
    for (const hex of SAMPLE) {
      expect(pixelToAxial(axialToPixel(hex, SIZE), SIZE)).toEqual(hex);
    }
  });

  it('picks the hex a point falls in, not just the one it is centred on', () => {
    // Nine points scattered well away from the centre of one hex — including
    // just inside each corner — must all still resolve to that hex.
    const hex = { q: 2, r: -1 };
    const centre = axialToPixel(hex, SIZE);
    for (const corner of hexCorners(hex, SIZE)) {
      const inset = {
        x: centre.x + (corner.x - centre.x) * 0.9,
        y: centre.y + (corner.y - centre.y) * 0.9,
      };
      expect(pixelToAxial(inset, SIZE)).toEqual(hex);
    }
    expect(pixelToAxial({ x: centre.x, y: centre.y + SIZE * 0.4 }, SIZE)).toEqual(hex);
  });

  it('assigns a point just past an edge to the neighbour across it', () => {
    const { rowStep } = hexMetrics(SIZE);
    // Just past the origin hex's north flat edge (half a flat-to-flat height
    // up), and just past its south one.
    expect(pixelToAxial({ x: 0, y: -rowStep / 2 - 0.5 }, SIZE)).toEqual({ q: 0, r: -1 });
    expect(pixelToAxial({ x: 0, y: rowStep / 2 + 0.5 }, SIZE)).toEqual({ q: 0, r: 1 });
  });
});

describe('axialRound', () => {
  it('leaves an already-integral hex alone', () => {
    for (const hex of SAMPLE) {
      expect(axialRound(hex)).toEqual(hex);
    }
  });

  it('differs from naive per-component rounding near a corner', () => {
    // This is the case cube rounding exists for: rounding q and r
    // independently gives {1,1}, two steps from the origin, when the point is
    // barely half a hex away. Cube rounding lands on a real neighbour.
    const fractional = { q: 0.6, r: 0.6 };
    const naive = { q: Math.round(fractional.q), r: Math.round(fractional.r) };
    const rounded = axialRound(fractional);
    expect(axialDistance(HEX_ORIGIN, naive)).toBe(2);
    expect(rounded).not.toEqual(naive);
    expect(axialDistance(HEX_ORIGIN, rounded)).toBe(1);
  });

  it('collapses onto the nearest centre, checked against brute force', () => {
    // Sample the plane and compare the analytic pick against the nearest of
    // every candidate centre nearby — the definition of "which hex is this".
    const candidates: Axial[] = [];
    for (let q = -4; q <= 4; q += 1) {
      for (let r = -4; r <= 4; r += 1) candidates.push({ q, r });
    }
    for (let x = -100; x <= 100; x += 7) {
      for (let y = -100; y <= 100; y += 7) {
        const picked = pixelToAxial({ x, y }, SIZE);
        const nearest = candidates.reduce((best, c) => {
          const p = axialToPixel(c, SIZE);
          const bp = axialToPixel(best, SIZE);
          return Math.hypot(p.x - x, p.y - y) < Math.hypot(bp.x - x, bp.y - y) ? c : best;
        }, candidates[0]!);
        expect(picked).toEqual(nearest);
      }
    }
  });
});

describe('hexCorners', () => {
  it('gives six corners, each exactly one size from the centre', () => {
    const hex = { q: -1, r: 2 };
    const centre = axialToPixel(hex, SIZE);
    const corners = hexCorners(hex, SIZE);
    expect(corners).toHaveLength(6);
    for (const c of corners) {
      expect(Math.hypot(c.x - centre.x, c.y - centre.y)).toBeCloseTo(SIZE, 9);
    }
  });

  it('is flat-topped: the first corner is due east, the top edge is flat', () => {
    const corners = hexCorners(HEX_ORIGIN, SIZE);
    expect(corners[0]!.x).toBeCloseTo(SIZE, 9);
    expect(corners[0]!.y).toBeCloseTo(0, 9);
    // The two topmost corners share a y, which is what "flat top" means.
    const ys = corners.map((c) => c.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(ys[1]!, 9);
  });

  it('two neighbours agree on the two corners they share', () => {
    const a = { q: 0, r: 0 };
    for (const b of axialNeighbors(a)) {
      const shared = hexCorners(a, SIZE).filter((ca) =>
        hexCorners(b, SIZE).some(
          (cb) => Math.abs(ca.x - cb.x) < 1e-9 && Math.abs(ca.y - cb.y) < 1e-9,
        ),
      );
      expect(shared).toHaveLength(2);
    }
  });
});
