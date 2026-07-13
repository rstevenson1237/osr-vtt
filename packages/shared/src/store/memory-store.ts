import { mergeUpdates } from 'yjs';
import { createSeed, expandSharedRollSlots } from '../dice/engine.js';
import { migrateRoom } from '../migrations/index.js';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_FOG_CONFIG,
  DEFAULT_GRID_CONFIG,
  DEFAULT_HANDOUT,
  DEFAULT_ROOM_SETTINGS,
} from '../types.js';
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
import type {
  CampaignSnapshot,
  CampaignStore,
  CursorPos,
  DragFrame,
  MapDraft,
  PingPos,
  Unsubscribe,
} from './campaign-store.js';
import { EXPORTED_COLLECTIONS, LIVE_LOG_LIMIT } from './campaign-store.js';

/**
 * The Phase 6 "second `CampaignStore` implementation" (Plan §7 Phase 6,
 * Roadmap Gate 6) — a dependency-free, in-process backend that stores every
 * room untyped-but-faithfully (mirroring how a Firestore doc body carries no
 * `id` field of its own) and re-emits snapshots the same way `onSnapshot`/
 * RTDB's `.on('value')` do: once immediately with the current value, then
 * again on every mutation. It exists to *prove* the `CampaignStore`
 * abstraction (Plan §1.3) — the same contract test suite
 * (`campaign-store.contract.ts`) runs unmodified against this and against
 * `FirebaseStore`.
 *
 * A `MemoryBackend` is the "server": all the room state a project would
 * otherwise keep in Firestore/RTDB. A `MemoryStore` is one authenticated
 * "client" — exactly like one browser tab holding one `FirebaseStore`
 * against one Firebase project. Construct several `MemoryStore`s over the
 * same `MemoryBackend` to simulate several tabs/players against one table,
 * each with its own `ensureAuth()`-issued uid.
 */

type Doc = Record<string, unknown>;
type Listener<T> = (value: T) => void;

/** Firestore's `onSnapshot`/RTDB's `.on('value')` both fire once with the
 * current value on subscribe, then again on every change — always off the
 * synchronous call stack. `queueMicrotask` reproduces that async-but-soon
 * contract without pulling in fake timers or real network latency. */
class ReactiveValue<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    for (const cb of this.listeners) queueMicrotask(() => cb(this.value));
  }

  subscribe(cb: Listener<T>): Unsubscribe {
    this.listeners.add(cb);
    const initial = this.value;
    queueMicrotask(() => cb(initial));
    return () => {
      this.listeners.delete(cb);
    };
  }
}

class ReactiveCollection {
  private docs = new Map<string, Doc>();
  private listeners = new Set<Listener<Doc[]>>();

  setDoc(id: string, value: Doc): void {
    this.docs.set(id, value);
    this.emit();
  }

  /** One notification for many docs — the in-memory analog of a Firestore
   * `WriteBatch.commit()` (a carve/fill stroke's chunk write, an import). */
  setMany(entries: Array<[string, Doc]>): void {
    for (const [id, value] of entries) this.docs.set(id, value);
    this.emit();
  }

  patchDoc(id: string, patch: Doc): void {
    const cur = this.docs.get(id);
    if (!cur) return; // mirrors call sites that only ever patch docs they created
    this.docs.set(id, { ...cur, ...patch });
    this.emit();
  }

  /** One notification for many partial patches — the in-memory analog of a
   * batched Firestore `update` commit (a collapsed group's drag lands every
   * member's new position at once, R8.4). Missing docs are skipped, mirroring
   * `patchDoc`. */
  patchMany(entries: Array<[string, Doc]>): void {
    for (const [id, patch] of entries) {
      const cur = this.docs.get(id);
      if (!cur) continue;
      this.docs.set(id, { ...cur, ...patch });
    }
    this.emit();
  }

  deleteDoc(id: string): void {
    this.docs.delete(id);
    this.emit();
  }

  /** One notification for many deletes — the in-memory analog of a batched
   * Firestore delete commit (e.g. an erase-mode wall drag-run). */
  deleteMany(ids: string[]): void {
    for (const id of ids) this.docs.delete(id);
    this.emit();
  }

  getDoc(id: string): Doc | undefined {
    return this.docs.get(id);
  }

  getAll(): Doc[] {
    return [...this.docs.values()];
  }

  entries(): Array<[string, Doc]> {
    return [...this.docs.entries()];
  }

  clear(): void {
    this.docs.clear();
    this.emit();
  }

  subscribe(cb: Listener<Doc[]>): Unsubscribe {
    this.listeners.add(cb);
    const initial = this.getAll();
    queueMicrotask(() => cb(initial));
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(): void {
    const snapshot = this.getAll();
    for (const cb of this.listeners) queueMicrotask(() => cb(snapshot));
  }
}

/** Every collection a room carries, keyed identically to `EXPORTED_COLLECTIONS`
 * so `exportRoom`/`importRoom` can loop over the names generically. `room` and
 * `encounter` are the two singleton docs; `dragging`/`yjs` are per-key reactive
 * values created lazily (one per tokenId / Yjs doc name). */
class RoomBucket {
  room = new ReactiveValue<Doc | null>(null);
  encounter = new ReactiveValue<Doc | null>(null);
  sharedRoll = new ReactiveValue<Doc | null>(null);
  players = new ReactiveCollection();
  profiles = new ReactiveCollection();
  tokens = new ReactiveCollection();
  groups = new ReactiveCollection();
  drawings = new ReactiveCollection();
  log = new ReactiveCollection();
  rolls = new ReactiveCollection();
  tables = new ReactiveCollection();
  floorChunks = new ReactiveCollection();
  fogChunks = new ReactiveCollection();
  walls = new ReactiveCollection();
  sightWalls = new ReactiveCollection();
  lights = new ReactiveCollection();
  symbols = new ReactiveCollection();
  mapRooms = new ReactiveCollection();
  macros = new ReactiveCollection();
  gmPrivate = new ReactiveCollection();
  // ---- RTDB-equivalent ephemeral channels (Plan §2.2, §4) ----
  cursors = new ReactiveCollection();
  pings = new ReactiveCollection();
  mapDraft = new ReactiveCollection();
  dragging = new Map<string, ReactiveValue<DragFrame | null>>();
  yjs = new Map<string, ReactiveValue<Uint8Array | null>>();
}

const PING_TTL_MS = 3000;

/** The shared "server" behind however many `MemoryStore` client handles are
 * constructed against it (Plan §1.3's abstraction proof — see file docstring). */
export class MemoryBackend {
  private rooms = new Map<string, RoomBucket>();
  private counter = 0;

  /** Lazily creates a room's bucket on first touch — same as Firestore never
   * requiring a subcollection's parent to "exist" first. */
  bucket(roomId: string): RoomBucket {
    let bucket = this.rooms.get(roomId);
    if (!bucket) {
      bucket = new RoomBucket();
      this.rooms.set(roomId, bucket);
    }
    return bucket;
  }

  nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  /** Stands in for the Auth emulator issuing a fresh anonymous uid per client
   * session — shared on the backend because uid uniqueness is global across
   * every simulated "tab", not per `MemoryStore` instance. */
  nextUid(): string {
    return this.nextId('uid');
  }
}

export class MemoryStore implements CampaignStore {
  private uid: string | null = null;

  constructor(private readonly backend: MemoryBackend = new MemoryBackend()) {}

  async ensureAuth(): Promise<string> {
    if (this.uid) return this.uid;
    this.uid = this.backend.nextUid();
    return this.uid;
  }

  currentUid(): string | null {
    return this.uid;
  }

  private requireUid(): string {
    if (!this.uid) {
      throw new Error('MemoryStore: no authenticated user — call ensureAuth() first');
    }
    return this.uid;
  }

  private patchRoom(roomId: string, patch: Doc): void {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get();
    if (!cur) return;
    bucket.room.set({ ...cur, ...patch });
  }

  // ---- rooms ----

  async createRoom(input: {
    name: string;
    profileTemplate: ProfileTemplateField[];
    difficultyDie?: string;
    dangerDie?: string;
    password?: string;
  }): Promise<string> {
    const uid = await this.ensureAuth();
    const roomId = this.backend.nextId('room');
    const room: Room = {
      id: roomId,
      name: input.name,
      gmUid: uid,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      difficultyDie: input.difficultyDie ?? 'd6',
      dangerDie: input.dangerDie ?? 'd6',
      createdAt: Date.now(),
      profileTemplate: input.profileTemplate,
      grid: DEFAULT_GRID_CONFIG,
      fog: DEFAULT_FOG_CONFIG,
      handout: DEFAULT_HANDOUT,
      settings: DEFAULT_ROOM_SETTINGS,
      ...(input.password ? { password: input.password } : {}),
    };
    this.backend.bucket(roomId).room.set(room as unknown as Doc);
    return roomId;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return (this.backend.bucket(roomId).room.get() as Room | null) ?? null;
  }

  subscribeRoom(roomId: string, cb: (room: Room | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).room.subscribe((v) => cb(v as Room | null));
  }

  async renameRoom(roomId: string, name: string): Promise<void> {
    this.patchRoom(roomId, { name });
  }

  async setTheme(roomId: string, theme: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({ ...cur, settings: { ...cur.settings, theme } } as unknown as Doc);
  }

  async setGridDimensions(roomId: string, grid: Room['grid']): Promise<void> {
    this.patchRoom(roomId, { grid });
  }

  async setTensionDefaults(
    roomId: string,
    input: { difficultyDie: string; dangerDie: string },
  ): Promise<void> {
    this.patchRoom(roomId, input);
  }

  // ---- players ----

  async joinRoom(roomId: string, displayName: string): Promise<void> {
    const uid = await this.ensureAuth();
    const room = await this.getRoom(roomId);
    const seat: PlayerSeat = {
      uid,
      displayName,
      seatId: uid,
      role: room?.gmUid === uid ? 'gm' : 'player',
    };
    this.backend.bucket(roomId).players.setDoc(uid, seat as unknown as Doc);
  }

  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).players.subscribe((items) => cb(items as unknown as PlayerSeat[]));
  }

  async renamePlayer(roomId: string, uid: string, displayName: string): Promise<void> {
    this.backend.bucket(roomId).players.patchDoc(uid, { displayName });
  }

  async setPlayerRole(roomId: string, uid: string, role: 'player' | 'viewer'): Promise<void> {
    this.backend.bucket(roomId).players.patchDoc(uid, { role });
  }

  async removePlayer(roomId: string, uid: string, opts?: { deleteProfile?: boolean }): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    bucket.players.deleteDoc(uid);
    if (opts?.deleteProfile) bucket.profiles.deleteDoc(uid);
  }

  async transferGM(roomId: string, newGmUid: string): Promise<void> {
    const oldGmUid = this.requireUid();
    const bucket = this.backend.bucket(roomId);
    this.patchRoom(roomId, { gmUid: newGmUid });
    bucket.players.patchDoc(oldGmUid, { role: 'player' });
    bucket.players.patchDoc(newGmUid, { role: 'gm' });
  }

  // ---- tokens ----

  subscribeTokens(roomId: string, cb: (tokens: Token[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).tokens.subscribe((items) => cb(items as unknown as Token[]));
  }

  async createToken(roomId: string, token: Omit<Token, 'id'> & { id?: string }): Promise<string> {
    const id = token.id ?? this.backend.nextId('token');
    const full: Token = { ...token, id };
    this.backend.bucket(roomId).tokens.setDoc(id, full as unknown as Doc);
    return id;
  }

  async moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void> {
    this.backend.bucket(roomId).tokens.patchDoc(tokenId, { pos });
  }

  async moveTokens(
    roomId: string,
    updates: Array<{ tokenId: string; pos: { x: number; y: number } }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    this.backend
      .bucket(roomId)
      .tokens.patchMany(updates.map((u) => [u.tokenId, { pos: u.pos } as unknown as Doc]));
  }

  async resizeToken(roomId: string, tokenId: string, size: number): Promise<void> {
    this.backend.bucket(roomId).tokens.patchDoc(tokenId, { size });
  }

  async setTokenOwner(
    roomId: string,
    tokenId: string,
    ownerSeatId: string | undefined,
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.tokens.getDoc(tokenId);
    if (!cur) return;
    const next = { ...cur };
    if (ownerSeatId === undefined) delete next['ownerSeatId'];
    else next['ownerSeatId'] = ownerSeatId;
    bucket.tokens.setDoc(tokenId, next);
  }

  // ---- groups ----

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).groups.subscribe((items) => cb(items as unknown as Group[]));
  }

  async createGroup(roomId: string, group: Omit<Group, 'id'> & { id?: string }): Promise<string> {
    const id = group.id ?? this.backend.nextId('group');
    const full: Group = { ...group, id };
    this.backend.bucket(roomId).groups.setDoc(id, full as unknown as Doc);
    return id;
  }

  async updateGroup(
    roomId: string,
    groupId: string,
    patch: Partial<Omit<Group, 'id'>>,
  ): Promise<void> {
    this.backend.bucket(roomId).groups.patchDoc(groupId, patch);
  }

  async deleteGroup(roomId: string, groupId: string): Promise<void> {
    this.backend.bucket(roomId).groups.deleteDoc(groupId);
  }

  // ---- combat tracker ----

  subscribeEncounter(roomId: string, cb: (encounter: Encounter | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).encounter.subscribe((v) => cb(v as Encounter | null));
  }

  async writeEncounter(roomId: string, encounter: Encounter): Promise<void> {
    this.backend.bucket(roomId).encounter.set(encounter as unknown as Doc);
  }

  // ---- cellular map model ----

  subscribeFloorChunks(roomId: string, cb: (chunks: FloorChunk[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).floorChunks.subscribe((items) => cb(items as unknown as FloorChunk[]));
  }

  async commitFloorChunks(roomId: string, chunks: FloorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    this.backend
      .bucket(roomId)
      .floorChunks.setMany(chunks.map((c) => [c.id, c as unknown as Doc]));
  }

  subscribeWalls(roomId: string, cb: (walls: MapWall[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).walls.subscribe((items) => cb(items as unknown as MapWall[]));
  }

  async setWall(roomId: string, wall: Omit<MapWall, 'id'> & { id?: string }): Promise<string> {
    const id = wall.id ?? this.backend.nextId('wall');
    const full: MapWall = { ...wall, id };
    this.backend.bucket(roomId).walls.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeWall(roomId: string, edgeId: string): Promise<void> {
    this.backend.bucket(roomId).walls.deleteDoc(edgeId);
  }

  async setWalls(roomId: string, walls: MapWall[]): Promise<void> {
    if (walls.length === 0) return;
    this.backend.bucket(roomId).walls.setMany(walls.map((w) => [w.id, w as unknown as Doc]));
  }

  async removeWalls(roomId: string, edgeIds: string[]): Promise<void> {
    if (edgeIds.length === 0) return;
    this.backend.bucket(roomId).walls.deleteMany(edgeIds);
  }

  subscribeSymbols(roomId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).symbols.subscribe((items) => cb(items as unknown as MapSymbol[]));
  }

  async placeSymbol(
    roomId: string,
    symbol: Omit<MapSymbol, 'id'> & { id?: string },
  ): Promise<string> {
    const id = symbol.id ?? this.backend.nextId('symbol');
    const full: MapSymbol = { ...symbol, id };
    this.backend.bucket(roomId).symbols.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeSymbol(roomId: string, symbolId: string): Promise<void> {
    this.backend.bucket(roomId).symbols.deleteDoc(symbolId);
  }

  subscribeMapRooms(roomId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).mapRooms.subscribe((items) => cb(items as unknown as MapRoom[]));
  }

  async upsertMapRoom(roomId: string, mapRoom: MapRoom): Promise<void> {
    this.backend.bucket(roomId).mapRooms.setDoc(mapRoom.id, mapRoom as unknown as Doc);
  }

  async removeMapRoom(roomId: string, mapRoomId: string): Promise<void> {
    this.backend.bucket(roomId).mapRooms.deleteDoc(mapRoomId);
  }

  subscribeFogChunks(roomId: string, cb: (chunks: FogChunk[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).fogChunks.subscribe((items) => cb(items as unknown as FogChunk[]));
  }

  async commitFogChunks(roomId: string, chunks: FogChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    this.backend.bucket(roomId).fogChunks.setMany(chunks.map((c) => [c.id, c as unknown as Doc]));
  }

  async resetFog(roomId: string): Promise<void> {
    this.backend.bucket(roomId).fogChunks.clear();
  }

  async setFogMode(roomId: string, mode: Room['fog']['mode']): Promise<void> {
    this.patchRoom(roomId, { fog: { mode } });
  }

  async setGridSubdivide(roomId: string, subdivide: boolean): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({
      ...cur,
      settings: { ...cur.settings, grid: { subdivide } },
    } as unknown as Doc);
  }

  async setMeasurement(roomId: string, measure: Room['settings']['measure']): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({ ...cur, settings: { ...cur.settings, measure } } as unknown as Doc);
  }

  // ---- imported vision geometry (`.uvtt`) ----

  subscribeSightWalls(roomId: string, cb: (walls: SightWall[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).sightWalls.subscribe((items) => cb(items as unknown as SightWall[]));
  }

  subscribeLights(roomId: string, cb: (lights: MapLight[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).lights.subscribe((items) => cb(items as unknown as MapLight[]));
  }

  async importUvtt(
    roomId: string,
    input: { walls: Array<Omit<SightWall, 'id'>>; lights: Array<Omit<MapLight, 'id'>> },
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    // A new import supersedes the previous one, mirroring FirebaseStore's
    // clear-then-write batch.
    bucket.sightWalls.clear();
    bucket.lights.clear();
    bucket.sightWalls.setMany(
      input.walls.map((wall) => {
        const id = this.backend.nextId('sightwall');
        return [id, { ...wall, id } as unknown as Doc];
      }),
    );
    bucket.lights.setMany(
      input.lights.map((light) => {
        const id = this.backend.nextId('light');
        return [id, { ...light, id } as unknown as Doc];
      }),
    );
  }

  async addSightWall(roomId: string, wall: Omit<SightWall, 'id'> & { id?: string }): Promise<string> {
    const id = wall.id ?? this.backend.nextId('sightwall');
    const full: SightWall = { ...wall, id };
    this.backend.bucket(roomId).sightWalls.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeSightWall(roomId: string, sightWallId: string): Promise<void> {
    this.backend.bucket(roomId).sightWalls.deleteDoc(sightWallId);
  }

  // ---- annotate overlay ----

  subscribeDrawings(roomId: string, cb: (drawings: Drawing[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).drawings.subscribe((items) => cb(items as unknown as Drawing[]));
  }

  async writeDrawing(
    roomId: string,
    drawing: Omit<Drawing, 'id'> & { id?: string },
  ): Promise<string> {
    const id = drawing.id ?? this.backend.nextId('drawing');
    const full: Drawing = { ...drawing, id };
    this.backend.bucket(roomId).drawings.setDoc(id, full as unknown as Doc);
    return id;
  }

  async deleteDrawing(roomId: string, drawingId: string): Promise<void> {
    this.backend.bucket(roomId).drawings.deleteDoc(drawingId);
  }

  // ---- profiles ----

  subscribeProfiles(roomId: string, cb: (profiles: ProfileInstance[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).profiles.subscribe((items) => cb(items as unknown as ProfileInstance[]));
  }

  async setProfileValue(
    roomId: string,
    seatId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.profiles.getDoc(seatId) as unknown as ProfileInstance | undefined;
    // Deep-merges just the `values` map — matches FirebaseStore's
    // `setDoc(..., {merge: true})`, which touches only this field and leaves
    // every sibling field in `values` untouched.
    const next: ProfileInstance = {
      seatId,
      ...(cur?.portraitRef !== undefined ? { portraitRef: cur.portraitRef } : {}),
      values: { ...(cur?.values ?? {}), [fieldId]: value },
    };
    bucket.profiles.setDoc(seatId, next as unknown as Doc);
  }

  async updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    this.patchRoom(roomId, { profileTemplate: template });
  }

  // ---- log ----

  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).log.subscribe((items) => {
      // Cap at the newest LIVE_LOG_LIMIT (U18) — sort ascending, keep the tail.
      const entries = [...(items as unknown as LogEntry[])].sort((a, b) => a.ts - b.ts);
      cb(entries.slice(-LIVE_LOG_LIMIT));
    });
  }

  async writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string> {
    const id = this.backend.nextId('log');
    const full: LogEntry = { ...entry, id };
    this.backend.bucket(roomId).log.setDoc(id, full as unknown as Doc);
    return id;
  }

  async listLogBefore(roomId: string, before: number, limit: number): Promise<LogEntry[]> {
    // The `limit` entries immediately older than `before`, oldest-first —
    // take the newest of the older-than set, then flip back to ascending.
    const older = (this.backend.bucket(roomId).log.getAll() as unknown as LogEntry[])
      .filter((e) => e.ts < before)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    return older.reverse();
  }

  // ---- rolls ----

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).rolls.subscribe((items) => {
      const rolls = [...(items as unknown as Roll[])].sort((a, b) => a.ts - b.ts);
      cb(rolls);
    });
  }

  async writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string> {
    const id = this.backend.nextId('roll');
    const full: Roll = { ...roll, id };
    this.backend.bucket(roomId).rolls.setDoc(id, full as unknown as Doc);
    return id;
  }

  // ---- shared rolls (Master Plan v2, R3.6) ----

  subscribeSharedRoll(roomId: string, cb: (sharedRoll: SharedRoll | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).sharedRoll.subscribe((v) => cb(v as SharedRoll | null));
  }

  async openSharedRoll(roomId: string, input: { openedBy: string; label?: string }): Promise<void> {
    const sharedRoll: SharedRoll = {
      status: 'staging',
      openedBy: input.openedBy,
      slots: {},
      ...(input.label ? { label: input.label } : {}),
    };
    this.backend.bucket(roomId).sharedRoll.set(sharedRoll as unknown as Doc);
  }

  async stageSharedSlot(roomId: string, slotId: string, slot: SharedRollSlot): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.sharedRoll.get() as SharedRoll | null;
    if (!cur) return;
    bucket.sharedRoll.set({ ...cur, slots: { ...cur.slots, [slotId]: slot } } as unknown as Doc);
  }

  async resolveSharedRoll(roomId: string, authorUid: string): Promise<Roll> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.sharedRoll.get() as SharedRoll | null;
    const seed = createSeed();
    const parts = cur ? expandSharedRollSlots(seed, cur.slots) : [];
    const roll: Omit<Roll, 'id'> = {
      ts: Date.now(),
      authorUid,
      seed,
      dice: [],
      modifier: 0,
      advantage: 'normal',
      mode: 'separate',
      parts,
      ...(cur?.label ? { label: cur.label } : {}),
    };
    const id = this.backend.nextId('roll');
    const full: Roll = { ...roll, id };
    bucket.rolls.setDoc(id, full as unknown as Doc);
    if (cur) bucket.sharedRoll.set({ ...cur, status: 'resolved' } as unknown as Doc);
    return full;
  }

  // ---- dice macros ----

  subscribeMacros(roomId: string, cb: (macros: DiceMacro[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).macros.subscribe((items) => cb(items as unknown as DiceMacro[]));
  }

  async saveMacro(roomId: string, macro: Omit<DiceMacro, 'id'> & { id?: string }): Promise<string> {
    const id = macro.id ?? this.backend.nextId('macro');
    const full: DiceMacro = { ...macro, id };
    this.backend.bucket(roomId).macros.setDoc(id, full as unknown as Doc);
    return id;
  }

  async deleteMacro(roomId: string, macroId: string): Promise<void> {
    this.backend.bucket(roomId).macros.deleteDoc(macroId);
  }

  // ---- referee random tables ----

  subscribeTables(roomId: string, cb: (tables: RandomTable[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).tables.subscribe((items) => cb(items as unknown as RandomTable[]));
  }

  async upsertTable(roomId: string, table: RandomTable): Promise<void> {
    this.backend.bucket(roomId).tables.setDoc(table.id, table as unknown as Doc);
  }

  async deleteTable(roomId: string, tableId: string): Promise<void> {
    this.backend.bucket(roomId).tables.deleteDoc(tableId);
  }

  // ---- Blind Drawer (gmPrivate) ----

  subscribeBlindDraws(roomId: string, cb: (draws: BlindDraw[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).gmPrivate.subscribe((items) => {
      const draws = items.filter((d) => d['kind'] === 'blindDraw') as unknown as BlindDraw[];
      draws.sort((a, b) => a.ts - b.ts);
      cb(draws);
    });
  }

  async writeBlindDraw(
    roomId: string,
    draw: Omit<BlindDraw, 'id'> & { id?: string },
  ): Promise<string> {
    const id = draw.id ?? this.backend.nextId('draw');
    // `BlindDraw extends GmPrivateDoc`'s index signature poisons
    // `Omit<BlindDraw, 'id'>` (its `keyof` collapses to `string`), so an
    // explicit `: BlindDraw` annotation on the spread loses every named
    // property under TS's structural checks — build it untyped instead,
    // exactly like FirebaseStore's equivalent `{ ...draw, id }` does.
    const full = { ...draw, id };
    this.backend.bucket(roomId).gmPrivate.setDoc(id, full as unknown as Doc);
    return id;
  }

  async revealBlindDraw(roomId: string, draw: BlindDraw): Promise<void> {
    await this.writeLog(roomId, {
      ts: Date.now(),
      authorUid: draw.authorUid,
      type: 'system',
      text: `${draw.title}: ${draw.text}`,
    });
    this.backend.bucket(roomId).gmPrivate.patchDoc(draw.id, { revealed: true });
  }

  // ---- handouts ----

  subscribeHandoutLibrary(roomId: string, cb: (handouts: HandoutRecord[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).gmPrivate.subscribe((items) => {
      const handouts = (items as { kind?: string }[]).filter(
        (d) => d['kind'] === 'handout',
      ) as unknown as HandoutRecord[];
      handouts.sort((a, b) => a.ts - b.ts);
      cb(handouts);
    });
  }

  async saveHandout(
    roomId: string,
    handout: Omit<HandoutRecord, 'id' | 'kind' | 'revealed'> & { id?: string },
  ): Promise<string> {
    const id = handout.id ?? this.backend.nextId('handout');
    // Same `GmPrivateDoc` index-signature caveat as `writeBlindDraw` above.
    const full = { ...handout, id, kind: 'handout' as const, revealed: false };
    this.backend.bucket(roomId).gmPrivate.setDoc(id, full as unknown as Doc);
    return id;
  }

  async deleteHandout(roomId: string, handoutId: string): Promise<void> {
    this.backend.bucket(roomId).gmPrivate.deleteDoc(handoutId);
  }

  async revealHandout(roomId: string, handout: HandoutRecord): Promise<void> {
    this.patchRoom(roomId, {
      handout: { ref: handout.ref, ...(handout.title ? { title: handout.title } : {}) },
    });
    this.backend.bucket(roomId).gmPrivate.patchDoc(handout.id, { revealed: true });
  }

  async hideHandout(roomId: string): Promise<void> {
    this.patchRoom(roomId, { handout: null });
  }

  // ---- `.vttcamp` portability ----

  async exportRoom(roomId: string): Promise<CampaignSnapshot> {
    const bucket = this.backend.bucket(roomId);
    const room = bucket.room.get();
    if (!room) {
      throw new Error(`exportRoom: room ${roomId} not found`);
    }
    const { id: _id, ...roomBody } = room;

    const collections: Record<string, Array<Record<string, unknown>>> = {};
    for (const name of EXPORTED_COLLECTIONS) {
      collections[name] = bucket[name].entries().map(([id, doc]) => ({ id, ...doc }));
    }

    const encounter = bucket.encounter.get();
    const notesState = await this.getYState(roomId, 'notes');
    const yjs: Record<string, string> = {};
    if (notesState) yjs['notes'] = bytesToBase64(notesState);

    return { room: roomBody, collections, encounter, yjs };
  }

  async importRoom(snapshot: CampaignSnapshot): Promise<string> {
    const uid = await this.ensureAuth();

    // Same migration-on-import + gmUid-forced-to-importer rules as
    // FirebaseStore (Plan §5, Gate 5) — see its importRoom for why.
    const migrated = migrateRoom(snapshot.room);
    const { gmUid: _oldGmUid, ...roomBody } = migrated;
    const roomId = this.backend.nextId('room');
    const room: Room = { ...(roomBody as Omit<Room, 'id' | 'gmUid'>), id: roomId, gmUid: uid };
    const bucket = this.backend.bucket(roomId);
    bucket.room.set(room as unknown as Doc);

    for (const name of EXPORTED_COLLECTIONS) {
      const docs = snapshot.collections[name] ?? [];
      const entries: Array<[string, Doc]> = docs.map((record) => {
        const { id, ...body } = record;
        return [String(id), body];
      });
      bucket[name].setMany(entries);
    }

    if (snapshot.encounter) {
      bucket.encounter.set(snapshot.encounter);
    }

    for (const [docName, base64] of Object.entries(snapshot.yjs)) {
      await this.mergeYUpdate(roomId, docName, base64ToBytes(base64));
    }

    return roomId;
  }

  // ---- Yjs (concurrent Notes) ----

  private yState(bucket: RoomBucket, docName: string): ReactiveValue<Uint8Array | null> {
    let value = bucket.yjs.get(docName);
    if (!value) {
      value = new ReactiveValue<Uint8Array | null>(null);
      bucket.yjs.set(docName, value);
    }
    return value;
  }

  subscribeYState(
    roomId: string,
    docName: string,
    cb: (state: Uint8Array | null) => void,
  ): Unsubscribe {
    return this.yState(this.backend.bucket(roomId), docName).subscribe(cb);
  }

  async mergeYUpdate(roomId: string, docName: string, update: Uint8Array): Promise<void> {
    const state = this.yState(this.backend.bucket(roomId), docName);
    const current = state.get();
    state.set(mergeUpdates(current ? [current, update] : [update]));
  }

  async getYState(roomId: string, docName: string): Promise<Uint8Array | null> {
    return this.yState(this.backend.bucket(roomId), docName).get();
  }

  // ---- RTDB-equivalent ephemeral channels ----

  publishCursor(roomId: string, pos: { x: number; y: number }): void {
    const uid = this.requireUid();
    const cursor: CursorPos = { uid, x: pos.x, y: pos.y, ts: Date.now() };
    this.backend.bucket(roomId).cursors.setDoc(uid, cursor as unknown as Doc);
  }

  subscribeCursors(roomId: string, cb: (cursors: CursorPos[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).cursors.subscribe((items) => cb(items as unknown as CursorPos[]));
  }

  private dragValue(bucket: RoomBucket, tokenId: string): ReactiveValue<DragFrame | null> {
    let value = bucket.dragging.get(tokenId);
    if (!value) {
      value = new ReactiveValue<DragFrame | null>(null);
      bucket.dragging.set(tokenId, value);
    }
    return value;
  }

  publishDrag(roomId: string, tokenId: string, pos: DragFrame): void {
    this.dragValue(this.backend.bucket(roomId), tokenId).set(pos);
  }

  subscribeDrag(
    roomId: string,
    tokenId: string,
    cb: (frame: DragFrame | null) => void,
  ): Unsubscribe {
    return this.dragValue(this.backend.bucket(roomId), tokenId).subscribe(cb);
  }

  clearDrag(roomId: string, tokenId: string): void {
    this.dragValue(this.backend.bucket(roomId), tokenId).set(null);
  }

  publishPing(roomId: string, pos: { x: number; y: number }): void {
    const uid = this.requireUid();
    const bucket = this.backend.bucket(roomId);
    const id = this.backend.nextId('ping');
    const ping: PingPos = { id, uid, x: pos.x, y: pos.y, ts: Date.now() };
    bucket.pings.setDoc(id, ping as unknown as Doc);
    // Self-cleans like FirebaseStore's RTDB ping node (Spec §3).
    setTimeout(() => bucket.pings.deleteDoc(id), PING_TTL_MS);
  }

  subscribePings(roomId: string, cb: (pings: PingPos[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).pings.subscribe((items) => cb(items as unknown as PingPos[]));
  }

  publishMapDraft(roomId: string, draft: MapDraft): void {
    this.backend.bucket(roomId).mapDraft.setDoc(draft.uid, draft as unknown as Doc);
  }

  subscribeMapDraft(roomId: string, cb: (drafts: MapDraft[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).mapDraft.subscribe((items) => cb(items as unknown as MapDraft[]));
  }

  clearMapDraft(roomId: string, uid: string): void {
    this.backend.bucket(roomId).mapDraft.deleteDoc(uid);
  }
}

/** Cross-environment (browser + Node/Vitest) byte<->base64 codecs — same
 * approach as `firebase-store.ts`, since both stores keep Yjs snapshots as
 * base64 in a `CampaignSnapshot`. */
function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
