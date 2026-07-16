import { describe, expect, it } from 'vitest';
import {
  FloorChunkSchema,
  MapDoorSchema,
  MapRoomSchema,
  MapSymbolSchema,
  MapWallSchema,
  ProfileTemplateFieldSchema,
  RoomSchema,
} from './schemas.js';
import { WORDS_PER_CHUNK } from './map/grid.js';

describe('RoomSchema', () => {
  const validRoom = {
    id: 'room1',
    name: 'Test Room',
    gmUid: 'uid-gm',
    schemaVersion: 1,
    difficultyDie: 'd6',
    dangerDie: 'd6',
    createdAt: Date.now(),
    profileTemplate: [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'torches', label: 'Torches', type: 'counter', default: 3 },
      { id: 'combat', label: 'Combat', type: 'roll', default: 'd6' },
    ],
    grid: { w: 64, h: 64, cellSize: 70 },
    fog: { mode: 'emergent' },
    handout: null,
    settings: { theme: 'parchment-dark', measure: { perSquare: 10, unit: 'feet' }, grid: { subdivide: false } },
  };

  it('accepts a well-formed room doc', () => {
    expect(() => RoomSchema.parse(validRoom)).not.toThrow();
  });

  it('rejects an unknown profile field type', () => {
    const bad = {
      ...validRoom,
      profileTemplate: [{ id: 'x', label: 'X', type: 'formula' }],
    };
    expect(() => RoomSchema.parse(bad)).toThrow();
  });

  it('rejects a missing gmUid', () => {
    const { gmUid: _drop, ...bad } = validRoom;
    expect(() => RoomSchema.parse(bad)).toThrow();
  });

  it('accepts a managed background — a ref, an explicit null, or absent (R15/WI-19)', () => {
    expect(() => RoomSchema.parse({ ...validRoom, background: { ref: 'maps/starter-room.svg' } })).not.toThrow();
    expect(() => RoomSchema.parse({ ...validRoom, background: null })).not.toThrow();
    expect(() => RoomSchema.parse(validRoom)).not.toThrow(); // absent → pre-migration fallback
  });

  it('rejects a background object with an empty ref', () => {
    expect(() => RoomSchema.parse({ ...validRoom, background: { ref: '' } })).toThrow();
  });
});

describe('cellular map schemas (Map Tooling Spec §7)', () => {
  it('accepts a well-formed floor chunk with the right bit-word count', () => {
    const bits = new Array(WORDS_PER_CHUNK).fill(0);
    expect(() => FloorChunkSchema.parse({ id: '0_0', bits })).not.toThrow();
  });

  it('rejects a floor chunk with the wrong bit-word count', () => {
    expect(() => FloorChunkSchema.parse({ id: '0_0', bits: [0, 0] })).toThrow();
  });

  it('accepts an explicit wall with a typed door (R11.1)', () => {
    expect(() =>
      MapWallSchema.parse({
        id: '0,0,N',
        x: 0,
        y: 0,
        side: 'N',
        door: { type: 'secret', state: 'closed' },
      }),
    ).not.toThrow();
    // A one-way door carries an optional facing.
    expect(() =>
      MapWallSchema.parse({
        id: '1,0,N',
        x: 1,
        y: 0,
        side: 'N',
        door: { type: 'oneWay', state: 'open', facing: 'ab' },
      }),
    ).not.toThrow();
  });

  it('accepts a wall with no door', () => {
    expect(() => MapWallSchema.parse({ id: '0,0,N', x: 0, y: 0, side: 'N' })).not.toThrow();
  });

  it('migrates a pre-R11 door shape on read: secret:true -> type:secret', () => {
    expect(MapDoorSchema.parse({ state: 'closed', secret: true })).toEqual({
      type: 'secret',
      state: 'closed',
    });
  });

  it('migrates a pre-R11 door shape on read: secret:false -> type:single', () => {
    expect(MapDoorSchema.parse({ state: 'open', secret: false })).toEqual({
      type: 'single',
      state: 'open',
    });
  });

  it('passes a new-shape door through untouched', () => {
    const door = { type: 'double', state: 'closed' as const };
    expect(MapDoorSchema.parse(door)).toEqual(door);
  });

  it('rejects an unknown door type', () => {
    expect(() => MapDoorSchema.parse({ type: 'portal', state: 'open' })).toThrow();
  });

  it('rejects an unknown edge side', () => {
    expect(() => MapWallSchema.parse({ id: '0,0,NE', x: 0, y: 0, side: 'NE' })).toThrow();
  });

  it('accepts any non-empty string as a symbol kind (extensible palette)', () => {
    expect(() =>
      MapSymbolSchema.parse({ id: 's1', cell: { x: 1, y: 2 }, kind: 'stairs-down', rotation: 0 }),
    ).not.toThrow();
    expect(() =>
      MapSymbolSchema.parse({ id: 's2', cell: { x: 1, y: 2 }, kind: 'custom-icon', rotation: 90 }),
    ).not.toThrow();
  });

  it('accepts a keyed map room with a wall style', () => {
    expect(() =>
      MapRoomSchema.parse({
        id: 'r1',
        key: '1',
        name: 'Entry Hall',
        bbox: { x: 0, y: 0, w: 5, h: 5 },
        labelAnchor: { x: 2, y: 2 },
        wallStyle: 'masonry',
      }),
    ).not.toThrow();
  });
});

describe('ProfileTemplateFieldSchema', () => {
  it('accepts every field type from the fixed set (Plan §2.5)', () => {
    const types = ['text', 'longtext', 'number', 'counter', 'checkbox', 'roll'];
    for (const type of types) {
      expect(() => ProfileTemplateFieldSchema.parse({ id: 'f', label: 'F', type })).not.toThrow();
    }
  });
});
