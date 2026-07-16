import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { migrateRoom } from '../migrations/index.js';
import type { CampaignSnapshot } from '../store/campaign-store.js';

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
  const background = (snapshot.room as { background?: { ref?: unknown } | null }).background;
  if (background && typeof background.ref === 'string') refs.add(background.ref);
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
    encounter: snapshot.encounter,
    yjs: snapshot.yjs,
  };

  return zipSync({ 'campaign.json': strToU8(JSON.stringify(body)) });
}

/** Zip bytes → snapshot, walking the room doc forward through the migration
 * scaffold (`migrateRoom`) to `CURRENT_SCHEMA_VERSION` first — this is the
 * one place an older `.vttcamp` gets upgraded on the way back in. */
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

  const room = migrateRoom(body.room);

  return {
    room,
    collections: body.collections ?? {},
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
