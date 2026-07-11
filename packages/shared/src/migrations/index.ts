import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FOG_CONFIG,
  DEFAULT_GRID_CONFIG,
  DEFAULT_HANDOUT,
} from '../types.js';

/**
 * schemaVersion + migrations scaffold (Plan §5, §8.10).
 *
 * `rooms/{roomId}.schemaVersion` records which shape a room doc is in.
 * A migration is a pure function that takes a room-doc-shaped object one
 * version forward. `migrateRoom` walks a doc forward from its stored version
 * to `CURRENT_SCHEMA_VERSION`, applying each migration in turn, so an
 * imported/loaded `.vttcamp` room (Plan §5) or an emulator-seeded doc from an
 * older build never gets silently misread.
 *
 * There are no real migrations yet (schema v1 is the first shape) — this
 * file exists so schema drift never orphans a saved campaign later. Add a
 * new entry to `migrations` every time CURRENT_SCHEMA_VERSION is bumped.
 */

export interface Migration {
  from: number;
  to: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

export const migrations: Migration[] = [
  // v1 -> v2 (Phase 1, Map Tooling Spec §7): rooms gain `grid` + `fog`. Any
  // v1 room predates the cellular map model, so it gets the same defaults a
  // freshly created room would (Plan §11: square grid only, emergent fog).
  {
    from: 1,
    to: 2,
    migrate: (data) => ({
      ...data,
      grid: data['grid'] ?? DEFAULT_GRID_CONFIG,
      fog: data['fog'] ?? DEFAULT_FOG_CONFIG,
    }),
  },
  // v2 -> v3 (Phase 5, Plan §7): rooms gain `handout`, the "reveal image to
  // players" pointer. A v2 room predates handouts, so nothing is revealed —
  // same default a freshly created room would seed.
  {
    from: 2,
    to: 3,
    migrate: (data) => ({
      ...data,
      handout: data['handout'] ?? DEFAULT_HANDOUT,
    }),
  },
];

export class MigrationError extends Error {
  constructor(fromVersion: number) {
    super(`No migration registered starting from schemaVersion ${fromVersion}`);
    this.name = 'MigrationError';
  }
}

/** Migrate a raw room-doc-shaped object forward to CURRENT_SCHEMA_VERSION. */
export function migrateRoom(
  input: Record<string, unknown>,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  let data = input;
  let version = Number(data['schemaVersion'] ?? 0);

  while (version < targetVersion) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      throw new MigrationError(version);
    }
    data = { ...step.migrate(data), schemaVersion: step.to };
    version = step.to;
  }

  return data;
}
