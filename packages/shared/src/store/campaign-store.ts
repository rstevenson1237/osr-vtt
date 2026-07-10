import type { Cell } from '../map/grid.js';
import type {
  Drawing,
  Encounter,
  FloorChunk,
  FogChunk,
  Group,
  LogEntry,
  MapRoom,
  MapSymbol,
  MapWall,
  PlayerSeat,
  ProfileInstance,
  ProfileTemplateField,
  ProfileValue,
  Roll,
  Room,
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

  /** Writes `rooms/{roomId}/players/{uid}` for the caller. */
  joinRoom(roomId: string, displayName: string): Promise<void>;
  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe;

  subscribeTokens(roomId: string, cb: (tokens: Token[]) => void): Unsubscribe;
  createToken(roomId: string, token: Omit<Token, 'id'> & { id?: string }): Promise<string>;
  moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void>;
  /** Token scale slider, 1×1–3×3 (Plan §7 Phase 1). `size` is a grid-cell
   * multiplier, same unit `Token.size` already uses. */
  resizeToken(roomId: string, tokenId: string, size: number): Promise<void>;

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

  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe;
  writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string>;

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe;
  writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string>;

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
