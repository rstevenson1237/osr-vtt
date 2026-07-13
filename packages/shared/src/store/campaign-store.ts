import type { Cell } from '../map/grid.js';
import type {
  BlindDraw,
  DiceMacro,
  Drawing,
  Encounter,
  FloorChunk,
  FogChunk,
  Group,
  HandoutRecord,
  LogEntry,
  MapLight,
  MapRoom,
  MapSymbol,
  MapWall,
  PlayerSeat,
  ProfileInstance,
  ProfileTemplateField,
  ProfileValue,
  RandomTable,
  Roll,
  Room,
  SharedRoll,
  SharedRollSlot,
  SightWall,
  Token,
} from '../types.js';

export type Unsubscribe = () => void;

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
 * `"notes"`).
 */
export interface CampaignSnapshot {
  room: Record<string, unknown>;
  collections: Record<string, Array<Record<string, unknown>>>;
  encounter: Record<string, unknown> | null;
  yjs: Record<string, string>;
}

/** Every room sub-collection a `.vttcamp` export carries (Plan §5). The
 * `encounter/current` singleton and the `notes` Yjs doc are handled
 * separately (see `CampaignSnapshot`). */
export const EXPORTED_COLLECTIONS = [
  'players',
  'profiles',
  'tokens',
  'groups',
  'drawings',
  'log',
  'rolls',
  'tables',
  'floorChunks',
  'fogChunks',
  'walls',
  'sightWalls',
  'lights',
  'symbols',
  'mapRooms',
  'macros',
  'gmPrivate',
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

  /** Room name inline edit (Master Plan v2, R4 — Session Config "Room"
   * section) — GM-only room-doc update, same pattern as `setFogMode`. */
  renameRoom(roomId: string, name: string): Promise<void>;
  /** Theme select (R2, re-housed into Session Config per R4) — GM-set so
   * every player renders the same map colors (`resolveThemeName`). */
  setTheme(roomId: string, theme: string): Promise<void>;
  /** Grid dimensions + cell size (Master Plan v2, R4 — previously
   * compile-time-only defaults). The grow-only "would orphan carved chunks"
   * guard is enforced client-side by the Session Config UI (via
   * `carvedBoundingBox`, `map/grid.ts`) before calling this — a plain write. */
  setGridDimensions(roomId: string, grid: Room['grid']): Promise<void>;
  /** Tension defaults (Master Plan v2, R4 — "Tension defaults" section).
   * Plain die-expression strings; never interpreted (Plan §2.5). */
  setTensionDefaults(
    roomId: string,
    input: { difficultyDie: string; dangerDie: string },
  ): Promise<void>;

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
  /** Token scale slider, 1×1–3×3 (Plan §7 Phase 1). `size` is a grid-cell
   * multiplier, same unit `Token.size` already uses. */
  resizeToken(roomId: string, tokenId: string, size: number): Promise<void>;
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

  // ---- cellular map model (Map Tooling Spec §7) ----

  /** Floor cells, chunked 16×16 (Spec §7). `commitFloorChunks` writes a
   * batch of whole chunk docs in one Firestore transaction — the
   * commit-on-pointer-release step of a carve/fill stroke. */
  subscribeFloorChunks(roomId: string, cb: (chunks: FloorChunk[]) => void): Unsubscribe;
  commitFloorChunks(roomId: string, chunks: FloorChunk[]): Promise<void>;

  /** Explicit walls + doors only — perimeter walls are derived client-side,
   * never stored (Spec §1, §4). */
  subscribeWalls(roomId: string, cb: (walls: MapWall[]) => void): Unsubscribe;
  setWall(roomId: string, wall: Omit<MapWall, 'id'> & { id?: string }): Promise<string>;
  removeWall(roomId: string, edgeId: string): Promise<void>;
  /** Batch-writes a whole wall drag-run in one commit (Master Plan v2, R9.2)
   * — "wall run = one gesture, one batch write," the same write-discipline
   * pattern `commitFloorChunks` already uses for a carve stroke. Every
   * `MapWall` carries its final `id` (the canonical edge id), so this is a
   * pure batch upsert, not an add-with-generated-id like `setWall`. */
  setWalls(roomId: string, walls: MapWall[]): Promise<void>;
  /** Batch-removes a wall drag-run — the erase-mode counterpart to
   * `setWalls` (Master Plan v2, R9.2). */
  removeWalls(roomId: string, edgeIds: string[]): Promise<void>;

  subscribeSymbols(roomId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe;
  placeSymbol(roomId: string, symbol: Omit<MapSymbol, 'id'> & { id?: string }): Promise<string>;
  removeSymbol(roomId: string, symbolId: string): Promise<void>;

  /** Keyed/named dungeon rooms (the Label/Key tool). Distinct from the
   * campaign `rooms/{roomId}` doc itself. */
  subscribeMapRooms(roomId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe;
  upsertMapRoom(roomId: string, mapRoom: MapRoom): Promise<void>;
  removeMapRoom(roomId: string, mapRoomId: string): Promise<void>;

  /** Manual-reveal fog mask (Spec §6). Meaningless when the room's
   * `fog.mode` is `'emergent'` — floor cells ARE the revealed mask then. */
  subscribeFogChunks(roomId: string, cb: (chunks: FogChunk[]) => void): Unsubscribe;
  commitFogChunks(roomId: string, chunks: FogChunk[]): Promise<void>;
  /** Fog: Reset (Spec §3) — clears every revealed cell back to hidden. */
  resetFog(roomId: string): Promise<void>;

  /** Fog mode switch (Spec §6) — GM-only room-doc update. `dynamic` engages
   * Phase 4 raycasting LoS from walls (see `map/los.ts`). */
  setFogMode(roomId: string, mode: Room['fog']['mode']): Promise<void>;

  /** Measurement ruler settings (Master Plan v2, R9.3) — a GM-set room-doc
   * update, same pattern as `setFogMode`. */
  setMeasurement(roomId: string, measure: Room['settings']['measure']): Promise<void>;

  /** Half-grid subdivision toggle (Master Plan v2, R9.6) — render-only room-doc
   * update; does not touch the cellular model or LoS. */
  setGridSubdivide(roomId: string, subdivide: boolean): Promise<void>;

  // ---- imported vision geometry (Plan §7 Phase 4 — `.uvtt` import) ----

  /** Vector (non-grid) vision-blocking walls + door portals imported from a
   * `.uvtt`/`.dd2vtt` (see `map/uvtt.ts`). Player-readable (trust model);
   * fed into `sightSegments()` for dynamic LoS. */
  subscribeSightWalls(roomId: string, cb: (walls: SightWall[]) => void): Unsubscribe;
  subscribeLights(roomId: string, cb: (lights: MapLight[]) => void): Unsubscribe;
  /** Replaces all imported walls + lights in one batch — a fresh `.uvtt`
   * import supersedes any previous one rather than accumulating. */
  importUvtt(
    roomId: string,
    input: { walls: Array<Omit<SightWall, 'id'>>; lights: Array<Omit<MapLight, 'id'>> },
  ): Promise<void>;
  /** Adds one diagonal vector wall (Master Plan v2, R9.2 — Wall tool's
   * diagonal-run mode). Distinct from `importUvtt`, which replaces the whole
   * collection; this adds a single record, mirroring `setWall`/`placeSymbol`. */
  addSightWall(roomId: string, wall: Omit<SightWall, 'id'> & { id?: string }): Promise<string>;
  removeSightWall(roomId: string, sightWallId: string): Promise<void>;

  /** The demoted Annotate overlay (Spec §3) — loose freehand/text notes,
   * not the cellular map-making core. */
  subscribeDrawings(roomId: string, cb: (drawings: Drawing[]) => void): Unsubscribe;
  writeDrawing(roomId: string, drawing: Omit<Drawing, 'id'> & { id?: string }): Promise<string>;
  deleteDrawing(roomId: string, drawingId: string): Promise<void>;

  subscribeProfiles(roomId: string, cb: (profiles: ProfileInstance[]) => void): Unsubscribe;
  setProfileValue(
    roomId: string,
    seatId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void>;

  /** GM adds/removes/reorders `profileTemplate` fields (Plan §2.5) — a plain
   * write to the room doc's `profileTemplate` array. The dock re-renders
   * generically from whatever comes back through `subscribeRoom`. */
  updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void>;

  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe;
  writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string>;

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
   * release/commit, right before the real Firestore chunk write lands. */
  publishMapDraft(roomId: string, draft: MapDraft): void;
  subscribeMapDraft(roomId: string, cb: (drafts: MapDraft[]) => void): Unsubscribe;
  clearMapDraft(roomId: string, uid: string): void;
}
