import { BundledAssetStore, type AssetStore } from '@osr-vtt/shared';

/**
 * v1 default (Plan §6, §8.11): BundledAssetStore only — resolves refs
 * against the static bundle's `assets/` directory (or a pasted absolute
 * URL, unchanged). No uploads, no Cloud Storage, no card on file.
 */
export const assetStore: AssetStore = new BundledAssetStore(`${import.meta.env.BASE_URL}assets/`);

export const STARTER_MAP_REF = 'maps/starter-room.svg';
export const STARTER_TOKEN_REFS = ['tokens/fighter.svg', 'tokens/goblin.svg'] as const;
export const DICE_FACE_REF = (face: number) => `dice/d6/face-${face}.svg`;
