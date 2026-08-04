import { describe, expect, it } from 'vitest';
import { polygonClippingBackend as B } from './backend.js';
import {
  bufferPolyline,
  cellRectPoly,
  corridorPoly,
  decimatePolyline,
  ngonPoly,
  pathPoly,
  polygonPoly,
  rectPoly,
  regularPoly,
  targetedBandRect,
} from './primitives.js';
import type { MultiPoly, Point } from './types.js';
import { pointInFloorUnion } from './point-in-floor.js';

const pointInMulti = (mp: MultiPoly, p: Point) => pointInFloorUnion(p, mp);

const allAxisAligned = (mp: MultiPoly) =>
  mp.every((poly) =>
    poly.every((ring) =>
      ring.every((p, i) => {
        const q = ring[(i + 1) % ring.length]!;
        return Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.y - q.y) < 1e-9;
      }),
    ),
  );
const allInteger = (mp: MultiPoly) =>
  mp.every((poly) =>
    poly.every((ring) => ring.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))),
  );

/** A boolean-backend ring without its repeated closing vertex, so a test can
 * state a corner count directly. `polygon-clipping` closes its rings; the
 * hand-built primitives in this file do not. */
const distinctRing = (ring: Point[]): Point[] => {
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed =
    ring.length > 1 && Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9;
  return closed ? ring.slice(0, -1) : [...ring];
};

/** The covered x-span along the horizontal line `y`, by sampling. Lets a test
 * state a cross-section invariant without restating the banding arithmetic it
 * is meant to be checking. */
const coveredXSpan = (mp: MultiPoly, y: number): [number, number] | null => {
  let lo: number | null = null;
  let hi = 0;
  for (let x = -4; x <= 16; x += 0.25) {
    if (pointInMulti(mp, { x, y })) {
      lo ??= x;
      hi = x;
    }
  }
  return lo === null ? null : [lo, hi];
};

/** The covered y-span down the vertical line `x`, sampled finely enough to
 * resolve an ⅛-cell band. Same idea as `coveredXSpan`, the other way up. */
const coveredYSpan = (mp: MultiPoly, x: number): [number, number] | null => {
  const step = 1 / 256;
  let lo: number | null = null;
  let hi = 0;
  for (let i = 0; i <= 16 / step; i++) {
    const y = i * step;
    if (pointInMulti(mp, { x, y })) {
      lo ??= y;
      hi = y;
    }
  }
  return lo === null ? null : [lo, hi];
};

/** The polygon's diameter across its flats: twice the shortest distance from
 * the centre to an edge. */
const acrossFlatsOf = (ring: Point[], center: Point): number => {
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    min = Math.min(min, Math.hypot(mid.x - center.x, mid.y - center.y));
  }
  return min * 2;
};

describe('rectPoly (Room)', () => {
  it('normalizes opposite corners into a 4-vertex rectangle', () => {
    const poly = rectPoly({ x: 3, y: 5 }, { x: 1, y: 2 });
    expect(poly).not.toBeNull();
    expect(poly![0]).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 1, y: 5 },
    ]);
  });

  it('rejects a degenerate (zero-area) rectangle', () => {
    expect(rectPoly({ x: 1, y: 1 }, { x: 1, y: 5 })).toBeNull();
  });
});

describe('polygonPoly (irregular)', () => {
  it('needs at least three vertices', () => {
    expect(
      polygonPoly([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBeNull();
  });
  it('copies the collected vertices (no aliasing)', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 2 },
    ];
    const poly = polygonPoly(src)!;
    src[0]!.x = 99;
    expect(poly[0]![0]).toEqual({ x: 0, y: 0 });
  });
});

describe('regularPoly (Regular n-gon)', () => {
  it('emits n vertices for n>=3', () => {
    expect(regularPoly({ x: 0, y: 0 }, 5, 6)![0]).toHaveLength(6);
  });
  it('n<=1 is the degenerate circle → finely sampled', () => {
    expect(regularPoly({ x: 0, y: 0 }, 5, 1)![0]).toHaveLength(64);
  });
  it('rejects a non-positive radius', () => {
    expect(regularPoly({ x: 0, y: 0 }, 0, 6)).toBeNull();
  });
});

describe('corridorPoly (L-shaped, cardinal)', () => {
  it('legs are axis-aligned (flat ends, 90° corner) snapped and freeform', () => {
    expect(allAxisAligned(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, 'full'))).toBe(true);
    expect(allAxisAligned(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, 'free'))).toBe(true);
  });
  it('snapped odd-width walls land on whole grid lines (no half-tile offset)', () => {
    expect(allInteger(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, 'full'))).toBe(true);
  });
  it('freeform centers the band rather than grid-forcing it', () => {
    expect(allInteger(corridorPoly({ x: 2, y: 2 }, { x: 8, y: 6 }, 1, B, 'free'))).toBe(false);
  });

  // The corner used to collapse: each leg ran only between its centerline
  // endpoints, so the turn lost a `half x width` notch off its outer corner.
  it.each([1, 2, 3])('keeps the turn at full width (width %i, snapped)', (width) => {
    const mp = corridorPoly({ x: 2, y: 2 }, { x: 8, y: 8 }, width, B, 'full');
    // The vertical leg's cross-section, sampled well clear of the turn...
    const leg = coveredXSpan(mp, 8.25)!;
    // ...must be reached by the horizontal leg at the turn. The notch stopped
    // it at the centerline, half a width short of the outer wall.
    const turn = coveredXSpan(mp, 2.25)!;
    expect(turn[1]).toBeCloseTo(leg[1]);
    expect(leg[1] - leg[0]).toBeCloseTo(width - 0.25, 1);
  });

  it('a straight run gains no corner block', () => {
    const straight = corridorPoly({ x: 2, y: 2 }, { x: 8, y: 2 }, 2, B, 'full');
    // The pointed-at end cell is covered in full — the run is inclusive of the
    // cell the drag ended in, exactly as a Room is...
    expect(pointInMulti(straight, { x: 8.5, y: 2.5 })).toBe(true);
    // ...and nothing beyond it. A near-zero cross-axis drift in the raw
    // endpoints must not read as a turn and grow a stub off the end.
    expect(pointInMulti(straight, { x: 9.5, y: 2.5 })).toBe(false);
    expect(
      pointInMulti(corridorPoly({ x: 2, y: 2.1 }, { x: 8, y: 2.9 }, 2, B, 'full'), {
        x: 9.5,
        y: 2.5,
      }),
    ).toBe(false);
  });

  it('snapped, centres the band on the pointed-at cell rather than a grid line', () => {
    // Width 1 under cell snap fills exactly the cell the pointer was in —
    // anywhere in cell (2,3) gives the same band.
    for (const y of [3.1, 3.5, 3.9]) {
      const mp = corridorPoly({ x: 2.5, y }, { x: 8.5, y }, 1, B, 'full');
      expect(pointInMulti(mp, { x: 5, y: 3.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 5, y: 2.5 })).toBe(false);
      expect(pointInMulti(mp, { x: 5, y: 4.5 })).toBe(false);
    }
  });

  it('half snap at width ½ fills exactly the pointed-at half-cell', () => {
    const mp = corridorPoly({ x: 2.1, y: 3.1 }, { x: 8.1, y: 3.1 }, 0.5, B, 'half');
    expect(pointInMulti(mp, { x: 5, y: 3.25 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.75 })).toBe(false);
    expect(pointInMulti(mp, { x: 5, y: 2.75 })).toBe(false);
  });

  it('a click with no drag is one cell of corridor, not nothing', () => {
    const mp = corridorPoly({ x: 4.3, y: 6.8 }, { x: 4.4, y: 6.9 }, 1, B, 'full');
    expect(pointInMulti(mp, { x: 4.5, y: 6.5 })).toBe(true);
    expect(pointInMulti(mp, { x: 5.5, y: 6.5 })).toBe(false);
  });

  // SPEC-028 §7 (DEC-032): a band narrower than the snap step insets evenly
  // inside the tile instead of being quantized onto one of its edges. This is
  // what makes `width = ½ · snap = cell` mean something other than
  // `width = ½ · snap = half`.
  it('a sub-step width is centred inside the pointed-at tile', () => {
    const mp = corridorPoly({ x: 2.5, y: 3.6 }, { x: 8.5, y: 3.6 }, 0.5, B, 'full');
    // Cell (·,3) runs 3 → 4; a ½ band centred in it runs 3.25 → 3.75, so a
    // quarter-cell of rock survives on each side of the passage.
    expect(pointInMulti(mp, { x: 5, y: 3.3 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.7 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.1 })).toBe(false);
    expect(pointInMulti(mp, { x: 5, y: 3.9 })).toBe(false);
  });

  it('the same width under half snap fills a half-tile edge to edge instead', () => {
    const mp = corridorPoly({ x: 2.5, y: 3.6 }, { x: 8.5, y: 3.6 }, 0.5, B, 'half');
    // Half-cell (·,3.5) runs 3.5 → 4.0, and a ½ band fills it exactly.
    expect(pointInMulti(mp, { x: 5, y: 3.6 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.9 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.4 })).toBe(false);
  });

  it('an ⅛ band is a real ⅛ of a cell, centred', () => {
    const mp = corridorPoly({ x: 2.5, y: 3.5 }, { x: 8.5, y: 3.5 }, 0.125, B, 'full');
    const span = coveredYSpan(mp, 5)!;
    expect(span[1] - span[0]).toBeCloseTo(0.125, 2);
    expect((span[0] + span[1]) / 2).toBeCloseTo(3.5, 2);
  });

  // SPEC-028 §9 (IN-038, DEC-046): a leg runs centre to centre; only the two
  // terminal ends of the gesture reach the far edge of their end cell. The
  // withdrawn rule extended every end, so at a bend each leg overshot the other
  // by `(step - width) / 2` and the L read as a plus.
  describe('SPEC-028 §9 — only terminal ends are capped', () => {
    it('an ⅛ bend does not spray floor into all four cardinals', () => {
      // IN-038's worked example, verbatim: cell snap, width ⅛, (0.3,0.3)→(3.6,3.6).
      const mp = corridorPoly({ x: 0.3, y: 0.3 }, { x: 3.6, y: 3.6 }, 0.125, B, 'full');
      // The corner is cell (3,0), so the bend sits at (3.5, 0.5).
      // Both legs of the L are floor...
      expect(pointInMulti(mp, { x: 2, y: 0.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 3.5, y: 2 })).toBe(true);
      // ...and the two arms the old rule sprayed past the corner are not.
      expect(pointInMulti(mp, { x: 3.9, y: 0.5 })).toBe(false); // east of the bend
      expect(pointInMulti(mp, { x: 3.5, y: 0.1 })).toBe(false); // north of the bend
      // The horizontal leg stops at the vertical band's outer wall (3.5625),
      // not at the far edge of the corner cell (4).
      expect(coveredXSpan(mp, 0.5)![1]).toBeLessThan(3.75);
    });

    it('the outer corner is the band edge, at every width', () => {
      for (const width of [0.125, 0.25, 0.5, 1, 2]) {
        const mp = corridorPoly({ x: 2.5, y: 2.5 }, { x: 8.5, y: 8.5 }, width, B, 'full');
        // Corner anchor (8.5, 2.5): the horizontal leg's far edge is the
        // vertical leg's own outer wall, half a width past the anchor — and not
        // the far edge of the corner cell, which the withdrawn rule gave it.
        const outer = 8.5 + width / 2;
        for (const y of [2.5, 6.5]) {
          expect(pointInMulti(mp, { x: outer - 0.01, y })).toBe(true);
          expect(pointInMulti(mp, { x: outer + 0.01, y })).toBe(false);
        }
      }
    });

    it('unions to a clean six-vertex L — one vertex per corner', () => {
      const mp = corridorPoly({ x: 2.5, y: 2.5 }, { x: 8.5, y: 8.5 }, 0.5, B, 'full');
      expect(mp).toHaveLength(1);
      expect(mp[0]).toHaveLength(1); // no holes
      // The inside and outside corners are one vertex each, not a staircase of
      // boolean seams left behind by an overshooting leg.
      expect(distinctRing(mp[0]![0]!)).toEqual([
        { x: 2, y: 2.25 },
        { x: 8.75, y: 2.25 },
        { x: 8.75, y: 9 },
        { x: 8.25, y: 9 },
        { x: 8.25, y: 2.75 },
        { x: 2, y: 2.75 },
      ]);
    });

    it('a straight run still covers both end cells in full', () => {
      const mp = corridorPoly({ x: 2.5, y: 2.5 }, { x: 8.5, y: 2.5 }, 1, B, 'full');
      expect(pointInMulti(mp, { x: 2.05, y: 2.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 8.95, y: 2.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 9.05, y: 2.5 })).toBe(false);
    });

    it('a snapped Path is still identical to the Corridor through the same points', () => {
      const a = { x: 2.5, y: 2.5 };
      const corner = { x: 8.5, y: 2.5 };
      const b = { x: 8.5, y: 8.5 };
      for (const width of [0.125, 0.5, 2]) {
        const corridor = corridorPoly(a, b, width, B, 'full');
        const path = pathPoly([a, corner, b], width, B, 'full');
        // Differenced both ways: neither shape carves anything the other doesn't.
        expect(B.difference(corridor, path)).toEqual([]);
        expect(B.difference(path, corridor)).toEqual([]);
      }
    });
  });

  // SPEC-028 §11 (IN-040, DEC-048): which leg comes first is an argument, not
  // something derived from the two endpoints — the same endpoints must be able
  // to produce either L, and only the gesture's history tells them apart.
  describe('SPEC-028 §11 — the first leg follows the latched axis', () => {
    const a = { x: 2.5, y: 2.5 };
    const b = { x: 8.5, y: 8.5 };

    it("defaults to horizontal-first, which is every pre-latch caller's shape", () => {
      const dflt = corridorPoly(a, b, 1, B, 'full');
      expect(B.difference(dflt, corridorPoly(a, b, 1, B, 'full', 'h'))).toEqual([]);
      expect(B.difference(corridorPoly(a, b, 1, B, 'full', 'h'), dflt)).toEqual([]);
    });

    it('puts the corner on the other side of the L when the drag latched vertical', () => {
      const h = corridorPoly(a, b, 1, B, 'full', 'h');
      const v = corridorPoly(a, b, 1, B, 'full', 'v');
      // Horizontal-first turns at (8.5, 2.5) — along the start row, then up.
      expect(pointInMulti(h, { x: 8.5, y: 2.5 })).toBe(true);
      expect(pointInMulti(h, { x: 2.5, y: 8.5 })).toBe(false);
      // Vertical-first turns at (2.5, 8.5) — up the start column, then across.
      expect(pointInMulti(v, { x: 2.5, y: 8.5 })).toBe(true);
      expect(pointInMulti(v, { x: 8.5, y: 2.5 })).toBe(false);
      // Both still start at `a` and end at `b`.
      for (const mp of [h, v]) {
        expect(pointInMulti(mp, a)).toBe(true);
        expect(pointInMulti(mp, b)).toBe(true);
      }
    });

    it('is a mirror of the horizontal-first L, not a different shape', () => {
      // Reflecting a vertical-first L in the diagonal x=y gives the
      // horizontal-first one, for a square gesture like this.
      const v = corridorPoly(a, b, 0.5, B, 'full', 'v');
      const h = corridorPoly(a, b, 0.5, B, 'full', 'h');
      const mirrored: MultiPoly = v.map((poly) =>
        poly.map((ring) => ring.map((p) => ({ x: p.y, y: p.x }))),
      );
      expect(B.difference(mirrored, h)).toEqual([]);
      expect(B.difference(h, mirrored)).toEqual([]);
    });

    it('still meets §9 at the bend under either latch', () => {
      // IN-038's worked example again, vertical-first: the corner is cell
      // (0,3), so the bend sits at (0.5, 3.5) instead of (3.5, 0.5).
      const mp = corridorPoly({ x: 0.3, y: 0.3 }, { x: 3.6, y: 3.6 }, 0.125, B, 'full', 'v');
      expect(pointInMulti(mp, { x: 0.5, y: 2 })).toBe(true);
      expect(pointInMulti(mp, { x: 2, y: 3.5 })).toBe(true);
      // No spray past the corner, in either cardinal.
      expect(pointInMulti(mp, { x: 0.5, y: 3.9 })).toBe(false);
      expect(pointInMulti(mp, { x: 0.1, y: 3.5 })).toBe(false);
    });

    it('leaves a straight run alone — there is no bend to place', () => {
      for (const [p, q] of [
        [
          { x: 2.5, y: 2.5 },
          { x: 8.5, y: 2.5 },
        ],
        [
          { x: 2.5, y: 2.5 },
          { x: 2.5, y: 8.5 },
        ],
      ] as const) {
        const h = corridorPoly(p, q, 1, B, 'full', 'h');
        const v = corridorPoly(p, q, 1, B, 'full', 'v');
        expect(B.difference(h, v)).toEqual([]);
        expect(B.difference(v, h)).toEqual([]);
      }
    });

    it('a click with no drag is one cell of corridor under either latch', () => {
      const p = { x: 4.3, y: 6.8 };
      for (const axis of ['h', 'v'] as const) {
        const mp = corridorPoly(p, { x: 4.4, y: 6.9 }, 1, B, 'full', axis);
        expect(pointInMulti(mp, { x: 4.5, y: 6.5 })).toBe(true);
        expect(pointInMulti(mp, { x: 5.5, y: 6.5 })).toBe(false);
        expect(pointInMulti(mp, { x: 4.5, y: 7.5 })).toBe(false);
      }
    });

    it('free snap latches the same way — both legs always exist', () => {
      const h = corridorPoly({ x: 1.2, y: 1.3 }, { x: 5.7, y: 4.1 }, 1, B, 'free', 'h');
      const v = corridorPoly({ x: 1.2, y: 1.3 }, { x: 5.7, y: 4.1 }, 1, B, 'free', 'v');
      expect(pointInMulti(h, { x: 5.7, y: 1.3 })).toBe(true);
      expect(pointInMulti(h, { x: 1.2, y: 4.1 })).toBe(false);
      expect(pointInMulti(v, { x: 1.2, y: 4.1 })).toBe(true);
      expect(pointInMulti(v, { x: 5.7, y: 1.3 })).toBe(false);
    });
  });
});

describe('pathPoly (Path — cell-anchored under snap, SPEC-028 §7)', () => {
  it('free snap keeps the round-capped organic ribbon', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(pathPoly(pts, 1, B, 'free')).toEqual(bufferPolyline(pts, 1, B));
  });

  it('snapped, a straight run is the corridor band: axis-aligned, whole cells', () => {
    const mp = pathPoly(
      [
        { x: 2.3, y: 3.6 },
        { x: 8.9, y: 3.4 },
      ],
      1,
      B,
      'full',
    );
    expect(allAxisAligned(mp)).toBe(true);
    // Both end cells are covered in full...
    expect(pointInMulti(mp, { x: 2.5, y: 3.5 })).toBe(true);
    expect(pointInMulti(mp, { x: 8.5, y: 3.5 })).toBe(true);
    // ...and nothing beyond them, or in the row either side.
    expect(pointInMulti(mp, { x: 9.5, y: 3.5 })).toBe(false);
    expect(pointInMulti(mp, { x: 5.5, y: 4.5 })).toBe(false);
  });

  it('snapped, a sub-step width is centred in the tile like the corridor', () => {
    const mp = pathPoly(
      [
        { x: 2.3, y: 3.6 },
        { x: 8.9, y: 3.6 },
      ],
      0.5,
      B,
      'full',
    );
    expect(pointInMulti(mp, { x: 5, y: 3.5 })).toBe(true);
    expect(pointInMulti(mp, { x: 5, y: 3.1 })).toBe(false);
    expect(pointInMulti(mp, { x: 5, y: 3.9 })).toBe(false);
  });

  it('snapped caps are squared, not rounded — the corners of the end cell are floor', () => {
    const mp = pathPoly(
      [
        { x: 2.3, y: 3.6 },
        { x: 8.9, y: 3.6 },
      ],
      1,
      B,
      'full',
    );
    // A round cap would have cut these two corners of the terminal cell off.
    expect(pointInMulti(mp, { x: 8.95, y: 3.05 })).toBe(true);
    expect(pointInMulti(mp, { x: 8.95, y: 3.95 })).toBe(true);
  });

  it('a single clicked point is one cell of path, not nothing', () => {
    const mp = pathPoly([{ x: 4.3, y: 6.8 }], 1, B, 'full');
    expect(pointInMulti(mp, { x: 4.5, y: 6.5 })).toBe(true);
    expect(pointInMulti(mp, { x: 5.5, y: 6.5 })).toBe(false);
  });

  it('several clicks inside one cell are one point, not a zero-length run', () => {
    const one = pathPoly([{ x: 4.3, y: 6.8 }], 1, B, 'full');
    const many = pathPoly(
      [
        { x: 4.3, y: 6.8 },
        { x: 4.4, y: 6.6 },
        { x: 4.9, y: 6.1 },
      ],
      1,
      B,
      'full',
    );
    expect(many).toEqual(one);
  });

  it('a turn keeps the path at full width, exactly as the corridor does', () => {
    const mp = pathPoly(
      [
        { x: 2.5, y: 2.5 },
        { x: 8.5, y: 2.5 },
        { x: 8.5, y: 8.5 },
      ],
      2,
      B,
      'full',
    );
    const leg = coveredXSpan(mp, 8.25)!;
    const turn = coveredXSpan(mp, 2.25)!;
    expect(turn[1]).toBeCloseTo(leg[1]);
  });

  it('a diagonal run is a band between the two cell centres', () => {
    const mp = pathPoly(
      [
        { x: 2.5, y: 2.5 },
        { x: 6.5, y: 6.5 },
      ],
      1,
      B,
      'full',
    );
    expect(pointInMulti(mp, { x: 4.5, y: 4.5 })).toBe(true);
    expect(pointInMulti(mp, { x: 4.5, y: 6.5 })).toBe(false);
  });

  it('rejects an empty point list and a non-positive width', () => {
    expect(pathPoly([], 1, B, 'full')).toEqual([]);
    expect(pathPoly([{ x: 0, y: 0 }], 0, B, 'full')).toEqual([]);
  });

  // SPEC-028 §9 (IN-038, DEC-046). A path has more interior vertices than a
  // corridor's single bend, so it is where the withdrawn rule sprayed furthest.
  describe('SPEC-028 §9 — only terminal ends are capped', () => {
    it('a middle leg, interior at both ends, overshoots neither neighbour', () => {
      // A staircase: right, down, right, down. Legs 1 and 2 are interior at both ends.
      const mp = pathPoly(
        [
          { x: 2.5, y: 2.5 },
          { x: 5.5, y: 2.5 },
          { x: 5.5, y: 5.5 },
          { x: 8.5, y: 5.5 },
          { x: 8.5, y: 8.5 },
        ],
        0.125,
        B,
        'full',
      );
      // Every leg is floor...
      expect(pointInMulti(mp, { x: 4, y: 2.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 5.5, y: 4 })).toBe(true);
      expect(pointInMulti(mp, { x: 7, y: 5.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 8.5, y: 7 })).toBe(true);
      // ...and no interior bend spurs past its own corner block.
      expect(pointInMulti(mp, { x: 5.9, y: 2.5 })).toBe(false);
      expect(pointInMulti(mp, { x: 5.5, y: 5.9 })).toBe(false);
      expect(pointInMulti(mp, { x: 8.9, y: 5.5 })).toBe(false);
      expect(pointInMulti(mp, { x: 5.5, y: 2.1 })).toBe(false);
      // The two terminal ends still reach the far edge of their end cell.
      expect(pointInMulti(mp, { x: 2.05, y: 2.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 1.95, y: 2.5 })).toBe(false);
      expect(pointInMulti(mp, { x: 8.5, y: 8.95 })).toBe(true);
      expect(pointInMulti(mp, { x: 8.5, y: 9.05 })).toBe(false);
    });

    it('a straight two-point run is unchanged — both of its ends are terminal', () => {
      const mp = pathPoly(
        [
          { x: 2.3, y: 3.6 },
          { x: 8.9, y: 3.4 },
        ],
        1,
        B,
        'full',
      );
      expect(pointInMulti(mp, { x: 2.05, y: 3.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 8.95, y: 3.5 })).toBe(true);
      expect(pointInMulti(mp, { x: 9.05, y: 3.5 })).toBe(false);
    });
  });
});

describe('targetedBandRect (Corridor/Path snap indicator, SPEC-028 §6, WI-052)', () => {
  it('coincides with the tile at width 1 under cell snap', () => {
    expect(targetedBandRect({ x: 3.9, y: 5.1 }, 1, 'full')).toEqual({ x: 3, y: 5, size: 1 });
  });

  it('centres a sub-step width inside the tile rather than flush with an edge', () => {
    expect(targetedBandRect({ x: 3.9, y: 5.1 }, 0.5, 'full')).toEqual({
      x: 3.25,
      y: 5.25,
      size: 0.5,
    });
  });

  it('drops to the half-cell centre under half snap', () => {
    expect(targetedBandRect({ x: 3.9, y: 5.1 }, 0.5, 'half')).toEqual({
      x: 3.5,
      y: 5,
      size: 0.5,
    });
  });
});

describe('cellRectPoly (Room, cell-anchored)', () => {
  it('a click with no drag is exactly one cell', () => {
    const poly = cellRectPoly({ x: 3.2, y: 5.7 }, { x: 3.2, y: 5.7 }, 'full')!;
    expect(poly[0]).toEqual([
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 3, y: 6 },
    ]);
  });

  it('grows a whole cell at a time, both end cells included', () => {
    const poly = cellRectPoly({ x: 3.2, y: 5.7 }, { x: 5.1, y: 7.9 }, 'full')!;
    expect(poly[0]![0]).toEqual({ x: 3, y: 5 });
    expect(poly[0]![2]).toEqual({ x: 6, y: 8 });
  });

  it('is corner-agnostic — dragging up-left gives the same rect', () => {
    const down = cellRectPoly({ x: 3.2, y: 5.7 }, { x: 5.1, y: 7.9 }, 'full');
    const up = cellRectPoly({ x: 5.1, y: 7.9 }, { x: 3.2, y: 5.7 }, 'full');
    expect(up).toEqual(down);
  });

  it('quantizes to half cells under half snap', () => {
    const poly = cellRectPoly({ x: 3.2, y: 5.7 }, { x: 3.2, y: 5.7 }, 'half')!;
    expect(poly[0]![0]).toEqual({ x: 3, y: 5.5 });
    expect(poly[0]![2]).toEqual({ x: 3.5, y: 6 });
  });

  it('falls through to corner-to-corner in freeform, degenerate case included', () => {
    expect(cellRectPoly({ x: 1, y: 2 }, { x: 3, y: 5 }, 'free')).toEqual(
      rectPoly({ x: 1, y: 2 }, { x: 3, y: 5 }),
    );
    expect(cellRectPoly({ x: 1, y: 1 }, { x: 1, y: 5 }, 'free')).toBeNull();
  });
});

describe('ngonPoly (N-gon: across-flats sizing, face-normal rotation)', () => {
  const center = { x: 4, y: 4 };

  it.each([3, 4, 5, 6, 7, 8])('sizes %i sides across the flats, not the vertices', (sides) => {
    const ring = ngonPoly({ center, acrossFlats: 6, sides, faceAngle: 0 })![0]!;
    expect(acrossFlatsOf(ring, center)).toBeCloseTo(6);
    // The circumscribed measure is strictly larger for any real polygon — the
    // difference is precisely what used to put a snapped square's edges off-grid.
    const circum = Math.max(...ring.map((p) => Math.hypot(p.x - center.x, p.y - center.y))) * 2;
    expect(circum).toBeGreaterThan(6);
  });

  it('puts a flat face normal on the drag direction, so a square drawn east is grid-aligned', () => {
    const ring = ngonPoly({ center, acrossFlats: 4, sides: 4, faceAngle: 0 })![0]!;
    // Every vertex sits on the square's own corners: x = 4 ± 2, y = 4 ± 2.
    for (const p of ring) {
      expect(Math.abs(p.x - center.x)).toBeCloseTo(2);
      expect(Math.abs(p.y - center.y)).toBeCloseTo(2);
    }
  });

  it('rotates with the drag — the same square dragged diagonally is a diamond', () => {
    const ring = ngonPoly({ center, acrossFlats: 4, sides: 4, faceAngle: Math.PI / 4 })![0]!;
    // A 45°-rotated square has a vertex on each axis through the centre.
    const onAxis = ring.filter(
      (p) => Math.abs(p.x - center.x) < 1e-9 || Math.abs(p.y - center.y) < 1e-9,
    );
    expect(onAxis).toHaveLength(4);
  });

  it('treats sides <= 1 as the circle, sized across the same diameter', () => {
    const ring = ngonPoly({ center, acrossFlats: 6, sides: 1, faceAngle: 0 })![0]!;
    expect(ring).toHaveLength(64);
    expect(acrossFlatsOf(ring, center)).toBeCloseTo(6);
  });

  it('rejects a non-positive diameter', () => {
    expect(ngonPoly({ center, acrossFlats: 0, sides: 6, faceAngle: 0 })).toBeNull();
  });
});

describe('bufferPolyline (Path — M6 offset stand-in)', () => {
  it('a single point buffers to a round cap', () => {
    const mp = bufferPolyline([{ x: 0, y: 0 }], 2, B);
    expect(mp).toHaveLength(1);
    expect(mp[0]![0]!.length).toBeGreaterThan(3);
  });
  it('a multi-point path unions into one connected region', () => {
    const mp = bufferPolyline(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
      1,
      B,
    );
    expect(mp).toHaveLength(1);
  });
  it('empty input and non-positive width yield nothing', () => {
    expect(bufferPolyline([], 2, B)).toEqual([]);
    expect(bufferPolyline([{ x: 0, y: 0 }], 0, B)).toEqual([]);
  });

  it('decimates dense pointer input before buffering (perf guard, §8.1)', () => {
    // 200 points along a straight line, sampled far finer than the brush radius.
    const dense: Point[] = [];
    for (let i = 0; i <= 200; i++) dense.push({ x: i * 0.02, y: 0 });
    const kept = decimatePolyline(dense, 1 / 4);
    expect(kept.length).toBeLessThan(dense.length);
    expect(kept[0]).toEqual(dense[0]); // endpoints preserved
    expect(kept[kept.length - 1]).toEqual(dense[dense.length - 1]);
    // Still one connected region, and cheap (few unions).
    expect(bufferPolyline(dense, 1, B)).toHaveLength(1);
  });

  it('decimation keeps both endpoints even for a 2-point stroke', () => {
    const p: Point[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(decimatePolyline(p, 1)).toEqual(p);
  });
});
