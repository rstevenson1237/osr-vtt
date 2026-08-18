import { CURRENT_SCHEMA_VERSION, DEFAULT_ROLL_CONVENTIONS } from '../types.js';
import { describe, expect, it } from 'vitest';
import { isRoomDormant } from '../store/campaign-store.js';
import {
  foldLegacyMapBackground,
  lockLegacyBackground,
  LEGACY_ENCOUNTER_TEMPLATE_V14,
  migrateProfile,
  migrateRoom,
  MigrationError,
  type Migration,
} from './index.js';
import { assignedCharacterColor } from '../character-color.js';
import { CHARACTER_COLOR_PALETTE } from '../store/asset-store.js';

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

  it('v1 -> v2 backfills grid defaults on a pre-Phase-1 room (Spec §7)', () => {
    // Fog was removed in the vector cutover (SPEC §4); v1 -> v2 now only
    // backfills `grid`.
    const v1Room = { schemaVersion: 1, name: 'Legacy Dungeon' };
    const migrated = migrateRoom(v1Room, 2);
    expect(migrated['schemaVersion']).toBe(2);
    expect(migrated['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(migrated['fog']).toBeUndefined();
  });

  it('v1 -> v2 preserves an already-present grid rather than overwriting it', () => {
    const v1Room = {
      schemaVersion: 1,
      name: 'Custom',
      grid: { w: 20, h: 20, cellSize: 50 },
    };
    const migrated = migrateRoom(v1Room, 2);
    expect(migrated['grid']).toEqual({ w: 20, h: 20, cellSize: 50 });
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
    expect(migrated['settings']).toEqual({
      theme: 'keyed-blue',
      measure: { perSquare: 10, unit: 'feet' },
    });
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
    expect(migrated['settings']).toEqual({
      theme: 'keyed-blue',
      measure: { perSquare: 3, unit: 'meters' },
    });
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
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: true },
      },
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
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
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
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v8Room, 9);
    expect(migrated['schemaVersion']).toBe(9);
    expect({ ...migrated, schemaVersion: 8 }).toEqual(v8Room);
  });

  it('v9 -> v10 backfills the managed background with the starter ref (R15/WI-19)', () => {
    const v9Room = {
      schemaVersion: 9,
      name: 'Pre-R15 Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v9Room, 10);
    expect(migrated['schemaVersion']).toBe(10);
    expect(migrated['background']).toEqual(null); // WI-073: no default background
    // Everything else is untouched.
    expect({ ...migrated, schemaVersion: 9, background: undefined }).toEqual({
      ...v9Room,
      background: undefined,
    });
  });

  it('v9 -> v10 preserves an already-set background, including an explicit null (cleared)', () => {
    const cleared = migrateRoom({ schemaVersion: 9, name: 'Bare Rock', background: null }, 10);
    expect(cleared['background']).toBeNull();
    const custom = migrateRoom(
      { schemaVersion: 9, name: 'Custom', background: { ref: 'https://x/y.png' } },
      10,
    );
    expect(custom['background']).toEqual({ ref: 'https://x/y.png' });
  });

  it('v10 -> v11 is a documentation-only bump (multi-map, R17.3) that leaves the doc otherwise unchanged', () => {
    // The real per-room adoption (moving grid/fog/background/settings.measure/
    // settings.grid onto a fresh `GameMap` and setting `activeMapId`) is a
    // real data move a pure room-doc transform can't perform — that's
    // `CampaignStore.ensureActiveMap`'s job (see its own tests), called once
    // by the GM's client. This step only records the version.
    const v10Room = {
      schemaVersion: 10,
      name: 'Pre-R17 Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: null,
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
      background: { ref: 'maps/starter-room.svg' },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v10Room, 11);
    expect(migrated['schemaVersion']).toBe(11);
    expect({ ...migrated, schemaVersion: 10 }).toEqual(v10Room);
  });

  it('v11 -> v12 is a documentation-only bump (MapSymbol.cellSpan) that leaves the doc otherwise unchanged', () => {
    // The real default (1x1 when `cellSpan` is absent) lives at the schema
    // read boundary (`MapSymbolSchema`), not on the room doc — symbols are a
    // subcollection, so there's nothing here to backfill.
    const v11Room = {
      schemaVersion: 11,
      name: 'Pre-cellSpan Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      handout: null,
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
      background: { ref: 'maps/starter-room.svg' },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v11Room, 12);
    expect(migrated['schemaVersion']).toBe(12);
    expect({ ...migrated, schemaVersion: 11 }).toEqual(v11Room);
  });

  it('v12 -> v13 is a documentation-only bump (Token/ProfileInstance color) that leaves the doc otherwise unchanged', () => {
    // The real default (absent = no custom color; dice fall back to the
    // `--dice-face` neutral, tokens to the gen-disc fill) lives at the schema
    // read boundary — tokens and profiles are subcollections, so there's
    // nothing here to backfill.
    const v12Room = {
      schemaVersion: 12,
      name: 'Pre-color Room',
      grid: { w: 64, h: 64, cellSize: 70 },
      handout: null,
      settings: {
        theme: 'keyed-blue',
        measure: { perSquare: 10, unit: 'feet' },
        grid: { subdivide: false },
      },
      background: { ref: 'maps/starter-room.svg' },
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number', pinned: false }],
    };
    const migrated = migrateRoom(v12Room, 13);
    expect(migrated['schemaVersion']).toBe(13);
    expect({ ...migrated, schemaVersion: 12 }).toEqual(v12Room);
  });

  it('v13 -> v14 seeds the default `encounterTemplate`, keeping any existing one', () => {
    const v13Room = {
      schemaVersion: 13,
      name: 'Pre-encounter-template Room',
      profileTemplate: [{ id: 'hp', label: 'HP', type: 'number' }],
    };
    const migrated = migrateRoom(v13Room, 14);
    expect(migrated['schemaVersion']).toBe(14);
    // The old hardcoded tension widgets, now ordinary editable fields —
    // frozen independently of the live `DEFAULT_ENCOUNTER_TEMPLATE` (DEC-065).
    expect(migrated['encounterTemplate']).toEqual(LEGACY_ENCOUNTER_TEMPLATE_V14);
    expect(migrated['profileTemplate']).toEqual(v13Room.profileTemplate);

    const withTemplate = migrateRoom(
      { ...v13Room, encounterTemplate: [{ id: 'light', label: 'Light', type: 'counter' }] },
      14,
    );
    expect(withTemplate['encounterTemplate']).toEqual([
      { id: 'light', label: 'Light', type: 'counter' },
    ]);
  });

  it('v14 -> v15 (fog of war) touches no room-doc field', () => {
    // Fog is per-`GameMap` (`maps/{mapId}.fog`) plus a `fogRegions`
    // subcollection, so — like the v11->v12 and v12->v13 bumps — the room doc
    // walks forward unchanged. Absent `fog` means fog off, which is the right
    // reading for every map that predates the feature.
    const v14Room = { schemaVersion: 14, name: 'Keep', encounterTemplate: [] };
    const migrated = migrateRoom(v14Room, 15);
    expect(migrated['schemaVersion']).toBe(15);
    expect(migrated['fog']).toBeUndefined();
    expect(migrated['name']).toBe('Keep');
  });

  it('v15 -> v16 seeds roll conventions and the initiative settings', () => {
    const v15Room = {
      schemaVersion: 15,
      name: 'Keep',
      settings: { theme: 'parchment-dark' },
    };
    const migrated = migrateRoom(v15Room, 16);
    expect(migrated['schemaVersion']).toBe(16);
    // The historical 4+/2-3/1 rule, now expressed as data *and scoped to the
    // d6 it was always describing* — that scoping is the bug fix: a d20 face
    // of 4 no longer classifies as a success.
    expect(migrated['rollConventions']).toEqual(DEFAULT_ROLL_CONVENTIONS);
    expect(migrated['settings']).toEqual({
      theme: 'parchment-dark',
      // Matches the historical DEFAULT_ENCOUNTER.mode and the die the deleted
      // `rollInitiative(dieMax = 6)` hardcoded, so a migrated room plays the
      // same as it did before the revamp.
      initiativeMode: 'side',
      initiativeDie: 'd6',
    });
  });

  it('v15 -> v16 leaves conventions and initiative settings a room already carries', () => {
    const custom = [
      {
        id: 'house',
        label: 'House rule',
        applies: { mode: 'summed' as const },
        bands: [{ min: 10, class: 'success' as const, label: 'Hit' }],
      },
    ];
    const migrated = migrateRoom(
      {
        schemaVersion: 15,
        rollConventions: custom,
        settings: { theme: 'ink', initiativeMode: 'individual', initiativeDie: 'd20' },
      },
      16,
    );
    expect(migrated['rollConventions']).toEqual(custom);
    expect(migrated['settings']).toEqual({
      theme: 'ink',
      initiativeMode: 'individual',
      initiativeDie: 'd20',
    });
  });

  it('v15 -> v16 tolerates a room doc with no settings object at all', () => {
    const migrated = migrateRoom({ schemaVersion: 15 }, 16);
    expect(migrated['settings']).toEqual({ initiativeMode: 'side', initiativeDie: 'd6' });
  });

  it('v16 -> v17 seeds the default player group', () => {
    const migrated = migrateRoom(
      {
        schemaVersion: 16,
        settings: { theme: 'parchment-dark', initiativeMode: 'side', initiativeDie: 'd6' },
      },
      17,
    );
    expect(migrated['schemaVersion']).toBe(17);
    expect(migrated['settings']).toEqual({
      theme: 'parchment-dark',
      initiativeMode: 'side',
      initiativeDie: 'd6',
      // Joiners land in whatever group sorts first — the reading a referee
      // running one party expects, and a no-op for a room with no groups.
      defaultPlayerGroup: 'first',
    });
  });

  it('v16 -> v17 leaves a default player group the room already carries', () => {
    const migrated = migrateRoom(
      { schemaVersion: 16, settings: { theme: 'ink', defaultPlayerGroup: 'unassigned' } },
      17,
    );
    expect((migrated['settings'] as Record<string, unknown>)['defaultPlayerGroup']).toBe(
      'unassigned',
    );
  });

  it('v16 -> v17 tolerates a room doc with no settings object at all', () => {
    const migrated = migrateRoom({ schemaVersion: 16 }, 17);
    expect(migrated['settings']).toEqual({ defaultPlayerGroup: 'first' });
  });

  it('v22 -> v23 is a no-op on the room doc: backgrounds move between map-scoped documents', () => {
    // Both halves of SPEC-038 §1 live under `maps/{mapId}` — the narrowed
    // `background` field and the new `backgrounds` subcollection — and
    // `migrateRoom` only ever sees the room doc. The document half is
    // `foldLegacyMapBackground`, tested below.
    const before = {
      schemaVersion: 22,
      name: 'Cavern Room',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
      activeMapId: 'map-1',
    };
    const migrated = migrateRoom(before, 23);
    expect(migrated).toEqual({ ...before, schemaVersion: 23 });
  });

  it('v22 -> v23 does NOT invent a backgrounds collection on the room doc', () => {
    const migrated = migrateRoom({ schemaVersion: 22 }, 23);
    expect(migrated['backgrounds']).toBeUndefined();
    expect(migrated['background']).toBeUndefined();
  });

  it('walks a v1 room all the way forward to CURRENT_SCHEMA_VERSION — the .vttcamp import path', () => {
    const v1Room = { schemaVersion: 1, name: 'Ancient Export' };
    const migrated = migrateRoom(v1Room);
    expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    // The pure version-walk migrations still backfill grid/settings.*/
    // background onto the doc (unchanged from before R17.3 — v10->v11 is a
    // documentation-only bump, see above); it's `vttcamp.ts`'s
    // `archiveToSnapshot` that adopts these into a `GameMap` and strips them
    // off the room for the final imported shape (see its own tests).
    expect(migrated['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    // The cellular `fog` mode field stays gone (removed in the vector cutover,
    // SPEC §4). v14->v15's fog of war is a per-*map* `fog: { enabled }`, not a
    // room-doc field, so nothing lands here.
    expect(migrated['fog']).toBeUndefined();
    expect(migrated['handout']).toBeNull();
    expect(migrated['settings']).toEqual({
      theme: 'parchment-dark',
      measure: { perSquare: 10, unit: 'feet' },
      grid: { subdivide: false },
      // v15->v16 backfills the initiative config the Combat Tracker's radios
      // used to hold.
      initiativeMode: 'side',
      initiativeDie: 'd6',
      // v16->v17's group ownership default.
      defaultPlayerGroup: 'first',
    });
    expect(migrated['rollConventions']).toEqual(DEFAULT_ROLL_CONVENTIONS);
    expect(migrated['background']).toEqual(null); // WI-073: no default background
    // A v1 room has no profileTemplate at all — the v6->v7 step maps over an
    // empty array, so it stays empty rather than erroring.
    expect(migrated['profileTemplate']).toEqual([]);
    // v13->v14 seeds the encounter's frozen legacy template (DEC-065).
    expect(migrated['encounterTemplate']).toEqual(LEGACY_ENCOUNTER_TEMPLATE_V14);
  });

  it('v17 -> v18 is a no-op on the room doc (presence lives on the seat)', () => {
    // R26's `PlayerSeat.lastPresentAt` is an additive field on a subcollection
    // doc, which `migrateRoom` never sees — the same shape as v11->v12 and
    // v14->v15. The bump exists to stamp `.vttcamp` archives, not to move data,
    // so the room doc must come through byte-identical apart from the version.
    const before = {
      schemaVersion: 17,
      name: 'Presence Room',
      settings: { theme: 'keyed-blue', defaultPlayerGroup: 'unassigned' },
    };
    const migrated = migrateRoom(before, 18);
    expect(migrated['schemaVersion']).toBe(18);
    expect(migrated['name']).toBe('Presence Room');
    expect(migrated['settings']).toEqual({
      theme: 'keyed-blue',
      defaultPlayerGroup: 'unassigned',
    });
  });

  it('v17 -> v18 does NOT invent a lastPresentAt anywhere', () => {
    // Pinning the deliberate absence of a backfill: R26.2 wants pre-existing
    // seats not to read as abandoned, and `abandonedSeatUids` gets that from
    // absence itself. A migration that seeded "now" onto the room doc would be
    // both useless (wrong doc) and misleading.
    const migrated = migrateRoom({ schemaVersion: 17 }, 18);
    expect(migrated['lastPresentAt']).toBeUndefined();
    expect(migrated['players']).toBeUndefined();
  });

  it('v18 -> v19 seeds lastActivityAt to the migration timestamp, not zero', () => {
    // R25.1's explicit instruction. A zero (or `createdAt`) seed would make
    // every existing campaign read as long-dormant the instant the feature
    // shipped, and the Lobby would offer its referee a Delete button for a room
    // they played in last night.
    const before = Date.now();
    const migrated = migrateRoom({ schemaVersion: 18, name: 'Live Campaign' }, 19);
    const after = Date.now();

    expect(migrated['schemaVersion']).toBe(19);
    const seeded = migrated['lastActivityAt'] as number;
    expect(seeded).toBeGreaterThanOrEqual(before);
    expect(seeded).toBeLessThanOrEqual(after);
  });

  it('a freshly migrated room does NOT read as dormant (Gate 27)', () => {
    const migrated = migrateRoom({ schemaVersion: 18, name: 'Live Campaign' }, 19);
    expect(isRoomDormant({ role: 'gm' }, migrated as unknown as { lastActivityAt?: number })).toBe(
      false,
    );
  });

  it('v18 -> v19 keeps a lastActivityAt that is already there', () => {
    // Re-running the walk (an import of an archive that already carries the
    // field, a doc read twice) must not reset a real, older value to now —
    // that would erase exactly the signal dormancy is derived from.
    const migrated = migrateRoom({ schemaVersion: 18, lastActivityAt: 1000 }, 19);
    expect(migrated['lastActivityAt']).toBe(1000);
  });

  it('v19 -> v20 is a no-op on the room doc (character colour lives on the profile)', () => {
    // SPEC-031's field is `profiles/{seatId}.color`, a subcollection doc that
    // `migrateRoom` never sees — the same shape as v11->v12, v14->v15 and
    // v17->v18. The bump exists to stamp `.vttcamp` archives; the real work is
    // `migrateProfile` plus the `assignedCharacterColor` resolution rule.
    const before = {
      schemaVersion: 19,
      name: 'Colour Room',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
    };
    const migrated = migrateRoom(before, 20);
    expect(migrated['schemaVersion']).toBe(20);
    expect(migrated['name']).toBe('Colour Room');
    expect(migrated['lastActivityAt']).toBe(1000);
    expect(migrated['settings']).toEqual({ theme: 'keyed-blue' });
    // Emphatically not on the room doc — a colour here would belong to nobody.
    expect(migrated['color']).toBeUndefined();
    expect(migrated['profiles']).toBeUndefined();
  });

  it('v20 -> v21 is a no-op: the profile key space widened, no document moved', () => {
    // SPEC-032 §2 re-keys `profiles/{id}` from a seat id to an actor id (a
    // seat id for a character, a token id for a creature). Every document that
    // existed is seat-keyed, and a seat id is still a valid actor id, so there
    // is nothing on the room doc *or* in the subcollection to rewrite — the
    // bump stamps `.vttcamp` archives, as v17->v18 and v19->v20 do.
    const before = {
      schemaVersion: 20,
      name: 'Actor Room',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
    };
    const migrated = migrateRoom(before, 21);
    expect(migrated).toEqual({ ...before, schemaVersion: 21 });
  });

  it('v21 -> v22 is a no-op: the battle-map marker lives on a map doc', () => {
    // SPEC-029 §3 adds `GameMap.battle` — an optional marker on a
    // `maps/{mapId}` document, which `migrateRoom` never sees. Absence already
    // means "an ordinary permanent map", so nothing is backfilled anywhere; the
    // bump stamps `.vttcamp` archives, as v17->v18, v19->v20 and v20->v21 do.
    // The behavioural half of this version — a battle map never surviving an
    // export — is `portability/vttcamp.ts`'s, and is tested there.
    const before = {
      schemaVersion: 21,
      name: 'Battle Room',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
      activeMapId: 'map-1',
    };
    const migrated = migrateRoom(before, 22);
    expect(migrated).toEqual({ ...before, schemaVersion: 22 });
  });

  it('v21 -> v22 does NOT invent a battle marker anywhere', () => {
    // Pinning the deliberate absence of a backfill: every existing map is an
    // ordinary one, and a `battle` seeded onto a room (or onto a map) would
    // claim a fight that never happened — and, worse, would be stripped by the
    // very next export.
    const migrated = migrateRoom({ schemaVersion: 21 }, 22);
    expect(migrated['battle']).toBeUndefined();
    expect(migrated['maps']).toBeUndefined();
  });

  it('v23 -> v24 is a no-op: the hex-crawl config lives on a map doc', () => {
    // SPEC-030 §1 adds `GameMap.hex` — an optional config on a `maps/{mapId}`
    // document, which `migrateRoom` never sees. Absence already means "a
    // square-grid map", so nothing is backfilled; the bump stamps `.vttcamp`
    // archives, as v20->v21 and v21->v22 do.
    const before = {
      schemaVersion: 23,
      name: 'Wilderlands',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
      activeMapId: 'map-1',
    };
    const migrated = migrateRoom(before, 24);
    expect(migrated).toEqual({ ...before, schemaVersion: 24 });
  });

  it('v23 -> v24 does NOT declare an existing map to be a hex crawl', () => {
    // Pinning the deliberate absence of a backfill. A seeded `hex` would
    // re-declare the coordinate space of every map that already exists
    // (RULE-006) and orphan every lattice polygon stored on it.
    const migrated = migrateRoom({ schemaVersion: 23 }, 24);
    expect(migrated['hex']).toBeUndefined();
    expect(migrated['maps']).toBeUndefined();
  });

  it('v24 -> v25 is a no-op: painted hexes live in a map-scoped collection', () => {
    // SPEC-030 §§2–3 add `maps/{mapId}/hexTiles` — one document per painted
    // hex. `migrateRoom` sees the room doc alone, and there is no document half
    // either: the collection is new, so nothing anywhere moves into it.
    const before = {
      schemaVersion: 24,
      name: 'Wilderlands',
      lastActivityAt: 1000,
      settings: { theme: 'keyed-blue' },
      activeMapId: 'map-1',
    };
    const migrated = migrateRoom(before, 25);
    expect(migrated).toEqual({ ...before, schemaVersion: 25 });
  });

  it('v24 -> v25 does NOT invent a hexTiles collection on the room doc', () => {
    // The same deliberate absence v22->v23 pins for `backgrounds`: an empty
    // collection is what "no painted hexes" already looks like, and a room-doc
    // field of that name would be read by nothing.
    const migrated = migrateRoom({ schemaVersion: 24 }, 25);
    expect(migrated['hexTiles']).toBeUndefined();
    expect(migrated['maps']).toBeUndefined();
  });

  it('v25 -> v26 is a no-op: a hex note lives on the hex tile, not the room doc', () => {
    // SPEC-030 §4 adds `HexTile.note`, on a `maps/{mapId}/hexTiles/{axialKey}`
    // document. Additive and map-scoped, so `migrateRoom` has nothing to do —
    // and nothing to seed: absence already means "nobody wrote a note here".
    const before = {
      schemaVersion: 25,
      name: 'The Bitter Reach',
      lastActivityAt: 2000,
      settings: { theme: 'keyed-blue' },
      activeMapId: 'map-hex',
    };
    const migrated = migrateRoom(before, 26);
    expect(migrated).toEqual({ ...before, schemaVersion: 26 });
  });

  it('v25 -> v26 does NOT seed a note anywhere', () => {
    const migrated = migrateRoom({ schemaVersion: 25 }, 26);
    expect(migrated['note']).toBeUndefined();
    expect(migrated['hexTiles']).toBeUndefined();
  });

  it('v26 -> v27 is a no-op on the room doc: a background lock lives on the background', () => {
    // SPEC-039 §1 adds `MapBackground.locked`, on a
    // `maps/{mapId}/backgrounds/{bgId}` document. Map-scoped, so `migrateRoom`
    // has nothing to do — the document half is `lockLegacyBackground`, below.
    const before = {
      schemaVersion: 26,
      name: 'The Sunless Vault',
      lastActivityAt: 3000,
      settings: { theme: 'parchment-dark' },
      activeMapId: 'map-1',
    };
    const migrated = migrateRoom(before, 27);
    expect(migrated).toEqual({ ...before, schemaVersion: 27 });
  });

  it('v26 -> v27 does NOT seed a lock on the room doc', () => {
    const migrated = migrateRoom({ schemaVersion: 26 }, 27);
    expect(migrated['locked']).toBeUndefined();
    expect(migrated['backgrounds']).toBeUndefined();
  });

  it('walks a v19 room to CURRENT_SCHEMA_VERSION without touching anything else', () => {
    // The seven most recent steps are all no-ops, so this is the assertion that
    // catches a future step being appended without a migration entry.
    const migrated = migrateRoom({ schemaVersion: 19, name: 'Live Campaign' });
    expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated['name']).toBe('Live Campaign');
  });
});

describe('lockLegacyBackground (SPEC-039 §1, DEC-069 — the v26->v27 document half)', () => {
  const BG = { id: 'bg-1', ref: 'maps/starter-room.svg', x: 0, y: 0, w: 64, h: 64, order: 0 };

  it('pins a background that predates the field', () => {
    // Absent reads as unlocked (DEC-068), which is right for a new document and
    // wrong for an old one: every pre-v27 placement is overwhelmingly full-grid
    // and would otherwise own every Select click on the map.
    expect(lockLegacyBackground({ ...BG })).toEqual({ ...BG, locked: true });
  });

  it('leaves a stated lock alone, in both directions, and returns it by reference', () => {
    const unlocked = { ...BG, locked: false };
    expect(lockLegacyBackground(unlocked)).toBe(unlocked);
    const locked = { ...BG, locked: true };
    expect(lockLegacyBackground(locked)).toBe(locked);
  });

  it('is idempotent — a second room-open re-pins nothing', () => {
    const once = lockLegacyBackground({ ...BG });
    expect(lockLegacyBackground(once)).toBe(once);
  });

  it('pins a non-boolean lock, which is not a stated one', () => {
    // Version-agnostic by construction: the field, not the stored version, is
    // what it reads — so a hand-edited `locked: "yes"` is treated as absent.
    expect(lockLegacyBackground({ ...BG, locked: 'yes' })).toEqual({ ...BG, locked: true });
  });
});

describe('migrateProfile (SPEC-031 — every character has a colour)', () => {
  it('backfills a palette colour derived from the seat id', () => {
    const migrated = migrateProfile({ values: { name: 'Bram' } }, 'seat-1');
    expect(migrated['color']).toBe(assignedCharacterColor('seat-1'));
    expect(CHARACTER_COLOR_PALETTE).toContain(migrated['color']);
    // Everything else comes through untouched.
    expect(migrated['values']).toEqual({ name: 'Bram' });
  });

  it('is deterministic, not random — two runs agree, and so do two clients', () => {
    const a = migrateProfile({}, 'seat-1');
    const b = migrateProfile({}, 'seat-1');
    expect(a['color']).toBe(b['color']);
  });

  it('leaves a profile that already carries a colour completely alone', () => {
    // Idempotence matters: re-importing an archive must never repaint a
    // character somebody deliberately chose a colour for.
    const before = { values: {}, color: '#3366cc', portraitRef: 'gen:disc:A:hsl(10, 65%, 45%)' };
    const migrated = migrateProfile(before, 'seat-1');
    expect(migrated).toBe(before);
    expect(migrated['color']).toBe('#3366cc');
  });

  it('gives different seats different colours rather than one shared default', () => {
    const colors = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5', 'seat-6'].map(
      (id) => migrateProfile({}, id)['color'],
    );
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});

describe('foldLegacyMapBackground (SPEC-038 §1 — the v22->v23 document half)', () => {
  const LEGACY_MAP = {
    id: 'map-1',
    name: 'Map 1',
    order: 0,
    createdAt: 1000,
    grid: { w: 40, h: 30, cellSize: 70 },
    background: { ref: 'maps/starter-room.svg' },
    measure: { perSquare: 10, unit: 'feet' },
    gridSettings: { subdivide: false },
  };

  it('moves a pre-v23 image ref into one background sized to the full map grid', () => {
    const { doc, background } = foldLegacyMapBackground(LEGACY_MAP);
    expect(background).toEqual({
      ref: 'maps/starter-room.svg',
      x: 0,
      y: 0,
      w: 40,
      h: 30,
      order: 0,
    });
    // The field is cleared rather than left dangling — `GameMapSchema` would
    // reject an image ref now, so leaving it would break the very next read.
    expect(doc['background']).toBeNull();
    // Nothing else on the map doc is disturbed.
    expect({ ...doc, background: undefined }).toEqual({ ...LEGACY_MAP, background: undefined });
  });

  it('falls back to the default grid when the legacy map doc carries none', () => {
    const { background } = foldLegacyMapBackground({ background: { ref: 'a.png' } });
    expect(background).toEqual({ ref: 'a.png', x: 0, y: 0, w: 64, h: 64, order: 0 });
  });

  it('is idempotent — a folded map folds no further', () => {
    const once = foldLegacyMapBackground(LEGACY_MAP);
    const twice = foldLegacyMapBackground(once.doc);
    expect(twice.background).toBeUndefined();
    expect(twice.doc).toBe(once.doc);
  });

  it('leaves a solid background colour exactly where it is', () => {
    // A colour is not an image (DEC-062): it stays the renderer's clear
    // colour on the map doc, and produces no background document.
    const map = { ...LEGACY_MAP, background: { color: '#5582CA' } };
    const { doc, background } = foldLegacyMapBackground(map);
    expect(background).toBeUndefined();
    expect(doc).toBe(map);
  });

  it('produces nothing for a cleared or absent background', () => {
    expect(foldLegacyMapBackground({ ...LEGACY_MAP, background: null }).background).toBeUndefined();
    const { background: _dropped, ...noField } = LEGACY_MAP;
    expect(foldLegacyMapBackground(noField).background).toBeUndefined();
  });
});
