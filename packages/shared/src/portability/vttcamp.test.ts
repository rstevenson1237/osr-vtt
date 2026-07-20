import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { CampaignSnapshot } from '../store/campaign-store.js';
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
      schemaVersion: 11,
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
      profiles: [{ id: 'gm-uid', values: { name: 'Sir Reginald' }, portraitRef: 'tokens/fighter.svg' }],
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
      log: [{ id: 'log-1', ts: 1700000001000, authorUid: 'gm-uid', type: 'system', text: 'Welcome' }],
      rolls: [],
      tables: [],
      macros: [],
      gmPrivate: [
        { id: 'handout-1', kind: 'handout', ts: 1700000002000, title: 'Vault Door', ref: 'maps/starter-room.svg', revealed: true },
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
});

describe('.vttcamp manifest', () => {
  it('tags the format and collects asset refs from tokens/profiles/handouts/map backgrounds', () => {
    const archive = snapshotToArchive(currentSnapshot());
    const manifest = readManifest(archive);
    expect(manifest.format).toBe(VTTCAMP_FORMAT);
    expect(manifest.roomName).toBe('The Sunless Vault');
    expect(manifest.schemaVersion).toBe(11);
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
    expect(recovered.room['schemaVersion']).toBe(11);
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({ theme: 'parchment-dark' });
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

  it('walks a v1 export (pre-grid/fog) all the way to v11, adopting an empty map', () => {
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
    expect(recovered.room['schemaVersion']).toBe(11);
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({ theme: 'parchment-dark' });
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
