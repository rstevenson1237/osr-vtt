import type { AssetStore, CampaignStore } from '@osr-vtt/shared';

/** Typed Svelte context keys. Components pull the store via `getContext`
 * (see App.svelte for the single `setContext` call) — this is the only
 * channel components use to reach Firebase, and it's typed to the
 * `CampaignStore`/`AssetStore` interfaces, never a concrete SDK type. */
export const CAMPAIGN_STORE_KEY = Symbol('campaign-store');
export const ASSET_STORE_KEY = Symbol('asset-store');

export interface AppContext {
  store: CampaignStore;
  assets: AssetStore;
}
