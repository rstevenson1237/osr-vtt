import { describe, expect, it, vi } from 'vitest';
import type { CampaignStore, MapRoom } from '@osr-vtt/shared';
import { MapLabels, type MapLabelsDeps } from './map-labels.svelte';

const CELL = 10;
const room = (id: string, x: number, y: number, name = id): MapRoom => ({
  id,
  key: id,
  name,
  bbox: { x: x - 1, y: y - 1, w: 2, h: 2 },
  labelAnchor: { x, y },
  wallStyle: 'masonry',
});

function setup(
  over: {
    rooms?: MapRoom[];
    notes?: Record<string, string>;
    coarse?: boolean;
    busy?: boolean;
  } = {},
) {
  const state = {
    rooms: over.rooms ?? [room('a', 2, 3), room('b', 8, 8)],
    notes: over.notes ?? { a: 'about a' },
    coarse: over.coarse ?? false,
    busy: over.busy ?? false,
  };
  const invalidate = vi.fn();
  const upsertMapRoom = vi.fn(async () => {});
  const deps: MapLabelsDeps = {
    invalidate,
    store: { upsertMapRoom } as unknown as CampaignStore,
    roomId: 'r',
    mapId: 'm',
    toLatticeRaw: (w) => ({ x: w.x / CELL, y: w.y / CELL }),
    mapRooms: () => state.rooms,
    noteText: (id) => state.notes[id] ?? '',
    isCoarsePointer: () => state.coarse,
    cellSize: () => CELL,
    pickThreshold: () => 0.5,
    isBusy: () => state.busy,
    snapCell: (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) }),
    snapCellSize: () => 1,
    toScreen: (p) => ({ x: p.x + 100, y: p.y + 200 }),
  };
  return { labels: new MapLabels(deps), state, invalidate, upsertMapRoom };
}

/** World pixels for the middle of a label's cell. */
const inCell = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });
/** World pixels on a note dot — the midpoint of the cell's top edge. */
const onDot = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: y * CELL });

describe('MapLabels hover tooltip', () => {
  it('shows the noted label under a fine pointer, anchored on the cell centre', () => {
    const { labels } = setup();
    expect(labels.pointerMove(inCell(2, 3))).toBe(false);
    expect(labels.hover).toEqual({ id: 'a', x: 2.5 * CELL + 100, y: 3.5 * CELL + 200 });
    expect(labels.tooltip).toEqual({ x: labels.hover!.x, y: labels.hover!.y, text: 'about a' });
  });

  it('shows nothing for a label with no notes', () => {
    const { labels } = setup();
    labels.pointerMove(inCell(8, 8));
    expect(labels.hover?.id).toBe('b');
    expect(labels.tooltip).toBeNull();
  });

  it('clears when the pointer leaves the label, the stage, or is busy', () => {
    const { labels, state } = setup();
    labels.pointerMove(inCell(2, 3));
    labels.pointerMove({ x: 500, y: 500 });
    expect(labels.hover).toBeNull();
    labels.pointerMove(inCell(2, 3));
    labels.pointerOut();
    expect(labels.hover).toBeNull();
    labels.pointerMove(inCell(2, 3));
    state.busy = true;
    labels.pointerMove(inCell(2, 3));
    expect(labels.hover).toBeNull();
  });

  it('ignores hover on a coarse pointer', () => {
    const { labels } = setup({ coarse: true });
    labels.pointerMove(inCell(2, 3));
    expect(labels.hover).toBeNull();
  });

  it('is hidden while that label is being renamed', () => {
    const { labels } = setup();
    labels.pointerMove(inCell(2, 3));
    expect(labels.tooltip).not.toBeNull();
    labels.open('a', { x: 2, y: 3 });
    expect(labels.tooltip).toBeNull();
  });
});

describe('MapLabels note dot', () => {
  it('draws a dot only on a coarse pointer, only for noted rooms', () => {
    expect([...setup({ coarse: true }).labels.noteDotRoomIds]).toEqual(['a']);
    expect(setup({ coarse: false }).labels.noteDotRoomIds.size).toBe(0);
  });

  it('a tap on the dot pins the tooltip and consumes the tap; a second tap closes it', () => {
    const { labels } = setup({ coarse: true });
    expect(labels.pointerDown(onDot(2, 3))).toBe(true);
    expect(labels.pinned?.id).toBe('a');
    expect(labels.tooltip?.text).toBe('about a');
    expect(labels.pointerDown(onDot(2, 3))).toBe(true);
    expect(labels.pinned).toBeNull();
  });

  it('a tap elsewhere dismisses the pin but is left for the tool', () => {
    const { labels } = setup({ coarse: true });
    labels.pointerDown(onDot(2, 3));
    expect(labels.pointerDown({ x: 500, y: 500 })).toBe(false);
    expect(labels.pinned).toBeNull();
  });

  it('never consumes a tap on a fine pointer', () => {
    const { labels } = setup();
    expect(labels.pointerDown(onDot(2, 3))).toBe(false);
  });

  it('pinned wins over hover, and opening the editor dismisses the pin', () => {
    const { labels } = setup({ coarse: true });
    labels.hover = { id: 'b', x: 0, y: 0 };
    labels.pointerDown(onDot(2, 3));
    expect(labels.active?.id).toBe('a');
    labels.open('a', { x: 2, y: 3 });
    expect(labels.pinned).toBeNull();
  });

  it('dismissTooltips drops both', () => {
    const { labels } = setup();
    labels.hover = { id: 'a', x: 0, y: 0 };
    labels.pinned = { id: 'a', x: 0, y: 0 };
    labels.dismissTooltips();
    expect(labels.hover).toBeNull();
    expect(labels.pinned).toBeNull();
  });
});

describe('MapLabels editor', () => {
  it('sizes the editor font at half a cell with a 9px floor', () => {
    expect(setup().labels.fontPx).toBe(9);
  });

  it('opens on the cell interior, seeded with the current name', () => {
    const { labels } = setup({ rooms: [room('a', 2, 3, 'Hall')] });
    labels.open('a', { x: 2, y: 3 });
    expect(labels.editingId).toBe('a');
    expect(labels.editingText).toBe('Hall');
    expect(labels.editingPos).toEqual({ x: 2.5 * CELL + 100, y: 3.5 * CELL + 200 });
  });

  it('the Label tool renames the label under the click', async () => {
    const { labels, upsertMapRoom } = setup();
    labels.toolClick(inCell(2, 3));
    expect(labels.editingId).toBe('a');
    labels.editingText = '  Crypt ';
    await labels.commit();
    expect(labels.editingId).toBeNull();
    expect(upsertMapRoom).toHaveBeenCalledWith('r', 'm', { ...room('a', 2, 3), name: 'Crypt' });
  });

  it('the Label tool on open floor creates a keyed room on commit', async () => {
    const { labels, upsertMapRoom } = setup();
    labels.toolClick({ x: 55, y: 66 });
    const id = labels.editingId!;
    expect(id).toMatch(/^room-/);
    labels.editingText = 'Vault';
    await labels.commit();
    expect(upsertMapRoom).toHaveBeenCalledWith('r', 'm', {
      id,
      key: '3',
      name: 'Vault',
      bbox: { x: 4, y: 5, w: 2, h: 2 },
      labelAnchor: { x: 5, y: 6 },
      wallStyle: 'masonry',
    });
  });

  it('an empty name on a new label is a cancel', async () => {
    const { labels, upsertMapRoom } = setup();
    labels.toolClick({ x: 55, y: 66 });
    labels.editingText = '   ';
    await labels.commit();
    expect(upsertMapRoom).not.toHaveBeenCalled();
    expect(labels.editingId).toBeNull();
  });

  it('Enter and Tab commit, Shift+Enter does not, Escape cancels', () => {
    const { labels, upsertMapRoom } = setup();
    const key = (k: string, shiftKey = false) => {
      const preventDefault = vi.fn();
      labels.keydown({ key: k, shiftKey, preventDefault } as unknown as KeyboardEvent);
      return preventDefault;
    };
    labels.open('a', { x: 2, y: 3 });
    expect(key('Enter', true)).not.toHaveBeenCalled();
    expect(labels.editingId).toBe('a');
    expect(key('Escape')).toHaveBeenCalled();
    expect(labels.editingId).toBeNull();
    labels.open('a', { x: 2, y: 3 });
    key('Tab');
    expect(labels.editingId).toBeNull();
    expect(upsertMapRoom).toHaveBeenCalledTimes(1);
  });
});

describe('MapLabels and the renderer', () => {
  it('never calls invalidate: its fields are $state the layer effects track', () => {
    const { labels, invalidate } = setup({ coarse: true });
    labels.pointerDown(onDot(2, 3));
    labels.open('a', { x: 2, y: 3 });
    labels.cancel();
    labels.dismissTooltips();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
