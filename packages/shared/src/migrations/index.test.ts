import { describe, expect, it } from 'vitest';
import { migrateRoom, MigrationError, type Migration } from './index.js';

describe('migrateRoom', () => {
  it('is a no-op when already at the target version', () => {
    const data = { schemaVersion: 1, name: 'Room' };
    expect(migrateRoom(data, 1)).toEqual(data);
  });

  it('applies a registered migration forward, step by step', () => {
    // Exercises the scaffold with a synthetic v0 -> v1 migration, proving
    // schema drift never orphans a saved campaign (Plan §5) even though the
    // real migrations list is still empty at CURRENT_SCHEMA_VERSION = 1.
    const fakeMigrations: Migration[] = [
      {
        from: 0,
        to: 1,
        migrate: (data) => ({ ...data, difficultyDie: data['difficultyDie'] ?? 'd6' }),
      },
    ];
    const legacyRoom = { schemaVersion: 0, name: 'Old Room' };

    let version = 0;
    let data: Record<string, unknown> = legacyRoom;
    while (version < 1) {
      const step = fakeMigrations.find((m) => m.from === version);
      if (!step) throw new Error('missing test migration');
      data = { ...step.migrate(data), schemaVersion: step.to };
      version = step.to;
    }

    expect(data).toEqual({ schemaVersion: 1, name: 'Old Room', difficultyDie: 'd6' });
  });

  it('throws MigrationError when no migration bridges the gap', () => {
    const data = { schemaVersion: 0, name: 'Orphaned' };
    expect(() => migrateRoom(data, 1)).toThrow(MigrationError);
  });

  it('v1 -> v2 backfills grid + fog defaults on a pre-Phase-1 room (Spec §7)', () => {
    const v1Room = { schemaVersion: 1, name: 'Legacy Dungeon' };
    const migrated = migrateRoom(v1Room, 2);
    expect(migrated['schemaVersion']).toBe(2);
    expect(migrated['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(migrated['fog']).toEqual({ mode: 'emergent' });
  });

  it('v1 -> v2 preserves an already-present grid/fog rather than overwriting it', () => {
    const v1Room = {
      schemaVersion: 1,
      name: 'Custom',
      grid: { w: 20, h: 20, cellSize: 50 },
      fog: { mode: 'manual' },
    };
    const migrated = migrateRoom(v1Room, 2);
    expect(migrated['grid']).toEqual({ w: 20, h: 20, cellSize: 50 });
    expect(migrated['fog']).toEqual({ mode: 'manual' });
  });

  it('v2 -> v3 backfills a null handout on a pre-Phase-5 room (Plan §7)', () => {
    const v2Room = {
      schemaVersion: 2,
      name: 'Pre-handout Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
    };
    const migrated = migrateRoom(v2Room, 3);
    expect(migrated['schemaVersion']).toBe(3);
    expect(migrated['handout']).toBeNull();
  });

  it('v3 -> v4 backfills default settings.theme on a pre-shell room (Master Plan v2, R2)', () => {
    const v3Room = {
      schemaVersion: 3,
      name: 'Pre-theme Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
    };
    const migrated = migrateRoom(v3Room, 4);
    expect(migrated['schemaVersion']).toBe(4);
    expect(migrated['settings']).toEqual({ theme: 'parchment-dark' });
  });

  it('v3 -> v4 preserves an already-present settings object rather than overwriting it', () => {
    const v3Room = {
      schemaVersion: 3,
      name: 'Custom-themed',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue' },
    };
    const migrated = migrateRoom(v3Room, 4);
    expect(migrated['settings']).toEqual({ theme: 'keyed-blue' });
  });

  it('v4 -> v5 backfills default settings.measure (10/feet) on a pre-R9.3 room (Master Plan v2)', () => {
    const v4Room = {
      schemaVersion: 4,
      name: 'Pre-measurement Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue' },
    };
    const migrated = migrateRoom(v4Room, 5);
    expect(migrated['schemaVersion']).toBe(5);
    expect(migrated['settings']).toEqual({ theme: 'keyed-blue', measure: { perSquare: 10, unit: 'feet' } });
  });

  it('v4 -> v5 preserves an already-present measure rather than overwriting it', () => {
    const v4Room = {
      schemaVersion: 4,
      name: 'Custom-measured',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue', measure: { perSquare: 3, unit: 'meters' } },
    };
    const migrated = migrateRoom(v4Room, 5);
    expect(migrated['settings']).toEqual({ theme: 'keyed-blue', measure: { perSquare: 3, unit: 'meters' } });
  });

  it('v5 -> v6 backfills default settings.grid (subdivide off) on a pre-R9.6 room (Master Plan v2)', () => {
    const v5Room = {
      schemaVersion: 5,
      name: 'Pre-half-grid Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue', measure: { perSquare: 3, unit: 'meters' } },
    };
    const migrated = migrateRoom(v5Room, 6);
    expect(migrated['schemaVersion']).toBe(6);
    expect(migrated['settings']).toEqual({
      theme: 'keyed-blue',
      measure: { perSquare: 3, unit: 'meters' },
      grid: { subdivide: false },
    });
  });

  it('v5 -> v6 preserves an already-present grid subdivision setting', () => {
    const v5Room = {
      schemaVersion: 5,
      name: 'Subdivided',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue', measure: { perSquare: 10, unit: 'feet' }, grid: { subdivide: true } },
    };
    const migrated = migrateRoom(v5Room, 6);
    expect(migrated['settings']).toEqual({
      theme: 'keyed-blue',
      measure: { perSquare: 10, unit: 'feet' },
      grid: { subdivide: true },
    });
  });

  it('v6 -> v7 backfills pinned: false on every profileTemplate field (Master Plan v2, R8.1)', () => {
    const v6Room = {
      schemaVersion: 6,
      name: 'Pre-pinned Room',
      profileTemplate: [
        { id: 'hp', label: 'HP', type: 'number' },
        { id: 'ac', label: 'AC', type: 'number', default: 10 },
      ],
    };
    const migrated = migrateRoom(v6Room, 7);
    expect(migrated['schemaVersion']).toBe(7);
    expect(migrated['profileTemplate']).toEqual([
      { id: 'hp', label: 'HP', type: 'number', pinned: false },
      { id: 'ac', label: 'AC', type: 'number', default: 10, pinned: false },
    ]);
  });

  it('v6 -> v7 preserves an already-pinned field rather than overwriting it', () => {
    const v6Room = {
      schemaVersion: 6,
      name: 'Half-pinned Room',
      profileTemplate: [
        { id: 'hp', label: 'HP', type: 'number', pinned: true },
        { id: 'notes', label: 'Notes', type: 'longtext' },
      ],
    };
    const migrated = migrateRoom(v6Room, 7);
    expect(migrated['profileTemplate']).toEqual([
      { id: 'hp', label: 'HP', type: 'number', pinned: true },
      { id: 'notes', label: 'Notes', type: 'longtext', pinned: false },
    ]);
  });

  it('v6 -> v7 tolerates a room with no profileTemplate array', () => {
    const migrated = migrateRoom({ schemaVersion: 6, name: 'Bare' }, 7);
    expect(migrated['schemaVersion']).toBe(7);
    expect(migrated['profileTemplate']).toEqual([]);
  });

  it('v7 -> v8 is a documentation-only bump (widened WallStyle) that leaves the doc otherwise unchanged (R10.2)', () => {
    const v7Room = {
      schemaVersion: 7,
      name: 'Pre-R10 Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue', measure: { perSquare: 10, unit: 'feet' }, grid: { subdivide: false } },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v7Room, 8);
    expect(migrated['schemaVersion']).toBe(8);
    expect({ ...migrated, schemaVersion: 7 }).toEqual(v7Room);
  });

  it('v8 -> v9 is a documentation-only bump (typed door model) that leaves the doc otherwise unchanged (R11.1)', () => {
    const v8Room = {
      schemaVersion: 8,
      name: 'Pre-R11 Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: { theme: 'keyed-blue', measure: { perSquare: 10, unit: 'feet' }, grid: { subdivide: false } },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v8Room, 9);
    expect(migrated['schemaVersion']).toBe(9);
    expect({ ...migrated, schemaVersion: 8 }).toEqual(v8Room);
  });

  it('walks a v1 room all the way forward to CURRENT_SCHEMA_VERSION (9) — the .vttcamp import path', () => {
    const v1Room = { schemaVersion: 1, name: 'Ancient Export' };
    const migrated = migrateRoom(v1Room);
    expect(migrated['schemaVersion']).toBe(9);
    expect(migrated['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(migrated['fog']).toEqual({ mode: 'emergent' });
    expect(migrated['handout']).toBeNull();
    expect(migrated['settings']).toEqual({
      theme: 'parchment-dark',
      measure: { perSquare: 10, unit: 'feet' },
      grid: { subdivide: false },
    });
    // A v1 room has no profileTemplate at all — the v6->v7 step maps over an
    // empty array, so it stays empty rather than erroring.
    expect(migrated['profileTemplate']).toEqual([]);
  });
});
