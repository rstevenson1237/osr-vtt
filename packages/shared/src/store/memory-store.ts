import { mergeUpdates } from 'yjs';
import { randomCharacterColor } from '../character-color.js';
import { sortGroups } from '../encounter/ordering.js';
import { createSeed, expandSharedRollSlots } from '../dice/engine.js';
import { foldLegacyMapBackground, migrateRoom } from '../migrations/index.js';
import { EncounterSchema, MapBackgroundSchema } from '../schemas.js';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_ENCOUNTER_TEMPLATE,
  DEFAULT_ROLL_CONVENTIONS,
  DEFAULT_HANDOUT,
  DEFAULT_ROOM_SETTINGS,
  createDefaultGameMap,
} from '../types.js';
import type {
  AccountInfo,
  AssetRef,
  BlindDraw,
  DefaultPlayerGroup,
  DiceMacro,
  Drawing,
  Encounter,
  EncounterMode,
  GameMap,
  Group,
  HandoutRecord,
  LogEntry,
  MapBackground,
  MapGridKind,
  MapRoom,
  MapSymbol,
  MyRoomEntry,
  PlayerSeat,
  ProfileInstance,
  ProfileTemplateField,
  ProfileValue,
  RandomTable,
  Role,
  Roll,
  RollConvention,
  Room,
  SharedRoll,
  SharedRollSlot,
  Token,
} from '../types.js';
import type {
  CampaignSnapshot,
  CampaignStore,
  CursorPos,
  PresenceEntry,
  DragFrame,
  FloorRegionCommit,
  LinkAccountResult,
  PingPos,
  StoredVectorWall,
  Unsubscribe,
  VectorDoor,
  VectorFloorRegion,
  VectorMapDraft,
} from './campaign-store.js';
import {
  ActivityThrottle,
  BATTLE_MAP_SOURCE_COLLECTIONS,
  EXPORTED_COLLECTIONS,
  EXPORTED_MAP_COLLECTIONS,
  LAST_PRESENT_THROTTLE_MS,
  LIVE_LOG_LIMIT,
  PRESENCE_HEARTBEAT_MS,
} from './campaign-store.js';

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

/** Every collection one `GameMap` carries, keyed identically to
 * `EXPORTED_MAP_COLLECTIONS` so `exportRoom`/`importRoom` can loop over the
 * names generically — the map-scoped analog of `RoomBucket`'s session
 * collections. `vectorMapDraft` is map-scoped RTDB-equivalent live-carve
 * preview state. */
class MapBucket {
  drawings = new ReactiveCollection();
  symbols = new ReactiveCollection();
  mapRooms = new ReactiveCollection();
  /** Placed background images (SPEC-038 §1, v23) — keyed identically to its
   * `EXPORTED_MAP_COLLECTIONS` entry so the generic loops pick it up. */
  backgrounds = new ReactiveCollection();
  // ---- Vector Map System — keyed identically to `VECTOR_MAP_COLLECTIONS` so
  // the generic `EXPORTED_MAP_COLLECTIONS` loops pick them up.
  floorRegions = new ReactiveCollection();
  walls = new ReactiveCollection();
  doors = new ReactiveCollection();
  fogRegions = new ReactiveCollection();
  vectorMapDraft = new ReactiveCollection();
}

/** Every collection a room carries, keyed identically to `EXPORTED_COLLECTIONS`
 * so `exportRoom`/`importRoom` can loop over the names generically. `room` and
 * `encounter` are the two singleton docs; `dragging`/`yjs` are per-key reactive
 * values created lazily (one per tokenId / Yjs doc name). Cellular-map data
 * lives one level deeper, per `GameMap` (R17.3) — see `maps`/`mapBucket`. */
class RoomBucket {
  room = new ReactiveValue<Doc | null>(null);
  encounter = new ReactiveValue<Doc | null>(null);
  sharedRoll = new ReactiveValue<Doc | null>(null);
  players = new ReactiveCollection();
  profiles = new ReactiveCollection();
  tokens = new ReactiveCollection();
  groups = new ReactiveCollection();
  log = new ReactiveCollection();
  rolls = new ReactiveCollection();
  tables = new ReactiveCollection();
  macros = new ReactiveCollection();
  assetRefs = new ReactiveCollection();
  gmPrivate = new ReactiveCollection();
  // ---- RTDB-equivalent ephemeral channels (Plan §2.2, §4) ----
  cursors = new ReactiveCollection();
  pings = new ReactiveCollection();
  presence = new ReactiveCollection();
  dragging = new Map<string, ReactiveValue<DragFrame | null>>();
  yjs = new Map<string, ReactiveValue<Uint8Array | null>>();

  // ---- maps (Master Plan v2, R17.3) ----
  /** `GameMap` docs — the Maps manager's list. */
  maps = new ReactiveCollection();
  private mapBuckets = new Map<string, MapBucket>();

  /** Lazily creates a map's bucket on first touch — same laziness as
   * `MemoryBackend.bucket` for rooms. */
  mapBucket(mapId: string): MapBucket {
    let bucket = this.mapBuckets.get(mapId);
    if (!bucket) {
      bucket = new MapBucket();
      this.mapBuckets.set(mapId, bucket);
    }
    return bucket;
  }

  allMapBuckets(): Map<string, MapBucket> {
    return this.mapBuckets;
  }
}

const PING_TTL_MS = 3000;

/** The shared "server" behind however many `MemoryStore` client handles are
 * constructed against it (Plan §1.3's abstraction proof — see file docstring). */
export class MemoryBackend {
  private rooms = new Map<string, RoomBucket>();
  /** Per-uid `users/{uid}/rooms` index (Master Plan v2, R6.2) — one reactive
   * collection of `MyRoomEntry` docs per simulated user, shared here on the
   * backend since a uid is global across every `MemoryStore` "tab". */
  private userRoomIndexes = new Map<string, ReactiveCollection>();
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

  /** Lazily creates a user's My Rooms index on first touch. */
  userRooms(uid: string): ReactiveCollection {
    let index = this.userRoomIndexes.get(uid);
    if (!index) {
      index = new ReactiveCollection();
      this.userRoomIndexes.set(uid, index);
    }
    return index;
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
  // Simulated Auth identity (Master Plan v2, R6.1). Anonymous by default;
  // `linkWithGoogle` flips `isAnonymous` in place (same uid), `signOutToAnonymous`
  // issues a fresh anonymous uid. Firebase-specific popups have no in-memory
  // analog, so these methods model just the observable state the UI reads.
  private isAnonymous = true;
  private displayName: string | null = null;
  private email: string | null = null;
  private readonly authListeners = new Set<(account: AccountInfo | null) => void>();
  /** room+uid → heartbeat interval (R26.1), mirroring FirebaseStore. */
  private readonly presenceTimers = new Map<string, ReturnType<typeof setInterval>>();
  /** room+uid → last `lastPresentAt` write, for the R26.2 throttle. */
  private readonly lastPresentWrites = new Map<string, number>();

  /** The R25.1 activity clock's throttle, keyed by roomId — same semantics as
   * `FirebaseStore`'s, so the contract suite pins one behaviour. */
  private readonly activity = new ActivityThrottle();

  constructor(private readonly backend: MemoryBackend = new MemoryBackend()) {}

  async ensureAuth(): Promise<string> {
    if (this.uid) return this.uid;
    this.uid = this.backend.nextUid();
    this.emitAuth();
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

  // ---- accounts (Master Plan v2, R6.1) — simulated identity ----

  private account(): AccountInfo | null {
    if (!this.uid) return null;
    return {
      uid: this.uid,
      isAnonymous: this.isAnonymous,
      displayName: this.displayName,
      email: this.email,
    };
  }

  private emitAuth(): void {
    const account = this.account();
    for (const cb of this.authListeners) queueMicrotask(() => cb(account));
  }

  subscribeAuth(cb: (account: AccountInfo | null) => void): Unsubscribe {
    this.authListeners.add(cb);
    const current = this.account();
    queueMicrotask(() => cb(current));
    return () => {
      this.authListeners.delete(cb);
    };
  }

  async linkWithGoogle(): Promise<LinkAccountResult> {
    await this.ensureAuth();
    // Same uid, upgraded in place — the whole point of R6.1.
    this.isAnonymous = false;
    this.displayName ??= 'Google User';
    this.email ??= 'user@example.com';
    this.emitAuth();
    return { ok: true, account: this.account()! };
  }

  async signInWithGoogle(): Promise<string> {
    // No cross-device credential store in memory, so this models the happy
    // path: the caller ends up on a non-anonymous identity.
    const uid = await this.ensureAuth();
    this.isAnonymous = false;
    this.emitAuth();
    return uid;
  }

  async signOutToAnonymous(): Promise<string> {
    this.uid = this.backend.nextUid();
    this.isAnonymous = true;
    this.displayName = null;
    this.email = null;
    this.emitAuth();
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
    encounterTemplate?: ProfileTemplateField[];
    difficultyDie?: string;
    dangerDie?: string;
    password?: string;
  }): Promise<string> {
    const uid = await this.ensureAuth();
    const roomId = this.backend.nextId('room');
    const mapId = this.backend.nextId('map');
    const room: Room = {
      id: roomId,
      name: input.name,
      gmUid: uid,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      difficultyDie: input.difficultyDie ?? 'd6',
      dangerDie: input.dangerDie ?? 'd6',
      createdAt: Date.now(),
      // A brand-new room is active by definition (R25.1) — seeding this at
      // create means the clock is never absent on a room written at v19+.
      lastActivityAt: Date.now(),
      profileTemplate: input.profileTemplate,
      encounterTemplate: input.encounterTemplate ?? DEFAULT_ENCOUNTER_TEMPLATE,
      rollConventions: DEFAULT_ROLL_CONVENTIONS,
      handout: DEFAULT_HANDOUT,
      settings: DEFAULT_ROOM_SETTINGS,
      activeMapId: mapId,
      ...(input.password ? { password: input.password } : {}),
    };
    const bucket = this.backend.bucket(roomId);
    bucket.room.set(room as unknown as Doc);
    bucket.maps.setDoc(mapId, createDefaultGameMap(mapId) as unknown as Doc);
    await this.recordRoomVisit(roomId, { name: input.name, role: 'gm' });
    return roomId;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return (this.backend.bucket(roomId).room.get() as Room | null) ?? null;
  }

  subscribeRoom(roomId: string, cb: (room: Room | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).room.subscribe((v) => cb(v as Room | null));
  }

  // ---- My Rooms index (Master Plan v2, R6.2) ----

  subscribeMyRooms(cb: (rooms: MyRoomEntry[]) => void): Unsubscribe {
    if (!this.uid) {
      queueMicrotask(() => cb([]));
      return () => {};
    }
    return this.backend.userRooms(this.uid).subscribe((items) => {
      const rooms = (items as unknown as MyRoomEntry[])
        .slice()
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
      cb(rooms);
    });
  }

  async recordRoomVisit(roomId: string, entry: { name: string; role: Role }): Promise<void> {
    const uid = await this.ensureAuth();
    const record: MyRoomEntry = {
      roomId,
      name: entry.name,
      role: entry.role,
      lastSeenAt: Date.now(),
    };
    this.backend.userRooms(uid).setDoc(roomId, record as unknown as Doc);
  }

  async removeMyRoom(roomId: string): Promise<void> {
    const uid = await this.ensureAuth();
    this.backend.userRooms(uid).deleteDoc(roomId);
  }

  async dismissRoomDormancy(roomId: string, until: number): Promise<void> {
    const uid = await this.ensureAuth();
    const index = this.backend.userRooms(uid);
    // No entry ⇒ nothing to dismiss, exactly as the Firestore `updateDoc`
    // against a missing doc is a swallowed no-op there.
    if (!index.getDoc(roomId)) return;
    index.patchDoc(roomId, { dormantDismissedUntil: until } as unknown as Doc);
  }

  /** The R25.1 activity clock — see `FirebaseStore.touchRoomActivity`. The
   * memory backend has no rules, so there is no denial path to model here;
   * the throttle is the part the contract suite pins. */
  private touchRoomActivity(roomId: string): void {
    const now = Date.now();
    if (!this.activity.shouldWrite(roomId, now)) return;
    this.patchRoom(roomId, { lastActivityAt: now } as unknown as Doc);
  }

  async deleteRoom(roomId: string): Promise<void> {
    // Mirrors FirebaseStore's recursive delete (Master Plan v2, R6.3): clear
    // every subcollection and null out the singletons/ephemeral channels on the
    // *existing* bucket so live subscribers observe the room emptying, rather
    // than swapping in a fresh bucket (which they'd never see).
    const bucket = this.backend.bucket(roomId);
    for (const name of EXPORTED_COLLECTIONS) bucket[name].clear();
    bucket.cursors.clear();
    bucket.pings.clear();
    // Presence rides the room node in RTDB, so deleting the room takes it —
    // mirror that here or a live subscriber would keep seeing ghosts.
    bucket.presence.clear();
    for (const mapBucket of bucket.allMapBuckets().values()) {
      for (const name of EXPORTED_MAP_COLLECTIONS) mapBucket[name].clear();
      mapBucket.vectorMapDraft.clear();
    }
    bucket.maps.clear();
    bucket.room.set(null);
    bucket.encounter.set(null);
    bucket.sharedRoll.set(null);
    for (const value of bucket.dragging.values()) value.set(null);
    for (const value of bucket.yjs.values()) value.set(null);
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

  async setInitiativeConfig(
    roomId: string,
    input: { initiativeMode: EncounterMode; initiativeDie: string },
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({ ...cur, settings: { ...cur.settings, ...input } } as unknown as Doc);
  }

  async setRollConventions(roomId: string, conventions: RollConvention[]): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({ ...cur, rollConventions: conventions } as unknown as Doc);
  }

  async setDefaultPlayerGroup(roomId: string, value: DefaultPlayerGroup): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) return;
    bucket.room.set({
      ...cur,
      settings: { ...cur.settings, defaultPlayerGroup: value },
    } as unknown as Doc);
  }

  // ---- maps (Master Plan v2, R17.3) ----

  private patchMap(roomId: string, mapId: string, patch: Doc): void {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.maps.getDoc(mapId);
    if (!cur) return;
    bucket.maps.setDoc(mapId, { ...cur, ...patch });
  }

  subscribeMaps(roomId: string, cb: (maps: GameMap[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).maps.subscribe((items) => cb(items as unknown as GameMap[]));
  }

  subscribeMap(roomId: string, mapId: string, cb: (map: GameMap | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).maps.subscribe((items) => {
      const map = (items as unknown as GameMap[]).find((m) => m.id === mapId) ?? null;
      cb(map);
    });
  }

  async createMap(roomId: string, input: { name: string; gridKind?: MapGridKind }): Promise<string> {
    const bucket = this.backend.bucket(roomId);
    const mapId = this.backend.nextId('map');
    const order = bucket.maps.getAll().length;
    bucket.maps.setDoc(mapId, {
      ...createDefaultGameMap(mapId, input.name, input.gridKind),
      order,
    } as unknown as Doc);
    return mapId;
  }

  async renameMap(roomId: string, mapId: string, name: string): Promise<void> {
    this.patchMap(roomId, mapId, { name });
  }

  async deleteMap(roomId: string, mapId: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const mapBucket = bucket.mapBucket(mapId);
    for (const name of EXPORTED_MAP_COLLECTIONS) mapBucket[name].clear();
    mapBucket.vectorMapDraft.clear();
    bucket.maps.deleteDoc(mapId);
  }

  async setActiveMap(roomId: string, mapId: string): Promise<void> {
    this.patchRoom(roomId, { activeMapId: mapId });
  }

  async ensureActiveMap(roomId: string): Promise<string> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.room.get() as Room | null;
    if (!cur) throw new Error(`ensureActiveMap: room ${roomId} not found`);
    if (cur.activeMapId) return cur.activeMapId;
    // Pre-multi-map `MemoryStore` rooms only exist in tests that hand-seed a
    // legacy-shape room doc (there's no pre-v11 `MemoryStore` data in the
    // wild) — adopt whatever grid/background/measure/gridSettings the raw
    // doc still carries, falling back to defaults for anything missing,
    // mirroring `FirebaseStore.ensureActiveMap`.
    const raw = cur as unknown as Record<string, unknown>;
    const legacySettings = (raw['settings'] as Record<string, unknown> | undefined) ?? {};
    const mapId = this.backend.nextId('map');
    const seeded = createDefaultGameMap(mapId);
    const map: GameMap = {
      ...seeded,
      grid: (raw['grid'] as GameMap['grid'] | undefined) ?? seeded.grid,
      background:
        'background' in raw ? (raw['background'] as GameMap['background']) : seeded.background,
      measure: (legacySettings['measure'] as GameMap['measure'] | undefined) ?? seeded.measure,
      gridSettings:
        (legacySettings['grid'] as GameMap['gridSettings'] | undefined) ?? seeded.gridSettings,
    };
    bucket.maps.setDoc(mapId, map as unknown as Doc);
    this.patchRoom(roomId, { activeMapId: mapId });
    return mapId;
  }

  async createBattleMap(
    roomId: string,
    sourceMapId: string,
    rect: { minX: number; minY: number; maxX: number; maxY: number },
  ): Promise<string> {
    const bucket = this.backend.bucket(roomId);
    const source = bucket.maps.getDoc(sourceMapId) as unknown as GameMap | undefined;
    if (!source) throw new Error(`createBattleMap: source map ${sourceMapId} not found`);
    const mapId = this.backend.nextId('map');
    const order = bucket.maps.getAll().length;
    const map: GameMap = {
      ...createDefaultGameMap(mapId, `${source.name} — Battle`),
      order,
      grid: source.grid,
      measure: source.measure,
      gridSettings: source.gridSettings,
      ...(source.background !== undefined ? { background: source.background } : {}),
      battle: { sourceMapId, rect },
    };
    bucket.maps.setDoc(mapId, map as unknown as Doc);
    const sourceBucket = bucket.mapBucket(sourceMapId);
    const newBucket = bucket.mapBucket(mapId);
    for (const name of BATTLE_MAP_SOURCE_COLLECTIONS) {
      const entries = sourceBucket[name].entries();
      if (entries.length > 0) newBucket[name].setMany(entries);
    }
    return mapId;
  }

  async exitBattleMap(roomId: string, mapId: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const map = bucket.maps.getDoc(mapId) as unknown as GameMap | undefined;
    const sourceMapId = map?.battle?.sourceMapId;
    if (!sourceMapId) throw new Error(`exitBattleMap: map ${mapId} is not a battle map`);
    this.patchRoom(roomId, { activeMapId: sourceMapId });
    await this.deleteMap(roomId, mapId);
  }

  async setMapBackgroundColor(roomId: string, mapId: string, color: string): Promise<void> {
    this.patchMap(roomId, mapId, { background: { color } });
  }

  async removeMapBackground(roomId: string, mapId: string): Promise<void> {
    this.patchMap(roomId, mapId, { background: null });
  }

  // ---- placed background images (SPEC-038 §1, v23) ----

  subscribeBackgrounds(
    roomId: string,
    mapId: string,
    cb: (backgrounds: MapBackground[]) => void,
  ): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .backgrounds.subscribe((items) => cb(items as unknown as MapBackground[]));
  }

  async addBackground(
    roomId: string,
    mapId: string,
    background: Omit<MapBackground, 'id'> & { id?: string },
  ): Promise<string> {
    const id = background.id ?? this.backend.nextId('background');
    const full: MapBackground = { ...background, id };
    // Validate exactly as `mapBackgroundConverter` does on the Firebase side,
    // so a rect the real backend would reject cannot pass the contract here.
    MapBackgroundSchema.parse(full);
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .backgrounds.setDoc(id, full as unknown as Doc);
    return id;
  }

  async setBackgroundTransform(
    roomId: string,
    mapId: string,
    backgroundId: string,
    rect: { x: number; y: number; w: number; h: number },
  ): Promise<void> {
    this.patchBackground(roomId, mapId, backgroundId, rect);
  }

  async setBackgroundOrder(
    roomId: string,
    mapId: string,
    backgroundId: string,
    order: number,
  ): Promise<void> {
    this.patchBackground(roomId, mapId, backgroundId, { order });
  }

  async removeBackground(roomId: string, mapId: string, backgroundId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).backgrounds.deleteDoc(backgroundId);
  }

  private patchBackground(
    roomId: string,
    mapId: string,
    backgroundId: string,
    patch: Partial<Omit<MapBackground, 'id'>>,
  ): void {
    const col = this.backend.bucket(roomId).mapBucket(mapId).backgrounds;
    const cur = col.getDoc(backgroundId) as unknown as MapBackground | undefined;
    if (!cur) return;
    col.setDoc(backgroundId, { ...cur, ...patch } as unknown as Doc);
  }

  async migrateMapBackgrounds(roomId: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    for (const raw of bucket.maps.getAll()) {
      const { doc, background } = foldLegacyMapBackground(raw as Record<string, unknown>);
      if (!background) continue;
      const mapId = String(raw['id']);
      const id = this.backend.nextId('background');
      bucket.mapBucket(mapId).backgrounds.setDoc(id, { ...background, id } as unknown as Doc);
      bucket.maps.setDoc(mapId, doc as unknown as Doc);
    }
  }

  async setMapGridDimensions(roomId: string, mapId: string, grid: GameMap['grid']): Promise<void> {
    this.patchMap(roomId, mapId, { grid });
  }

  // ---- players ----

  async joinRoom(roomId: string, displayName: string): Promise<void> {
    const uid = await this.ensureAuth();
    const room = await this.getRoom(roomId);
    const existing = this.backend.bucket(roomId).players.getDoc(uid) as PlayerSeat | undefined;
    const seat: PlayerSeat = {
      uid,
      displayName,
      seatId: uid,
      role: room?.gmUid === uid ? 'gm' : 'player',
      joinedAt: existing?.joinedAt ?? Date.now(),
    };
    this.backend.bucket(roomId).players.setDoc(uid, seat as unknown as Doc);
    // SPEC-031 §3 — a seat gets a colour at creation. First join only, and only
    // when the (lazily created) profile doc doesn't already carry one, so a
    // re-join never repaints a character somebody chose for.
    if (!existing) {
      const profile = this.backend.bucket(roomId).profiles.getDoc(uid) as unknown as
        | ProfileInstance
        | undefined;
      if (profile?.color === undefined) {
        await this.setProfileColor(roomId, uid, randomCharacterColor());
      }
    }
    await this.recordRoomVisit(roomId, { name: room?.name ?? displayName, role: seat.role });
  }

  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .players.subscribe((items) => cb(items as unknown as PlayerSeat[]));
  }

  async renamePlayer(roomId: string, uid: string, displayName: string): Promise<void> {
    this.backend.bucket(roomId).players.patchDoc(uid, { displayName });
  }

  async setPlayerRole(roomId: string, uid: string, role: 'player' | 'viewer'): Promise<void> {
    this.backend.bucket(roomId).players.patchDoc(uid, { role });
  }

  async removePlayer(
    roomId: string,
    uid: string,
    opts?: { deleteProfile?: boolean },
  ): Promise<void> {
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

  async setCurrentCharacter(
    roomId: string,
    uid: string,
    seatId: string | undefined,
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.players.getDoc(uid);
    if (!cur) return;
    const next = { ...cur };
    if (seatId === undefined) delete next['currentCharacterSeatId'];
    else next['currentCharacterSeatId'] = seatId;
    bucket.players.setDoc(uid, next);
  }

  // ---- tokens ----

  subscribeTokens(roomId: string, cb: (tokens: Token[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).tokens.subscribe((items) => cb(items as unknown as Token[]));
  }

  async createToken(roomId: string, token: Omit<Token, 'id'> & { id?: string }): Promise<string> {
    const id = token.id ?? this.backend.nextId('token');
    const full: Token = { ...token, id };
    this.backend.bucket(roomId).tokens.setDoc(id, full as unknown as Doc);
    this.touchRoomActivity(roomId);
    return id;
  }

  async moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void> {
    this.backend.bucket(roomId).tokens.patchDoc(tokenId, { pos });
    this.touchRoomActivity(roomId);
  }

  async moveTokens(
    roomId: string,
    updates: Array<{ tokenId: string; pos: { x: number; y: number } }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    this.backend
      .bucket(roomId)
      .tokens.patchMany(updates.map((u) => [u.tokenId, { pos: u.pos } as unknown as Doc]));
    this.touchRoomActivity(roomId);
  }

  async resizeToken(roomId: string, tokenId: string, size: number): Promise<void> {
    this.backend.bucket(roomId).tokens.patchDoc(tokenId, { size });
  }

  async setTokenImage(roomId: string, tokenId: string, imageRef: string): Promise<void> {
    this.backend.bucket(roomId).tokens.patchDoc(tokenId, { imageRef });
  }

  async setTokenColor(roomId: string, tokenId: string, color: string | undefined): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.tokens.getDoc(tokenId);
    if (!cur) return;
    const next = { ...cur };
    if (color === undefined) delete next['color'];
    else next['color'] = color;
    bucket.tokens.setDoc(tokenId, next);
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

  async deleteToken(roomId: string, tokenId: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    bucket.tokens.deleteDoc(tokenId);
    // A creature's profile is keyed by its token id (SPEC-032 §2) and owned by
    // the token, so it goes with it. Unconditional: a token with no profile
    // deletes nothing, and no seat's profile can collide with a token id.
    bucket.profiles.deleteDoc(tokenId);
    this.touchRoomActivity(roomId);
  }

  // ---- groups ----

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .groups.subscribe((items) => cb(sortGroups(items as unknown as Group[])));
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
    // Validate exactly as `encounterConverter` does on the Firebase side.
    // Without this the contract suite happily accepted documents Firestore
    // would reject, which is the opposite of what a two-implementation
    // contract is for.
    EncounterSchema.parse(encounter);
    this.backend.bucket(roomId).encounter.set(encounter as unknown as Doc);
  }

  subscribeSymbols(roomId: string, mapId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .symbols.subscribe((items) => cb(items as unknown as MapSymbol[]));
  }

  async placeSymbol(
    roomId: string,
    mapId: string,
    symbol: Omit<MapSymbol, 'id'> & { id?: string },
  ): Promise<string> {
    const id = symbol.id ?? this.backend.nextId('symbol');
    const full: MapSymbol = { ...symbol, id };
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .symbols.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeSymbol(roomId: string, mapId: string, symbolId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).symbols.deleteDoc(symbolId);
  }

  subscribeMapRooms(roomId: string, mapId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .mapRooms.subscribe((items) => cb(items as unknown as MapRoom[]));
  }

  async upsertMapRoom(roomId: string, mapId: string, mapRoom: MapRoom): Promise<void> {
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .mapRooms.setDoc(mapRoom.id, mapRoom as unknown as Doc);
  }

  async removeMapRoom(roomId: string, mapId: string, mapRoomId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).mapRooms.deleteDoc(mapRoomId);
  }

  async setMapGridSubdivide(roomId: string, mapId: string, subdivide: boolean): Promise<void> {
    this.patchMap(roomId, mapId, { gridSettings: { subdivide } });
  }

  async setMapMeasurement(
    roomId: string,
    mapId: string,
    measure: GameMap['measure'],
  ): Promise<void> {
    this.patchMap(roomId, mapId, { measure });
  }

  // ---- Vector Map System — the floor/wall/door model (only map geometry
  // model, WI-D pure-rollout cutover) ----

  subscribeFloorRegions(
    roomId: string,
    mapId: string,
    cb: (regions: VectorFloorRegion[]) => void,
  ): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .floorRegions.subscribe((items) => cb(items as unknown as VectorFloorRegion[]));
  }

  async commitFloorRegions(
    roomId: string,
    mapId: string,
    commit: FloorRegionCommit,
  ): Promise<void> {
    const regions = this.backend.bucket(roomId).mapBucket(mapId).floorRegions;
    // One logical batch: upsert survivors, delete the absorbed ones (SPEC §5.5).
    if (commit.delete.length > 0) regions.deleteMany(commit.delete);
    if (commit.put.length > 0) {
      regions.setMany(commit.put.map((r) => [r.id, r as unknown as Doc]));
    }
    this.touchRoomActivity(roomId);
  }

  subscribeFogRegions(
    roomId: string,
    mapId: string,
    cb: (regions: VectorFloorRegion[]) => void,
  ): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .fogRegions.subscribe((items) => cb(items as unknown as VectorFloorRegion[]));
  }

  async commitFogRegions(roomId: string, mapId: string, commit: FloorRegionCommit): Promise<void> {
    const regions = this.backend.bucket(roomId).mapBucket(mapId).fogRegions;
    if (commit.delete.length > 0) regions.deleteMany(commit.delete);
    if (commit.put.length > 0) {
      regions.setMany(commit.put.map((r) => [r.id, r as unknown as Doc]));
    }
  }

  async setMapFogEnabled(roomId: string, mapId: string, enabled: boolean): Promise<void> {
    this.patchMap(roomId, mapId, { fog: { enabled } });
  }

  subscribeWalls(
    roomId: string,
    mapId: string,
    cb: (walls: StoredVectorWall[]) => void,
  ): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .walls.subscribe((items) => cb(items as unknown as StoredVectorWall[]));
  }

  async setWall(
    roomId: string,
    mapId: string,
    wall: Omit<StoredVectorWall, 'id'> & { id?: string },
  ): Promise<string> {
    const id = wall.id ?? this.backend.nextId('wseg');
    const full: StoredVectorWall = { ...wall, id };
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .walls.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeWall(roomId: string, mapId: string, wallId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).walls.deleteDoc(wallId);
  }

  async setWalls(roomId: string, mapId: string, walls: StoredVectorWall[]): Promise<void> {
    if (walls.length === 0) return;
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .walls.setMany(walls.map((w) => [w.id, w as unknown as Doc]));
  }

  async removeWalls(roomId: string, mapId: string, wallIds: string[]): Promise<void> {
    if (wallIds.length === 0) return;
    this.backend.bucket(roomId).mapBucket(mapId).walls.deleteMany(wallIds);
  }

  subscribeDoors(roomId: string, mapId: string, cb: (doors: VectorDoor[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .doors.subscribe((items) => cb(items as unknown as VectorDoor[]));
  }

  async setDoor(
    roomId: string,
    mapId: string,
    door: Omit<VectorDoor, 'id'> & { id?: string },
  ): Promise<string> {
    const id = door.id ?? this.backend.nextId('door');
    const full: VectorDoor = { ...door, id };
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .doors.setDoc(id, full as unknown as Doc);
    return id;
  }

  async removeDoor(roomId: string, mapId: string, doorId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).doors.deleteDoc(doorId);
  }

  publishVectorMapDraft(roomId: string, mapId: string, draft: VectorMapDraft): void {
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .vectorMapDraft.setDoc(draft.uid, draft as unknown as Doc);
  }

  subscribeVectorMapDraft(
    roomId: string,
    mapId: string,
    cb: (drafts: VectorMapDraft[]) => void,
  ): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .vectorMapDraft.subscribe((items) => cb(items as unknown as VectorMapDraft[]));
  }

  clearVectorMapDraft(roomId: string, mapId: string, uid: string): void {
    this.backend.bucket(roomId).mapBucket(mapId).vectorMapDraft.deleteDoc(uid);
  }

  // ---- annotate overlay ----

  subscribeDrawings(roomId: string, mapId: string, cb: (drawings: Drawing[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .drawings.subscribe((items) => cb(items as unknown as Drawing[]));
  }

  async writeDrawing(
    roomId: string,
    mapId: string,
    drawing: Omit<Drawing, 'id'> & { id?: string },
  ): Promise<string> {
    const id = drawing.id ?? this.backend.nextId('drawing');
    const full: Drawing = { ...drawing, id };
    this.backend
      .bucket(roomId)
      .mapBucket(mapId)
      .drawings.setDoc(id, full as unknown as Doc);
    return id;
  }

  async deleteDrawing(roomId: string, mapId: string, drawingId: string): Promise<void> {
    this.backend.bucket(roomId).mapBucket(mapId).drawings.deleteDoc(drawingId);
  }

  // ---- profiles ----

  subscribeProfiles(roomId: string, cb: (profiles: ProfileInstance[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .profiles.subscribe((items) => cb(items as unknown as ProfileInstance[]));
  }

  async setProfileValue(
    roomId: string,
    actorId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.profiles.getDoc(actorId) as unknown as ProfileInstance | undefined;
    // Deep-merges just the `values` map — matches FirebaseStore's
    // `setDoc(..., {merge: true})`, which touches only this field and leaves
    // every sibling field in `values` untouched.
    const next: ProfileInstance = {
      actorId,
      ...(cur?.portraitRef !== undefined ? { portraitRef: cur.portraitRef } : {}),
      ...(cur?.color !== undefined ? { color: cur.color } : {}),
      values: { ...(cur?.values ?? {}), [fieldId]: value },
    };
    bucket.profiles.setDoc(actorId, next as unknown as Doc);
    this.touchRoomActivity(roomId);
  }

  async updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    this.patchRoom(roomId, { profileTemplate: template });
  }

  async updateEncounterTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    this.patchRoom(roomId, { encounterTemplate: template });
  }

  async setProfilePortrait(
    roomId: string,
    actorId: string,
    portraitRef: string | undefined,
  ): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.profiles.getDoc(actorId) as unknown as ProfileInstance | undefined;
    const next: ProfileInstance = {
      actorId,
      values: cur?.values ?? {},
      ...(portraitRef !== undefined ? { portraitRef } : {}),
      ...(cur?.color !== undefined ? { color: cur.color } : {}),
    };
    bucket.profiles.setDoc(actorId, next as unknown as Doc);
  }

  async setProfileColor(roomId: string, actorId: string, color: string): Promise<void> {
    const bucket = this.backend.bucket(roomId);
    const cur = bucket.profiles.getDoc(actorId) as unknown as ProfileInstance | undefined;
    const next: ProfileInstance = {
      actorId,
      values: cur?.values ?? {},
      ...(cur?.portraitRef !== undefined ? { portraitRef: cur.portraitRef } : {}),
      color,
    };
    bucket.profiles.setDoc(actorId, next as unknown as Doc);
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

  async pruneEntriesBefore(
    roomId: string,
    before: number,
  ): Promise<{ log: number; rolls: number }> {
    const bucket = this.backend.bucket(roomId);
    const staleLog = (bucket.log.getAll() as unknown as LogEntry[]).filter((e) => e.ts < before);
    const staleRolls = (bucket.rolls.getAll() as unknown as Roll[]).filter((r) => r.ts < before);
    bucket.log.deleteMany(staleLog.map((e) => e.id));
    bucket.rolls.deleteMany(staleRolls.map((r) => r.id));
    return { log: staleLog.length, rolls: staleRolls.length };
  }

  // ---- rolls ----

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe {
    return this.backend.bucket(roomId).rolls.subscribe((items) => {
      // Same cap as `subscribeLog` / the Firebase impl (U18) — the contract
      // suite pins this boundary, so both stores must agree.
      const rolls = [...(items as unknown as Roll[])]
        .sort((a, b) => a.ts - b.ts)
        .slice(-LIVE_LOG_LIMIT);
      cb(rolls);
    });
  }

  async writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string> {
    const id = this.backend.nextId('roll');
    const full: Roll = { ...roll, id };
    this.backend.bucket(roomId).rolls.setDoc(id, full as unknown as Doc);
    this.touchRoomActivity(roomId);
    return id;
  }

  // ---- shared rolls (Master Plan v2, R3.6) ----

  subscribeSharedRoll(roomId: string, cb: (sharedRoll: SharedRoll | null) => void): Unsubscribe {
    return this.backend.bucket(roomId).sharedRoll.subscribe((v) => cb(v as SharedRoll | null));
  }

  async openSharedRoll(
    roomId: string,
    input: { openedBy: string; label?: string; kind?: 'initiative' },
  ): Promise<void> {
    const sharedRoll: SharedRoll = {
      status: 'staging',
      openedBy: input.openedBy,
      slots: {},
      ...(input.label ? { label: input.label } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
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
    return this.backend
      .bucket(roomId)
      .macros.subscribe((items) => cb(items as unknown as DiceMacro[]));
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
    return this.backend
      .bucket(roomId)
      .tables.subscribe((items) => cb(items as unknown as RandomTable[]));
  }

  async upsertTable(roomId: string, table: RandomTable): Promise<void> {
    this.backend.bucket(roomId).tables.setDoc(table.id, table as unknown as Doc);
  }

  async deleteTable(roomId: string, tableId: string): Promise<void> {
    this.backend.bucket(roomId).tables.deleteDoc(tableId);
  }

  // ---- Assets activity — saved URL refs ----

  subscribeAssetRefs(roomId: string, cb: (assetRefs: AssetRef[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .assetRefs.subscribe((items) => cb(items as unknown as AssetRef[]));
  }

  async saveAssetRef(
    roomId: string,
    assetRef: Omit<AssetRef, 'id'> & { id?: string },
  ): Promise<string> {
    const id = assetRef.id ?? this.backend.nextId('assetref');
    const full: AssetRef = { ...assetRef, id };
    this.backend.bucket(roomId).assetRefs.setDoc(id, full as unknown as Doc);
    return id;
  }

  async deleteAssetRef(roomId: string, assetRefId: string): Promise<void> {
    this.backend.bucket(roomId).assetRefs.deleteDoc(assetRefId);
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

    const maps = bucket.maps.entries().map(([mapId, mapDoc]) => {
      const mapBucket = bucket.mapBucket(mapId);
      const mapCollections: Record<string, Array<Record<string, unknown>>> = {};
      for (const name of EXPORTED_MAP_COLLECTIONS) {
        mapCollections[name] = mapBucket[name].entries().map(([id, doc]) => ({ id, ...doc }));
      }
      return { doc: { id: mapId, ...mapDoc }, collections: mapCollections };
    });

    const encounter = bucket.encounter.get();
    const notesState = await this.getYState(roomId, 'notes');
    const yjs: Record<string, string> = {};
    if (notesState) yjs['notes'] = bytesToBase64(notesState);

    return { room: roomBody, collections, maps, encounter, yjs };
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

    for (const { doc, collections: mapCollections } of snapshot.maps ?? []) {
      const { id: mapId, ...mapBody } = doc;
      bucket.maps.setDoc(String(mapId), mapBody);
      const mapBucket = bucket.mapBucket(String(mapId));
      for (const name of EXPORTED_MAP_COLLECTIONS) {
        const docs = mapCollections[name] ?? [];
        const entries: Array<[string, Doc]> = docs.map((record) => {
          const { id, ...body } = record;
          return [String(id), body];
        });
        mapBucket[name].setMany(entries);
      }
    }
    // A pre-v11 export carries no `maps` array — adopt its (already-imported,
    // still-flat) legacy map collections into a fresh first map, same as a
    // pre-v11 room does on open (`ensureActiveMap`).
    if (!snapshot.maps || snapshot.maps.length === 0) {
      await this.ensureActiveMap(roomId);
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
    return this.backend
      .bucket(roomId)
      .cursors.subscribe((items) => cb(items as unknown as CursorPos[]));
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
    return this.backend
      .bucket(roomId)
      .pings.subscribe((items) => cb(items as unknown as PingPos[]));
  }

  // ---- Presence (R26.1) ----

  publishPresence(roomId: string, name: string): void {
    const uid = this.requireUid();
    const key = `${roomId}/${uid}`;
    if (this.presenceTimers.has(key)) return; // idempotent, as in FirebaseStore
    const bucket = this.backend.bucket(roomId);
    const beat = (): void =>
      bucket.presence.setDoc(uid, { uid, name, ts: Date.now() } as unknown as Doc);
    beat();
    // A real interval, so the contract suite's staleness expectations and the
    // Firebase implementation's behaviour stay the same shape. `unref` where
    // available so a forgotten heartbeat cannot hold a Node test process open.
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    (timer as { unref?: () => void }).unref?.();
    this.presenceTimers.set(key, timer);
    void this.touchLastPresent(roomId, uid);
  }

  clearPresence(roomId: string): void {
    const uid = this.currentUid();
    if (!uid) return;
    const key = `${roomId}/${uid}`;
    const timer = this.presenceTimers.get(key);
    if (timer !== undefined) {
      clearInterval(timer);
      this.presenceTimers.delete(key);
    }
    // Stands in for RTDB `onDisconnect().remove()`: an in-memory store has no
    // connection to drop, so the explicit clear is the only removal path.
    this.backend.bucket(roomId).presence.deleteDoc(uid);
  }

  subscribePresence(roomId: string, cb: (present: PresenceEntry[]) => void): Unsubscribe {
    return this.backend
      .bucket(roomId)
      .presence.subscribe((items) => cb(items as unknown as PresenceEntry[]));
  }

  /** Durable half of presence (R26.2), throttled exactly as FirebaseStore is. */
  private async touchLastPresent(roomId: string, uid: string): Promise<void> {
    const key = `${roomId}/${uid}`;
    const last = this.lastPresentWrites.get(key) ?? 0;
    const now = Date.now();
    if (now - last < LAST_PRESENT_THROTTLE_MS) return;
    const bucket = this.backend.bucket(roomId);
    const seat = bucket.players.getDoc(uid);
    if (!seat) return; // no seat yet — the next heartbeat will land
    this.lastPresentWrites.set(key, now);
    bucket.players.setDoc(uid, { ...seat, lastPresentAt: now });
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
