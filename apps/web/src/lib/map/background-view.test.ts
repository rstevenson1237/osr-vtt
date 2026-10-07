import { describe, expect, it } from 'vitest';
import type { MapBackground } from '@osr-vtt/shared';
import {
  backgroundRect,
  liveBackgroundRect,
  nativeAspect,
  settleBackgroundTextures,
} from './background-view';

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

  it('keeps the live rect when a snapshot moves the dragged background (SPEC-059 §2.3)', () => {
    // A remote write lands mid-drag: the stored rect changes under the
    // gesture, but the sprite is still placed from the drag until release.
    const rect = { x: 3, y: 3, w: 2, h: 2 };
    const remote = { ...bg, x: 20, y: 20 } as MapBackground;
    expect(liveBackgroundRect(remote, { id: 'b1', rect })).toBe(rect);
    const other = { ...bg, id: 'b2', x: 20, y: 20 } as MapBackground;
    expect(liveBackgroundRect(other, { id: 'b1', rect })).toEqual({ x: 20, y: 20, w: 8, h: 4 });
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
