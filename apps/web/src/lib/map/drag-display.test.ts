import { describe, expect, it } from 'vitest';
import type {
  Drawing,
  MapRoom,
  MapSymbol,
  StoredVectorWall,
  VectorDoor,
  VectorFloorRegion,
} from '@osr-vtt/shared';
import {
  annotationsWithLiveStroke,
  displayOverlayState,
  displayState,
  objectHighlightBBox,
} from './drag-display';

const region = (id: string) => ({ id }) as unknown as VectorFloorRegion;
const wall = (id: string) => ({ id }) as unknown as StoredVectorWall;
const door = (id: string) => ({ id }) as unknown as VectorDoor;
const symbol = (id: string) => ({ id }) as unknown as MapSymbol;
const room = (id: string, x = 0, y = 0) => ({ id, labelAnchor: { x, y } }) as unknown as MapRoom;
const drawing = (id: string) => ({ id }) as unknown as Drawing;

describe('displayState', () => {
  const regions = [region('r1'), region('r2')];
  const walls = [wall('w1'), wall('w2')];
  const doors = [door('d1'), door('d2')];

  it('returns the stored arrays untouched when nothing is dragging', () => {
    const out = displayState(null, regions, walls, doors);
    expect(out.regions).toBe(regions);
    expect(out.walls).toBe(walls);
    expect(out.doors).toBe(doors);
  });

  it('swaps only the dragged region for its working copy', () => {
    const working = { id: 'r2', moved: true } as unknown as VectorFloorRegion;
    const out = displayState(
      { owner: { kind: 'region', id: 'r2' }, working },
      regions,
      walls,
      doors,
    );
    expect(out.regions).toEqual([regions[0], working]);
    expect(out.regions[1]).toBe(working);
    expect(out.walls).toBe(walls);
    expect(out.doors).toBe(doors);
    expect(regions[1]).not.toBe(working); // the subscribed array is not mutated
  });

  it('swaps only the dragged wall', () => {
    const working = { id: 'w1', moved: true } as unknown as StoredVectorWall;
    const out = displayState({ owner: { kind: 'wall', id: 'w1' }, working }, regions, walls, doors);
    expect(out.walls[0]).toBe(working);
    expect(out.walls[1]).toBe(walls[1]);
    expect(out.regions).toBe(regions);
    expect(out.doors).toBe(doors);
  });

  it('swaps only the dragged door', () => {
    const working = { id: 'd2', moved: true } as unknown as VectorDoor;
    const out = displayState({ owner: { kind: 'door', id: 'd2' }, working }, regions, walls, doors);
    expect(out.doors[1]).toBe(working);
    expect(out.doors[0]).toBe(doors[0]);
    expect(out.regions).toBe(regions);
    expect(out.walls).toBe(walls);
  });
});

describe('displayOverlayState', () => {
  const symbols = [symbol('s1'), symbol('s2')];
  const mapRooms = [room('m1'), room('m2')];
  const drawings = [drawing('a1'), drawing('a2')];

  it('returns the stored arrays untouched when nothing is dragging', () => {
    const out = displayOverlayState(null, symbols, mapRooms, drawings);
    expect(out.symbols).toBe(symbols);
    expect(out.mapRooms).toBe(mapRooms);
    expect(out.drawings).toBe(drawings);
  });

  it('swaps a dragged symbol', () => {
    const working = { id: 's1', moved: true } as unknown as MapSymbol;
    const out = displayOverlayState(
      { selection: { kind: 'symbol', id: 's1' }, working },
      symbols,
      mapRooms,
      drawings,
    );
    expect(out.symbols).toEqual([working, symbols[1]]);
    expect(out.mapRooms).toBe(mapRooms);
    expect(out.drawings).toBe(drawings);
  });

  it('swaps a dragged label', () => {
    const working = room('m2', 5, 5);
    const out = displayOverlayState(
      { selection: { kind: 'mapRoom', id: 'm2' }, working },
      symbols,
      mapRooms,
      drawings,
    );
    expect(out.mapRooms[1]).toBe(working);
    expect(out.mapRooms[0]).toBe(mapRooms[0]);
    expect(out.symbols).toBe(symbols);
  });

  it('treats any other selection kind as a drawing', () => {
    const working = { id: 'a2', moved: true } as unknown as Drawing;
    const out = displayOverlayState(
      { selection: { kind: 'drawing', id: 'a2' }, working },
      symbols,
      mapRooms,
      drawings,
    );
    expect(out.drawings[1]).toBe(working);
    expect(out.drawings[0]).toBe(drawings[0]);
    expect(out.symbols).toBe(symbols);
    expect(out.mapRooms).toBe(mapRooms);
  });
});

describe('annotationsWithLiveStroke', () => {
  const source = [drawing('a1')];
  const pts = [
    { x: 0, y: 0 },
    { x: 4, y: 4 },
  ];

  it('returns the source array itself unless the pen has a stroke of two points', () => {
    expect(annotationsWithLiveStroke(source, 'select', pts)).toBe(source);
    expect(annotationsWithLiveStroke(source, 'pen', [pts[0]!])).toBe(source);
    expect(annotationsWithLiveStroke(source, 'pen', [])).toBe(source);
  });

  it('appends the in-progress stroke as a __live__ freehand', () => {
    const out = annotationsWithLiveStroke(source, 'pen', pts);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(source[0]);
    expect(out[1]).toEqual({
      id: '__live__',
      layer: 'mapping',
      kind: 'freehand',
      points: pts,
      style: {},
    });
    expect(source).toHaveLength(1);
  });
});

describe('objectHighlightBBox', () => {
  const disp = { symbols: [], mapRooms: [room('m1', 3, 4)], drawings: [] };

  it('boxes a label by the snap step, from its anchor', () => {
    expect(objectHighlightBBox({ kind: 'mapRoom', id: 'm1' }, disp, [], 50, 0.5)).toEqual({
      a: { x: 3, y: 4 },
      b: { x: 3.5, y: 4.5 },
    });
  });

  it('is null for a label that no longer exists', () => {
    expect(objectHighlightBBox({ kind: 'mapRoom', id: 'gone' }, disp, [], 50, 1)).toBeNull();
  });

  it('is null for a symbol that no longer exists (delegates to objectBounds)', () => {
    expect(objectHighlightBBox({ kind: 'symbol', id: 'gone' }, disp, [], 50, 1)).toBeNull();
  });
});
