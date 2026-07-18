import type { Cell } from '../map/grid.js';
import type {
  AccountInfo,
  AssetRef,
  BlindDraw,
  CircleWall,
  DiceMacro,
  Drawing,
  Encounter,
  FloorChunk,
  FogChunk,
  GameMap,
  Group,
  HandoutRecord,
  LogEntry,
  MapLight,
  MapRoom,
  MapSymbol,
  MapWall,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  ProfileTemplateField,
  ProfileValue,
  RandomTable,
  Role,
  Roll,
  Room,
  SharedRoll,
  SharedRollSlot,
  SightWall,
  Token,
} from '../types.js';

export type Unsubscribe = () => void;

/**
 * Outcome of `linkWithGoogle` (Master Plan v2, R6.1). Success upgrades the
 * current anonymous uid in place. The one specifically-handled failure is
 * `credential-already-in-use` — the chosen Google account is already bound to
 * a *different* uid, so linking can't happen; the UI offers sign-in-instead
 * (a deliberate identity switch, no merge in v1). `cancelled` is the user
 * closing the popup; `error` is everything else. */
export type LinkAccountResult =
  | { ok: true; account: AccountInfo }
  | { ok: false; reason: 'credential-already-in-use' | 'cancelled' | 'error'; message?: string };

/**
 * Live log/roll subscriptions cap at the most-recent N entries (Master Plan
 * v2, R5.2 / U18 — "Rolls/log grow unbounded; subscriptions load everything").
 * The Log activity pages further back through history in blocks of this size
 * via `listLogBefore`, so the boundary the pager crosses is exactly this
 * number. Kept here (not in a store impl) so both `FirebaseStore` and
 * `MemoryStore` — and the contract suite that pins the boundary — share one
 * definition. */
export const LIVE_LOG_LIMIT = 200;

export interface CursorPos {
  uid: string;
  x: number;
  y: number;
  ts: number;
}

export interface DragFrame {
  x: number;
  y: number;
}

export interface PingPos {
  id: string;
  uid: string;
  x: number;
  y: number;
  ts: number;
}

/** In-progress carve/fill/eraser preview, streamed via RTDB while the
 * pointer is down and cleared on release/commit (Spec §7 write discipline —
 * peers see the live stroke without a single Firestore write until it
 * settles). */
export interface MapDraft {
  uid: string;
  tool: string;
  cells: Cell[];
  ts: number;
}

/**
 * The full document tree of one room (Plan §5, §7 Phase 5), as read by
 * `exportRoom` / written by `importRoom`. Every sub-collection is a plain
 * array of raw doc bodies with the doc id folded back in as `id` — the same
 * shape a converter's `fromFirestore` would produce, but unvalidated (schema
 * validation/migration happens at the `.vttcamp` archive boundary in
 * `portability/vttcamp.ts`, not here). `yjs` carries base64-encoded
 * `Y.encodeStateAsUpdate` snapshots keyed by doc name (currently just
 * `"notes"`). `maps` is one entry per `GameMap` (Master Plan v2, R17.3 —
 * multiple full map builds per session), each carrying its own cellular-map
 * subcollections; `collections` now holds only session-scoped data.
 */
export interface CampaignSnapshot {
  room: Record<string, unknown>;
  collections: Record<string, Array<Record<string, unknown>>>;
  maps: Array<{
    doc: Record<string, unknown>;
    collections: Record<string, Array<Record<string, unknown>>>;
  }>;
  encounter: Record<string, unknown> | null;
  yjs: Record<string, string>;
}

/** Every session-scoped room sub-collection a `.vttcamp` export carries
 * (Plan §5). The `encounter/current` singleton and the `notes` Yjs doc are
 * handled separately (see `CampaignSnapshot`); map-scoped collections are
 * `EXPORTED_MAP_COLLECTIONS` below, one set per `maps/{mapId}`. */
export const EXPORTED_COLLECTIONS = [
  'players',
  'profiles',
  'tokens',
  'groups',
  'log',
  'rolls',
  'tables',
  'macros',
  'assetRefs',
  'gmPrivate',
] as const;

/** Every map-scoped sub-collection a `GameMap` carries (Master Plan v2,
 * R17.3) — nested under `rooms/{roomId}/maps/{mapId}/*`. */
export const EXPORTED_MAP_COLLECTIONS = [
  'drawings',
  'floorChunks',
  'fogChunks',
  'walls',
  'sightWalls',
  'circleWalls',
  'lights',
  'symbols',
  'mapRooms',
] as const;

/**
 * Data-access abstraction (Plan §1.3). ALL Firebase reads/writes go through
 * an implementation of this interface — Svelte components never import the
 * Firebase SDK directly. Swapping backends later (PocketBase, Supabase, a
 * second emulator-backed impl for Phase 6 contract tests) means writing a
 * new `CampaignStore`, not touching UI code.
 */
export interface CampaignStore {
  /** Anonymous Auth bootstrap (Plan §2.3). Resolves to the stable client UID. */
  ensureAuth(): Promise<string>;
  currentUid(): string | null;

  // ---- accounts (Master Plan v2, R6.1 — optional Google linking) ----

  /** Live Auth identity (uid, anonymous-vs-linked, provider display name/email).
   * Fires once with the current state on subscribe, then on every auth change
   * (link, sign-in, sign-out). */
  subscribeAuth(cb: (account: AccountInfo | null) => void): Unsubscribe;
  /** Upgrades the current anonymous uid in place by linking a Google credential
   * (`linkWithPopup`) — same uid, zero data migration, so a GM's room ownership
   * survives (Master Plan v2, R6.1). See `LinkAccountResult` for the outcomes. */
  linkWithGoogle(): Promise<LinkAccountResult>;
  /** Signs in with Google, *switching* which uid this client is (discarding the
   * current anonymous one). Used on a fresh device to recover a linked identity
   * (⇒ GM recovery) and as the "sign in instead" path when a link hits
   * `credential-already-in-use`. Resolves to the recovered uid. */
  signInWithGoogle(): Promise<string>;
  /** Signs out of the current identity and re-bootstraps a fresh anonymous uid
   * so the app keeps working (never a logged-out dead end). Resolves to the new
   * anonymous uid. */
  signOutToAnonymous(): Promise<string>;

  /** Creates `rooms/{roomId}`, setting gmUid to the caller's uid. */
  createRoom(input: {
    name: string;
    profileTemplate: ProfileTemplateField[];
    difficultyDie?: string;
    dangerDie?: string;
    /** Unenforced in Phase 0 (Plan §8.5) — stored for later. */
    password?: string;
  }): Promise<string>;

  getRoom(roomId: string): Promise<Room | null>;
  subscribeRoom(roomId: string, cb: (room: Room | null) => void): Unsubscribe;

  // ---- My Rooms index (Master Plan v2, R6.2 — Lobby v2) ----

  /** The caller's own `users/{uid}/rooms/*` index, newest-visited first.
   * Best-effort convenience data; a dangling entry (room deleted elsewhere) is
   * kept and surfaced as a "room gone" row rather than silently dropped. */
  subscribeMyRooms(cb: (rooms: MyRoomEntry[]) => void): Unsubscribe;
  /** Upserts the caller's index entry for a room (Master Plan v2, R6.2 —
   * "written on create/join/open"), refreshing `name`/`role`/`lastSeenAt`.
   * `createRoom`/`joinRoom` call this automatically; the room-open path calls
   * it directly. Self-owned (rules gate it to the caller's own uid). */
  recordRoomVisit(roomId: string, entry: { name: string; role: Role }): Promise<void>;
  /** Removes one entry from the caller's index — the "remove?" action on a
   * dangling row, and the cleanup a GM's own client does after `deleteRoom`. */
  removeMyRoom(roomId: string): Promise<void>;

  /**
   * GM room deletion (Master Plan v2, R6.3): client-side recursive delete of
   * every room subcollection in ≤400-doc batches, then the room doc, then the
   * ephemeral RTDB `/rooms/{roomId}` node. Only the room's GM may delete the
   * room doc (Security Rules) — a non-GM call fails at that write. Does NOT
   * touch any user's My Rooms index (those are best-effort and self-owned;
   * the caller removes its own entry separately). */
  deleteRoom(roomId: string): Promise<void>;

  /** Room name inline edit (Master Plan v2, R4 — Session Config "Room"
   * section) — GM-only room-doc update, same pattern as `setMapFogMode`. */
  renameRoom(roomId: string, name: string): Promise<void>;
  /** Theme select (R2, re-housed into Session Config per R4) — GM-set so
   * every player renders the same map colors (`resolveThemeName`). Session-
   * wide, not per-map (R17.3). */
  setTheme(roomId: string, theme: string): Promise<void>;
  /** Tension defaults (Master Plan v2, R4 — "Tension defaults" section).
   * Plain die-expression strings; never interpreted (Plan §2.5). */
  setTensionDefaults(
    roomId: string,
    input: { difficultyDie: string; dangerDie: string },
  ): Promise<void>;

  // ---- maps (Master Plan v2, R17.3 — multiple full map builds per session)

  /** Every `GameMap` in the session (for the Maps manager), unordered by
   * subscription — sort by `order` for display. */
  subscribeMaps(roomId: string, cb: (maps: GameMap[]) => void): Unsubscribe;
  /** The single active (or any one) `GameMap` doc. `cb(null)` only while
   * `mapId` doesn't (yet) resolve to a doc — e.g. mid-`ensureActiveMap`. */
  subscribeMap(roomId: string, mapId: string, cb: (map: GameMap | null) => void): Unsubscribe;
  /** GM creates a new, independently-configured map build (own background/
   * grid/fog/floor/walls/etc.) — does not change which map is active. */
  createMap(roomId: string, input: { name: string }): Promise<string>;
  renameMap(roomId: string, mapId: string, name: string): Promise<void>;
  /** GM deletes a map and every one of its subcollections. Deleting the
   * currently-active map is a client-side-guarded no-op (the Maps manager
   * requires switching active to a different map first) — not enforced by
   * Security Rules, same trust model as every other GM-only action. */
  deleteMap(roomId: string, mapId: string): Promise<void>;
  /** GM switches which map every player's client renders — writes
   * `Room.activeMapId`. */
  setActiveMap(roomId: string, mapId: string): Promise<void>;
  /**
   * Adopts a pre-multi-map room's existing flat cellular-map data into a
   * freshly created first `GameMap`, and sets `Room.activeMapId` to it — the
   * real (non-pure, doc-moving) half of the v10->v11 migration (see
   * `migrations/index.ts`). A no-op once `Room.activeMapId` is already set.
   * Call once per room-open, gated to the GM's client only (avoids two
   * clients racing the adoption) — idempotent either way, so a stale/racing
   * call is harmless. Resolves to the room's active map id either way. */
  ensureActiveMap(roomId: string): Promise<string>;

  /** Managed background image (R15/WI-19) — GM-set so every player renders the
   * same backdrop, per map (R17.3). `setMapBackground` points the map at an
   * asset ref (bundled or saved URL); `removeMapBackground` clears it to
   * `null` so the stage shows bare rock. */
  setMapBackground(roomId: string, mapId: string, ref: string): Promise<void>;
  removeMapBackground(roomId: string, mapId: string): Promise<void>;
  /** Grid dimensions + cell size (Master Plan v2, R4 — previously
   * compile-time-only defaults), per map (R17.3). The grow-only "would orphan
   * carved chunks" guard is enforced client-side by the Session Config UI
   * (via `carvedBoundingBox`, `map/grid.ts`) before calling this — a plain
   * write. */
  setMapGridDimensions(roomId: string, mapId: string, grid: GameMap['grid']): Promise<void>;

  /** Writes `rooms/{roomId}/players/{uid}` for the caller. */
  joinRoom(roomId: string, displayName: string): Promise<void>;
  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe;
  /** GM renames a seat's display name (Master Plan v2, R4 — "Players"
   * section, in-session management). */
  renamePlayer(roomId: string, uid: string, displayName: string): Promise<void>;
  /** GM sets a seat's role (Master Plan v2, R4). GM-ness itself only ever
   * changes via `transferGM` — never through this setter. */
  setPlayerRole(roomId: string, uid: string, role: 'player' | 'viewer'): Promise<void>;
  /** GM removes a seat (Master Plan v2, R4). Always deletes `players/{uid}`;
   * the player's `profiles/{seatId}` instance (seatId === uid for v1) is kept
   * unless `deleteProfile` is set. The removed player's own client falls back
   * to the join gate reactively once their seat doc disappears — no separate
   * "kick" signal needed (`RoomShell`'s `hasJoined` derivation). */
  removePlayer(roomId: string, uid: string, opts?: { deleteProfile?: boolean }): Promise<void>;
  /** Transfer referee (Master Plan v2, R4): writes the new `gmUid`, demotes
   * the caller's own seat to `player`, and promotes the target seat to `gm`.
   * Security Rules already gate room-doc updates to the *current* GM
   * (checked against the pre-write stored doc), so only the acting GM can
   * call this — see the rules test in `firestore.rules.test.ts`. */
  transferGM(roomId: string, newGmUid: string): Promise<void>;

  subscribeTokens(roomId: string, cb: (tokens: Token[]) => void): Unsubscribe;
  createToken(roomId: string, token: Omit<Token, 'id'> & { id?: string }): Promise<string>;
  moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void>;
  /** Batch-moves several tokens' positions in one logical write burst (Master
   * Plan v2, R8.4). A collapsed group's drag lands every member's new
   * position as one Firestore `WriteBatch.commit()`, never one write per
   * token — the same write-discipline pattern `setWalls` uses for a wall
   * drag-run. Each update only patches `pos`, leaving every other token field
   * (size, owner, layer) untouched. */
  moveTokens(
    roomId: string,
    updates: Array<{ tokenId: string; pos: { x: number; y: number } }>,
  ): Promise<void>;
  /** Token scale slider, 1×1–3×3 (Plan §7 Phase 1). `size` is a grid-cell
   * multiplier, same unit `Token.size` already uses. */
  resizeToken(roomId: string, tokenId: string, size: number): Promise<void>;
  /** Swaps a token's art (Master Plan v2, R7.3 — "My token"): re-points an
   * existing token at a new `imageRef` without touching its position/size/
   * ownership. Distinct from `createToken`, which always makes a new doc. */
  setTokenImage(roomId: string, tokenId: string, imageRef: string): Promise<void>;
  /** Links a token to a player's Profile instance (Encounter Screen Spec §5:
   * actor cards surface their linked Profile's `roll` fields and raise the
   * Dock on selection). `undefined` clears the link. */
  setTokenOwner(roomId: string, tokenId: string, ownerSeatId: string | undefined): Promise<void>;

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe;
  createGroup(roomId: string, group: Omit<Group, 'id'> & { id?: string }): Promise<string>;
  /** Partial update — e.g. a single `[Map]`/`[Board]`/`[Active]` toggle
   * flip, a rename, or a member-list edit. */
  updateGroup(roomId: string, groupId: string, patch: Partial<Omit<Group, 'id'>>): Promise<void>;
  deleteGroup(roomId: string, groupId: string): Promise<void>;

  // ---- combat tracker (Encounter Screen Spec §4, §10) ----

  /** rooms/{roomId}/encounter/current — the room's one encounter doc.
   * `cb(null)` until a GM starts an encounter for the first time. */
  subscribeEncounter(roomId: string, cb: (encounter: Encounter | null) => void): Unsubscribe;
  /** Persists the full encounter doc. All ordering/advancing arithmetic
   * lives in `encounter/initiative.ts` — this just writes the result. */
  writeEncounter(roomId: string, encounter: Encounter): Promise<void>;

  // ---- cellular map model (Map Tooling Spec §7) — all per-map (R17.3) ----

  /** Floor cells, chunked 16×16 (Spec §7). `commitFloorChunks` writes a
   * batch of whole chunk docs in one Firestore transaction — the
   * commit-on-pointer-release step of a carve/fill stroke. */
  subscribeFloorChunks(roomId: string, mapId: string, cb: (chunks: FloorChunk[]) => void): Unsubscribe;
  commitFloorChunks(roomId: string, mapId: string, chunks: FloorChunk[]): Promise<void>;

  /** Explicit walls + doors only — perimeter walls are derived client-side,
   * never stored (Spec §1, §4). */
  subscribeWalls(roomId: string, mapId: string, cb: (walls: MapWall[]) => void): Unsubscribe;
  setWall(roomId: string, mapId: string, wall: Omit<MapWall, 'id'> & { id?: string }): Promise<string>;
  removeWall(roomId: string, mapId: string, edgeId: string): Promise<void>;
  /** Batch-writes a whole wall drag-run in one commit (Master Plan v2, R9.2)
   * — "wall run = one gesture, one batch write," the same write-discipline
   * pattern `commitFloorChunks` already uses for a carve stroke. Every
   * `MapWall` carries its final `id` (the canonical edge id), so this is a
   * pure batch upsert, not an add-with-generated-id like `setWall`. */
  setWalls(roomId: string, mapId: string, walls: MapWall[]): Promise<void>;
  /** Batch-removes a wall drag-run — the erase-mode counterpart to
   * `setWalls` (Master Plan v2, R9.2). */
  removeWalls(roomId: string, mapId: string, edgeIds: string[]): Promise<void>;

  subscribeSymbols(roomId: string, mapId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe;
  placeSymbol(roomId: string, mapId: string, symbol: Omit<MapSymbol, 'id'> & { id?: string }): Promise<string>;
  removeSymbol(roomId: string, mapId: string, symbolId: string): Promise<void>;

  /** Keyed/named dungeon rooms (the Label/Key tool). Distinct from the
   * campaign `rooms/{roomId}` doc itself. */
  subscribeMapRooms(roomId: string, mapId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe;
  upsertMapRoom(roomId: string, mapId: string, mapRoom: MapRoom): Promise<void>;
  removeMapRoom(roomId: string, mapId: string, mapRoomId: string): Promise<void>;

  /** Manual-reveal fog mask (Spec §6). Meaningless when the map's `fog.mode`
   * is `'emergent'` — floor cells ARE the revealed mask then. */
  subscribeFogChunks(roomId: string, mapId: string, cb: (chunks: FogChunk[]) => void): Unsubscribe;
  commitFogChunks(roomId: string, mapId: string, chunks: FogChunk[]): Promise<void>;
  /** Fog: Reset (Spec §3) — clears every revealed cell back to hidden. */
  resetFog(roomId: string, mapId: string): Promise<void>;

  /** Fog mode switch (Spec §6) — GM-only map-doc update, per map (R17.3).
   * `dynamic` engages Phase 4 raycasting LoS from walls (see `map/los.ts`). */
  setMapFogMode(roomId: string, mapId: string, mode: GameMap['fog']['mode']): Promise<void>;

  /** Measurement ruler settings (Master Plan v2, R9.3) — a GM-set map-doc
   * update, per map (R17.3, different maps may use different scales). */
  setMapMeasurement(roomId: string, mapId: string, measure: GameMap['measure']): Promise<void>;

  /** Half-grid subdivision toggle (Master Plan v2, R9.6) — render-only
   * map-doc update, per map; does not touch the cellular model or LoS. */
  setMapGridSubdivide(roomId: string, mapId: string, subdivide: boolean): Promise<void>;

  // ---- imported vision geometry (Plan §7 Phase 4 — `.uvtt` import) ----

  /** Vector (non-grid) vision-blocking walls + door portals imported from a
   * `.uvtt`/`.dd2vtt` (see `map/uvtt.ts`). Player-readable (trust model);
   * fed into `sightSegments()` for dynamic LoS. */
  subscribeSightWalls(roomId: string, mapId: string, cb: (walls: SightWall[]) => void): Unsubscribe;
  subscribeLights(roomId: string, mapId: string, cb: (lights: MapLight[]) => void): Unsubscribe;
  /** Replaces all imported walls + lights in one batch — a fresh `.uvtt`
   * import supersedes any previous one rather than accumulating. */
  importUvtt(
    roomId: string,
    mapId: string,
    input: { walls: Array<Omit<SightWall, 'id'>>; lights: Array<Omit<MapLight, 'id'>> },
  ): Promise<void>;
  /** Adds one diagonal vector wall (Master Plan v2, R9.2 — Wall tool's
   * diagonal-run mode). Distinct from `importUvtt`, which replaces the whole
   * collection; this adds a single record, mirroring `setWall`/`placeSymbol`. */
  addSightWall(roomId: string, mapId: string, wall: Omit<SightWall, 'id'> & { id?: string }): Promise<string>;
  removeSightWall(roomId: string, mapId: string, sightWallId: string): Promise<void>;

  /** Circular vision-blocking walls (Master Plan v2, R10.5). Player-readable,
   * same trust model as grid/sight walls; fed into `sightSegments()` (sampled
   * to an N-gon with `gaps` skipped). `setCircleWall` upserts by id so the
   * undo/redo op path and a "cut a gap" edit both replay through one call. */
  subscribeCircleWalls(roomId: string, mapId: string, cb: (walls: CircleWall[]) => void): Unsubscribe;
  setCircleWall(roomId: string, mapId: string, wall: Omit<CircleWall, 'id'> & { id?: string }): Promise<string>;
  removeCircleWall(roomId: string, mapId: string, circleWallId: string): Promise<void>;

  /** The demoted Annotate overlay (Spec §3) — loose freehand/text notes,
   * not the cellular map-making core. */
  subscribeDrawings(roomId: string, mapId: string, cb: (drawings: Drawing[]) => void): Unsubscribe;
  writeDrawing(roomId: string, mapId: string, drawing: Omit<Drawing, 'id'> & { id?: string }): Promise<string>;
  deleteDrawing(roomId: string, mapId: string, drawingId: string): Promise<void>;

  subscribeProfiles(roomId: string, cb: (profiles: ProfileInstance[]) => void): Unsubscribe;
  setProfileValue(
    roomId: string,
    seatId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void>;
  /** "My token" (Master Plan v2, R7.3): sets/clears the seat's Profile
   * portrait ref — a plain field patch, own-seat-or-GM writable, same trust
   * model as `setProfileValue` (§2.5). `undefined` clears it back to the
   * generated `gen:disc:` default the Character dock falls back to. */
  setProfilePortrait(
    roomId: string,
    seatId: string,
    portraitRef: string | undefined,
  ): Promise<void>;

  /** GM adds/removes/reorders `profileTemplate` fields (Plan §2.5) — a plain
   * write to the room doc's `profileTemplate` array. The dock re-renders
   * generically from whatever comes back through `subscribeRoom`. */
  updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void>;

  /** Live log subscription, capped at the most-recent `LIVE_LOG_LIMIT`
   * entries (Master Plan v2, R5.2 / U18) and delivered oldest-first. Older
   * history is paged in on demand via `listLogBefore`. */
  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe;
  writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string>;
  /**
   * One-shot "load older" page for the Log activity (Master Plan v2, R5.2):
   * the up-to-`limit` entries strictly older than `before` (a `ts`), returned
   * oldest-first so a caller can prepend them to what it already holds. Paging
   * back in `LIVE_LOG_LIMIT`-sized blocks from the oldest loaded `ts` walks the
   * whole history across the live-subscription boundary. */
  listLogBefore(roomId: string, before: number, limit: number): Promise<LogEntry[]>;

  /**
   * GM maintenance — "prune entries older than N days" (Master Plan v2, R6.4).
   * Permanently deletes every `log` and `rolls` doc with `ts < before`, in
   * ≤400-doc batches, and resolves to how many of each were removed. The UI
   * offers "export first"; this call itself is the destructive step. */
  pruneEntriesBefore(roomId: string, before: number): Promise<{ log: number; rolls: number }>;

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe;
  writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string>;

  // ---- shared rolls (Master Plan v2, R3.6) ----

  /** rooms/{roomId}/sharedRoll/current — `cb(null)` until a referee has ever
   * opened one. */
  subscribeSharedRoll(roomId: string, cb: (sharedRoll: SharedRoll | null) => void): Unsubscribe;
  /** Referee-only: starts a fresh staging round, clearing any previous
   * slots — the room has one shared roll in flight at a time. */
  openSharedRoll(roomId: string, input: { openedBy: string; label?: string }): Promise<void>;
  /** Own-slot-or-GM write (mirrors Profiles, §2.5): a player may only pass
   * their own uid as `slotId`; the GM may stage any slot id (e.g. a groupId,
   * for a monster side). A no-op if no shared roll is currently open. */
  stageSharedSlot(roomId: string, slotId: string, slot: SharedRollSlot): Promise<void>;
  /**
   * Referee-only: the "press one Roll" moment. Reads the current staging
   * doc, expands every `ready` slot deterministically from a fresh seed
   * (`dice/engine.ts` `expandSharedRollSlots` — seat-id-sorted, so every
   * client re-derives identical faces), writes the resulting `Roll` (with
   * `parts` set), and marks the staging doc `resolved`. Returns the written
   * `Roll` so the caller can build its own grouped log entry (display
   * concern — same split as a solo roll's `writeRoll` + `writeLog`).
   */
  resolveSharedRoll(roomId: string, authorUid: string): Promise<Roll>;

  /** Saved dice macros (Plan §7 Phase 3) — a snapshot of a tray configuration
   * a player can replay later. Owner-or-GM writable, all-readable, same
   * pattern as profiles (§2.5). */
  subscribeMacros(roomId: string, cb: (macros: DiceMacro[]) => void): Unsubscribe;
  saveMacro(roomId: string, macro: Omit<DiceMacro, 'id'> & { id?: string }): Promise<string>;
  deleteMacro(roomId: string, macroId: string): Promise<void>;

  // ---- referee random tables (Plan §7 Phase 4) ----

  /** Imported CSV/JSON random tables (`tables/{tableId}`). GM-writable,
   * all-readable; the runner (`tables/runner.ts`) resolves nested rolls. */
  subscribeTables(roomId: string, cb: (tables: RandomTable[]) => void): Unsubscribe;
  upsertTable(roomId: string, table: RandomTable): Promise<void>;
  deleteTable(roomId: string, tableId: string): Promise<void>;

  // ---- Blind Drawer (Plan §7 Phase 4 — hidden in gmPrivate per §3) ----

  /** GM-only subscription to blind-draw results under `gmPrivate/**`. Players'
   * clients are physically denied this read by Security Rules — call only when
   * the caller is the GM. */
  subscribeBlindDraws(roomId: string, cb: (draws: BlindDraw[]) => void): Unsubscribe;
  /** Writes a secret result to `gmPrivate/{id}` — unreadable by players until
   * revealed. */
  writeBlindDraw(roomId: string, draw: Omit<BlindDraw, 'id'> & { id?: string }): Promise<string>;
  /** Reveal → copies the result into the shared `log` (now all-readable) and
   * flips the gmPrivate doc's `revealed` flag. */
  revealBlindDraw(roomId: string, draw: BlindDraw): Promise<void>;

  // ---- handouts (Plan §7 Phase 5 — "reveal image to players") ----

  /** GM-only subscription to the saved handout library under `gmPrivate/**`
   * — the same physical-denial pattern as Blind Draws (§3) keeps unrevealed
   * handouts off players' clients. */
  subscribeHandoutLibrary(roomId: string, cb: (handouts: HandoutRecord[]) => void): Unsubscribe;
  saveHandout(
    roomId: string,
    handout: Omit<HandoutRecord, 'id' | 'kind' | 'revealed'> & { id?: string },
  ): Promise<string>;
  deleteHandout(roomId: string, handoutId: string): Promise<void>;
  /** Copies `ref`/`title` onto the player-readable `Room.handout` pointer and
   * flips the library entry's `revealed` flag — mirrors `revealBlindDraw`. */
  revealHandout(roomId: string, handout: HandoutRecord): Promise<void>;
  /** Clears `Room.handout` back to `null` without touching the library. */
  hideHandout(roomId: string): Promise<void>;

  // ---- Assets activity — saved URL refs (Master Plan v2, R7.2) ----

  /** The "By URL" tab's saved-refs list: player-or-GM pasted a validated
   * external image URL once, and it's reusable from then on by every
   * client's Add-creature / My-token picker (member-or-GM writable, same
   * trust model as tokens/drawings — §2.5). Bundled starter-pack refs never
   * appear here; they resolve straight off the static catalog. */
  subscribeAssetRefs(roomId: string, cb: (assetRefs: AssetRef[]) => void): Unsubscribe;
  saveAssetRef(roomId: string, assetRef: Omit<AssetRef, 'id'> & { id?: string }): Promise<string>;
  deleteAssetRef(roomId: string, assetRefId: string): Promise<void>;

  // ---- `.vttcamp` portability (Plan §5, §7 Phase 5) ----

  /** Reads the room's whole document tree (Plan §5) — every collection in
   * `EXPORTED_COLLECTIONS`, the `encounter/current` singleton, and the
   * `notes` Yjs state. GM-only in practice (only the GM can read `gmPrivate`,
   * which is included in the export). */
  exportRoom(roomId: string): Promise<CampaignSnapshot>;
  /** Writes a fresh room from a snapshot: allocates a new `roomId`, forces
   * `gmUid` to the importing caller (Security Rules require the creator to
   * own their own room), runs the room doc through `migrateRoom` first (this
   * is what upgrades an old `.vttcamp` export), and preserves every other
   * doc's original id so cross-references (groupId, ownerSeatId, encounter
   * refIds, …) stay valid. Restores `notes` Yjs state. Resolves to the new
   * roomId. */
  importRoom(snapshot: CampaignSnapshot): Promise<string>;

  // ---- Yjs transport over RTDB (Plan §7 Phase 5 — concurrent Notes) ----

  /** Live state of a room-scoped Yjs doc (e.g. `"notes"`), as a merged
   * `Y.encodeStateAsUpdate` binary. `cb(null)` until the doc has ever been
   * written. */
  subscribeYState(
    roomId: string,
    docName: string,
    cb: (state: Uint8Array | null) => void,
  ): Unsubscribe;
  /** Merges a local Yjs update into the room's shared state via an RTDB
   * transaction — `Y.applyUpdate`/`Y.encodeStateAsUpdate` are commutative and
   * idempotent, so concurrent merges from different clients converge to the
   * same state with no last-write-wins stomp. */
  mergeYUpdate(roomId: string, docName: string, update: Uint8Array): Promise<void>;
  /** One-shot read of the current merged state (used by `exportRoom`). */
  getYState(roomId: string, docName: string): Promise<Uint8Array | null>;

  /** High-frequency ephemeral channels (Plan §4) — Realtime Database, never Firestore. */
  publishCursor(roomId: string, pos: { x: number; y: number }): void;
  subscribeCursors(roomId: string, cb: (cursors: CursorPos[]) => void): Unsubscribe;

  publishDrag(roomId: string, tokenId: string, pos: DragFrame): void;
  subscribeDrag(
    roomId: string,
    tokenId: string,
    cb: (frame: DragFrame | null) => void,
  ): Unsubscribe;
  clearDrag(roomId: string, tokenId: string): void;

  /** Ping tool (Spec §3) — a transient marker on the map. Self-expires from
   * RTDB after a short delay; peers render it for as long as it's present. */
  publishPing(roomId: string, pos: { x: number; y: number }): void;
  subscribePings(roomId: string, cb: (pings: PingPos[]) => void): Unsubscribe;

  /** In-progress carve/fill/eraser preview (Spec §7 write discipline) — the
   * tool publishes the cells it's touching every frame while the pointer is
   * down; peers render a ghost preview; the tool clears it on
   * release/commit, right before the real Firestore chunk write lands.
   * Map-scoped (R17.3): a stroke preview from a map you're not currently
   * looking at is meaningless. */
  publishMapDraft(roomId: string, mapId: string, draft: MapDraft): void;
  subscribeMapDraft(roomId: string, mapId: string, cb: (drafts: MapDraft[]) => void): Unsubscribe;
  clearMapDraft(roomId: string, mapId: string, uid: string): void;
}
