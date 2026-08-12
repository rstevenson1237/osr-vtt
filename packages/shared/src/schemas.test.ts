import { describe, expect, it } from 'vitest';
import {
  GameMapSchema,
  MapBackgroundSchema,
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

  it('accepts a managed background colour, an explicit null, or absent (R15/WI-19, v23)', () => {
    expect(() =>
      GameMapSchema.parse({ ...validMap, background: { color: '#5582CA' } }),
    ).not.toThrow();
    expect(() => GameMapSchema.parse({ ...validMap, background: null })).not.toThrow();
    expect(() => GameMapSchema.parse(validMap)).not.toThrow(); // absent → never set
  });

  it('rejects a pre-v23 image ref on the map doc (SPEC-038 §1 — images are their own documents)', () => {
    // `foldLegacyMapBackground` moves such a ref into a `backgrounds` document
    // before anything parses the map doc, so one reaching here is a bug rather
    // than old data — and Zod would otherwise silently drop it on the way *to*
    // Firestore, losing the image without an error.
    expect(() =>
      GameMapSchema.parse({ ...validMap, background: { ref: 'maps/starter-room.svg' } }),
    ).toThrow();
  });

  it('rejects a malformed background color', () => {
    expect(() => GameMapSchema.parse({ ...validMap, background: { color: 'blue' } })).toThrow();
    expect(() => GameMapSchema.parse({ ...validMap, background: { color: '#5582C' } })).toThrow();
  });

  it('carries a battle-map marker through the parse rather than stripping it (SPEC-029 §3, v22)', () => {
    // Zod drops unknown keys, and `gameMapConverter` parses through this schema
    // on the way *to* Firestore as well as back — so a field that is not
    // declared here is not merely unvalidated, it is silently unwritable.
    const battle = { sourceMapId: 'map-1', rect: { minX: 4, minY: 4, maxX: 12, maxY: 10 } };
    expect(GameMapSchema.parse({ ...validMap, id: 'battle-1', battle }).battle).toEqual(battle);
  });

  it('accepts a map with no battle marker — the ordinary, permanent map', () => {
    expect(GameMapSchema.parse(validMap).battle).toBeUndefined();
  });

  describe('MapBackgroundSchema (SPEC-038 §1, v23)', () => {
    const validBackground = {
      id: 'bg-1',
      ref: 'maps/starter-room.svg',
      x: 0,
      y: 0,
      w: 64,
      h: 64,
      order: 0,
    };

    it('accepts a well-formed placed background', () => {
      expect(() => MapBackgroundSchema.parse(validBackground)).not.toThrow();
    });

    it('accepts fractional and negative placement — lattice units as floats (RULE-006)', () => {
      expect(() =>
        MapBackgroundSchema.parse({ ...validBackground, x: -12.5, y: 3.25, w: 0.5, h: 0.25 }),
      ).not.toThrow();
    });

    it('rejects an empty ref, and a zero or negative size', () => {
      expect(() => MapBackgroundSchema.parse({ ...validBackground, ref: '' })).toThrow();
      expect(() => MapBackgroundSchema.parse({ ...validBackground, w: 0 })).toThrow();
      expect(() => MapBackgroundSchema.parse({ ...validBackground, h: -4 })).toThrow();
    });
  });

  it('accepts a rect with negative lattice coordinates (the grid extends both ways)', () => {
    const battle = { sourceMapId: 'map-1', rect: { minX: -6, minY: -2, maxX: 2, maxY: 4 } };
    expect(() => GameMapSchema.parse({ ...validMap, battle })).not.toThrow();
  });

  it('rejects a battle marker with no source map to return to', () => {
    const rect = { minX: 4, minY: 4, maxX: 12, maxY: 10 };
    expect(() => GameMapSchema.parse({ ...validMap, battle: { sourceMapId: '', rect } })).toThrow();
    expect(() => GameMapSchema.parse({ ...validMap, battle: { rect } })).toThrow();
  });

  it('rejects a battle marker with an incomplete rect', () => {
    expect(() =>
      GameMapSchema.parse({
        ...validMap,
        battle: { sourceMapId: 'map-1', rect: { minX: 4, minY: 4, maxX: 12 } },
      }),
    ).toThrow();
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
