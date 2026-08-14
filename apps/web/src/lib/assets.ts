import {
  BundledAssetStore,
  FirebaseStorageAssetStore,
  STARTER_MAP_REF,
  type AssetStore,
} from '@osr-vtt/shared';
import { getUploadStorage } from './firebase/client';

/**
 * v1 default (Plan §6, §8.11): BundledAssetStore only — resolves refs
 * against the static bundle's `assets/` directory (or a pasted absolute
 * URL, unchanged). No uploads, no Cloud Storage, no card on file.
 *
 * `FirebaseStorageAssetStore` (Plan §7 Phase 5, §10.5, SPEC-034) exists behind
 * the same `AssetStore` interface but stays **disabled** — Cloud Storage
 * requires the Blaze plan (a card on file), which this project does not
 * assume. Flip it on only after the `[HUMAN]` console work in
 * `docs/runbooks/blaze-billing.md`, by setting
 * `VITE_ENABLE_STORAGE_UPLOADS=true`.
 *
 * The decision is `getUploadStorage()`'s to report, not this module's to
 * re-derive from an env var: the same flag also decides whether `deleteRoom`
 * sweeps the bucket, and two independent readings of it could disagree —
 * leaving a build that uploads objects nothing ever deletes.
 */
function buildAssetStore(): AssetStore {
  const storage = getUploadStorage();
  if (storage) return new FirebaseStorageAssetStore(storage);
  return new BundledAssetStore(`${import.meta.env.BASE_URL}assets/`);
}

export const assetStore: AssetStore = buildAssetStore();

// The canonical starter map ref lives in `@osr-vtt/shared` (the v9->v10
// background migration and store defaults seed it); re-exported here so the
// web app's existing `../../assets` imports keep working unchanged.
export { STARTER_MAP_REF };
export const STARTER_TOKEN_REFS = ['tokens/fighter.svg', 'tokens/goblin.svg'] as const;
// (The old `DICE_FACE_REF` d6 face SVGs were retired in WI-4: the dice renderer
// v2 generates every die's number faces procedurally on a canvas per R3.2, so
// no dice textures are loaded from the bundle anymore.)

/** Bundled sample fixtures for Phase 4 (referee engine + FoW LoS). */
export const SAMPLE_UVTT_REF = 'maps/sample-dungeon.dd2vtt';
export const SAMPLE_TABLE_REFS = [
  { ref: 'tables/wandering-monsters.json', kind: 'json' as const },
  { ref: 'tables/treasure.csv', kind: 'csv' as const },
];
