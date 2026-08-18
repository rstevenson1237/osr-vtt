import type { AssetStore, CampaignStore } from '@osr-vtt/shared';

/** Typed Svelte context keys. Components pull the store via `getContext`
 * (see App.svelte for the single `setContext` call) — this is the only
 * channel components use to reach Firebase, and it's typed to the
 * `CampaignStore`/`AssetStore` interfaces, never a concrete SDK type. */
export const CAMPAIGN_STORE_KEY = Symbol('campaign-store');
export const ASSET_STORE_KEY = Symbol('asset-store');

/**
 * What this **build** is (SPEC-041 §3). Set once, in `App.svelte`, from the
 * same module that chooses the store — never derived, never negotiated with the
 * store, and never re-read from an env var somewhere downstream.
 *
 * A local build has one actor, so everything whose meaning is "another person"
 * is absent from its UI rather than present-but-broken: multiplayer and room
 * join, extra seats, presence and the disconnect badges, live cursors, pings,
 * shared rolls and roll readiness, GM transfer, accounts and the rooms list.
 * The handful of containers that own those surfaces read this flag; nothing
 * else does.
 */
export const SESSION_MODE_KEY = Symbol('session-mode');

export interface SessionMode {
  /** False in a local build: one referee, one file, nobody else at the table. */
  multiplayer: boolean;
}

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
