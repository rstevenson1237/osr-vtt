import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { migrateRoom } from '../migrations/index.js';
import { EXPORTED_MAP_COLLECTIONS, type CampaignSnapshot } from '../store/campaign-store.js';
import {
  DEFAULT_BACKGROUND,
  DEFAULT_FOG_CONFIG,
  DEFAULT_GRID_CONFIG,
  DEFAULT_GRID_SETTINGS,
  DEFAULT_MAP_NAME,
  DEFAULT_MEASURE,
} from '../types.js';

/**
 * `.vttcamp` export/import (Plan §5, §7 Phase 5). A room's whole
 * `CampaignSnapshot` (read via `CampaignStore.exportRoom`) is zipped into a
 * single portable file; `CampaignStore.importRoom` writes the unzipped
 * result back as a fresh room. This module is the pure archive core — no
 * Firebase, fully unit-testable — so the migration-on-import path (Gate 5:
 * "a migration upgrades an older export") can be exercised without an
 * emulator.
 */

export const VTTCAMP_FORMAT = 'vttcamp';
export const VTTCAMP_FORMAT_VERSION = 1;

export interface VttCampManifest {
  format: typeof VTTCAMP_FORMAT;
  /** Archive container format — bumps only if the zip layout itself changes
   * (distinct from `schemaVersion`, which is the room-doc shape). */
  formatVersion: number;
  /** The room's `schemaVersion` *as exported*, before any migration. */
  schemaVersion: number;
  exportedAt: number;
  roomName: string;
  /** Every `AssetStore` ref the room touches (token/profile/handout images)
   * — informational today; a future archive version could bundle the
   * bytes for refs that aren't bundled/URL, but v1 assets are always
   * resolvable without the archive carrying pixels (Plan §6). */
  assetRefs: string[];
}

interface VttCampArchiveBody {
  manifest: VttCampManifest;
  room: Record<string, unknown>;
  collections: Record<string, Array<Record<string, unknown>>>;
  /** Absent on a pre-v11 (single implicit map) archive — see
   * `archiveToSnapshot`'s legacy-adoption branch. */
  maps?: Array<{
    doc: Record<string, unknown>;
    collections: Record<string, Array<Record<string, unknown>>>;
  }>;
  encounter: Record<string, unknown> | null;
  yjs: Record<string, string>;
}

export class VttCampFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VttCampFormatError';
  }
}

function collectAssetRefs(snapshot: CampaignSnapshot): string[] {
  const refs = new Set<string>();
  for (const token of snapshot.collections['tokens'] ?? []) {
    if (typeof token['imageRef'] === 'string') refs.add(token['imageRef']);
  }
  for (const profile of snapshot.collections['profiles'] ?? []) {
    if (typeof profile['portraitRef'] === 'string') refs.add(profile['portraitRef']);
  }
  for (const gmDoc of snapshot.collections['gmPrivate'] ?? []) {
    if (gmDoc['kind'] === 'handout' && typeof gmDoc['ref'] === 'string') {
      refs.add(gmDoc['ref']);
    }
  }
  const handout = (snapshot.room as { handout?: { ref?: unknown } | null }).handout;
  if (handout && typeof handout.ref === 'string') refs.add(handout.ref);
  // Background is per-map (R17.3) — scan every map's, not just the active one.
  for (const { doc } of snapshot.maps ?? []) {
    const background = (doc as { background?: { ref?: unknown } | null }).background;
    if (background && typeof background.ref === 'string') refs.add(background.ref);
  }
  return [...refs].sort();
}

/** Room → zip bytes. `exportRoom`'s output goes straight in, untouched —
 * the export side never migrates (that only matters on import, per Gate 5's
 * "a migration upgrades an *older* export"). */
export function snapshotToArchive(snapshot: CampaignSnapshot): Uint8Array {
  const roomName =
    typeof snapshot.room['name'] === 'string' ? (snapshot.room['name'] as string) : 'Untitled Room';
  const schemaVersion =
    typeof snapshot.room['schemaVersion'] === 'number'
      ? (snapshot.room['schemaVersion'] as number)
      : 0;

  const manifest: VttCampManifest = {
    format: VTTCAMP_FORMAT,
    formatVersion: VTTCAMP_FORMAT_VERSION,
    schemaVersion,
    exportedAt: Date.now(),
    roomName,
    assetRefs: collectAssetRefs(snapshot),
  };

  const body: VttCampArchiveBody = {
    manifest,
    room: snapshot.room,
    collections: snapshot.collections,
    maps: snapshot.maps,
    encounter: snapshot.encounter,
    yjs: snapshot.yjs,
  };

  return zipSync({ 'campaign.json': strToU8(JSON.stringify(body)) });
}

/** The one map a pre-v11 (single implicit map) archive gets adopted into —
 * fixed id so `archiveToSnapshot` can point `room.activeMapId` at it without
 * generating one (the importing `CampaignStore` uses this id verbatim, same
 * as any other map doc id in the snapshot). */
const LEGACY_MAP_ID = 'legacy-map';

/** Zip bytes → snapshot, walking the room doc forward through the migration
 * scaffold (`migrateRoom`) to `CURRENT_SCHEMA_VERSION` first — this is the
 * one place an older `.vttcamp` gets upgraded on the way back in. A pre-v11
 * archive (no `maps` array — the map-scoped collections still sit flat in
 * `collections`, and the room doc itself still carries its `grid`/`fog`/
 * `background`/`settings.measure`/`settings.grid`) is adopted into one
 * synthetic map here, mirroring `CampaignStore.ensureActiveMap`'s live-room
 * adoption — so every importer (`FirebaseStore`/`MemoryStore`) only ever has
 * to handle the current (`maps` always present) shape. */
export function archiveToSnapshot(bytes: Uint8Array): CampaignSnapshot {
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new VttCampFormatError('Not a valid zip archive');
  }

  const entry = files['campaign.json'];
  if (!entry) {
    throw new VttCampFormatError('Not a .vttcamp archive: missing campaign.json');
  }

  let body: VttCampArchiveBody;
  try {
    body = JSON.parse(strFromU8(entry)) as VttCampArchiveBody;
  } catch {
    throw new VttCampFormatError('campaign.json is not valid JSON');
  }

  if (body.manifest?.format !== VTTCAMP_FORMAT) {
    throw new VttCampFormatError(`Unrecognized archive format: ${String(body.manifest?.format)}`);
  }

  const rawRoom = body.room;
  const room = migrateRoom(rawRoom) as Record<string, unknown>;

  if (body.maps) {
    return {
      room,
      collections: body.collections ?? {},
      maps: body.maps,
      encounter: body.encounter ?? null,
      yjs: body.yjs ?? {},
    };
  }

  // ---- legacy (<v11) archive: adopt the flat map data into one map ----
  const rawCollections = body.collections ?? {};
  const mapCollectionKeys = new Set<string>(EXPORTED_MAP_COLLECTIONS);
  const sessionCollections: Record<string, Array<Record<string, unknown>>> = {};
  const legacyMapCollections: Record<string, Array<Record<string, unknown>>> = {};
  for (const [key, docs] of Object.entries(rawCollections)) {
    (mapCollectionKeys.has(key) ? legacyMapCollections : sessionCollections)[key] = docs;
  }
  const legacySettings = (rawRoom['settings'] as Record<string, unknown> | undefined) ?? {};
  const legacyMapDoc: Record<string, unknown> = {
    id: LEGACY_MAP_ID,
    name: DEFAULT_MAP_NAME,
    order: 0,
    createdAt: typeof rawRoom['createdAt'] === 'number' ? rawRoom['createdAt'] : Date.now(),
    grid: rawRoom['grid'] ?? DEFAULT_GRID_CONFIG,
    fog: rawRoom['fog'] ?? DEFAULT_FOG_CONFIG,
    background: 'background' in rawRoom ? rawRoom['background'] : DEFAULT_BACKGROUND,
    measure: legacySettings['measure'] ?? DEFAULT_MEASURE,
    gridSettings: legacySettings['grid'] ?? DEFAULT_GRID_SETTINGS,
  };

  // Strip the fields that just got adopted into the map — the pure
  // version-walk migrations that ran inside `migrateRoom` above predate the
  // v10->v11 move and still inject them (e.g. v4->v5/v5->v6 backfilling
  // `settings.measure`/`settings.grid`), but they no longer belong on the
  // room doc; leaving them would round-trip stale duplicate data.
  const { grid: _grid, fog: _fog, background: _background, ...roomWithoutMapFields } = room;
  const { measure: _measure, grid: _settingsGrid, ...settingsWithoutMapFields } =
    (room['settings'] as Record<string, unknown> | undefined) ?? {};

  return {
    room: { ...roomWithoutMapFields, settings: settingsWithoutMapFields, activeMapId: LEGACY_MAP_ID },
    collections: sessionCollections,
    maps: [{ doc: legacyMapDoc, collections: legacyMapCollections }],
    encounter: body.encounter ?? null,
    yjs: body.yjs ?? {},
  };
}

/** Reads just the manifest without decoding the full archive — cheap enough
 * for an import dialog to preview what it's about to load. */
export function readManifest(bytes: Uint8Array): VttCampManifest {
  const files = unzipSync(bytes);
  const entry = files['campaign.json'];
  if (!entry) {
    throw new VttCampFormatError('Not a .vttcamp archive: missing campaign.json');
  }
  const body = JSON.parse(strFromU8(entry)) as VttCampArchiveBody;
  if (body.manifest?.format !== VTTCAMP_FORMAT) {
    throw new VttCampFormatError(`Unrecognized archive format: ${String(body.manifest?.format)}`);
  }
  return body.manifest;
}
