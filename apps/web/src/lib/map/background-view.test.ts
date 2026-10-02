import { describe, expect, it } from 'vitest';
import type { MapBackground } from '@osr-vtt/shared';
import { backgroundRect, liveBackgroundRect, nativeAspect } from './background-view';

const bg = { id: 'b1', x: 1, y: 2, w: 8, h: 4, order: 0 } as unknown as MapBackground;

describe('backgroundRect', () => {
  it('copies just the four rect fields', () => {
    expect(backgroundRect(bg)).toEqual({ x: 1, y: 2, w: 8, h: 4 });
  });
});

describe('liveBackgroundRect', () => {
  it('is the stored rect with no gesture, or one on a different background', () => {
    expect(liveBackgroundRect(bg, null)).toEqual({ x: 1, y: 2, w: 8, h: 4 });
    expect(liveBackgroundRect(bg, { id: 'other', rect: { x: 9, y: 9, w: 1, h: 1 } })).toEqual({
      x: 1,
      y: 2,
      w: 8,
      h: 4,
    });
  });

  it("is the gesture's rect while one is running on this background", () => {
    const rect = { x: 3, y: 3, w: 2, h: 2 };
    expect(liveBackgroundRect(bg, { id: 'b1', rect })).toBe(rect);
  });
});

describe('nativeAspect', () => {
  const fallback = { x: 0, y: 0, w: 6, h: 3 };

  it("is the texture's width over height", () => {
    expect(nativeAspect({ width: 400, height: 100 }, fallback)).toBe(4);
  });

  it("falls back to the rect's ratio when the texture has no size, then to 1", () => {
    expect(nativeAspect(undefined, fallback)).toBe(2);
    expect(nativeAspect({ width: 0, height: 0 }, fallback)).toBe(2);
    expect(nativeAspect(undefined, { x: 0, y: 0, w: 0, h: 0 })).toBe(1);
  });
});
