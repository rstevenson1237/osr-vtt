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
