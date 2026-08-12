import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { foldLegacyMapBackground, migrateProfile, migrateRoom } from '../migrations/index.js';
import { LEGACY_FLAT_MAP_COLLECTIONS, type CampaignSnapshot } from '../store/campaign-store.js';
import {
  DEFAULT_BACKGROUND,
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
/**
 * Bumped 1 -> 2 for the WI-D pure-rollout cutover (DECISIONS.md WI-D D1,
 * WI-B B3): the cellular map model (floor chunks/walls/sight walls/circle
 * walls/lights) is gone, so a v1 archive — which carries only cellular map
 * collections and no Vector Map System data — can no longer be imported into
 * an app build that can't render it. `readManifest`/`archiveToSnapshot`
 * reject any archive whose `formatVersion` predates this (SPEC §2.3 "clean
 * break" error style) rather than silently importing an unrenderable map.
 */
export const VTTCAMP_FORMAT_VERSION = 2;

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
  // Backgrounds are per-map (R17.3) and, since v23, one document each
  // (SPEC-038 §1) — scan every map's whole `backgrounds` collection, not just
  // the active map's and no longer a single map-doc field.
  for (const { collections } of snapshot.maps ?? []) {
    for (const background of collections['backgrounds'] ?? []) {
      if (typeof background['ref'] === 'string') refs.add(background['ref']);
    }
  }
  return [...refs].sort();
}

/** Is this raw `maps/{mapId}` doc a temporary battle map (SPEC-029 §3, v22)?
 *
 * Deliberately lenient — *any* `battle` object marks the doc, whether or not
 * its contents parse. "A battle map must never survive an export" is the
 * requirement (DEC-026), so a half-written marker must exclude the map too;
 * the strict shape is `BattleMapCaptureSchema`'s business, on read. */
function isBattleMapDoc(doc: Record<string, unknown>): boolean {
  const battle = doc['battle'];
  return typeof battle === 'object' && battle !== null;
}

/**
 * Drops every temporary battle map from a snapshot, re-pointing
 * `room.activeMapId` if it named one (SPEC-029 §3, DEC-026).
 *
 * A battle map is scratch state: one fight's cut-out of another map, deleted
 * when the fight ends. Carrying it into an archive would restore a dangling
 * temporary map — possibly the *active* one — into a room where nothing owns
 * it any more, and would let "exactly one at a time" be violated by an import.
 *
 * Applied on **both** sides of the archive boundary. On export it is the rule
 * itself; on import it is the cheap guarantee that an archive written by some
 * other build cannot smuggle one back in.
 *
 * The re-point prefers the battle map's own `sourceMapId` — that is where Exit
 * would have returned to — and falls back to whatever map remains, or to no
 * active map at all (`ensureActiveMap` recovers from that) when none does.
 * Returns the snapshot **by reference** when there is nothing to strip, which
 * is every ordinary room, so the round-trip identity path is untouched.
 */
function withoutBattleMaps(snapshot: CampaignSnapshot): CampaignSnapshot {
  const maps = snapshot.maps ?? [];
  const stripped = maps.filter(({ doc }) => isBattleMapDoc(doc));
  if (stripped.length === 0) return snapshot;

  const kept = maps.filter(({ doc }) => !isBattleMapDoc(doc));
  const activeMapId = snapshot.room['activeMapId'];
  const activeWasStripped =
    typeof activeMapId === 'string' && stripped.some(({ doc }) => doc['id'] === activeMapId);

  let room = snapshot.room;
  if (activeWasStripped) {
    const active = stripped.find(({ doc }) => doc['id'] === activeMapId);
    const battle = active?.doc['battle'] as { sourceMapId?: unknown } | undefined;
    const sourceMapId = typeof battle?.sourceMapId === 'string' ? battle.sourceMapId : undefined;
    const replacement =
      kept.find(({ doc }) => doc['id'] === sourceMapId)?.doc['id'] ?? kept[0]?.doc['id'];
    const { activeMapId: _dropped, ...roomWithoutActive } = snapshot.room;
    room =
      typeof replacement === 'string'
        ? { ...roomWithoutActive, activeMapId: replacement }
        : roomWithoutActive;
  }

  return { ...snapshot, room, maps: kept };
}

/** Room → zip bytes. `exportRoom`'s output goes in untouched apart from the
 * battle-map strip below — the export side never migrates (that only matters
 * on import, per Gate 5's "a migration upgrades an *older* export"). */
export function snapshotToArchive(input: CampaignSnapshot): Uint8Array {
  // Before anything reads the snapshot — including `collectAssetRefs`, so a
  // battle map's background never shows up in the manifest either.
  const snapshot = withoutBattleMaps(input);
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

/** Document id given to a pre-v23 map's folded-out background image (SPEC-038
 * §1). Fixed rather than generated because this module is pure — and it only
 * has to be unique within one map's `backgrounds` collection, which by
 * definition holds nothing else when the fold runs. */
const FOLDED_BACKGROUND_ID = 'legacy-background';

/** The v22->v23 document half, applied to every map in an archive (SPEC-038
 * §1, DEC-062): a map doc still carrying `background: { ref }` has it moved
 * into its own `backgrounds` document, sized to the full map grid.
 *
 * Keys off the field rather than off the archive's `schemaVersion`, so it is
 * idempotent — an archive written at v23+ carries no image ref on the map doc
 * and is returned **by reference**, which keeps the round-trip identity path
 * untouched.
 */
function foldMapBackgrounds(maps: NonNullable<VttCampArchiveBody['maps']>): typeof maps {
  if (!maps.some(({ doc }) => foldLegacyMapBackground(doc).background)) return maps;
  return maps.map(({ doc, collections }) => {
    const folded = foldLegacyMapBackground(doc);
    if (!folded.background) return { doc, collections };
    return {
      doc: folded.doc,
      collections: {
        ...collections,
        backgrounds: [
          ...(collections['backgrounds'] ?? []),
          { ...folded.background, id: FOLDED_BACKGROUND_ID },
        ],
      },
    };
  });
}

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
  assertSupportedFormatVersion(body.manifest.formatVersion);

  const rawRoom = body.room;
  const room = migrateRoom(rawRoom) as Record<string, unknown>;

  if (body.maps) {
    // The strip is belt and braces on this side: `snapshotToArchive` already
    // refuses to write a battle map, so only an archive from another build
    // could carry one — and importing it would resurrect a temporary map that
    // nothing owns (SPEC-029 §3).
    return withoutBattleMaps({
      room,
      collections: migrateProfileCollection(body.collections ?? {}),
      maps: foldMapBackgrounds(body.maps),
      encounter: body.encounter ?? null,
      yjs: body.yjs ?? {},
    });
  }

  // ---- legacy (<v11) archive: adopt the flat map data into one map ----
  const rawCollections = body.collections ?? {};
  // A pre-v11 archive's flat collections are exactly the legacy cellular ones;
  // the Vector Map System collections are v11+ (always under `maps/{mapId}`),
  // so they never appear flat in a legacy archive.
  const mapCollectionKeys = new Set<string>(LEGACY_FLAT_MAP_COLLECTIONS);
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
    background: 'background' in rawRoom ? rawRoom['background'] : DEFAULT_BACKGROUND,
    measure: legacySettings['measure'] ?? DEFAULT_MEASURE,
    gridSettings: legacySettings['grid'] ?? DEFAULT_GRID_SETTINGS,
  };

  // Strip the fields that just got adopted into the map — the pure
  // version-walk migrations that ran inside `migrateRoom` above predate the
  // v10->v11 move and still inject them (e.g. v4->v5/v5->v6 backfilling
  // `settings.measure`/`settings.grid`), but they no longer belong on the
  // room doc; leaving them would round-trip stale duplicate data.
  const { grid: _grid, background: _background, ...roomWithoutMapFields } = room;
  const {
    measure: _measure,
    grid: _settingsGrid,
    ...settingsWithoutMapFields
  } = (room['settings'] as Record<string, unknown> | undefined) ?? {};

  return {
    room: {
      ...roomWithoutMapFields,
      settings: settingsWithoutMapFields,
      activeMapId: LEGACY_MAP_ID,
    },
    collections: migrateProfileCollection(sessionCollections),
    // A pre-v11 archive predates v23 by definition, so its adopted background
    // — an image ref on the old *room* doc — folds out here too.
    maps: foldMapBackgrounds([{ doc: legacyMapDoc, collections: legacyMapCollections }]),
    encounter: body.encounter ?? null,
    yjs: body.yjs ?? {},
  };
}

/** The v19->v20 profile half of the import-side migration (SPEC-031 §2).
 * `migrateRoom` walks the room doc only, so the guarantee that every character
 * carries a colour has to be applied to the `profiles` collection here — this
 * is the one place a `.vttcamp`'s documents are rewritten on the way back in.
 * An actor's id rides as the exported doc's `id`; a document with no usable
 * `id` is passed through untouched rather than given a colour derived from
 * nothing. Every other collection is returned by reference, unchanged.
 *
 * **Seat-keyed profiles only** (SPEC-032 §2, DEC-042). Since v21 the
 * collection also holds token-keyed creature profiles, and "every character
 * has a colour" is a guarantee about characters — a creature has none, so
 * backfilling one here would invent data an export never carried. The seat
 * roster is the archive's own `players` collection, whose document ids are the
 * seat ids; a creature's id is a token id and matches nothing in it. An
 * archive with no `players` collection therefore backfills nothing, which is
 * the conservative direction: it has no characters we can name. */
function migrateProfileCollection(
  collections: Record<string, Array<Record<string, unknown>>>,
): Record<string, Array<Record<string, unknown>>> {
  const profiles = collections['profiles'];
  if (!profiles) return collections;
  const seatIds = new Set(
    (collections['players'] ?? [])
      .map((player) => player['id'])
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  return {
    ...collections,
    profiles: profiles.map((profile) => {
      const actorId = profile['id'];
      return typeof actorId === 'string' && seatIds.has(actorId)
        ? migrateProfile(profile, actorId)
        : profile;
    }),
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
  assertSupportedFormatVersion(body.manifest.formatVersion);
  return body.manifest;
}

/** WI-D pure-rollout cutover (DECISIONS.md WI-D D1): an archive exported
 * before the Vector Map System landed (`formatVersion < 2`) carries only
 * cellular map collections, which this build can no longer render — reject
 * it with a clear "unsupported schema" error rather than silently importing
 * a room with no floor/wall/door data (SPEC §2.3 clean-break style). */
function assertSupportedFormatVersion(formatVersion: number): void {
  if (formatVersion < VTTCAMP_FORMAT_VERSION) {
    throw new VttCampFormatError(
      `Unsupported .vttcamp archive: formatVersion ${formatVersion} predates the Vector Map ` +
        `System (current formatVersion ${VTTCAMP_FORMAT_VERSION}). This archive was exported ` +
        `before the map system's hard cutover and can no longer be imported.`,
    );
  }
}
