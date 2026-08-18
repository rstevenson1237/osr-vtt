import { describe, expect, it } from 'vitest';
import {
  backgroundHandlePoint,
  backgroundHitTest,
  backgroundRectChanged,
  fitBackgroundToGrid,
  MIN_BACKGROUND_CELLS,
  moveBackground,
  resizeBackground,
  type BgHandle,
} from './background-transform';

describe('fitBackgroundToGrid', () => {
  it('fits a wide image to the grid width and keeps its ratio', () => {
    expect(fitBackgroundToGrid({ w: 20, h: 20 }, 2)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
  });

  it('fits a tall image to the grid height and keeps its ratio', () => {
    expect(fitBackgroundToGrid({ w: 20, h: 20 }, 0.5)).toEqual({ x: 0, y: 0, w: 10, h: 20 });
  });

  it('falls back to a square when the aspect is unusable', () => {
    // A texture that failed to report a size must not produce NaN/0 rects.
    expect(fitBackgroundToGrid({ w: 12, h: 30 }, 0)).toEqual({ x: 0, y: 0, w: 12, h: 12 });
    expect(fitBackgroundToGrid({ w: 12, h: 30 }, Number.NaN)).toEqual({ x: 0, y: 0, w: 12, h: 12 });
  });
});

describe('moveBackground', () => {
  it('translates without resizing (SPEC-038 §3 — x, y move together)', () => {
    expect(moveBackground({ x: 1, y: 2, w: 8, h: 4 }, 1.5, -0.5)).toEqual({
      x: 2.5,
      y: 1.5,
      w: 8,
      h: 4,
    });
  });
});

describe('resizeBackground — corners (ratio-locked)', () => {
  const rect = { x: 2, y: 3, w: 8, h: 4 }; // native aspect 2 (8x4)

  it('keeps the top-left anchor fixed (se)', () => {
    const out = resizeBackground(rect, { x: 14, y: 20 }, 'se', 2);
    expect(out.x).toBe(2);
    expect(out.y).toBe(3);
  });

  it('scales w and h together from the native aspect, never stretching', () => {
    const out = resizeBackground(rect, { x: 14, y: 3 }, 'se', 2);
    expect(out.w).toBeCloseTo(12);
    expect(out.h).toBeCloseTo(6);
    expect(out.w / out.h).toBeCloseTo(2);
  });

  it('re-imposes the native ratio on a rect that was stored stretched', () => {
    // The v22->v23 fold sizes a legacy background to the whole grid, which is
    // rarely the image's own ratio. The first resize is what corrects it.
    const stretched = { x: 0, y: 0, w: 30, h: 30 };
    const out = resizeBackground(stretched, { x: 20, y: 30 }, 'se', 2);
    expect(out.w / out.h).toBeCloseTo(2);
  });

  it('sizes by the further-dragged axis, so a downward drag grows the image', () => {
    // Pointer barely right of the anchor but far below it: height drives.
    const out = resizeBackground(rect, { x: 3, y: 13 }, 'se', 2);
    expect(out.h).toBeCloseTo(10);
    expect(out.w).toBeCloseTo(20);
  });

  it('clamps to the minimum instead of inverting the rect (se)', () => {
    const out = resizeBackground(rect, { x: -40, y: -40 }, 'se', 2);
    expect(out.w).toBe(MIN_BACKGROUND_CELLS);
    expect(out.h).toBe(MIN_BACKGROUND_CELLS / 2);
    expect(out.w).toBeGreaterThan(0);
    expect(out.h).toBeGreaterThan(0);
  });

  it('falls back to the rect’s own ratio when no native aspect is known', () => {
    const out = resizeBackground(rect, { x: 6, y: 3 }, 'se', 0);
    expect(out.w / out.h).toBeCloseTo(rect.w / rect.h);
  });

  it('anchors the opposite corner for nw, ne and sw', () => {
    // nw: anchor is the se corner (10, 7).
    const nw = resizeBackground(rect, { x: -2, y: -1 }, 'nw', 2);
    expect(nw.x + nw.w).toBeCloseTo(10);
    expect(nw.y + nw.h).toBeCloseTo(7);
    expect(nw.w / nw.h).toBeCloseTo(2);

    // ne: anchor is the sw corner (2, 7).
    const ne = resizeBackground(rect, { x: 14, y: -1 }, 'ne', 2);
    expect(ne.x).toBeCloseTo(2);
    expect(ne.y + ne.h).toBeCloseTo(7);
    expect(ne.w / ne.h).toBeCloseTo(2);

    // sw: anchor is the ne corner (10, 3).
    const sw = resizeBackground(rect, { x: -2, y: 15 }, 'sw', 2);
    expect(sw.x + sw.w).toBeCloseTo(10);
    expect(sw.y).toBeCloseTo(3);
    expect(sw.w / sw.h).toBeCloseTo(2);
  });

  it('clamps every corner to the minimum instead of inverting', () => {
    // Each pointer sits past that corner's own anchor on both axes.
    const cases: [BgHandle, { x: number; y: number }][] = [
      ['nw', { x: 20, y: 20 }], // anchor (10, 7)
      ['ne', { x: -20, y: 20 }], // anchor (2, 7)
      ['sw', { x: 20, y: -20 }], // anchor (10, 3)
    ];
    for (const [handle, pointer] of cases) {
      const out = resizeBackground(rect, pointer, handle, 2);
      expect(out.w).toBe(MIN_BACKGROUND_CELLS);
      expect(out.h).toBe(MIN_BACKGROUND_CELLS / 2);
    }
  });
});

describe('resizeBackground — edges (free, per axis)', () => {
  const rect = { x: 2, y: 3, w: 8, h: 4 };

  it('e moves only w, anchored at the left edge', () => {
    const out = resizeBackground(rect, { x: 16, y: 999 }, 'e', 2);
    expect(out).toEqual({ x: 2, y: 3, w: 14, h: 4 });
  });

  it('w moves only w, anchored at the right edge', () => {
    const out = resizeBackground(rect, { x: -2, y: 999 }, 'w', 2);
    expect(out.x).toBeCloseTo(-2);
    expect(out.y).toBe(3);
    expect(out.w).toBeCloseTo(12);
    expect(out.h).toBe(4);
  });

  it('n moves only h, anchored at the bottom edge', () => {
    const out = resizeBackground(rect, { x: 999, y: 0 }, 'n', 2);
    expect(out.x).toBe(2);
    expect(out.y).toBeCloseTo(0);
    expect(out.w).toBe(8);
    expect(out.h).toBeCloseTo(7);
  });

  it('s moves only h, anchored at the top edge', () => {
    const out = resizeBackground(rect, { x: 999, y: 10 }, 's', 2);
    expect(out).toEqual({ x: 2, y: 3, w: 8, h: 7 });
  });

  it('clamps an edge to the minimum instead of inverting', () => {
    const out = resizeBackground(rect, { x: 40, y: 40 }, 'w', 2);
    expect(out.w).toBe(MIN_BACKGROUND_CELLS);
    expect(out.h).toBe(4);
  });

  it('stretches away from the native ratio, unlike a corner', () => {
    const out = resizeBackground(rect, { x: 20, y: 999 }, 'e', 2);
    expect(out.w / out.h).not.toBeCloseTo(2);
  });
});

describe('backgroundHandlePoint', () => {
  const rect = { x: 2, y: 2, w: 6, h: 4 };

  it('places all eight handles', () => {
    const expected: Record<BgHandle, { x: number; y: number }> = {
      nw: { x: 2, y: 2 },
      n: { x: 5, y: 2 },
      ne: { x: 8, y: 2 },
      e: { x: 8, y: 4 },
      se: { x: 8, y: 6 },
      s: { x: 5, y: 6 },
      sw: { x: 2, y: 6 },
      w: { x: 2, y: 4 },
    };
    for (const handle of Object.keys(expected) as BgHandle[]) {
      expect(backgroundHandlePoint(rect, handle)).toEqual(expected[handle]);
    }
  });
});

describe('backgroundHitTest', () => {
  const rect = { x: 2, y: 2, w: 6, h: 4 };

  it('grabs the se handle where handle and body overlap', () => {
    expect(backgroundHitTest(rect, { x: 7.9, y: 5.9 }, 0.4)).toEqual({ kind: 'handle', handle: 'se' });
  });

  it('grabs an edge handle at its midpoint', () => {
    expect(backgroundHitTest(rect, { x: 5, y: 2 }, 0.4)).toEqual({ kind: 'handle', handle: 'n' });
    expect(backgroundHitTest(rect, { x: 8, y: 4 }, 0.4)).toEqual({ kind: 'handle', handle: 'e' });
  });

  it('prefers a corner over an adjacent edge where their radii overlap', () => {
    // With a generous radius the ne corner and the n/e edge midpoints all
    // reach this point; the corner must win.
    expect(backgroundHitTest(rect, { x: 7, y: 3 }, 4)).toEqual({ kind: 'handle', handle: 'ne' });
  });

  it('grabs the body inside the rect', () => {
    expect(backgroundHitTest(rect, { x: 4, y: 3 }, 0.4)).toEqual({ kind: 'body' });
  });

  it('grabs nothing outside, so the press falls through to the active tool', () => {
    expect(backgroundHitTest(rect, { x: 20, y: 20 }, 0.4)).toBeNull();
    expect(backgroundHitTest(rect, { x: 1.4, y: 3 }, 0.4)).toBeNull();
  });
});

describe('backgroundRectChanged', () => {
  it('is false for a click that never moved', () => {
    const rect = { x: 1, y: 1, w: 4, h: 2 };
    expect(backgroundRectChanged(rect, { ...rect })).toBe(false);
  });

  it('is true once any of the four numbers actually moves', () => {
    const rect = { x: 1, y: 1, w: 4, h: 2 };
    expect(backgroundRectChanged(rect, { ...rect, x: 1.01 })).toBe(true);
    expect(backgroundRectChanged(rect, { ...rect, h: 2.01 })).toBe(true);
  });
});
