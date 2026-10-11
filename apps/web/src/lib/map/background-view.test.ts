import { describe, expect, it } from 'vitest';
import { hexMap, MapBackgroundSchema, type MapBackground } from '@osr-vtt/shared';
import {
  backgroundRect,
  backgroundSpaceScale,
  backgroundTransform,
  hexCornersOfRect,
  liveBackgroundRect,
  minBackgroundSize,
  nativeAspect,
  settleBackgroundTextures,
  type BackgroundSpace,
} from './background-view';
import { MIN_BACKGROUND_CELLS } from './background-transform';

const bg = { id: 'b1', x: 1, y: 2, w: 8, h: 4, order: 0 } as unknown as MapBackground;
const SQUARE: BackgroundSpace = { kind: 'square', cellSize: 70 };
const HEX: BackgroundSpace = { kind: 'hex', hexSize: 48, cellSize: 70 };

describe('backgroundRect', () => {
  it('copies just the four rect fields on a square map', () => {
    expect(backgroundRect(bg, SQUARE)).toEqual({ x: 1, y: 2, w: 8, h: 4 });
  });

  it('is the pixel rect the two hex corners span on a hex map (SPEC-059 §3.1)', () => {
    const tl = hexMap.pixelToHexPoint({ x: -120, y: 35 }, 48);
    const br = hexMap.pixelToHexPoint({ x: 200, y: 275 }, 48);
    const hexBg = { ...bg, x: 0, y: 0, w: 0, h: 0, hex: { tl, br } } as MapBackground;
    const rect = backgroundRect(hexBg, HEX);
    expect(rect.x).toBeCloseTo(-120, 9);
    expect(rect.y).toBeCloseTo(35, 9);
    expect(rect.w).toBeCloseTo(320, 9);
    expect(rect.h).toBeCloseTo(240, 9);
  });

  it('draws a hex-map background the v35 migration has not reached from its old lattice rect', () => {
    // Exactly where `placeHexBackground` will put it: the rect times cellSize.
    expect(backgroundRect(bg, HEX)).toEqual({ x: 70, y: 140, w: 560, h: 280 });
  });
});

describe('background space (SPEC-059 §3.3)', () => {
  it('scales lattice units by cellSize on a square map, and pixels by 1 on a hex map', () => {
    expect(backgroundSpaceScale(SQUARE)).toBe(70);
    expect(backgroundSpaceScale(HEX)).toBe(1);
  });

  it('keeps the minimum size at half a cell, or half a hex circumradius in pixels', () => {
    expect(minBackgroundSize(SQUARE)).toBe(MIN_BACKGROUND_CELLS);
    expect(minBackgroundSize(HEX)).toBe(MIN_BACKGROUND_CELLS * 48);
  });

  it('writes the lattice rect as it is on a square map', () => {
    const rect = { x: 1.5, y: -2, w: 3, h: 4 };
    expect(backgroundTransform(rect, SQUARE)).toBe(rect);
  });

  it('writes the hex corners on a hex map, unsnapped, round-tripping to the same pixels', () => {
    const rect = { x: -100.25, y: 33.5, w: 210, h: 140.75 };
    const written = backgroundTransform(rect, HEX);
    expect('hex' in written).toBe(true);
    const corners = (written as { hex: ReturnType<typeof hexCornersOfRect> }).hex;
    expect(corners).toEqual(hexCornersOfRect(rect, 48));
    const back = backgroundRect(
      { ...bg, x: 0, y: 0, w: 0, h: 0, hex: corners } as MapBackground,
      HEX,
    );
    expect(back.x).toBeCloseTo(rect.x, 9);
    expect(back.y).toBeCloseTo(rect.y, 9);
    expect(back.w).toBeCloseTo(rect.w, 9);
    expect(back.h).toBeCloseTo(rect.h, 9);
    // Free-valued, not snapped onto the thirds lattice.
    expect(Number.isInteger(corners.tl.q)).toBe(false);
    // And a stored document the schema accepts (§3.1's shape).
    expect(() =>
      MapBackgroundSchema.parse({ ...bg, ref: 'a.png', x: 0, y: 0, w: 0, h: 0, hex: corners }),
    ).not.toThrow();
  });
});

describe('liveBackgroundRect', () => {
  it('is the stored rect with no gesture, or one on a different background', () => {
    expect(liveBackgroundRect(bg, null, SQUARE)).toEqual({ x: 1, y: 2, w: 8, h: 4 });
    expect(
      liveBackgroundRect(bg, { id: 'other', rect: { x: 9, y: 9, w: 1, h: 1 } }, SQUARE),
    ).toEqual({
      x: 1,
      y: 2,
      w: 8,
      h: 4,
    });
  });

  it("is the gesture's rect while one is running on this background", () => {
    const rect = { x: 3, y: 3, w: 2, h: 2 };
    expect(liveBackgroundRect(bg, { id: 'b1', rect }, SQUARE)).toBe(rect);
  });

  it('keeps the live rect when a snapshot moves the dragged background (SPEC-059 §2.3)', () => {
    // A remote write lands mid-drag: the stored rect changes under the
    // gesture, but the sprite is still placed from the drag until release.
    const rect = { x: 3, y: 3, w: 2, h: 2 };
    const remote = { ...bg, x: 20, y: 20 } as MapBackground;
    expect(liveBackgroundRect(remote, { id: 'b1', rect }, SQUARE)).toBe(rect);
    const other = { ...bg, id: 'b2', x: 20, y: 20 } as MapBackground;
    expect(liveBackgroundRect(other, { id: 'b1', rect }, SQUARE)).toEqual({
      x: 20,
      y: 20,
      w: 8,
      h: 4,
    });
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

describe('settleBackgroundTextures (SPEC-059 §2.1)', () => {
  const a = { ...bg, id: 'a', ref: 'a.png' } as MapBackground;
  const dead = { ...bg, id: 'dead', ref: 'dead.png' } as MapBackground;
  const c = { ...bg, id: 'c', ref: 'c.png' } as MapBackground;
  const load = (b: MapBackground): Promise<string> =>
    b.ref === 'dead.png' ? Promise.reject(new Error('404')) : Promise.resolve(`tex:${b.ref}`);

  it('settles every image on its own: one failure blocks none of the others', async () => {
    const { loaded, failed } = await settleBackgroundTextures([a, dead, c], load);
    expect(loaded.map((l) => [l.bg.id, l.texture])).toEqual([
      ['a', 'tex:a.png'],
      ['c', 'tex:c.png'],
    ]);
    expect(failed.map((f) => f.id)).toEqual(['dead']);
  });

  it('resolves, rather than rejects, when every image fails', async () => {
    const { loaded, failed } = await settleBackgroundTextures([dead], load);
    expect(loaded).toEqual([]);
    expect(failed.map((f) => f.id)).toEqual(['dead']);
  });

  it('is empty for no backgrounds', async () => {
    expect(await settleBackgroundTextures([], load)).toEqual({ loaded: [], failed: [] });
  });
});
