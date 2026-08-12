import { describe, expect, it } from 'vitest';
import {
  backgroundHandlePoint,
  backgroundHitTest,
  backgroundRectChanged,
  fitBackgroundToGrid,
  MIN_BACKGROUND_CELLS,
  moveBackground,
  resizeBackground,
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

describe('resizeBackground', () => {
  const rect = { x: 2, y: 3, w: 8, h: 4 }; // native aspect 2 (8x4)

  it('keeps the top-left anchor fixed', () => {
    const out = resizeBackground(rect, { x: 14, y: 20 }, 2);
    expect(out.x).toBe(2);
    expect(out.y).toBe(3);
  });

  it('scales w and h together from the native aspect, never stretching', () => {
    const out = resizeBackground(rect, { x: 14, y: 3 }, 2);
    expect(out.w).toBeCloseTo(12);
    expect(out.h).toBeCloseTo(6);
    expect(out.w / out.h).toBeCloseTo(2);
  });

  it('re-imposes the native ratio on a rect that was stored stretched', () => {
    // The v22->v23 fold sizes a legacy background to the whole grid, which is
    // rarely the image's own ratio. The first resize is what corrects it.
    const stretched = { x: 0, y: 0, w: 30, h: 30 };
    const out = resizeBackground(stretched, { x: 20, y: 30 }, 2);
    expect(out.w / out.h).toBeCloseTo(2);
  });

  it('sizes by the further-dragged axis, so a downward drag grows the image', () => {
    // Pointer barely right of the anchor but far below it: height drives.
    const out = resizeBackground(rect, { x: 3, y: 13 }, 2);
    expect(out.h).toBeCloseTo(10);
    expect(out.w).toBeCloseTo(20);
  });

  it('clamps to the minimum instead of inverting the rect', () => {
    const out = resizeBackground(rect, { x: -40, y: -40 }, 2);
    expect(out.w).toBe(MIN_BACKGROUND_CELLS);
    expect(out.h).toBe(MIN_BACKGROUND_CELLS / 2);
    expect(out.w).toBeGreaterThan(0);
    expect(out.h).toBeGreaterThan(0);
  });

  it('falls back to the rect’s own ratio when no native aspect is known', () => {
    const out = resizeBackground(rect, { x: 6, y: 3 }, 0);
    expect(out.w / out.h).toBeCloseTo(rect.w / rect.h);
  });
});

describe('backgroundHitTest', () => {
  const rect = { x: 2, y: 2, w: 6, h: 4 };

  it('puts the handle on the bottom-right corner', () => {
    expect(backgroundHandlePoint(rect)).toEqual({ x: 8, y: 6 });
  });

  it('grabs the handle where handle and body overlap', () => {
    expect(backgroundHitTest(rect, { x: 7.9, y: 5.9 }, 0.4)).toBe('handle');
  });

  it('grabs the body inside the rect', () => {
    expect(backgroundHitTest(rect, { x: 4, y: 3 }, 0.4)).toBe('body');
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
