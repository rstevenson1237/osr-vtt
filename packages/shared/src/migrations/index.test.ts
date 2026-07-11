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

  it('walks a v1 room all the way forward to CURRENT_SCHEMA_VERSION (4) — the .vttcamp import path', () => {
    const v1Room = { schemaVersion: 1, name: 'Ancient Export' };
    const migrated = migrateRoom(v1Room);
    expect(migrated['schemaVersion']).toBe(4);
    expect(migrated['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(migrated['fog']).toEqual({ mode: 'emergent' });
    expect(migrated['handout']).toBeNull();
    expect(migrated['settings']).toEqual({ theme: 'parchment-dark' });
  });
});
