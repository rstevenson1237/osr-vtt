import { describe, expect, it } from 'vitest';
import {
  GameMapSchema,
  MapRoomSchema,
  MapSymbolSchema,
  ProfileTemplateFieldSchema,
  RoomSchema,
} from './schemas.js';

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
    handout: null,
    settings: { theme: 'parchment-dark' },
    activeMapId: 'map-1',
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

  it('accepts an absent activeMapId (the brief pre-ensureActiveMap migration window, R17.3)', () => {
    const { activeMapId: _drop, ...bad } = validRoom;
    expect(() => RoomSchema.parse(bad)).not.toThrow();
  });
});

describe('GameMapSchema (Master Plan v2, R17.3 — multiple full map builds per session)', () => {
  const validMap = {
    id: 'map-1',
    name: 'Map 1',
    order: 0,
    createdAt: Date.now(),
    grid: { w: 64, h: 64, cellSize: 70 },
    measure: { perSquare: 10, unit: 'feet' },
    gridSettings: { subdivide: false },
  };

  it('accepts a well-formed map doc', () => {
    expect(() => GameMapSchema.parse(validMap)).not.toThrow();
  });

  it('accepts a managed background — a ref, an explicit null, or absent (R15/WI-19)', () => {
    expect(() =>
      GameMapSchema.parse({ ...validMap, background: { ref: 'maps/starter-room.svg' } }),
    ).not.toThrow();
    expect(() => GameMapSchema.parse({ ...validMap, background: null })).not.toThrow();
    expect(() => GameMapSchema.parse(validMap)).not.toThrow(); // absent → pre-migration fallback
  });

  it('rejects a background object with an empty ref', () => {
    expect(() => GameMapSchema.parse({ ...validMap, background: { ref: '' } })).toThrow();
  });

  it('accepts a solid background color as a #rrggbb hex string (additive, alongside image support)', () => {
    expect(() =>
      GameMapSchema.parse({ ...validMap, background: { color: '#5582CA' } }),
    ).not.toThrow();
  });

  it('rejects a malformed background color', () => {
    expect(() => GameMapSchema.parse({ ...validMap, background: { color: 'blue' } })).toThrow();
    expect(() => GameMapSchema.parse({ ...validMap, background: { color: '#5582C' } })).toThrow();
  });
});

describe('symbol/label authoring schemas (kept from the cellular tool rail — SPEC §2.2)', () => {
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
