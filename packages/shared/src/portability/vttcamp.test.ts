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
 */

function currentSnapshot(): CampaignSnapshot {
  return {
    room: {
      name: 'The Sunless Vault',
      gmUid: 'gm-uid',
      schemaVersion: 7,
      difficultyDie: 'd6',
      dangerDie: 'd6',
      createdAt: 1700000000000,
      profileTemplate: [{ id: 'name', label: 'Name', type: 'text', pinned: false }],
      grid: { w: 64, h: 64, cellSize: 70 },
      fog: { mode: 'emergent' },
      handout: { ref: 'maps/starter-room.svg', title: 'The Vault Door' },
      settings: { theme: 'parchment-dark', measure: { perSquare: 10, unit: 'feet' }, grid: { subdivide: false } },
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
      drawings: [],
      log: [{ id: 'log-1', ts: 1700000001000, authorUid: 'gm-uid', type: 'system', text: 'Welcome' }],
      rolls: [],
      tables: [],
      floorChunks: [],
      fogChunks: [],
      walls: [],
      sightWalls: [],
      lights: [],
      symbols: [],
      mapRooms: [],
      macros: [],
      gmPrivate: [
        { id: 'handout-1', kind: 'handout', ts: 1700000002000, title: 'Vault Door', ref: 'maps/starter-room.svg', revealed: true },
      ],
    },
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
  it('tags the format and collects asset refs from tokens/profiles/handouts', () => {
    const archive = snapshotToArchive(currentSnapshot());
    const manifest = readManifest(archive);
    expect(manifest.format).toBe(VTTCAMP_FORMAT);
    expect(manifest.roomName).toBe('The Sunless Vault');
    expect(manifest.schemaVersion).toBe(7);
    expect(manifest.assetRefs).toEqual(
      ['maps/starter-room.svg', 'tokens/fighter.svg', 'tokens/goblin.svg'].sort(),
    );
  });
});

describe('.vttcamp migration exercise (Gate 5: a migration upgrades an older export)', () => {
  it('upgrades a v2 export (pre-handout, pre-settings) forward to v7 on import', () => {
    const oldSnapshot: CampaignSnapshot = {
      ...currentSnapshot(),
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
    };
    const archive = snapshotToArchive(oldSnapshot);

    // The manifest still records the pre-migration version it was exported at...
    expect(readManifest(archive).schemaVersion).toBe(2);

    // ...but decoding the archive walks the room forward.
    const recovered = archiveToSnapshot(archive);
    expect(recovered.room['schemaVersion']).toBe(7);
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({
      theme: 'parchment-dark',
      measure: { perSquare: 10, unit: 'feet' },
      grid: { subdivide: false },
    });
  });

  it('walks a v1 export (pre-grid/fog) all the way to v7', () => {
    const ancientSnapshot: CampaignSnapshot = {
      ...currentSnapshot(),
      room: {
        name: 'Original Dungeon',
        gmUid: 'gm-uid',
        schemaVersion: 1,
        difficultyDie: 'd6',
        dangerDie: 'd6',
        createdAt: 1500000000000,
        profileTemplate: [],
      },
    };
    const recovered = archiveToSnapshot(snapshotToArchive(ancientSnapshot));
    expect(recovered.room['schemaVersion']).toBe(7);
    expect(recovered.room['grid']).toEqual({ w: 64, h: 64, cellSize: 70 });
    expect(recovered.room['fog']).toEqual({ mode: 'emergent' });
    expect(recovered.room['handout']).toBeNull();
    expect(recovered.room['settings']).toEqual({
      theme: 'parchment-dark',
      measure: { perSquare: 10, unit: 'feet' },
      grid: { subdivide: false },
    });
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
});
