import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { assignedCharacterColor } from '../character-color.js';
import type { CampaignSnapshot } from '../store/campaign-store.js';
import { CURRENT_SCHEMA_VERSION } from '../types.js';
import {
  archiveToSnapshot,
  readManifest,
  snapshotToArchive,
  VttCampFormatError,
  VTTCAMP_FORMAT,
} from './vttcamp.js';

/**
 * `.vttcamp` archive core (Plan §5, §7 Phase 5). Pure — no emulator — so
 * Gate 5's two portability items are proved as plain unit tests:
 *  - "export → new import yields identical state" (round-trip identity)
 *  - "a migration upgrades an older export" (schemaVersion walked forward)
 *
 * Master Plan v2, R17.3 (multiple full map builds per session) moved
 * grid/fog/background/measure/gridSettings off the room doc onto a `GameMap`
 * doc (`snapshot.maps`), with `room.activeMapId` pointing at it. A pre-v11
 * archive carries none of that — `archiveToSnapshot` adopts its flat map data
 * into one synthetic map (`LEGACY_MAP_ID` = `'legacy-map'`) so every importer
 * only ever sees the current (`maps` always present) shape — see that
 * function's doc comment.
 */

function currentSnapshot(): CampaignSnapshot {
  return {
    room: {
      name: 'The Sunless Vault',
      gmUid: 'gm-uid',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      difficultyDie: 'd6',
      dangerDie: 'd6',
      createdAt: 1700000000000,
      profileTemplate: [{ id: 'name', label: 'Name', type: 'text', pinned: false }],
      handout: { ref: 'maps/starter-room.svg', title: 'The Vault Door' },
      settings: { theme: 'parchment-dark' },
      activeMapId: 'map-1',
    },
    collections: {
      players: [{ id: 'gm-uid', displayName: 'Referee', seatId: 'gm-uid', role: 'gm' }],
      profiles: [
        {
          id: 'gm-uid',
          values: { name: 'Sir Reginald' },
          portraitRef: 'tokens/fighter.svg',
          // Every character carries a colour at v20 (SPEC-031), so a snapshot
          // that is already at CURRENT_SCHEMA_VERSION has nothing to backfill —
          // which is what lets the round-trip below be an exact identity.
          color: '#3366cc',
        },
      ],
      tokens: [
        {
          id: 'tok-1',
          pos: { x: 160, y: 160 },
          size: 1,
          layer: 'tokens',
          imageRef: 'tokens/goblin.svg',
        },
      ],
      groups: [],
      log: [
        { id: 'log-1', ts: 1700000001000, authorUid: 'gm-uid', type: 'system', text: 'Welcome' },
      ],
      rolls: [],
      tables: [],
      macros: [],
      gmPrivate: [
        {
          id: 'handout-1',
          kind: 'handout',
          ts: 1700000002000,
          title: 'Vault Door',
          ref: 'maps/starter-room.svg',
          revealed: true,
        },
      ],
    },
    maps: [
      {
        doc: {
          id: 'map-1',
          name: 'Map 1',
          order: 0,
          createdAt: 1700000000000,
          grid: { w: 64, h: 64, cellSize: 70 },
          fog: { mode: 'emergent' },
          background: { ref: 'maps/starter-room.svg' },
          measure: { perSquare: 10, unit: 'feet' },
          gridSettings: { subdivide: false },
        },
        collections: {
          drawings: [],
          floorChunks: [],
          fogChunks: [],
          walls: [],
          sightWalls: [],
          circleWalls: [],
          lights: [],
          symbols: [],
          mapRooms: [],
        },
      },
    ],
    encounter: { mode: 'side', round: 1, order: [], currentIndex: 0 },
    yjs: { notes: 'AQAAAA==' },
  };
}

describe('.vttcamp round trip (Gate 5: export -> new import yields identical state)', () => {
  it('recovers an identical snapshot when the room is already at CURRENT_SCHEMA_VERSION', () => {
    const snapshot = currentSnapshot();
    const archive = snapshotToArchive(snapshot);
    const recovered = archiveToSnapshot(archive);
    expect(recovered).toEqual(snapshot);
  });

  it('is a real zip carrying a campaign.json payload', () => {
    const archive = snapshotToArchive(currentSnapshot());
    // A zip's local file header starts with the "PK\x03\x04" signature.
    expect(archive[0]).toBe(0x50);
    expect(archive[1]).toBe(0x4b);
  });

  it('backfills a character colour onto a profile exported before SPEC-031 (v19 -> v20)', () => {
    // The room-doc walk cannot reach a subcollection doc, so this is the one
    // boundary where the "every character has a colour" guarantee is applied
    // to stored documents rather than resolved at read time.
    const snapshot = currentSnapshot();
    snapshot.room['schemaVersion'] = 19;
    snapshot.collections['players'] = [
      ...snapshot.collections['players']!,
      { id: 'seat-2', displayName: 'Mira', seatId: 'seat-2', role: 'player' },
    ];
    snapshot.collections['profiles'] = [
      { id: 'gm-uid', values: { name: 'Sir Reginald' }, portraitRef: 'tokens/fighter.svg' },
      { id: 'seat-2', values: {} },
    ];

    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered.room['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    const profiles = recovered.collections['profiles']!;
    expect(profiles[0]!['color']).toBe(assignedCharacterColor('gm-uid'));
    expect(profiles[1]!['color']).toBe(assignedCharacterColor('seat-2'));
    // Nothing else about the documents moved.
    expect(profiles[0]!['portraitRef']).toBe('tokens/fighter.svg');
    expect(profiles[0]!['values']).toEqual({ name: 'Sir Reginald' });
    // And no other collection was disturbed by the profile pass.
    expect(recovered.collections['tokens']).toEqual(snapshot.collections['tokens']);
  });

  it('re-importing a backfilled archive repaints nobody', () => {
    const snapshot = currentSnapshot();
    snapshot.room['schemaVersion'] = 19;
    snapshot.collections['players'] = [
      { id: 'seat-2', displayName: 'Mira', seatId: 'seat-2', role: 'player' },
    ];
    snapshot.collections['profiles'] = [{ id: 'seat-2', values: {} }];

    const once = archiveToSnapshot(snapshotToArchive(snapshot));
    const twice = archiveToSnapshot(snapshotToArchive(once));
    expect(twice.collections['profiles']).toEqual(once.collections['profiles']);
  });

  it('leaves a colourless profile alone when its doc id is missing', () => {
    // There is no seat id to derive from, and inventing one would attach a
    // colour to the wrong character on import.
    const snapshot = currentSnapshot();
    snapshot.collections['profiles'] = [{ values: {} }];
    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered.collections['profiles']).toEqual([{ values: {} }]);
  });

  // ---- SPEC-032 §2: profiles are keyed by an actor, not a seat (v21) ----

  it('round-trips a token-keyed creature profile identically', () => {
    const snapshot = currentSnapshot();
    snapshot.collections['profiles'] = [
      ...snapshot.collections['profiles']!,
      // Keyed by the token id of the goblin in `tokens` — a creature, which
      // has no seat and never will.
      { id: 'tok-1', values: { name: 'Goblin Sentry', hp: 4 } },
    ];

    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered).toEqual(snapshot);
  });

  it('does not backfill a colour onto a token-keyed creature profile', () => {
    // SPEC-031's guarantee is about *characters* (DEC-042). A creature has no
    // character behind it, so an import must not invent a colour its export
    // never carried — the archive's `players` roster is what tells them apart.
    const snapshot = currentSnapshot();
    snapshot.room['schemaVersion'] = 19;
    snapshot.collections['profiles'] = [
      { id: 'gm-uid', values: {} },
      { id: 'tok-1', values: { name: 'Goblin Sentry' } },
    ];

    const profiles = archiveToSnapshot(snapshotToArchive(snapshot)).collections['profiles']!;
    expect(profiles[0]!['color']).toBe(assignedCharacterColor('gm-uid'));
    expect(profiles[1]).toEqual({ id: 'tok-1', values: { name: 'Goblin Sentry' } });
  });

  it('round-trips an ordinary map identically now that `battle` exists (v22)', () => {
    // The identity path must be untouched by the strip: a snapshot with no
    // battle map comes back byte-for-byte, `activeMapId` included.
    const snapshot = currentSnapshot();
    expect(archiveToSnapshot(snapshotToArchive(snapshot))).toEqual(snapshot);
    expect(snapshot.room['schemaVersion']).toBe(22);
  });
});

/** `currentSnapshot()` plus a temporary battle map cut out of `map-1`, with the
 * room switched into it — the shape a room is in mid-fight (SPEC-029 §3). */
function snapshotMidBattle(): CampaignSnapshot {
  const snapshot = currentSnapshot();
  snapshot.room['activeMapId'] = 'battle-1';
  snapshot.maps.push({
    doc: {
      id: 'battle-1',
      name: 'Battle',
      order: 1,
      createdAt: 1700000003000,
      // Half the source cell size over double the cells — SPEC-029 §4's
      // doubled grid density over the 8×6 captured rect.
      grid: { w: 16, h: 12, cellSize: 35 },
      background: { ref: 'maps/battle-only.svg' },
      measure: { perSquare: 5, unit: 'feet' },
      gridSettings: { subdivide: false },
      battle: { sourceMapId: 'map-1', rect: { minX: 4, minY: 4, maxX: 12, maxY: 10 } },
    },
    collections: { drawings: [], symbols: [], mapRooms: [] },
  });
  return snapshot;
}

describe('.vttcamp battle maps (SPEC-029 §3 — a battle map never survives an export)', () => {
  it('drops the battle map on export and returns the room to its source map', () => {
    const recovered = archiveToSnapshot(snapshotToArchive(snapshotMidBattle()));
    expect(recovered.maps.map(({ doc }) => doc['id'])).toEqual(['map-1']);
    expect(recovered.room['activeMapId']).toBe('map-1');
  });

  it('yields exactly the snapshot the room had before the fight started', () => {
    // The strongest statement of the rule: exporting mid-fight and exporting
    // before the fight produce the same state. Nothing else moves.
    expect(archiveToSnapshot(snapshotToArchive(snapshotMidBattle()))).toEqual(currentSnapshot());
  });

  it('keeps the battle map out of the manifest asset refs', () => {
    const manifest = readManifest(snapshotToArchive(snapshotMidBattle()));
    expect(manifest.assetRefs).not.toContain('maps/battle-only.svg');
  });

  it('leaves the source map active when the room was not switched into the battle map', () => {
    // Capture without Start: the temporary map exists but the table is still on
    // the source map. Only the map is dropped; `activeMapId` is not rewritten.
    const snapshot = snapshotMidBattle();
    snapshot.room['activeMapId'] = 'map-1';

    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered.maps.map(({ doc }) => doc['id'])).toEqual(['map-1']);
    expect(recovered.room['activeMapId']).toBe('map-1');
  });

  it('strips a battle map smuggled in by an archive this build did not write', () => {
    // The import-side half. Hand-built body, since `snapshotToArchive` refuses
    // to produce one — this is the archive some other build could hand us.
    const snapshot = snapshotMidBattle();
    const bytes = zipSync({
      'campaign.json': strToU8(
        JSON.stringify({
          manifest: {
            format: VTTCAMP_FORMAT,
            formatVersion: 2,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            exportedAt: 1700000004000,
            roomName: 'The Sunless Vault',
            assetRefs: [],
          },
          room: snapshot.room,
          collections: snapshot.collections,
          maps: snapshot.maps,
          encounter: snapshot.encounter,
          yjs: snapshot.yjs,
        }),
      ),
    });

    const recovered = archiveToSnapshot(bytes);
    expect(recovered.maps.map(({ doc }) => doc['id'])).toEqual(['map-1']);
    expect(recovered.room['activeMapId']).toBe('map-1');
  });

  it('falls back to a remaining map when the source map is gone', () => {
    // The source map was deleted while the fight ran. There is nowhere to
    // return to, so the import lands on whatever map is left rather than on a
    // dangling id.
    const snapshot = snapshotMidBattle();
    snapshot.maps.push({
      doc: {
        id: 'map-2',
        name: 'Map 2',
        order: 2,
        createdAt: 1700000005000,
        grid: { w: 64, h: 64, cellSize: 70 },
        measure: { perSquare: 10, unit: 'feet' },
        gridSettings: { subdivide: false },
      },
      collections: {},
    });
    snapshot.maps = snapshot.maps.filter(({ doc }) => doc['id'] !== 'map-1');

    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered.maps.map(({ doc }) => doc['id'])).toEqual(['map-2']);
    expect(recovered.room['activeMapId']).toBe('map-2');
  });

  it('leaves no active map at all when the battle map was the only one', () => {
    // Degenerate, but it must not round-trip a pointer at a map that is not in
    // the archive: `activeMapId` is optional precisely so `ensureActiveMap` can
    // recover from its absence.
    const snapshot = snapshotMidBattle();
    snapshot.maps = snapshot.maps.filter(({ doc }) => doc['id'] === 'battle-1');

    const recovered = archiveToSnapshot(snapshotToArchive(snapshot));
    expect(recovered.maps).toEqual([]);
    expect(recovered.room['activeMapId']).toBeUndefined();
    expect('activeMapId' in recovered.room).toBe(false);
  });
});

describe('.vttcamp manifest', () => {
  it('tags the format and collects asset refs from tokens/profiles/handouts/map backgrounds', () => {
    const archive = snapshotToArchive(currentSnapshot());
    const manifest = readManifest(archive);
    expect(manifest.format).toBe(VTTCAMP_FORMAT);
    expect(manifest.roomName).toBe('The Sunless Vault');
    expect(manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(manifest.assetRefs).toEqual(
      ['maps/starter-room.svg', 'tokens/fighter.svg', 'tokens/goblin.svg'].sort(),
    );
  });
});

describe('.vttcamp migration exercise (Gate 5: a migration upgrades an older export)', () => {
  it('adopts a pre-v11 export (v2 shape: pre-handout, pre-settings, flat map collections) into one map', () => {
    const oldSnapshot: CampaignSnapshot = {
      room: {
        name: 'Ancient Barrow',
        gmUid: 'gm-uid',
        schemaVersion: 2,
        difficultyDie: 'd6',
        dangerDie: 'd6',
        createdAt: 1600000000000,
        profileTemplate: [],
        grid: { w: 64, h: 64, cellSize: 70 },
        fog: { mode: 'emergent' },
        // no `handout` field — this room predates Phase 5.
      },
      collections: {
        players: [{ id: 'gm-uid', displayName: 'Referee', seatId: 'gm-uid', role: 'gm' }],
        // Pre-v11 flat map-scoped data that survives the cutover — the
        // cellular equivalents (floorChunks/walls) are gone entirely (WI-D
        // pure-rollout cutover) and no longer part of this adoption path.
        drawings: [],
      },
      // No `maps` array at all — the pre-v11 shape.
      maps: undefined as unknown as CampaignSnapshot['maps'],
      encounter: null,
      yjs: {},
    };
    const archive = snapshotToArchive(oldSnapshot);

    // The manifest still records the pre-migration version it was exported at...
    expect(readManifest(archive).schemaVersion).toBe(2);

    // ...but decoding the archive walks the room forward and adopts its flat
    // map data into one synthetic map.
    const recovered = archiveToSnapshot(archive);
    expect(recovered.room['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({
      theme: 'parchment-dark',
      // v15->v16 backfills the initiative config and v16->v17 the group
      // ownership default onto every migrated room; the map-scoped
      // measure/grid keys are adopted into the GameMap and stripped.
      initiativeMode: 'side',
      initiativeDie: 'd6',
      defaultPlayerGroup: 'first',
    });
    expect(recovered.room['activeMapId']).toBe('legacy-map');
    // Session-scoped collections stay in `collections`...
    expect(recovered.collections['players']).toEqual(oldSnapshot.collections['players']);
    // ...map-scoped ones move into the synthesized map.
    expect(recovered.collections['drawings']).toBeUndefined();
    expect(recovered.maps).toHaveLength(1);
    const { doc, collections: mapCollections } = recovered.maps[0]!;
    expect(doc['id']).toBe('legacy-map');
    expect(doc['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(doc['fog']).toBeUndefined(); // fog removed in the vector cutover (SPEC §4)
    expect(doc['background']).toEqual({ ref: 'maps/starter-room.svg' }); // pre-R15 fallback
    expect(doc['measure']).toEqual({ perSquare: 10, unit: 'feet' });
    expect(doc['gridSettings']).toEqual({ subdivide: false });
    expect(mapCollections['drawings']).toEqual(oldSnapshot.collections['drawings']);
  });

  it('walks a v1 export (pre-grid/fog) all the way to CURRENT_SCHEMA_VERSION, adopting an empty map', () => {
    const ancientSnapshot: CampaignSnapshot = {
      room: {
        name: 'Original Dungeon',
        gmUid: 'gm-uid',
        schemaVersion: 1,
        difficultyDie: 'd6',
        dangerDie: 'd6',
        createdAt: 1500000000000,
        profileTemplate: [],
      },
      collections: {},
      maps: undefined as unknown as CampaignSnapshot['maps'],
      encounter: null,
      yjs: {},
    };
    const recovered = archiveToSnapshot(snapshotToArchive(ancientSnapshot));
    expect(recovered.room['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({
      theme: 'parchment-dark',
      // v15->v16 backfills the initiative config and v16->v17 the group
      // ownership default onto every migrated room; the map-scoped
      // measure/grid keys are adopted into the GameMap and stripped.
      initiativeMode: 'side',
      initiativeDie: 'd6',
      defaultPlayerGroup: 'first',
    });
    expect(recovered.room['activeMapId']).toBe('legacy-map');
    expect(recovered.maps).toHaveLength(1);
    const { doc } = recovered.maps[0]!;
    expect(doc['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(doc['fog']).toBeUndefined(); // fog removed in the vector cutover (SPEC §4)
    expect(doc['background']).toEqual({ ref: 'maps/starter-room.svg' });
    expect(doc['measure']).toEqual({ perSquare: 10, unit: 'feet' });
    expect(doc['gridSettings']).toEqual({ subdivide: false });
  });
});

describe('.vttcamp format validation', () => {
  it('rejects bytes that are not a zip at all', () => {
    expect(() => archiveToSnapshot(new Uint8Array([1, 2, 3, 4]))).toThrow(VttCampFormatError);
  });

  it('rejects a well-formed zip without a campaign.json entry', () => {
    const archive = zipSync({ 'other.txt': strToU8('not a campaign') });
    expect(() => archiveToSnapshot(archive)).toThrow(VttCampFormatError);
  });

  it('rejects an archive whose manifest format tag is wrong', () => {
    const archive = zipSync({
      'campaign.json': strToU8(
        JSON.stringify({
          manifest: { format: 'not-vttcamp', formatVersion: 1, schemaVersion: 3 },
          room: {},
          collections: {},
          encounter: null,
          yjs: {},
        }),
      ),
    });
    expect(() => archiveToSnapshot(archive)).toThrow(VttCampFormatError);
    expect(() => readManifest(archive)).toThrow(VttCampFormatError);
  });

  it('rejects a pre-vector (formatVersion 1) archive with an "unsupported schema" error (WI-D D1)', () => {
    const archive = zipSync({
      'campaign.json': strToU8(
        JSON.stringify({
          manifest: { format: 'vttcamp', formatVersion: 1, schemaVersion: 11 },
          room: {},
          collections: {},
          encounter: null,
          yjs: {},
        }),
      ),
    });
    expect(() => archiveToSnapshot(archive)).toThrow(VttCampFormatError);
    expect(() => archiveToSnapshot(archive)).toThrow(/[Uu]nsupported/);
    expect(() => readManifest(archive)).toThrow(VttCampFormatError);
    expect(() => readManifest(archive)).toThrow(/[Uu]nsupported/);
  });
});
