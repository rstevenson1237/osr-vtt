import { describe, expect, it } from 'vitest';
import { axialKey, axialToPixel, hexCorners, hexMetrics, type Axial } from './axial.js';
import {
  hexColumnsInRect,
  hexCountInRect,
  hexOwnedEdgePath,
  hexPillAnchor,
  hexesInRect,
} from './grid.js';

const SIZE = 48;
/** A viewport-shaped rect straddling the origin, the way a fresh hex map opens. */
const VIEWPORT = { x: -400, y: -300, width: 800, height: 600 };

describe('hexColumnsInRect', () => {
  it('is empty for a non-positive size', () => {
    expect(hexColumnsInRect(VIEWPORT, 0)).toEqual([]);
    expect(hexColumnsInRect(VIEWPORT, -10)).toEqual([]);
  });

  it('returns ascending, contiguous columns', () => {
    const columns = hexColumnsInRect(VIEWPORT, SIZE);
    expect(columns.length).toBeGreaterThan(1);
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i]!.q).toBe(columns[i - 1]!.q + 1);
    }
  });

  it('offsets each column half a row, so the range tracks the column stagger', () => {
    const columns = hexColumnsInRect(VIEWPORT, SIZE);
    // r = y / rowStep - q/2, so two columns apart shifts the range by exactly
    // one row. (Adjacent columns differ by a half row, which floor/ceil may or
    // may not round into a different integer.)
    const byQ = new Map(columns.map((c) => [c.q, c]));
    for (const col of columns) {
      const two = byQ.get(col.q + 2);
      if (!two) continue;
      expect(two.rMin).toBe(col.rMin - 1);
      expect(two.rMax).toBe(col.rMax - 1);
    }
  });

  it('accepts either corner order', () => {
    const a = hexColumnsInRect({ x: 400, y: 300, width: -800, height: -600 }, SIZE);
    expect(a).toEqual(hexColumnsInRect(VIEWPORT, SIZE));
  });
});

describe('hexesInRect', () => {
  it('covers every hex whose centre is inside the rect', () => {
    const covered = new Set(hexesInRect(VIEWPORT, SIZE).map(axialKey));
    // Independently enumerate the hexes whose *centres* land in the rect and
    // check the culler is a superset of them — the margin may add more, but it
    // may never drop one.
    for (let q = -20; q <= 20; q++) {
      for (let r = -20; r <= 20; r++) {
        const p = axialToPixel({ q, r }, SIZE);
        const inside =
          p.x >= VIEWPORT.x &&
          p.x <= VIEWPORT.x + VIEWPORT.width &&
          p.y >= VIEWPORT.y &&
          p.y <= VIEWPORT.y + VIEWPORT.height;
        if (inside) expect(covered.has(axialKey({ q, r }))).toBe(true);
      }
    }
  });

  it('reaches at least one hex past every edge', () => {
    // The margin is what keeps a hex clipped by the viewport edge — and the
    // west/north edges the drawn hexes do not own — from going missing.
    const hexes = hexesInRect(VIEWPORT, SIZE);
    const xs = hexes.map((h) => axialToPixel(h, SIZE).x);
    const ys = hexes.map((h) => axialToPixel(h, SIZE).y);
    expect(Math.min(...xs)).toBeLessThan(VIEWPORT.x);
    expect(Math.max(...xs)).toBeGreaterThan(VIEWPORT.x + VIEWPORT.width);
    expect(Math.min(...ys)).toBeLessThan(VIEWPORT.y);
    expect(Math.max(...ys)).toBeGreaterThan(VIEWPORT.y + VIEWPORT.height);
  });

  it('is column-major and free of duplicates', () => {
    const hexes = hexesInRect(VIEWPORT, SIZE);
    expect(new Set(hexes.map(axialKey)).size).toBe(hexes.length);
    for (let i = 1; i < hexes.length; i++) {
      const prev = hexes[i - 1]!;
      const cur = hexes[i]!;
      expect(cur.q === prev.q ? cur.r > prev.r : cur.q === prev.q + 1).toBe(true);
    }
  });

  it('scales with the rect, not with some fixed viewport', () => {
    const small = hexesInRect({ x: 0, y: 0, width: 200, height: 200 }, SIZE);
    const large = hexesInRect({ x: 0, y: 0, width: 2000, height: 2000 }, SIZE);
    expect(large.length).toBeGreaterThan(small.length * 10);
  });

  it('scales inversely with the hex size', () => {
    const big = hexesInRect(VIEWPORT, 96);
    const small = hexesInRect(VIEWPORT, 24);
    expect(small.length).toBeGreaterThan(big.length);
  });
});

describe('hexCountInRect', () => {
  it('agrees with the length of hexesInRect', () => {
    for (const size of [12, 48, 137]) {
      expect(hexCountInRect(VIEWPORT, size)).toBe(hexesInRect(VIEWPORT, size).length);
    }
  });

  it('is zero for a non-positive size', () => {
    expect(hexCountInRect(VIEWPORT, 0)).toBe(0);
  });
});

describe('hexOwnedEdgePath', () => {
  const CORNER_ORDER = [5, 0, 1, 2];

  it('is corners 5-0-1-2 of the hex', () => {
    for (const hex of [
      { q: 0, r: 0 },
      { q: 3, r: -2 },
      { q: -4, r: 7 },
    ] as Axial[]) {
      const corners = hexCorners(hex, SIZE);
      const path = hexOwnedEdgePath(hex, SIZE);
      expect(path).toHaveLength(4);
      path.forEach((p, i) => {
        const want = corners[CORNER_ORDER[i]!]!;
        expect(p.x).toBeCloseTo(want.x, 9);
        expect(p.y).toBeCloseTo(want.y, 9);
      });
    }
  });

  it('tiles the plane: every edge in a block is drawn exactly once', () => {
    // The property the three-of-six choice exists for. Enumerate a block of
    // hexes, collect the edges each one owns, and check that no edge strictly
    // inside the block is emitted twice.
    const seen = new Map<string, number>();
    const key = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
      const round = (p: { x: number; y: number }): string => `${p.x.toFixed(6)}:${p.y.toFixed(6)}`;
      const [lo, hi] = [round(a), round(b)].sort() as [string, string];
      return `${lo}|${hi}`;
    };
    for (let q = -4; q <= 4; q++) {
      for (let r = -4; r <= 4; r++) {
        const path = hexOwnedEdgePath({ q, r }, SIZE);
        for (let i = 1; i < path.length; i++) {
          const k = key(path[i - 1]!, path[i]!);
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
      }
    }
    expect([...seen.values()].every((n) => n === 1)).toBe(true);

    // …and the interior hexes still get all six of their edges, from their own
    // path plus their neighbours'.
    const interior = hexCorners({ q: 0, r: 0 }, SIZE);
    for (let i = 0; i < 6; i++) {
      expect(seen.has(key(interior[i]!, interior[(i + 1) % 6]!))).toBe(true);
    }
  });
});

describe('hexPillAnchor', () => {
  it('sits on the midpoint of the hex bottom edge', () => {
    for (const hex of [
      { q: 0, r: 0 },
      { q: 2, r: 5 },
      { q: -7, r: -1 },
    ] as Axial[]) {
      const corners = hexCorners(hex, SIZE);
      // Corners 1 (SE) and 2 (SW) are the bottom edge.
      const anchor = hexPillAnchor(hex, SIZE);
      expect(anchor.x).toBeCloseTo((corners[1]!.x + corners[2]!.x) / 2, 9);
      expect(anchor.y).toBeCloseTo((corners[1]!.y + corners[2]!.y) / 2, 9);
    }
  });

  it('is half a hex height below the centre', () => {
    const centre = axialToPixel({ q: 4, r: -3 }, SIZE);
    const anchor = hexPillAnchor({ q: 4, r: -3 }, SIZE);
    expect(anchor.x).toBeCloseTo(centre.x, 9);
    expect(anchor.y - centre.y).toBeCloseTo(hexMetrics(SIZE).height / 2, 9);
  });
});
