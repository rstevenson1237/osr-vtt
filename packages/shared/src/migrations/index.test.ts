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
});
