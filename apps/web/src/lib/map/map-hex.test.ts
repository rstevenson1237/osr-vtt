import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hexMap, type CampaignStore, type HexTile } from '@osr-vtt/shared';
import { MapToolController } from '../shell/map-tool-controller.svelte';
import { HexAuthoringController, type MapHexDeps } from './map-hex.svelte';

const SIZE = 40;
/** World pixels at the centre of a hex. */
const centre = (q: number, r: number) => hexMap.axialToPixel({ q, r }, SIZE);
const tile = (q: number, r: number, extra: Partial<HexTile> = {}): HexTile => ({
  id: hexMap.axialKey({ q, r }),
  hex: { q, r },
  ...extra,
});

function setup(
  over: {
    tool?: string;
    selecting?: boolean;
    isGM?: boolean;
    fog?: boolean;
    snap?: string;
    size?: number;
    coarse?: boolean;
    gesture?: boolean;
    dragging?: boolean;
    pickBackground?: boolean;
    toScreen?: boolean;
  } = {},
) {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const state = {
    tool: over.tool ?? 'pan',
    selecting: over.selecting ?? false,
    isGM: over.isGM ?? true,
    fog: over.fog ?? false,
    snap: over.snap ?? 'hex',
    size: over.size ?? SIZE,
    coarse: over.coarse ?? false,
    gesture: over.gesture ?? false,
    dragging: over.dragging ?? false,
    pickBackground: over.pickBackground ?? false,
    toScreen: over.toScreen ?? true,
  };
  const tools = new MapToolController();
  const invalidate = vi.fn();
  const dropBackgroundPick = vi.fn();
  const pickBackground = vi.fn(() => state.pickBackground);
  const unsubs = [vi.fn(), vi.fn(), vi.fn()];
  const cb: {
    tiles: (t: HexTile[]) => void;
    symbols: (s: unknown[]) => void;
    lines: (l: unknown[]) => void;
  } = { tiles: () => {}, symbols: () => {}, lines: () => {} };
  const store = {
    subscribeHexTiles: vi.fn((_r: string, _m: string, f: (t: HexTile[]) => void) => {
      cb.tiles = f;
      return unsubs[0]!;
    }),
    subscribeHexSymbols: vi.fn((_r: string, _m: string, f: (s: unknown[]) => void) => {
      cb.symbols = f;
      return unsubs[1]!;
    }),
    subscribeHexLines: vi.fn((_r: string, _m: string, f: (l: unknown[]) => void) => {
      cb.lines = f;
      return unsubs[2]!;
    }),
    placeHexSymbol: vi.fn(async () => {}),
    addHexLine: vi.fn(async () => {}),
    setHexTerrain: vi.fn(async () => {}),
    setHexContents: vi.fn(async () => {}),
    setHexNote: vi.fn(async () => {}),
    setHexesRevealed: vi.fn(async () => {}),
  };
  const deps: MapHexDeps = {
    invalidate,
    store: store as unknown as CampaignStore,
    roomId: 'r',
    mapId: 'm',
    tools,
    hexSize: () => state.size,
    selecting: () => state.selecting,
    tool: () => state.tool,
    isGM: () => state.isGM,
    fogEnabled: () => state.fog,
    gestureActive: () => state.gesture,
    dragging: () => state.dragging,
    isCoarsePointer: () => state.coarse,
    effectiveSnap: () => state.snap,
    toScreen: (p) => (state.toScreen ? { x: p.x + 1000, y: p.y + 2000 } : null),
    pickBackground,
    dropBackgroundPick,
  };
  return {
    hex: new HexAuthoringController(deps),
    state,
    tools,
    store,
    invalidate,
    pickBackground,
    dropBackgroundPick,
    unsubs,
    emitTiles: (t: HexTile[]) => cb.tiles(t),
    emitSymbols: (s: unknown[]) => cb.symbols(s),
    emitLines: (l: unknown[]) => cb.lines(l),
  };
}

describe('HexAuthoringController listeners', () => {
  it('opens the three hex subscriptions and feeds their state', () => {
    const { hex, store, unsubs, emitTiles, emitSymbols, emitLines } = setup();
    expect(hex.subscribe()).toEqual(unsubs);
    expect(store.subscribeHexTiles).toHaveBeenCalledWith('r', 'm', expect.any(Function));
    emitTiles([tile(1, 0, { revealed: true }), tile(2, 0)]);
    emitSymbols([{ id: 's' }]);
    emitLines([{ id: 'l' }, { id: 'l2' }]);
    expect(hex.tiles).toHaveLength(2);
    expect(hex.symbols).toHaveLength(1);
    expect(hex.lines).toHaveLength(2);
    expect([...hex.revealed]).toEqual(['1,0']);
  });
});

describe('HexAuthoringController conversions', () => {
  it('resolves a world pixel to the hex it is in', () => {
    const { hex } = setup();
    expect(hex.hexAt(centre(2, -1))).toEqual({ q: 2, r: -1 });
    expect(hex.hexAt({ x: 0, y: 0 })).toEqual({ q: 0, r: 0 });
  });

  it('resolves nothing while the hex size is not positive', () => {
    const { hex } = setup({ size: 0 });
    expect(hex.hexAt({ x: 5, y: 5 })).toBeNull();
    expect(hex.hexSymbolPointFor({ x: 5, y: 5 })).toBeNull();
    expect(hex.hexLinePointFor({ x: 5, y: 5 })).toBeNull();
  });

  it('puts a symbol on the hex centre under Hex snap and on the raw point under Free', () => {
    const near = { x: centre(1, 0).x + 3, y: centre(1, 0).y - 2 };
    expect(setup({ snap: 'hex' }).hex.hexSymbolPointFor(near)).toEqual(
      hexMap.axialToHexPoint({ q: 1, r: 0 }),
    );
    expect(setup({ snap: 'free' }).hex.hexSymbolPointFor(near)).toEqual(
      hexMap.pixelToHexPoint(near, SIZE),
    );
  });

  it('snaps a line vertex to the thirds lattice under Hex snap only', () => {
    const p = { x: 31, y: 17 };
    const raw = hexMap.pixelToHexPoint(p, SIZE);
    expect(setup({ snap: 'free' }).hex.hexLinePointFor(p)).toEqual(raw);
    expect(setup({ snap: 'hex' }).hex.hexLinePointFor(p)).toEqual(hexMap.snapHexPoint(raw));
  });
});

describe('HexAuthoringController Select', () => {
  it('picks the hex under the pointer and toggles it off on a second click', () => {
    const { hex, tools, dropBackgroundPick, invalidate } = setup({ selecting: true });
    expect(hex.pointerDown(centre(3, 1))).toBe(true);
    expect(tools.selectedHex).toEqual({ q: 3, r: 1 });
    expect(dropBackgroundPick).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith();
    expect(hex.pointerDown(centre(3, 1))).toBe(true);
    expect(tools.selectedHex).toBeNull();
    hex.pointerDown(centre(3, 1));
    hex.pointerDown(centre(0, 0));
    expect(tools.selectedHex).toEqual({ q: 0, r: 0 });
  });

  it('lets an unlocked background take the press first, dropping the hex pick', () => {
    const { hex, tools, invalidate, dropBackgroundPick } = setup({
      selecting: true,
      pickBackground: true,
    });
    tools.selectedHex = { q: 1, r: 1 };
    expect(hex.pointerDown(centre(1, 1))).toBe(true);
    expect(tools.selectedHex).toBeNull();
    expect(invalidate).toHaveBeenCalledWith('tools');
    expect(dropBackgroundPick).not.toHaveBeenCalled();
  });

  it('consumes a click on a fogged hex for a player and drops the selection', () => {
    const { hex, tools, emitTiles, state } = setup({ selecting: true, isGM: false, fog: true });
    hex.subscribe();
    emitTiles([tile(1, 0, { revealed: true })]);
    tools.selectedHex = { q: 1, r: 0 };
    expect(hex.pointerDown(centre(2, 0))).toBe(true);
    expect(tools.selectedHex).toBeNull();
    expect(hex.pointerDown(centre(1, 0))).toBe(true);
    expect(tools.selectedHex).toEqual({ q: 1, r: 0 });
    state.isGM = true;
    expect(hex.pointerDown(centre(2, 0))).toBe(true);
    expect(tools.selectedHex).toEqual({ q: 2, r: 0 });
  });

  it('is not consumed when the hex size gives no hex to pick', () => {
    const { hex, tools } = setup({ selecting: true, size: 0 });
    expect(hex.pointerDown({ x: 1, y: 1 })).toBe(false);
    expect(tools.selectedHex).toBeNull();
  });

  it('drops a selected hex the referee has fogged, for a player', () => {
    const { hex, tools, emitTiles, state } = setup({ isGM: false, fog: true });
    hex.subscribe();
    tools.selectedHex = { q: 4, r: 4 };
    hex.dropFoggedSelection();
    expect(tools.selectedHex).toBeNull();
    emitTiles([tile(4, 4, { revealed: true })]);
    tools.selectedHex = { q: 4, r: 4 };
    hex.dropFoggedSelection();
    expect(tools.selectedHex).toEqual({ q: 4, r: 4 });
    state.isGM = true;
    emitTiles([]);
    hex.dropFoggedSelection();
    expect(tools.selectedHex).toEqual({ q: 4, r: 4 });
  });

  it('exposes the selected hex tile, and the hex sheet writes to it', () => {
    const { hex, tools, store, emitTiles } = setup();
    hex.subscribe();
    emitTiles([tile(2, 2, { terrain: 'forest', note: 'camp' })]);
    expect(hex.selectedTile).toBeNull();
    tools.selectedHex = { q: 2, r: 2 };
    expect(hex.selectedTile?.note).toBe('camp');
    hex.setTerrain('hills');
    hex.setContents('castle');
    hex.setNote('keep');
    expect(store.setHexTerrain).toHaveBeenCalledWith('r', 'm', { q: 2, r: 2 }, 'hills');
    expect(store.setHexContents).toHaveBeenCalledWith('r', 'm', { q: 2, r: 2 }, 'castle');
    expect(store.setHexNote).toHaveBeenCalledWith('r', 'm', { q: 2, r: 2 }, 'keep');
  });

  it('writes nothing from the sheet while no hex is picked', () => {
    const { hex, store } = setup();
    hex.setTerrain('hills');
    hex.setContents(null);
    hex.setNote('x');
    expect(store.setHexTerrain).not.toHaveBeenCalled();
    expect(store.setHexContents).not.toHaveBeenCalled();
    expect(store.setHexNote).not.toHaveBeenCalled();
  });
});

describe('HexAuthoringController click tools', () => {
  it('ignores tools that are not its own', () => {
    for (const tool of ['wall', 'symbol', 'label', 'text', 'pan', 'pen']) {
      expect(setup({ tool }).hex.pointerDown({ x: 1, y: 1 })).toBe(false);
    }
  });

  it('places the chosen hex symbol with one write per click', () => {
    const { hex, tools, store } = setup({ tool: 'hexSymbol' });
    tools.selectedHexSymbolKind = 'tower';
    expect(hex.pointerDown(centre(1, 2))).toBe(true);
    expect(store.placeHexSymbol).toHaveBeenCalledWith('r', 'm', {
      point: hexMap.axialToHexPoint({ q: 1, r: 2 }),
      kind: 'tower',
    });
  });

  it('opens a hex note with the Label tool and never toggles it off', () => {
    const { hex, tools } = setup({ tool: 'hexLabel' });
    expect(hex.pointerDown(centre(2, 0))).toBe(true);
    expect(tools.selectedHex).toEqual({ q: 2, r: 0 });
    hex.pointerDown(centre(2, 0));
    expect(tools.selectedHex).toEqual({ q: 2, r: 0 });
  });

  it('does not open a note on a hex a player cannot see', () => {
    const { hex, tools } = setup({ tool: 'hexLabel', isGM: false, fog: true });
    expect(hex.pointerDown(centre(2, 0))).toBe(true);
    expect(tools.selectedHex).toBeNull();
  });

  it('paints terrain, and clears it when the hex already carries that kind', () => {
    const { hex, tools, store, emitTiles } = setup({ tool: 'hexTerrain' });
    hex.subscribe();
    tools.selectedHexTerrainKind = 'swamp';
    hex.pointerDown(centre(1, 1));
    expect(store.setHexTerrain).toHaveBeenLastCalledWith('r', 'm', { q: 1, r: 1 }, 'swamp');
    emitTiles([tile(1, 1, { terrain: 'swamp' })]);
    hex.pointerDown(centre(1, 1));
    expect(store.setHexTerrain).toHaveBeenLastCalledWith('r', 'm', { q: 1, r: 1 }, null);
  });

  it('does not paint a hex a player cannot see', () => {
    const { hex, store } = setup({ tool: 'hexTerrain', isGM: false, fog: true });
    hex.pointerDown(centre(1, 1));
    expect(store.setHexTerrain).not.toHaveBeenCalled();
  });
});

describe('HexAuthoringController Road/River', () => {
  it('collects vertices, previews the run and commits it on finish', async () => {
    const { hex, tools, store, invalidate } = setup({ tool: 'road', snap: 'free' });
    tools.selectedHexLineWidth = 2;
    const a = { x: 10, y: 10 };
    const b = { x: 90, y: 30 };
    expect(hex.linePreview()).toBeNull();
    expect(hex.pointerDown(a)).toBe(true);
    expect(invalidate).toHaveBeenCalledWith();
    hex.hover(b);
    expect(hex.pointerMove(b)).toBe(false);
    const preview = hex.linePreview();
    expect(preview?.kind).toBe('road');
    expect(preview?.points).toEqual([
      hexMap.pixelToHexPoint(a, SIZE),
      hexMap.pixelToHexPoint(b, SIZE),
    ]);
    hex.pointerDown(b);
    await hex.finishLine();
    expect(store.addHexLine).toHaveBeenCalledWith('r', 'm', {
      kind: 'road',
      points: [hexMap.pixelToHexPoint(a, SIZE), hexMap.pixelToHexPoint(b, SIZE)],
      shade: 2,
      width: 2,
      join: hexMap.hexLineEntry('road').join,
    });
    expect(hex.linePreview()).toBeNull();
  });

  it('discards a one-point run rather than committing it', async () => {
    const { hex, store } = setup({ tool: 'river' });
    hex.pointerDown({ x: 5, y: 5 });
    await hex.finishLine();
    expect(store.addHexLine).not.toHaveBeenCalled();
    await hex.finishLine();
    expect(store.addHexLine).not.toHaveBeenCalled();
  });

  it('commits nothing from a tool that is not Road or River', async () => {
    const { hex, state, store } = setup({ tool: 'road' });
    hex.pointerDown({ x: 5, y: 5 });
    hex.pointerDown({ x: 50, y: 50 });
    state.tool = 'wall';
    await hex.finishLine();
    expect(store.addHexLine).not.toHaveBeenCalled();
  });

  it('cancel drops the run', async () => {
    const { hex, store } = setup({ tool: 'road' });
    hex.pointerDown({ x: 5, y: 5 });
    hex.pointerDown({ x: 50, y: 50 });
    hex.cancel();
    await hex.finishLine();
    expect(store.addHexLine).not.toHaveBeenCalled();
  });
});

describe('HexAuthoringController fog', () => {
  it('reveals every hex a stroke crosses in one batched write', async () => {
    const { hex, store, invalidate } = setup({ tool: 'hexFog', fog: true });
    expect(hex.pointerDown(centre(0, 0))).toBe(true);
    expect(hex.pointerMove(centre(1, 0))).toBe(true);
    expect(invalidate).toHaveBeenCalledWith('fog');
    expect(hex.fogView().revealed).toEqual(
      expect.arrayContaining([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ]),
    );
    expect(await hex.pointerUp()).toBe(true);
    expect(store.setHexesRevealed).toHaveBeenCalledTimes(1);
    const [room, map, hexes, reveal] = store.setHexesRevealed.mock.calls[0] as unknown as [
      string,
      string,
      hexMap.Axial[],
      boolean,
    ];
    expect([room, map, reveal]).toEqual(['r', 'm', true]);
    expect(hexes).toEqual(
      expect.arrayContaining([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ]),
    );
    expect(hexes).toHaveLength(2);
  });

  it('hides when the stroke starts on a revealed hex', async () => {
    const { hex, store, emitTiles } = setup({ tool: 'hexFog', fog: true });
    hex.subscribe();
    emitTiles([tile(0, 0, { revealed: true })]);
    hex.pointerDown(centre(0, 0));
    await hex.pointerUp();
    expect(store.setHexesRevealed).toHaveBeenCalledWith('r', 'm', [{ q: 0, r: 0 }], false);
  });

  it('keeps previewing a released stroke until the tiles show it landed', async () => {
    const { hex, emitTiles } = setup({ tool: 'hexFog', fog: true });
    hex.subscribe();
    hex.pointerDown(centre(5, 5));
    await hex.pointerUp();
    // The write resolved but the listener has not caught up: still previewed.
    expect(hex.fogView().revealed).toEqual([{ q: 5, r: 5 }]);
    emitTiles([tile(5, 5, { revealed: true })]);
    expect(hex.fogView().revealed).toEqual([{ q: 5, r: 5 }]);
    emitTiles([]);
    expect(hex.fogView().revealed).toEqual([]);
  });

  it('drops the preview when the write fails', async () => {
    const { hex, store } = setup({ tool: 'hexFog', fog: true });
    store.setHexesRevealed.mockRejectedValueOnce(new Error('denied'));
    hex.pointerDown(centre(5, 5));
    await expect(hex.pointerUp()).rejects.toThrow('denied');
    expect(hex.fogView().revealed).toEqual([]);
  });

  it('does not start a stroke for a player, or while the map has no fog', async () => {
    for (const over of [
      { isGM: false, fog: true },
      { isGM: true, fog: false },
    ]) {
      const { hex, store } = setup({ tool: 'hexFog', ...over });
      expect(hex.pointerDown(centre(0, 0))).toBe(true);
      expect(hex.pointerMove(centre(1, 0))).toBe(false);
      expect(await hex.pointerUp()).toBe(false);
      expect(store.setHexesRevealed).not.toHaveBeenCalled();
    }
  });

  it('cancel drops an open stroke without writing', async () => {
    const { hex, store } = setup({ tool: 'hexFog', fog: true });
    hex.pointerDown(centre(0, 0));
    hex.cancel();
    expect(await hex.pointerUp()).toBe(false);
    expect(store.setHexesRevealed).not.toHaveBeenCalled();
  });

  it('Reveal all and Reset fog are the referee’s, one batched write each', async () => {
    const { hex, store, emitTiles, state } = setup({ fog: true });
    hex.subscribe();
    emitTiles([
      tile(0, 0, { terrain: 'forest' }),
      tile(1, 0, { revealed: true, terrain: 'plains' }),
    ]);
    state.isGM = false;
    await hex.revealAll();
    await hex.resetFog();
    expect(store.setHexesRevealed).not.toHaveBeenCalled();
    state.isGM = true;
    await hex.revealAll();
    expect(store.setHexesRevealed).toHaveBeenLastCalledWith('r', 'm', [{ q: 0, r: 0 }], true);
    await hex.resetFog();
    expect(store.setHexesRevealed).toHaveBeenLastCalledWith('r', 'm', [{ q: 1, r: 0 }], false);
  });
});

describe('HexAuthoringController note hover', () => {
  it('anchors the note on the hex centre and reads the tile’s note', () => {
    const { hex, emitTiles } = setup();
    hex.subscribe();
    emitTiles([tile(2, 0, { note: 'a ruin' })]);
    hex.hover(centre(2, 0));
    const c = centre(2, 0);
    expect(hex.hoverNote).toEqual({ key: '2,0', x: c.x + 1000, y: c.y + 2000 });
    expect(hex.hoverNoteText).toBe('a ruin');
    hex.hover(centre(3, 0));
    expect(hex.hoverNote?.key).toBe('3,0');
    expect(hex.hoverNoteText).toBe('');
  });

  it('does not re-anchor while the pointer stays in the same hex', () => {
    const { hex } = setup();
    hex.hover(centre(2, 0));
    const first = hex.hoverNote;
    hex.hover({ x: centre(2, 0).x + 2, y: centre(2, 0).y });
    expect(hex.hoverNote).toBe(first);
  });

  it('shows nothing on a coarse pointer, mid-gesture, mid-drag or off a visible hex', () => {
    for (const over of [{ coarse: true }, { gesture: true }, { dragging: true }]) {
      const { hex } = setup(over);
      hex.hover(centre(1, 0));
      expect(hex.hoverNote).toBeNull();
    }
    const { hex } = setup({ isGM: false, fog: true });
    hex.hover(centre(1, 0));
    expect(hex.hoverNote).toBeNull();
  });

  it('shows nothing before the engine can place it', () => {
    const { hex } = setup({ toScreen: false });
    hex.hover(centre(1, 0));
    expect(hex.hoverNote).toBeNull();
  });

  it('clears when the pointer leaves the stage', () => {
    const { hex } = setup();
    hex.hover(centre(1, 0));
    expect(hex.hoverNote).not.toBeNull();
    hex.pointerOut();
    expect(hex.hoverNote).toBeNull();
  });
});

describe('HexAuthoringController on a map with no use for it', () => {
  beforeEach(() => vi.useRealTimers());

  it('reports nothing consumed and no preview', async () => {
    const { hex } = setup({ tool: 'pan' });
    expect(hex.pointerDown({ x: 0, y: 0 })).toBe(false);
    expect(hex.pointerMove({ x: 0, y: 0 })).toBe(false);
    expect(await hex.pointerUp()).toBe(false);
    expect(hex.linePreview()).toBeNull();
  });
});
