import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignStore, PingPos, Token } from '@osr-vtt/shared';
import { CURSOR_PUBLISH_MS, MapDraw, type MapDrawDeps } from './map-draw.svelte';

const CELL = 10;

function setup(over: { tool?: string; multiplayer?: boolean; tokens?: Token[] } = {}) {
  const state = {
    tool: over.tool ?? 'pen',
    tokens: over.tokens ?? [],
  };
  const invalidate = vi.fn();
  const syncReadout = vi.fn();
  const renderCursors = vi.fn();
  const unsubCursors = vi.fn();
  const unsubPings = vi.fn();
  let pingCb: (p: PingPos[]) => void = () => {};
  const store = {
    publishCursor: vi.fn(),
    publishPing: vi.fn(),
    writeDrawing: vi.fn(async () => {}),
    subscribeCursors: vi.fn((_room: string, cb: (c: unknown[]) => void) => {
      cb([{ uid: 'peer' }]);
      return unsubCursors;
    }),
    subscribePings: vi.fn((_room: string, cb: (p: PingPos[]) => void) => {
      pingCb = cb;
      return unsubPings;
    }),
  };
  const deps: MapDrawDeps = {
    invalidate,
    store: store as unknown as CampaignStore,
    roomId: 'r',
    mapId: 'm',
    toLatticeRaw: (w) => ({ x: w.x / CELL, y: w.y / CELL }),
    // An axial stand-in: the hex a pointer is over, one hex per 100px column.
    hexAt: (w) => ({ q: Math.floor(w.x / 100), r: 0 }),
    multiplayer: over.multiplayer ?? true,
    myUid: 'me',
    tool: () => state.tool,
    tokens: () => state.tokens,
    renderCursors,
    syncReadout,
  };
  return {
    draw: new MapDraw(deps),
    state,
    store,
    invalidate,
    syncReadout,
    renderCursors,
    unsubCursors,
    unsubPings,
    emitPings: (p: PingPos[]) => pingCb(p),
  };
}

describe('MapDraw cursor publish', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('publishes to the store (RTDB), throttled to one per interval', () => {
    const { draw, store } = setup();
    draw.hover({ x: 1, y: 2 });
    draw.hover({ x: 3, y: 4 });
    expect(store.publishCursor).toHaveBeenCalledTimes(1);
    expect(store.publishCursor).toHaveBeenCalledWith('r', { x: 1, y: 2 });
    vi.advanceTimersByTime(CURSOR_PUBLISH_MS);
    draw.hover({ x: 5, y: 6 });
    expect(store.publishCursor).toHaveBeenCalledTimes(2);
    expect(store.publishCursor).toHaveBeenLastCalledWith('r', { x: 5, y: 6 });
  });

  it('publishes nothing in a local build', () => {
    const { draw, store } = setup({ multiplayer: false });
    draw.hover({ x: 1, y: 2 });
    expect(store.publishCursor).not.toHaveBeenCalled();
  });
});

describe('MapDraw listeners', () => {
  it('opens no listener in a local build (SPEC-041 §3)', () => {
    const { draw, store } = setup({ multiplayer: false });
    expect(draw.subscribe()).toEqual([]);
    expect(store.subscribeCursors).not.toHaveBeenCalled();
    expect(store.subscribePings).not.toHaveBeenCalled();
  });

  it('opens both when multiplayer, feeding cursors out and pings into livePings', () => {
    const { draw, store, renderCursors, emitPings, unsubCursors, unsubPings } = setup();
    const unsubs = draw.subscribe();
    expect(store.subscribeCursors).toHaveBeenCalledWith('r', expect.any(Function));
    expect(renderCursors).toHaveBeenCalledWith([{ uid: 'peer' }], 'me');
    const p = { id: 'p1', uid: 'u', x: 500, y: 500, ts: 0 } as PingPos;
    emitPings([p]);
    expect(draw.livePings).toEqual([p]);
    expect(unsubs).toEqual([unsubCursors, unsubPings]);
  });

  it('resolves live pings against the current tokens', () => {
    const tok = { id: 't', pos: { x: 0, y: 0 }, size: 1 } as unknown as Token;
    const { draw, state, emitPings } = setup({ tokens: [tok] });
    draw.subscribe();
    emitPings([{ id: 'p1', uid: 'u', x: 0, y: 0, ts: 0 } as PingPos]);
    expect(draw.resolvePings()).toHaveLength(1);
    expect(draw.resolvePings()[0]).toHaveProperty('tokenRingRadius');
    state.tokens = [{ ...tok, pos: { x: 99, y: 0 } } as Token];
    expect(draw.resolvePings()).toEqual([]);
  });
});

describe('MapDraw ping', () => {
  it('publishes a ping and consumes the click, move and release', async () => {
    const { draw, store } = setup({ tool: 'ping' });
    expect(draw.pointerDown({ x: 40, y: 50 })).toBe(true);
    expect(store.publishPing).toHaveBeenCalledWith('r', { x: 40, y: 50 });
    expect(draw.pointerMove({ x: 1, y: 1 })).toBe(true);
    expect(await draw.pointerUp()).toBe(true);
  });
});

describe('MapDraw pen', () => {
  it('buffers the stroke, invalidating overlay per move, and writes once on release', async () => {
    const { draw, store, invalidate } = setup({ tool: 'pen' });
    expect(draw.pointerDown({ x: 1, y: 1 })).toBe(true);
    draw.pointerMove({ x: 2, y: 2 });
    draw.pointerMove({ x: 3, y: 3 });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith('overlay');
    expect(draw.annotationsWithLiveStroke([])).toHaveLength(1);
    expect(store.writeDrawing).not.toHaveBeenCalled();

    expect(await draw.pointerUp()).toBe(true);
    expect(store.writeDrawing).toHaveBeenCalledTimes(1);
    expect(store.writeDrawing).toHaveBeenCalledWith('r', 'm', {
      layer: 'mapping',
      kind: 'freehand',
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ],
      style: {},
    });
    expect(draw.annotationsWithLiveStroke([])).toEqual([]);
  });

  it('writes nothing for a click that never moved', async () => {
    const { draw, store } = setup({ tool: 'pen' });
    draw.pointerDown({ x: 1, y: 1 });
    await draw.pointerUp();
    expect(store.writeDrawing).not.toHaveBeenCalled();
  });

  it('ignores a move with no stroke started, but still consumes it', () => {
    const { draw, invalidate } = setup({ tool: 'pen' });
    expect(draw.pointerMove({ x: 2, y: 2 })).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('cancel drops an unfinished stroke without writing', async () => {
    const { draw, store } = setup({ tool: 'pen' });
    draw.pointerDown({ x: 1, y: 1 });
    draw.pointerMove({ x: 2, y: 2 });
    draw.cancel();
    expect(draw.annotationsWithLiveStroke([])).toEqual([]);
    await draw.pointerUp();
    expect(store.writeDrawing).not.toHaveBeenCalled();
  });
});

describe('MapDraw measure', () => {
  it('extends the path per click, in lattice units, with the hex path alongside', () => {
    const { draw, invalidate, syncReadout } = setup({ tool: 'measure' });
    expect(draw.pointerDown({ x: 10, y: 20 })).toBe(true);
    expect(draw.pointerDown({ x: 150, y: 20 })).toBe(true);
    expect(draw.livePath).toEqual([
      { x: 1, y: 2 },
      { x: 15, y: 2 },
      { x: 15, y: 2 },
    ]);
    expect(draw.liveHexPath).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 1, r: 0 },
    ]);
    expect(invalidate).toHaveBeenCalledWith('tools');
    expect(syncReadout).toHaveBeenCalledTimes(2);
  });

  it('follows the pointer between clicks, but only once a path exists', () => {
    const { draw, invalidate, syncReadout } = setup({ tool: 'measure' });
    expect(draw.pointerMove({ x: 50, y: 50 })).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
    expect(syncReadout).not.toHaveBeenCalled();
    draw.pointerDown({ x: 10, y: 20 });
    invalidate.mockClear();
    draw.pointerMove({ x: 210, y: 30 });
    expect(draw.livePath).toEqual([
      { x: 1, y: 2 },
      { x: 21, y: 3 },
    ]);
    expect(invalidate).toHaveBeenCalledWith('tools');
  });

  it('pointer-up has nothing to do and writes nothing', async () => {
    const { draw, store } = setup({ tool: 'measure' });
    draw.pointerDown({ x: 10, y: 20 });
    expect(await draw.pointerUp()).toBe(true);
    expect(store.writeDrawing).not.toHaveBeenCalled();
    expect(draw.livePath.length).toBeGreaterThan(0);
  });

  it('finishMeasure and cancel both clear the path', () => {
    const { draw, invalidate } = setup({ tool: 'measure' });
    draw.pointerDown({ x: 10, y: 20 });
    invalidate.mockClear();
    draw.finishMeasure();
    expect(draw.livePath).toEqual([]);
    expect(draw.liveHexPath).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith('tools');

    draw.pointerDown({ x: 10, y: 20 });
    draw.cancel();
    expect(draw.livePath).toEqual([]);
    expect(draw.liveHexPath).toEqual([]);
  });
});

describe('MapDraw other tools', () => {
  it('leaves the event for the next handler', async () => {
    const { draw } = setup({ tool: 'select' });
    expect(draw.pointerDown({ x: 1, y: 1 })).toBe(false);
    expect(draw.pointerMove({ x: 1, y: 1 })).toBe(false);
    expect(await draw.pointerUp()).toBe(false);
  });
});
