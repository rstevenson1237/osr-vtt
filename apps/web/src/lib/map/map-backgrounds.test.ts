import { describe, expect, it, vi } from 'vitest';
import * as PIXI from 'pixi.js';
import type { CampaignStore, MapBackground } from '@osr-vtt/shared';
import { MapBackgrounds, type MapBackgroundsDeps } from './map-backgrounds.svelte';
import type { BackgroundSpace } from './background-view';

const CELL = 10;

function bg(id: string, over: Partial<MapBackground> = {}): MapBackground {
  return {
    id,
    ref: `img-${id}`,
    order: 0,
    locked: false,
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    ...over,
  } as MapBackground;
}

function setup(
  over: {
    bgs?: MapBackground[];
    space?: BackgroundSpace;
    isGM?: boolean;
    load?: (ref: string) => Promise<PIXI.Texture>;
  } = {},
) {
  const state = {
    bgs: over.bgs ?? [bg('a')],
    space: over.space ?? ({ kind: 'square', cellSize: CELL } as BackgroundSpace),
    isGM: over.isGM ?? true,
  };
  const layer = new PIXI.Container();
  const invalidate = vi.fn();
  const onPick = vi.fn();
  const reportBroken = vi.fn();
  const setClearColor = vi.fn();
  const toLatticeRaw = vi.fn((w: { x: number; y: number }) => ({ x: w.x / CELL, y: w.y / CELL }));
  const store = { setBackgroundTransform: vi.fn(async () => {}) };
  const deps: MapBackgroundsDeps = {
    invalidate,
    store: store as unknown as CampaignStore,
    roomId: 'r',
    mapId: 'm',
    toSpace: (w) => (state.space.kind === 'hex' ? w : toLatticeRaw(w)),
    space: () => state.space,
    ordered: () => state.bgs,
    isGM: () => state.isGM,
    layer: () => layer,
    zoom: () => 1,
    setClearColor,
    loadTexture: over.load ?? (async () => PIXI.Texture.EMPTY),
    reportBroken,
    onPick,
  };
  return {
    ctrl: new MapBackgrounds(deps),
    state,
    layer,
    invalidate,
    onPick,
    reportBroken,
    setClearColor,
    toLatticeRaw,
    store,
  };
}

describe('MapBackgrounds sprite lifecycle', () => {
  it('adds one sprite per image in paint order and positions it from the stored rect', async () => {
    const t = setup({ bgs: [bg('a', { x: 1, y: 2, w: 3, h: 4 }), bg('b', { order: 1 })] });
    await t.ctrl.apply(t.state.bgs, t.state.space);
    expect(t.layer.children).toHaveLength(2);
    const [first] = t.layer.children as PIXI.Sprite[];
    expect([first!.x, first!.y, first!.width, first!.height]).toEqual([10, 20, 30, 40]);
    expect(t.reportBroken).toHaveBeenCalledWith([]);
  });

  it('drops the sprite of a removed image and keeps the rest', async () => {
    const t = setup({ bgs: [bg('a'), bg('b', { order: 1 })] });
    await t.ctrl.apply(t.state.bgs, t.state.space);
    await t.ctrl.apply([bg('b', { order: 1 })], t.state.space);
    expect(t.layer.children).toHaveLength(1);
  });

  it('draws nothing for an image that will not load and reports it, without stopping the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup({
      bgs: [bg('a'), bg('b', { order: 1 })],
      load: async (ref) => {
        if (ref === 'img-a') throw new Error('dead link');
        return PIXI.Texture.EMPTY;
      },
    });
    await t.ctrl.apply(t.state.bgs, t.state.space);
    expect(t.layer.children).toHaveLength(1);
    expect(t.reportBroken).toHaveBeenCalledWith(['a']);
    warn.mockRestore();
  });

  it('drops the results of a pass superseded while a texture was in flight', async () => {
    let release: (t: PIXI.Texture) => void = () => {};
    const slow = new Promise<PIXI.Texture>((r) => (release = r));
    let calls = 0;
    const t = setup({ load: () => (calls++ === 0 ? slow : Promise.resolve(PIXI.Texture.EMPTY)) });
    const first = t.ctrl.apply(t.state.bgs, t.state.space);
    await t.ctrl.apply(t.state.bgs, t.state.space);
    release(PIXI.Texture.EMPTY);
    await first;
    expect(t.layer.children).toHaveLength(1);
    expect(t.reportBroken).toHaveBeenCalledTimes(1);
  });

  it('scales a hex map by its pixel space, not by cell size', async () => {
    const t = setup({
      bgs: [bg('a', { hex: { tl: { q: 0, r: 0 }, br: { q: 1, r: 1 } } } as Partial<MapBackground>)],
      space: { kind: 'hex', hexSize: 20, cellSize: CELL },
    });
    await t.ctrl.apply(t.state.bgs, t.state.space);
    const sprite = t.layer.children[0] as PIXI.Sprite;
    expect(sprite.width).toBeGreaterThan(0);
  });

  it('hands the clear colour to the renderer, or back to the theme', () => {
    const t = setup();
    t.ctrl.applyColor({ kind: 'color', color: '#112233' });
    expect(t.setClearColor).toHaveBeenLastCalledWith(0x112233);
    t.ctrl.applyColor({ kind: 'none' });
    expect(t.setClearColor).toHaveBeenLastCalledWith(null);
  });
});

describe('MapBackgrounds gesture', () => {
  it('a player never picks a background', () => {
    const t = setup({ isGM: false });
    expect(t.ctrl.pointerDown({ x: 20, y: 20 })).toBe(false);
    expect(t.onPick).not.toHaveBeenCalled();
    expect(t.ctrl.dragging).toBe(false);
  });

  it('ignores a locked background and a press on open canvas', () => {
    const t = setup({ bgs: [bg('a', { locked: true })] });
    expect(t.ctrl.pointerDown({ x: 20, y: 20 })).toBe(false);
    const open = setup();
    expect(open.ctrl.pointerDown({ x: 900, y: 900 })).toBe(false);
  });

  it('picks the topmost unlocked image where two overlap', () => {
    const t = setup({
      bgs: [bg('low'), bg('top', { order: 1 }), bg('locked', { order: 2, locked: true })],
    });
    expect(t.ctrl.pointerDown({ x: 20, y: 20 })).toBe(true);
    expect(t.onPick).toHaveBeenCalledWith('top');
  });

  it('moves the body by the pointer delta and writes once on release', async () => {
    const t = setup();
    await t.ctrl.apply(t.state.bgs, t.state.space);
    expect(t.ctrl.pointerDown({ x: 20, y: 20 })).toBe(true);
    expect(t.ctrl.pointerMove({ x: 50, y: 40 })).toBe(true);
    expect(t.invalidate).toHaveBeenCalledWith('tools');
    expect(t.ctrl.liveRect(t.state.bgs[0]!)).toMatchObject({ x: 3, y: 2, w: 4, h: 4 });
    const sprite = t.layer.children[0] as PIXI.Sprite;
    expect([sprite.x, sprite.y]).toEqual([30, 20]);
    expect(t.store.setBackgroundTransform).not.toHaveBeenCalled();
    expect(await t.ctrl.pointerUp()).toBe(true);
    expect(t.store.setBackgroundTransform).toHaveBeenCalledTimes(1);
    expect(t.store.setBackgroundTransform).toHaveBeenCalledWith('r', 'm', 'a', {
      x: 3,
      y: 2,
      w: 4,
      h: 4,
    });
    expect(t.ctrl.dragging).toBe(false);
  });

  it('writes nothing for a click that never moved', async () => {
    const t = setup();
    t.ctrl.pointerDown({ x: 20, y: 20 });
    await t.ctrl.pointerUp();
    expect(t.store.setBackgroundTransform).not.toHaveBeenCalled();
  });

  it('a press on the corner handle resizes from the first click', async () => {
    const t = setup();
    // The bottom-right corner of a 4x4 image at the origin is lattice (4,4) = world (40,40).
    expect(t.ctrl.pointerDown({ x: 40, y: 40 })).toBe(true);
    t.ctrl.pointerMove({ x: 60, y: 60 });
    const rect = t.ctrl.liveRect(t.state.bgs[0]!);
    expect(rect.w).toBeGreaterThan(4);
    await t.ctrl.pointerUp();
    expect(t.store.setBackgroundTransform).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the gesture with no write', async () => {
    const t = setup();
    t.ctrl.pointerDown({ x: 20, y: 20 });
    t.ctrl.pointerMove({ x: 50, y: 50 });
    t.ctrl.cancel();
    expect(t.ctrl.dragging).toBe(false);
    expect(t.ctrl.pointerMove({ x: 60, y: 60 })).toBe(false);
    expect(await t.ctrl.pointerUp()).toBe(false);
    expect(t.store.setBackgroundTransform).not.toHaveBeenCalled();
  });

  it('on a hex map drags in world pixels and writes hex corners, never reaching a lattice conversion', async () => {
    const t = setup({
      bgs: [bg('a', { hex: { tl: { q: 0, r: 0 }, br: { q: 3, r: 3 } } } as Partial<MapBackground>)],
      space: { kind: 'hex', hexSize: 20, cellSize: CELL },
    });
    await t.ctrl.apply(t.state.bgs, t.state.space);
    const sprite = t.layer.children[0] as PIXI.Sprite;
    const start = { x: sprite.x + 5, y: sprite.y + 5 };
    expect(t.ctrl.pointerDown(start)).toBe(true);
    t.ctrl.pointerMove({ x: start.x + 30, y: start.y });
    await t.ctrl.pointerUp();
    expect(t.toLatticeRaw).not.toHaveBeenCalled();
    const [, , , transform] = t.store.setBackgroundTransform.mock.calls[0] as unknown as [
      string,
      string,
      string,
      { hex?: unknown },
    ];
    expect(transform).toHaveProperty('hex');
  });
});
