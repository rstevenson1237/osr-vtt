import type { AssetStore, CampaignStore } from '@osr-vtt/shared';

/** Typed Svelte context keys. Components pull the store via `getContext`
 * (see App.svelte for the single `setContext` call) — this is the only
 * channel components use to reach Firebase, and it's typed to the
 * `CampaignStore`/`AssetStore` interfaces, never a concrete SDK type. */
export const CAMPAIGN_STORE_KEY = Symbol('campaign-store');
export const ASSET_STORE_KEY = Symbol('asset-store');

/** Shell-owned context (Master Plan v2, R1). The Activity Shell provides a
 * per-room reactive tool controller (bridges the Map stage ⇄ the right Tools
 * rail), shell UI state, and the dialog service that retires `window.prompt`
 * (U10). Created once per `RoomShell` instance and read by the rails/stage. */
export const MAP_TOOL_KEY = Symbol('map-tool-controller');
export const SHELL_STATE_KEY = Symbol('shell-state');
export const DIALOG_KEY = Symbol('dialog-service');
/** The session's CRDT-backed per-map-room players' notes (Shell UI Redesign) —
 * one shared Yjs doc per room, read by the Room quick sheet's list previews and
 * its inline editor. */
export const ROOM_NOTES_KEY = Symbol('room-notes');

export interface AppContext {
  store: CampaignStore;
  assets: AssetStore;
}
