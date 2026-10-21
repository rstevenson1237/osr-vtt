import { describe, expect, it, vi } from 'vitest';
import {
  MemoryBackend,
  MemoryStore,
  type Drawing,
  type MapRoom,
  type MapSymbol,
  type StoredVectorWall,
  type Token,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import { SelectionController, type SelectionControllerDeps } from './map-select.svelte';
import { MapSelection } from './map-selection.svelte';
import type { VectorEditorOp } from './vector-tools';

const CELL = 10;
/** World pixels for a lattice point. */
const px = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

function wall(id: string, ax: number, ay: number, bx: number, by: number): StoredVectorWall {
  return {
    id,
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
    source: 'explicit',
    blocksSight: true,
    blocksMovement: true,
  };
}
const door = (id: string, ax: number, ay: number, bx: number, by: number): VectorDoor => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  type: 'single',
  state: 'closed',
});
const symbol = (id: string, x: number, y: number): MapSymbol => ({
  id,
  cell: { x, y },
  kind: 'chest',
  rotation: 0,
});
const room = (id: string, x: number, y: number): MapRoom => ({
  id,
  key: id,
  name: id,
  bbox: { x, y, w: 2, h: 2 },
  labelAnchor: { x, y },
  wallStyle: 'masonry',
});
const token = (id: string, x: number, y: number): Token =>
  ({ id, pos: { x: x * CELL, y: y * CELL } }) as unknown as Token;

function setup(
  over: {
    walls?: StoredVectorWall[];
    doors?: VectorDoor[];
    regions?: VectorFloorRegion[];
    symbols?: MapSymbol[];
    mapRooms?: MapRoom[];
    drawings?: Drawing[];
    tokens?: Token[];
    mapMode?: 'edit' | 'view';
    backgroundHit?: boolean;
  } = {},
) {
  const state = {
    walls: over.walls ?? [],
    doors: over.doors ?? [],
    regions: over.regions ?? [],
    symbols: over.symbols ?? [],
    mapRooms: over.mapRooms ?? [],
    drawings: over.drawings ?? [],
    tokens: over.tokens ?? [],
    mapMode: over.mapMode ?? 'edit',
    backgroundHit: over.backgroundHit ?? false,
    backgroundDragging: false,
  };
  const store = new MemoryStore(new MemoryBackend());
  const placeSymbol = vi.spyOn(store, 'placeSymbol').mockResolvedValue('id');
  const upsertMapRoom = vi.spyOn(store, 'upsertMapRoom').mockResolvedValue(undefined);
  const setDoor = vi.spyOn(store, 'setDoor').mockResolvedValue('id');
  const invalidate = vi.fn();
  const applied: VectorEditorOp[] = [];
  const selection = new MapSelection();
  const mapCtrl = {
    get mapMode() {
      return state.mapMode;
    },
    selectedMapRoomId: null as string | null,
  };
  const background = {
    get dragging() {
      return state.backgroundDragging;
    },
    pointerDown: vi.fn(() => {
      if (state.backgroundHit) state.backgroundDragging = true;
      return state.backgroundHit;
    }),
    pointerMove: vi.fn(() => true),
    pointerUp: vi.fn(async () => {
      state.backgroundDragging = false;
      return true;
    }),
    cancel: vi.fn(() => {
      state.backgroundDragging = false;
    }),
  };
  const focusToken = vi.fn();
  const deps: SelectionControllerDeps = {
    invalidate,
    store,
    roomId: 'r',
    mapId: 'm',
    toLatticeSnapped: (w) => ({ x: w.x / CELL, y: w.y / CELL }),
    selection,
    mapCtrl,
    applyOp: async (op) => {
      applied.push(op);
    },
    background,
    focusToken,
    cellSize: () => CELL,
    pickThreshold: () => 0.5,
    effectiveSnap: () => 'free',
    regions: () => state.regions,
    walls: () => state.walls,
    doors: () => state.doors,
    symbols: () => state.symbols,
    mapRooms: () => state.mapRooms,
    drawings: () => state.drawings,
    tokens: () => state.tokens,
  };
  return {
    ctrl: new SelectionController(deps),
    state,
    selection,
    mapCtrl,
    background,
    focusToken,
    invalidate,
    applied,
    placeSymbol,
    upsertMapRoom,
    setDoor,
  };
}

describe('SelectionController pick priority', () => {
  it('a vertex handle under the pointer is selected and arms a vertex drag', () => {
    const { ctrl, selection, invalidate } = setup({ walls: [wall('w', 10, 10, 14, 10)] });
    expect(ctrl.pointerDown(px(10, 10))).toBe(true);
    expect(selection.handles.map((h) => h.owner.id)).toEqual(['w']);
    expect(selection.count).toBe(1);
    expect(ctrl.activeDrag?.owner).toEqual({ kind: 'wall', id: 'w' });
    expect(ctrl.busy).toBe(true);
    expect(invalidate).toHaveBeenCalledWith('tools');
  });

  it('a handle beats an object, which beats a background, which beats a lasso', () => {
    const base = {
      walls: [wall('w', 10, 10, 14, 10)],
      symbols: [symbol('s', 10, 10)],
      backgroundHit: true,
    };
    const a = setup(base);
    a.ctrl.pointerDown(px(10, 10));
    expect(a.selection.handles).toHaveLength(1);
    expect(a.selection.objects).toEqual([]);

    const b = setup({ symbols: base.symbols, backgroundHit: true });
    b.ctrl.pointerDown(px(10.5, 10.5));
    expect(b.selection.object).toEqual({ kind: 'symbol', id: 's' });
    expect(b.background.pointerDown).not.toHaveBeenCalled();

    const c = setup({ backgroundHit: true });
    c.ctrl.pointerDown(px(30, 30));
    expect(c.background.pointerDown).toHaveBeenCalledWith(px(30, 30));
    expect(c.ctrl.lasso).toBeNull();

    const d = setup();
    d.ctrl.pointerDown(px(30, 30));
    expect(d.ctrl.lasso).toEqual({ a: { x: 30, y: 30 }, b: { x: 30, y: 30 } });
  });

  it('starting a lasso drops a held background pick but nothing else', () => {
    const { ctrl, selection } = setup();
    selection.selectBackground('bg');
    ctrl.pointerDown(px(30, 30));
    expect(selection.backgroundId).toBeNull();
  });

  it('picking a room label publishes it for the Room quick sheet', () => {
    const { ctrl, mapCtrl, selection } = setup({ mapRooms: [room('lab', 20, 20)] });
    ctrl.pointerDown(px(20.5, 20.5));
    expect(selection.object).toEqual({ kind: 'mapRoom', id: 'lab' });
    expect(mapCtrl.selectedMapRoomId).toBe('lab');
  });
});

describe('SelectionController vertex drag', () => {
  it('moves the working copy and lands one op on release, leaving the stored wall alone', async () => {
    const stored = wall('w', 10, 10, 14, 10);
    const { ctrl, applied, invalidate } = setup({ walls: [stored] });
    ctrl.pointerDown(px(10, 10));
    ctrl.pointerMove(px(12, 11));
    expect(invalidate).toHaveBeenLastCalledWith('floor', 'tools');
    expect(stored.a).toEqual({ x: 10, y: 10 });
    expect(ctrl.displayState().walls[0]!.a).toEqual({ x: 12, y: 11 });
    expect(applied).toEqual([]);

    await ctrl.pointerUp();
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({
      kind: 'wallsBatch',
      changes: [{ id: 'w', from: { a: { x: 10, y: 10 } }, to: { a: { x: 12, y: 11 } } }],
    });
    expect(ctrl.activeDrag).toBeNull();
  });

  it('redraws the overlay too while a door endpoint moves', () => {
    const { ctrl, invalidate } = setup({ doors: [door('d', 20, 20, 21, 20)] });
    ctrl.pointerDown(px(20, 20));
    ctrl.pointerMove(px(22, 22));
    expect(invalidate).toHaveBeenLastCalledWith('floor', 'overlay', 'tools');
  });

  it('under the View lock the handle is selected but no drag is armed', async () => {
    const { ctrl, selection, applied } = setup({
      walls: [wall('w', 10, 10, 14, 10)],
      mapMode: 'view',
    });
    ctrl.pointerDown(px(10, 10));
    expect(selection.handles).toHaveLength(1);
    expect(ctrl.busy).toBe(false);
    await ctrl.pointerUp();
    expect(applied).toEqual([]);
  });
});

describe('SelectionController object drag', () => {
  it('drags a symbol by its pick offset and writes it once on release', async () => {
    const { ctrl, placeSymbol, invalidate } = setup({ symbols: [symbol('s', 10, 10)] });
    ctrl.pointerDown(px(10.25, 10.25));
    expect(ctrl.objectDrag?.selection).toEqual({ kind: 'symbol', id: 's' });
    ctrl.pointerMove(px(13.25, 12.25));
    expect(invalidate).toHaveBeenLastCalledWith('overlay', 'tools');
    expect(ctrl.displayOverlayState().symbols[0]!.cell).toEqual({ x: 13, y: 12 });
    expect(placeSymbol).not.toHaveBeenCalled();

    await ctrl.pointerUp();
    expect(placeSymbol).toHaveBeenCalledTimes(1);
    expect(placeSymbol).toHaveBeenCalledWith(
      'r',
      'm',
      expect.objectContaining({ id: 's', cell: { x: 13, y: 12 } }),
    );
    expect(ctrl.objectDrag).toBeNull();
  });

  it('drags a room label by its pick offset and upserts it once on release', async () => {
    const { ctrl, upsertMapRoom } = setup({ mapRooms: [room('lab', 20, 20)] });
    ctrl.pointerDown(px(20.5, 20.5));
    ctrl.pointerMove(px(23.5, 22.5));
    await ctrl.pointerUp();
    expect(upsertMapRoom).toHaveBeenCalledTimes(1);
    expect(upsertMapRoom).toHaveBeenCalledWith(
      'r',
      'm',
      expect.objectContaining({ id: 'lab', labelAnchor: { x: 23, y: 22 } }),
    );
  });

  it('a door is select-only: picked, never armed', () => {
    const { ctrl, selection } = setup({ doors: [door('d', 20, 20, 21, 20)] });
    ctrl.pointerDown(px(20.5, 20));
    expect(selection.object).toEqual({ kind: 'door', id: 'd' });
    expect(ctrl.busy).toBe(false);
  });

  it('under the View lock an object is selected but not armed to move', () => {
    const { ctrl, selection } = setup({ symbols: [symbol('s', 10, 10)], mapMode: 'view' });
    ctrl.pointerDown(px(10.5, 10.5));
    expect(selection.object).toEqual({ kind: 'symbol', id: 's' });
    expect(ctrl.busy).toBe(false);
  });
});

describe('SelectionController lasso', () => {
  it('a sweep over tokens selects tokens only and focuses the last one caught', async () => {
    const { ctrl, selection, focusToken } = setup({
      tokens: [token('a', 31, 31), token('b', 33, 33), token('far', 80, 80)],
      walls: [wall('w', 30, 30, 34, 30)],
    });
    // Starts on open canvas away from the wall's handles.
    ctrl.pointerDown(px(29.4, 29.4));
    ctrl.pointerMove(px(36, 36));
    expect(ctrl.lasso?.b).toEqual({ x: 36, y: 36 });
    await ctrl.pointerUp();
    expect(selection.tokenIds).toEqual(['a', 'b']);
    expect(selection.handles).toEqual([]);
    expect(focusToken).toHaveBeenCalledWith('b');
    expect(ctrl.lasso).toBeNull();
  });

  it('a sweep over geometry selects handles and objects together', async () => {
    const { ctrl, selection, focusToken } = setup({
      walls: [wall('w', 30, 30, 34, 30)],
      symbols: [symbol('s', 31, 32)],
    });
    ctrl.pointerDown(px(28, 28));
    ctrl.pointerMove(px(40, 40));
    await ctrl.pointerUp();
    expect(selection.handles.map((h) => h.owner.id)).toEqual(['w', 'w']);
    expect(selection.objects).toEqual([{ kind: 'symbol', id: 's' }]);
    expect(selection.count).toBe(3);
    expect(focusToken).not.toHaveBeenCalled();
  });

  it('a sweep that catches nothing clears a held selection', async () => {
    const { ctrl, selection } = setup();
    selection.selectTokens(['x']);
    ctrl.pointerDown(px(60, 60));
    ctrl.pointerMove(px(62, 62));
    await ctrl.pointerUp();
    expect(selection.tokenIds).toEqual([]);
    expect(selection.count).toBe(0);
  });

  it('a lassoed room label is published for the Room quick sheet', async () => {
    const { ctrl, mapCtrl } = setup({ mapRooms: [room('lab', 31, 31)] });
    ctrl.pointerDown(px(29, 29));
    ctrl.pointerMove(px(40, 40));
    await ctrl.pointerUp();
    expect(mapCtrl.selectedMapRoomId).toBe('lab');
  });
});

describe('SelectionController background gesture', () => {
  it('routes move and release to the background seam while it is dragging', async () => {
    const { ctrl, background } = setup({ backgroundHit: true });
    ctrl.pointerDown(px(50, 50));
    ctrl.pointerMove(px(51, 51));
    expect(background.pointerMove).toHaveBeenCalledWith(px(51, 51));
    await ctrl.pointerUp();
    expect(background.pointerUp).toHaveBeenCalled();
  });
});

describe('SelectionController hover', () => {
  it('tracks the handle under an idle pointer', () => {
    const { ctrl, invalidate } = setup({ walls: [wall('w', 10, 10, 14, 10)] });
    ctrl.pointerMove(px(14, 10));
    expect(ctrl.hoverHandle?.owner).toEqual({ kind: 'wall', id: 'w' });
    expect(invalidate).toHaveBeenLastCalledWith('tools');
    ctrl.pointerMove(px(50, 50));
    expect(ctrl.hoverHandle).toBeNull();
  });
});

describe('SelectionController verbs', () => {
  it('rotate turns a selected symbol by 90 degrees', async () => {
    const { ctrl, selection, placeSymbol } = setup({ symbols: [symbol('s', 10, 10)] });
    selection.selectObjects([{ kind: 'symbol', id: 's' }]);
    await ctrl.rotateSelectedObject();
    expect(placeSymbol).toHaveBeenCalledWith(
      'r',
      'm',
      expect.objectContaining({ id: 's', rotation: 90 }),
    );
  });

  it('rotate flips a selected door end for end', async () => {
    const { ctrl, selection, setDoor } = setup({ doors: [door('d', 20, 20, 21, 22)] });
    selection.selectObjects([{ kind: 'door', id: 'd' }]);
    await ctrl.rotateSelectedObject();
    expect(setDoor).toHaveBeenCalledWith(
      'r',
      'm',
      expect.objectContaining({ a: { x: 21, y: 22 }, b: { x: 20, y: 20 } }),
    );
  });

  it('rotate does nothing under the View lock or with several things selected', async () => {
    const view = setup({ symbols: [symbol('s', 10, 10)], mapMode: 'view' });
    view.selection.selectObjects([{ kind: 'symbol', id: 's' }]);
    await view.ctrl.rotateSelectedObject();
    expect(view.placeSymbol).not.toHaveBeenCalled();

    const many = setup({ symbols: [symbol('s', 10, 10), symbol('t', 12, 12)] });
    many.selection.selectObjects([
      { kind: 'symbol', id: 's' },
      { kind: 'symbol', id: 't' },
    ]);
    await many.ctrl.rotateSelectedObject();
    expect(many.placeSymbol).not.toHaveBeenCalled();
  });

  it('delete removes handles and objects as one batched undo entry and clears the selection', async () => {
    const { ctrl, selection, applied, background } = setup({
      walls: [wall('w', 10, 10, 14, 10)],
      symbols: [symbol('s', 30, 30)],
    });
    ctrl.pointerDown(px(10, 10));
    selection.selectGeometry(selection.handles, [{ kind: 'symbol', id: 's' }]);
    await ctrl.deleteSelection();
    expect(selection.count).toBe(0);
    expect(background.cancel).toHaveBeenCalled();
    expect(applied).toHaveLength(1);
    expect(applied[0]!.kind).toBe('batch');
  });

  it('delete with nothing selected writes nothing', async () => {
    const { ctrl, applied, invalidate } = setup();
    await ctrl.deleteSelection();
    expect(applied).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('cancel drops the lasso and both drags', () => {
    const { ctrl } = setup({ walls: [wall('w', 10, 10, 14, 10)] });
    ctrl.pointerDown(px(10, 10));
    expect(ctrl.busy).toBe(true);
    ctrl.cancel();
    expect(ctrl.busy).toBe(false);
    ctrl.pointerDown(px(50, 50));
    expect(ctrl.lasso).not.toBeNull();
    ctrl.cancel();
    expect(ctrl.lasso).toBeNull();
  });
});
