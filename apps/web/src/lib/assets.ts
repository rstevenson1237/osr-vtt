import { BundledAssetStore, FirebaseStorageAssetStore, type AssetStore } from '@osr-vtt/shared';
import { getStorage } from 'firebase/storage';
import { getStore } from './firebase/client';

/**
 * v1 default (Plan §6, §8.11): BundledAssetStore only — resolves refs
 * against the static bundle's `assets/` directory (or a pasted absolute
 * URL, unchanged). No uploads, no Cloud Storage, no card on file.
 *
 * `FirebaseStorageAssetStore` (Plan §7 Phase 5, §10.5) exists behind the
 * same `AssetStore` interface but stays **disabled** — Cloud Storage
 * requires the Blaze plan (a card on file), which this project does not
 * assume. Flip it on only after doing the Blaze upgrade + budget alert
 * yourself, by setting `VITE_ENABLE_STORAGE_UPLOADS=true`.
 */
function buildAssetStore(): AssetStore {
  if (import.meta.env.VITE_ENABLE_STORAGE_UPLOADS === 'true') {
    // Ensures the default Firebase app is initialized (same singleton the
    // rest of the app uses) before deriving a Storage handle from it.
    getStore();
    return new FirebaseStorageAssetStore(getStorage());
  }
  return new BundledAssetStore(`${import.meta.env.BASE_URL}assets/`);
}

export const assetStore: AssetStore = buildAssetStore();

export const STARTER_MAP_REF = 'maps/starter-room.svg';
export const STARTER_TOKEN_REFS = ['tokens/fighter.svg', 'tokens/goblin.svg'] as const;
export const DICE_FACE_REF = (face: number) => `dice/d6/face-${face}.svg`;

/** Bundled sample fixtures for Phase 4 (referee engine + FoW LoS). */
export const SAMPLE_UVTT_REF = 'maps/sample-dungeon.dd2vtt';
export const SAMPLE_TABLE_REFS = [
  { ref: 'tables/wandering-monsters.json', kind: 'json' as const },
  { ref: 'tables/treasure.csv', kind: 'csv' as const },
];
