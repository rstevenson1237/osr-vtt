import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
} from 'firebase/database';
import {
  type CollectionReference,
  type DocumentReference,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { mergeUpdates } from 'yjs';
import {
  assetRefConverter,
  diceMacroConverter,
  drawingConverter,
  encounterConverter,
  gameMapConverter,
  groupConverter,
  logEntryConverter,
  mapRoomConverter,
  mapSymbolConverter,
  playerSeatConverter,
  profileInstanceConverter,
  randomTableConverter,
  rollConverter,
  roomConverter,
  tokenConverter,
  vectorDoorConverter,
  vectorFloorRegionConverter,
  vectorWallConverter,
} from '../converters.js';
import { randomCharacterColor } from '../character-color.js';
import { sortGroups } from '../encounter/ordering.js';
import { createSeed, expandSharedRollSlots } from '../dice/engine.js';
import type { FirebaseClient } from '../firebase-config.js';
import { migrateRoom } from '../migrations/index.js';
import {
  BlindDrawSchema,
  HandoutRecordSchema,
  SharedRollMetaSchema,
  SharedRollSlotSchema,
} from '../schemas.js';
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
  DragFrame,
  FloorRegionCommit,
  LinkAccountResult,
  PingPos,
  PresenceEntry,
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
  LEGACY_FLAT_MAP_COLLECTIONS,
  LIVE_LOG_LIMIT,
  PRESENCE_HEARTBEAT_MS,
} from './campaign-store.js';

/**
 * The one `CampaignStore` implementation shipped in v1 (Plan §1.3). Every
 * Firebase SDK import in the whole app lives in this file (plus
 * `firebase-config.ts`) — Svelte components only ever see the
 * `CampaignStore` interface.
 */
export class FirebaseStore implements CampaignStore {
  constructor(private readonly client: FirebaseClient) {}

  /** room+uid keys whose cursor node already has an `onDisconnect().remove()`
   * armed, so the per-frame `publishCursor` only registers it once (R6.4). */
  private readonly cursorDisconnects = new Set<string>();

  /** room+uid → heartbeat interval, so `clearPresence` can stop exactly the one
   * it started and `publishPresence` stays idempotent (R26.1). */
  private readonly presenceTimers = new Map<string, ReturnType<typeof setInterval>>();

  /** room+uid → when `lastPresentAt` was last written, for the R26.2 throttle.
   * In-memory on purpose: a stored cursor would itself be a write. */
  private readonly lastPresentWrites = new Map<string, number>();

  /** room+token keys whose drag node already has an `onDisconnect().remove()`
   * armed (R25.3) — same guarded one-time pattern as `cursorDisconnects`, and
   * for the same reason: `publishDrag` is a per-frame path. */
  private readonly dragDisconnects = new Set<string>();

  /** The R25.1 activity clock's throttle, keyed by roomId. */
  private readonly activity = new ActivityThrottle();

  /** Rooms this client has learned it may not write the room doc of — see
   * `touchRoomActivity`. */
  private readonly activityDenied = new Set<string>();

  async ensureAuth(): Promise<string> {
    // `auth.currentUser` is `null` until the SDK finishes restoring a
    // persisted session from IndexedDB — a real async read that hasn't
    // necessarily settled by the time this runs (e.g. `Lobby`'s `onMount`
    // calls this immediately on every page load). Without this wait, a
    // returning user whose session hadn't finished restoring yet — including
    // one linked to Google — reads as "no user", and the `signInAnonymously`
    // below would silently replace them with a brand-new anonymous identity:
    // an effective, unintended sign-out with no persisted state lost, but
    // no way back to it either. `authStateReady()` resolves once that
    // restoration (or the determination that there's nothing to restore) is
    // done, so `currentUser` below reflects the real, settled state.
    await this.client.auth.authStateReady();
    const existing = this.client.auth.currentUser;
    if (existing) return existing.uid;
    const cred = await signInAnonymously(this.client.auth);
    return cred.user.uid;
  }

  currentUid(): string | null {
    return this.client.auth.currentUser?.uid ?? null;
  }

  private requireUid(): string {
    const uid = this.currentUid();
    if (!uid) {
      throw new Error('FirebaseStore: no authenticated user — call ensureAuth() first');
    }
    return uid;
  }

  // ---- accounts (Master Plan v2, R6.1 — optional Google linking) ----

  subscribeAuth(cb: (account: AccountInfo | null) => void): Unsubscribe {
    return onAuthStateChanged(this.client.auth, (user) => {
      cb(user ? toAccountInfo(user) : null);
    });
  }

  async linkWithGoogle(): Promise<LinkAccountResult> {
    const user = this.client.auth.currentUser;
    if (!user) return { ok: false, reason: 'error', message: 'not signed in' };
    try {
      // Same uid, in place (Master Plan v2, R6.1) — a GM keeps their room.
      const cred = await linkWithPopup(user, new GoogleAuthProvider());
      return { ok: true, account: toAccountInfo(cred.user) };
    } catch (err) {
      return { ok: false, ...classifyAuthError(err) };
    }
  }

  async signInWithGoogle(): Promise<string> {
    // Switches identity (the current anonymous uid is abandoned) — the
    // recover-on-a-fresh-device / "sign in instead" path (Master Plan v2, R6.1).
    const cred = await signInWithPopup(this.client.auth, new GoogleAuthProvider());
    return cred.user.uid;
  }

  async signOutToAnonymous(): Promise<string> {
    await signOut(this.client.auth);
    // Never leave the client logged-out: re-bootstrap a fresh anonymous seat
    // so the app keeps working (mirrors `ensureAuth`'s bootstrap).
    const cred = await signInAnonymously(this.client.auth);
    return cred.user.uid;
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
    // Room-id entropy (R24.4 — audited, passes; do not "simplify" this to a
    // readable or derived id). Room reads are `signedIn()`, not
    // membership-gated, because a listener denied at subscribe time never
    // recovers (see the `groups` note in firestore.rules). The roomId IS the
    // capability, so its entropy is the only barrier against a stranger
    // reading an arbitrary room.
    //
    // `doc(collection(...))` mints a Firestore auto-id: 20 characters from a
    // 62-symbol alphabet ≈ 119 bits of CSPRNG-derived entropy, which R24.4
    // accepts explicitly. Anything sequential, timestamp-derived,
    // `Math.random()`-derived, or short enough to enumerate would not be.
    const roomRef = doc(collection(this.client.db, 'rooms')).withConverter(roomConverter);
    const mapRef = doc(collection(this.client.db, 'rooms', roomRef.id, 'maps')).withConverter(
      gameMapConverter,
    );
    const room: Room = {
      id: roomRef.id,
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
      activeMapId: mapRef.id,
      ...(input.password ? { password: input.password } : {}),
    };
    // The room doc must land first: `maps/{mapId}`'s create rule is
    // `isGM(roomId)`, which `get()`s the room doc to read `gmUid` — if the
    // map write races ahead of the room write, that `get()` hits a
    // not-yet-existent doc and the rule evaluation fails outright (a real CI
    // failure this exact ordering caused: "Null value error ... for 'create'"
    // against the `maps/{mapId}` rule).
    await setDoc(roomRef, room);
    await setDoc(mapRef, createDefaultGameMap(mapRef.id));
    // "written on create/join/open" (Master Plan v2, R6.2) — the creator is GM.
    await this.recordRoomVisit(roomRef.id, { name: input.name, role: 'gm' });
    return roomRef.id;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const snap = await getDoc(doc(this.client.db, 'rooms', roomId).withConverter(roomConverter));
    return snap.exists() ? snap.data() : null;
  }

  subscribeRoom(roomId: string, cb: (room: Room | null) => void): Unsubscribe {
    const roomRef = doc(this.client.db, 'rooms', roomId).withConverter(roomConverter);
    return onSnapshot(roomRef, (snap) => cb(snap.exists() ? snap.data() : null));
  }

  // ---- My Rooms index (Master Plan v2, R6.2) ----

  subscribeMyRooms(cb: (rooms: MyRoomEntry[]) => void): Unsubscribe {
    const uid = this.currentUid();
    if (!uid) {
      cb([]);
      return () => {};
    }
    const col = query(
      collection(this.client.db, 'users', uid, 'rooms'),
      orderBy('lastSeenAt', 'desc'),
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => toMyRoomEntry(d.id, d.data()))));
  }

  async recordRoomVisit(roomId: string, entry: { name: string; role: Role }): Promise<void> {
    const uid = await this.ensureAuth();
    const record: MyRoomEntry = {
      roomId,
      name: entry.name,
      role: entry.role,
      lastSeenAt: Date.now(),
    };
    await setDoc(doc(this.client.db, 'users', uid, 'rooms', roomId), record);
  }

  async removeMyRoom(roomId: string): Promise<void> {
    const uid = await this.ensureAuth();
    await deleteDoc(doc(this.client.db, 'users', uid, 'rooms', roomId));
  }

  async dismissRoomDormancy(roomId: string, until: number): Promise<void> {
    const uid = await this.ensureAuth();
    // merge:true, not setDoc: the entry already carries name/role/lastSeenAt
    // and this must not resurrect a stale copy of them. An entry that no longer
    // exists would be recreated as a fragment, so this is a no-op in that case
    // — hence `updateDoc`, which rejects on a missing doc, swallowed.
    await updateDoc(doc(this.client.db, 'users', uid, 'rooms', roomId), {
      dormantDismissedUntil: until,
    }).catch(() => {});
  }

  /**
   * The R25.1 activity clock. Called from **settled** write paths only (never
   * from an RTDB channel, a cursor, or a timer) and throttled to at most one
   * write per `ROOM_ACTIVITY_THROTTLE_MS` per room, so a busy session costs at
   * most 12 extra writes per client-hour.
   *
   * Fire-and-forget by design: this is bookkeeping riding on top of a write the
   * caller already cares about, and it must never turn a successful token move
   * into a rejected promise.
   *
   * Room-doc updates are GM-only (`firestore.rules`), so a player's client is
   * denied here. Rather than pay a room read to find out, the first denial
   * *is* the answer: the room goes into `activityDenied` and this client stops
   * trying for the rest of the session. The referee's client keeps the clock —
   * and a room nobody with write authority has opened in 90 days is exactly
   * what "dormant" is meant to describe.
   */
  private touchRoomActivity(roomId: string): void {
    if (this.activityDenied.has(roomId)) return;
    const now = Date.now();
    if (!this.activity.shouldWrite(roomId, now)) return;
    void updateDoc(doc(this.client.db, 'rooms', roomId), { lastActivityAt: now }).catch(
      (err: unknown) => {
        if ((err as { code?: string })?.code === 'permission-denied') {
          this.activityDenied.add(roomId);
          return;
        }
        // A transient failure (offline, contention) should not cost the room
        // five minutes of silence — let the next settled write try again.
        this.activity.forget(roomId);
      },
    );
  }

  async deleteRoom(roomId: string): Promise<void> {
    // Recursive, client-side (Master Plan v2, R6.3): clear every subcollection
    // in ≤DELETE_BATCH_LIMIT-doc batches, then the room doc, then the room's
    // ephemeral RTDB node. The final room-doc delete is the GM-only write
    // Security Rules gate on — a non-GM caller fails there.
    //
    // Every collection wipe below is independent of the others, so they run
    // via Promise.all rather than sequential awaits — with a map's worth of
    // subcollections (R17.3) now added on top of the original room-level
    // ones, awaiting each round-trip one at a time pushed this well past the
    // emulator-backed contract test's 30s timeout under real CI latency.
    const mapsSnap = await getDocs(collection(this.client.db, 'rooms', roomId, 'maps'));
    await Promise.all([
      ...EXPORTED_COLLECTIONS.map((name) =>
        this.deleteCollectionDocs(collection(this.client.db, 'rooms', roomId, name)),
      ),
      // Every map (R17.3) and its own map-scoped subcollections.
      ...mapsSnap.docs.flatMap((mapDoc) =>
        EXPORTED_MAP_COLLECTIONS.map((name) =>
          this.deleteCollectionDocs(
            collection(this.client.db, 'rooms', roomId, 'maps', mapDoc.id, name),
          ),
        ),
      ),
      this.deleteCollectionDocs(collection(this.client.db, 'rooms', roomId, 'maps')),
      // Singleton `encounter/current` plus the `sharedRoll/current` doc's
      // nested `slots` subcollection (deleting a doc never cascades to its
      // own subcollections in Firestore, so `slots` must be cleared explicitly).
      this.deleteCollectionDocs(collection(this.client.db, 'rooms', roomId, 'encounter')),
      this.deleteCollectionDocs(
        collection(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots'),
      ),
    ]);
    await this.deleteCollectionDocs(collection(this.client.db, 'rooms', roomId, 'sharedRoll'));
    await deleteDoc(doc(this.client.db, 'rooms', roomId));
    await remove(ref(this.client.rtdb, `rooms/${roomId}`));
  }

  /** Deletes every doc in a collection in ≤DELETE_BATCH_LIMIT-doc batches
   * (Master Plan v2, R6.3 — "≤400-doc batches"). Shared by `deleteRoom` and
   * `pruneEntriesBefore`. */
  private async deleteDocRefs(refs: DocumentReference[]): Promise<void> {
    for (let i = 0; i < refs.length; i += DELETE_BATCH_LIMIT) {
      const batch = writeBatch(this.client.db);
      for (const r of refs.slice(i, i + DELETE_BATCH_LIMIT)) batch.delete(r);
      await batch.commit();
    }
  }

  private async deleteCollectionDocs(col: CollectionReference): Promise<void> {
    const snap = await getDocs(col);
    await this.deleteDocRefs(snap.docs.map((d) => d.ref));
  }

  async renameRoom(roomId: string, name: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { name });
  }

  async setTheme(roomId: string, theme: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { 'settings.theme': theme });
  }

  async setInitiativeConfig(
    roomId: string,
    input: { initiativeMode: EncounterMode; initiativeDie: string },
  ): Promise<void> {
    // Dotted paths so the write touches only these two keys — `settings` also
    // carries `theme`, which `setTheme` owns.
    await updateDoc(doc(this.client.db, 'rooms', roomId), {
      'settings.initiativeMode': input.initiativeMode,
      'settings.initiativeDie': input.initiativeDie,
    });
  }

  async setRollConventions(roomId: string, conventions: RollConvention[]): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { rollConventions: conventions });
  }

  async setDefaultPlayerGroup(roomId: string, value: DefaultPlayerGroup): Promise<void> {
    // Dotted path for the same reason as `setInitiativeConfig` above — this
    // must not clobber the sibling keys other setters own.
    await updateDoc(doc(this.client.db, 'rooms', roomId), { 'settings.defaultPlayerGroup': value });
  }

  // ---- maps (Master Plan v2, R17.3 — multiple full map builds per session)

  subscribeMaps(roomId: string, cb: (maps: GameMap[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'maps').withConverter(gameMapConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  subscribeMap(roomId: string, mapId: string, cb: (map: GameMap | null) => void): Unsubscribe {
    const mapRef = doc(this.client.db, 'rooms', roomId, 'maps', mapId).withConverter(
      gameMapConverter,
    );
    return onSnapshot(mapRef, (snap) => cb(snap.exists() ? snap.data() : null));
  }

  async createMap(roomId: string, input: { name: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'maps').withConverter(gameMapConverter);
    const existing = await getDocs(col);
    const mapRef = doc(col);
    const map: GameMap = { ...createDefaultGameMap(mapRef.id, input.name), order: existing.size };
    await setDoc(mapRef, map);
    return mapRef.id;
  }

  async renameMap(roomId: string, mapId: string, name: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { name });
  }

  async deleteMap(roomId: string, mapId: string): Promise<void> {
    for (const name of EXPORTED_MAP_COLLECTIONS) {
      await this.deleteCollectionDocs(
        collection(this.client.db, 'rooms', roomId, 'maps', mapId, name),
      );
    }
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId));
  }

  async setActiveMap(roomId: string, mapId: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { activeMapId: mapId });
  }

  async ensureActiveMap(roomId: string): Promise<string> {
    // Raw, unconverted read: `roomConverter`/`RoomSchema` no longer declare
    // `grid`/`background`/`settings.measure`/`settings.grid` (moved to
    // `GameMap`, v10->v11), so the legacy values this adopts would already be
    // stripped by the time they reached a `Room`. Reading the raw doc body
    // catches them before that happens.
    const roomRef = doc(this.client.db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error(`ensureActiveMap: room ${roomId} not found`);
    const raw = snap.data() as Record<string, unknown>;
    if (typeof raw['activeMapId'] === 'string') return raw['activeMapId'];

    const mapCol = collection(this.client.db, 'rooms', roomId, 'maps').withConverter(
      gameMapConverter,
    );
    const mapRef = doc(mapCol);
    const legacySettings = (raw['settings'] as Record<string, unknown> | undefined) ?? {};
    const seeded = createDefaultGameMap(mapRef.id);
    const map: GameMap = {
      ...seeded,
      grid: (raw['grid'] as GameMap['grid'] | undefined) ?? seeded.grid,
      background:
        'background' in raw ? (raw['background'] as GameMap['background']) : seeded.background,
      measure: (legacySettings['measure'] as GameMap['measure'] | undefined) ?? seeded.measure,
      gridSettings:
        (legacySettings['grid'] as GameMap['gridSettings'] | undefined) ?? seeded.gridSettings,
    };

    // Move every legacy flat map collection under the new map doc, in
    // ≤DELETE_BATCH_LIMIT-doc batches (same write discipline as `deleteRoom`).
    // Each collection is independent of the others, so they migrate via
    // Promise.all rather than sequential awaits (same rationale as the
    // `deleteRoom` parallelization above — this loop has the identical
    // one-round-trip-per-collection shape).
    await Promise.all(
      // Only the legacy-flat cellular collections ever lived at the flat
      // room-level path (and have flat room-level rules); the Vector Map
      // System collections are v11+ / `maps/{mapId}`-only, so scanning their
      // flat path would hit an unruled location and be denied.
      LEGACY_FLAT_MAP_COLLECTIONS.map(async (name) => {
        const flatCol = collection(this.client.db, 'rooms', roomId, name);
        const flatSnap = await getDocs(flatCol);
        if (flatSnap.empty) return;
        const nestedCol = collection(this.client.db, 'rooms', roomId, 'maps', mapRef.id, name);
        for (let i = 0; i < flatSnap.docs.length; i += DELETE_BATCH_LIMIT) {
          const batch = writeBatch(this.client.db);
          for (const d of flatSnap.docs.slice(i, i + DELETE_BATCH_LIMIT)) {
            batch.set(doc(nestedCol, d.id), d.data());
          }
          await batch.commit();
        }
        await this.deleteCollectionDocs(flatCol);
      }),
    );

    await setDoc(mapRef, map);
    await updateDoc(roomRef, { activeMapId: mapRef.id });
    return mapRef.id;
  }

  async createBattleMap(
    roomId: string,
    sourceMapId: string,
    rect: { minX: number; minY: number; maxX: number; maxY: number },
  ): Promise<string> {
    const sourceRef = doc(
      this.client.db,
      'rooms',
      roomId,
      'maps',
      sourceMapId,
    ).withConverter(gameMapConverter);
    const sourceSnap = await getDoc(sourceRef);
    if (!sourceSnap.exists()) {
      throw new Error(`createBattleMap: source map ${sourceMapId} not found`);
    }
    const source = sourceSnap.data();

    const col = collection(this.client.db, 'rooms', roomId, 'maps').withConverter(gameMapConverter);
    const existing = await getDocs(col);
    const mapRef = doc(col);
    const map: GameMap = {
      ...createDefaultGameMap(mapRef.id, `${source.name} — Battle`),
      order: existing.size,
      grid: source.grid,
      measure: source.measure,
      gridSettings: source.gridSettings,
      ...(source.background !== undefined ? { background: source.background } : {}),
      battle: { sourceMapId, rect },
    };
    await setDoc(mapRef, map);

    // Every source subcollection except `fogRegions` (SPEC-029 §2), copied
    // verbatim with the original doc ids preserved — same write discipline as
    // `importRoom`'s per-map loop.
    for (const name of BATTLE_MAP_SOURCE_COLLECTIONS) {
      const snap = await getDocs(
        collection(this.client.db, 'rooms', roomId, 'maps', sourceMapId, name),
      );
      for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(this.client.db);
        for (const d of snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
          batch.set(doc(this.client.db, 'rooms', roomId, 'maps', mapRef.id, name, d.id), d.data());
        }
        await batch.commit();
      }
    }
    return mapRef.id;
  }

  async exitBattleMap(roomId: string, mapId: string): Promise<void> {
    const mapRef = doc(this.client.db, 'rooms', roomId, 'maps', mapId).withConverter(
      gameMapConverter,
    );
    const snap = await getDoc(mapRef);
    const sourceMapId = snap.exists() ? snap.data().battle?.sourceMapId : undefined;
    if (!sourceMapId) throw new Error(`exitBattleMap: map ${mapId} is not a battle map`);
    await updateDoc(doc(this.client.db, 'rooms', roomId), { activeMapId: sourceMapId });
    await this.deleteMap(roomId, mapId);
  }

  async setMapBackground(roomId: string, mapId: string, ref: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { background: { ref } });
  }

  async setMapBackgroundColor(roomId: string, mapId: string, color: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { background: { color } });
  }

  async removeMapBackground(roomId: string, mapId: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { background: null });
  }

  async setMapGridDimensions(roomId: string, mapId: string, grid: GameMap['grid']): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { grid });
  }

  async setMapMeasurement(
    roomId: string,
    mapId: string,
    measure: GameMap['measure'],
  ): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { measure });
  }

  async setMapGridSubdivide(roomId: string, mapId: string, subdivide: boolean): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), {
      gridSettings: { subdivide },
    });
  }

  // ---- players ----

  async joinRoom(roomId: string, displayName: string): Promise<void> {
    const uid = await this.ensureAuth();
    const room = await this.getRoom(roomId);
    const role = room?.gmUid === uid ? 'gm' : 'player';
    const seatRef = doc(this.client.db, 'rooms', roomId, 'players', uid).withConverter(
      playerSeatConverter,
    );
    const existing = await getDoc(seatRef);
    const seat: PlayerSeat = {
      uid,
      displayName,
      seatId: uid,
      role,
      joinedAt: existing.exists() ? (existing.data().joinedAt ?? Date.now()) : Date.now(),
    };
    await setDoc(seatRef, seat);
    if (!existing.exists()) await this.seedCharacterColor(roomId, uid);
    // "written on create/join/open" (Master Plan v2, R6.2). `role` here is the
    // seat's gm/player role; a viewer seat records as 'player' (index roles are
    // gm/player/viewer, and a fresh join is never a viewer).
    await this.recordRoomVisit(roomId, { name: room?.name ?? displayName, role });
  }

  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'players').withConverter(
      playerSeatConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async renamePlayer(roomId: string, uid: string, displayName: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'players', uid), { displayName });
  }

  async setPlayerRole(roomId: string, uid: string, role: 'player' | 'viewer'): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'players', uid), { role });
  }

  async removePlayer(
    roomId: string,
    uid: string,
    opts?: { deleteProfile?: boolean },
  ): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'players', uid));
    if (opts?.deleteProfile) {
      await deleteDoc(doc(this.client.db, 'rooms', roomId, 'profiles', uid));
    }
  }

  async transferGM(roomId: string, newGmUid: string): Promise<void> {
    const oldGmUid = this.requireUid();
    const batch = writeBatch(this.client.db);
    batch.update(doc(this.client.db, 'rooms', roomId), { gmUid: newGmUid });
    batch.update(doc(this.client.db, 'rooms', roomId, 'players', oldGmUid), { role: 'player' });
    batch.update(doc(this.client.db, 'rooms', roomId, 'players', newGmUid), { role: 'gm' });
    await batch.commit();
  }

  async setCurrentCharacter(
    roomId: string,
    uid: string,
    seatId: string | undefined,
  ): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'players', uid), {
      currentCharacterSeatId: seatId ?? deleteField(),
    });
  }

  // ---- tokens ----

  subscribeTokens(roomId: string, cb: (tokens: Token[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'tokens').withConverter(tokenConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async createToken(roomId: string, token: Omit<Token, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'tokens').withConverter(tokenConverter);
    const tokenRef = token.id ? doc(col, token.id) : doc(col);
    const full: Token = { ...token, id: tokenRef.id };
    await setDoc(tokenRef, full);
    this.touchRoomActivity(roomId);
    return tokenRef.id;
  }

  async moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { pos });
    // Drag-END, one of R25.1's named settled writes — the drag *frames* are
    // RTDB and never touch this.
    this.touchRoomActivity(roomId);
  }

  async moveTokens(
    roomId: string,
    updates: Array<{ tokenId: string; pos: { x: number; y: number } }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    // One batched commit per collapsed-group drag, never one write per member
    // (Master Plan v2, R8.4 — mirrors `setWalls`'s drag-run write discipline).
    // `update` (not `set`) so only `pos` changes, leaving size/owner/layer be.
    const batch = writeBatch(this.client.db);
    for (const u of updates) {
      batch.update(doc(this.client.db, 'rooms', roomId, 'tokens', u.tokenId), { pos: u.pos });
    }
    await batch.commit();
    this.touchRoomActivity(roomId);
  }

  async resizeToken(roomId: string, tokenId: string, size: number): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { size });
  }

  async setTokenImage(roomId: string, tokenId: string, imageRef: string): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { imageRef });
  }

  async setTokenColor(roomId: string, tokenId: string, color: string | undefined): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { color: color ?? deleteField() });
  }

  async setTokenOwner(
    roomId: string,
    tokenId: string,
    ownerSeatId: string | undefined,
  ): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { ownerSeatId: ownerSeatId ?? deleteField() });
  }

  async deleteToken(roomId: string, tokenId: string): Promise<void> {
    // The token and the creature profile it owns (SPEC-032 §2) go together.
    // A batch rather than two awaits: a half-applied delete would leave an
    // orphan profile nothing can ever reach again, since its only key was the
    // token's id. Deleting a profile document that does not exist is a no-op,
    // so a character token — whose profile is keyed by a seat id — costs one
    // extra write in the batch and touches nothing.
    const batch = writeBatch(this.client.db);
    batch.delete(doc(this.client.db, 'rooms', roomId, 'tokens', tokenId));
    batch.delete(doc(this.client.db, 'rooms', roomId, 'profiles', tokenId));
    await batch.commit();
    this.touchRoomActivity(roomId);
  }

  // ---- groups ----

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'groups').withConverter(groupConverter);
    // Sorted here, not `orderBy`'d: `order` is optional, and a Firestore
    // `orderBy` silently *drops* documents missing the field — a room written
    // before `order` existed would come back empty. `sortGroups` keeps those
    // groups, after the ordered ones.
    return onSnapshot(col, (snap) => cb(sortGroups(snap.docs.map((d) => d.data()))));
  }

  async createGroup(roomId: string, group: Omit<Group, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'groups').withConverter(groupConverter);
    const groupRef = group.id ? doc(col, group.id) : doc(col);
    const full: Group = { ...group, id: groupRef.id };
    await setDoc(groupRef, full);
    return groupRef.id;
  }

  async updateGroup(
    roomId: string,
    groupId: string,
    patch: Partial<Omit<Group, 'id'>>,
  ): Promise<void> {
    const groupRef = doc(this.client.db, 'rooms', roomId, 'groups', groupId);
    await updateDoc(groupRef, patch);
  }

  async deleteGroup(roomId: string, groupId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'groups', groupId));
  }

  // ---- combat tracker (Encounter Screen Spec §4, §10) ----

  subscribeEncounter(roomId: string, cb: (encounter: Encounter | null) => void): Unsubscribe {
    const ref = doc(this.client.db, 'rooms', roomId, 'encounter', 'current').withConverter(
      encounterConverter,
    );
    return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
  }

  async writeEncounter(roomId: string, encounter: Encounter): Promise<void> {
    const ref = doc(this.client.db, 'rooms', roomId, 'encounter', 'current').withConverter(
      encounterConverter,
    );
    await setDoc(ref, encounter);
  }

  subscribeSymbols(roomId: string, mapId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'symbols').withConverter(
      mapSymbolConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async placeSymbol(
    roomId: string,
    mapId: string,
    symbol: Omit<MapSymbol, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'symbols').withConverter(
      mapSymbolConverter,
    );
    const symbolRef = symbol.id ? doc(col, symbol.id) : doc(col);
    const full: MapSymbol = { ...symbol, id: symbolRef.id };
    await setDoc(symbolRef, full);
    return symbolRef.id;
  }

  async removeSymbol(roomId: string, mapId: string, symbolId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'symbols', symbolId));
  }

  subscribeMapRooms(roomId: string, mapId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe {
    const col = collection(
      this.client.db,
      'rooms',
      roomId,
      'maps',
      mapId,
      'mapRooms',
    ).withConverter(mapRoomConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async upsertMapRoom(roomId: string, mapId: string, mapRoom: MapRoom): Promise<void> {
    const roomRef = doc(
      this.client.db,
      'rooms',
      roomId,
      'maps',
      mapId,
      'mapRooms',
      mapRoom.id,
    ).withConverter(mapRoomConverter);
    await setDoc(roomRef, mapRoom);
  }

  async removeMapRoom(roomId: string, mapId: string, mapRoomId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'mapRooms', mapRoomId));
  }

  // ---- Vector Map System (WI-B — SPEC/DECISIONS in `docs/VTT_Master_Plan.md` (Part II §2, Part V §2)) ----

  /** `floorRegions` and `fogRegions` are the same doc shape and the same
   * commit discipline pointed at two collections (SPEC §2.1 / §4), so they
   * share one accessor rather than duplicating the converter wiring. */
  private regionCollection(roomId: string, mapId: string, name: 'floorRegions' | 'fogRegions') {
    return collection(this.client.db, 'rooms', roomId, 'maps', mapId, name).withConverter(
      vectorFloorRegionConverter,
    );
  }

  private async commitRegions(
    roomId: string,
    mapId: string,
    name: 'floorRegions' | 'fogRegions',
    commit: FloorRegionCommit,
  ): Promise<void> {
    if (commit.put.length === 0 && commit.delete.length === 0) return;
    const col = this.regionCollection(roomId, mapId, name);
    // One batched write per carve/merge/split (SPEC §5.5), never one write per
    // region — the same discipline `commitFloorChunks`/`setWalls` use.
    const batch = writeBatch(this.client.db);
    for (const id of commit.delete) batch.delete(doc(col, id));
    for (const region of commit.put) batch.set(doc(col, region.id), region);
    await batch.commit();
    // Stroke release (R25.1). The in-progress carve preview rides RTDB and is
    // deliberately not counted as activity.
    this.touchRoomActivity(roomId);
  }

  subscribeFloorRegions(
    roomId: string,
    mapId: string,
    cb: (regions: VectorFloorRegion[]) => void,
  ): Unsubscribe {
    const col = this.regionCollection(roomId, mapId, 'floorRegions');
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async commitFloorRegions(
    roomId: string,
    mapId: string,
    commit: FloorRegionCommit,
  ): Promise<void> {
    await this.commitRegions(roomId, mapId, 'floorRegions', commit);
  }

  subscribeFogRegions(
    roomId: string,
    mapId: string,
    cb: (regions: VectorFloorRegion[]) => void,
  ): Unsubscribe {
    const col = this.regionCollection(roomId, mapId, 'fogRegions');
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async commitFogRegions(roomId: string, mapId: string, commit: FloorRegionCommit): Promise<void> {
    await this.commitRegions(roomId, mapId, 'fogRegions', commit);
  }

  async setMapFogEnabled(roomId: string, mapId: string, enabled: boolean): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId), { fog: { enabled } });
  }

  subscribeWalls(
    roomId: string,
    mapId: string,
    cb: (walls: StoredVectorWall[]) => void,
  ): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'walls').withConverter(
      vectorWallConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setWall(
    roomId: string,
    mapId: string,
    wall: Omit<StoredVectorWall, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'walls').withConverter(
      vectorWallConverter,
    );
    const wallRef = wall.id ? doc(col, wall.id) : doc(col);
    const full: StoredVectorWall = { ...wall, id: wallRef.id };
    await setDoc(wallRef, full);
    return wallRef.id;
  }

  async removeWall(roomId: string, mapId: string, wallId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'walls', wallId));
  }

  async setWalls(roomId: string, mapId: string, walls: StoredVectorWall[]): Promise<void> {
    if (walls.length === 0) return;
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'walls').withConverter(
      vectorWallConverter,
    );
    const batch = writeBatch(this.client.db);
    for (const wall of walls) batch.set(doc(col, wall.id), wall);
    await batch.commit();
  }

  async removeWalls(roomId: string, mapId: string, wallIds: string[]): Promise<void> {
    if (wallIds.length === 0) return;
    const batch = writeBatch(this.client.db);
    for (const id of wallIds) {
      batch.delete(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'walls', id));
    }
    await batch.commit();
  }

  subscribeDoors(roomId: string, mapId: string, cb: (doors: VectorDoor[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'doors').withConverter(
      vectorDoorConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setDoor(
    roomId: string,
    mapId: string,
    door: Omit<VectorDoor, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'maps', mapId, 'doors').withConverter(
      vectorDoorConverter,
    );
    const doorRef = door.id ? doc(col, door.id) : doc(col);
    const full: VectorDoor = { ...door, id: doorRef.id };
    await setDoc(doorRef, full);
    return doorRef.id;
  }

  async removeDoor(roomId: string, mapId: string, doorId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'doors', doorId));
  }

  publishVectorMapDraft(roomId: string, mapId: string, draft: VectorMapDraft): void {
    void set(
      ref(this.client.rtdb, `rooms/${roomId}/maps/${mapId}/vectorMapDraft/${draft.uid}`),
      draft,
    );
  }

  subscribeVectorMapDraft(
    roomId: string,
    mapId: string,
    cb: (drafts: VectorMapDraft[]) => void,
  ): Unsubscribe {
    const draftRef = ref(this.client.rtdb, `rooms/${roomId}/maps/${mapId}/vectorMapDraft`);
    return onValue(draftRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, VectorMapDraft>;
      cb(Object.values(value));
    });
  }

  clearVectorMapDraft(roomId: string, mapId: string, uid: string): void {
    void remove(ref(this.client.rtdb, `rooms/${roomId}/maps/${mapId}/vectorMapDraft/${uid}`));
  }

  // ---- annotate overlay (Spec §3 — demoted, not the map-making core) ----

  subscribeDrawings(roomId: string, mapId: string, cb: (drawings: Drawing[]) => void): Unsubscribe {
    const col = collection(
      this.client.db,
      'rooms',
      roomId,
      'maps',
      mapId,
      'drawings',
    ).withConverter(drawingConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async writeDrawing(
    roomId: string,
    mapId: string,
    drawing: Omit<Drawing, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(
      this.client.db,
      'rooms',
      roomId,
      'maps',
      mapId,
      'drawings',
    ).withConverter(drawingConverter);
    const drawingRef = drawing.id ? doc(col, drawing.id) : doc(col);
    const full: Drawing = { ...drawing, id: drawingRef.id };
    await setDoc(drawingRef, full);
    return drawingRef.id;
  }

  async deleteDrawing(roomId: string, mapId: string, drawingId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'maps', mapId, 'drawings', drawingId));
  }

  // ---- profiles ----

  subscribeProfiles(roomId: string, cb: (profiles: ProfileInstance[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'profiles').withConverter(
      profileInstanceConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setProfileValue(
    roomId: string,
    actorId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', actorId);
    // merge:true deep-merges the `values` map, touching only this field —
    // every other field in the profile instance is left untouched.
    const patch: Partial<ProfileInstance> = { actorId, values: { [fieldId]: value } };
    await setDoc(profileRef, patch, { merge: true });
    this.touchRoomActivity(roomId);
  }

  async updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    const roomRef = doc(this.client.db, 'rooms', roomId);
    await updateDoc(roomRef, { profileTemplate: template });
  }

  async updateEncounterTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    const roomRef = doc(this.client.db, 'rooms', roomId);
    await updateDoc(roomRef, { encounterTemplate: template });
  }

  async setProfilePortrait(
    roomId: string,
    actorId: string,
    portraitRef: string | undefined,
  ): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', actorId);
    const patch: Partial<ProfileInstance> = {
      actorId,
      portraitRef: portraitRef ?? deleteField(),
    } as unknown as Partial<ProfileInstance>;
    await setDoc(profileRef, patch, { merge: true });
  }

  /** SPEC-031 §3 — a seat gets a colour at creation. Only ever called on a
   * genuinely new seat, and it still checks for an existing colour first: a
   * profile doc can predate its seat doc (a colour/portrait write creates one
   * lazily), and repainting a character somebody already chose for would be a
   * silent data loss. */
  private async seedCharacterColor(roomId: string, seatId: string): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', seatId);
    const existing = await getDoc(profileRef);
    if (typeof existing.data()?.['color'] === 'string') return;
    await this.setProfileColor(roomId, seatId, randomCharacterColor());
  }

  async setProfileColor(roomId: string, actorId: string, color: string): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', actorId);
    const patch: Partial<ProfileInstance> = { actorId, color };
    await setDoc(profileRef, patch, { merge: true });
  }

  // ---- log ----

  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe {
    // Newest LIVE_LOG_LIMIT only (U18): Firestore can only `limit` from the
    // ordered end, so take the newest by `desc` + `limit`, then flip back to
    // ascending for delivery. Older history pages in via `listLogBefore`.
    const col = query(
      collection(this.client.db, 'rooms', roomId, 'log'),
      orderBy('ts', 'desc'),
      limit(LIVE_LOG_LIMIT),
    ).withConverter(logEntryConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data()).reverse()));
  }

  async writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'log').withConverter(logEntryConverter);
    const entryRef = doc(col);
    await setDoc(entryRef, { ...entry, id: entryRef.id });
    return entryRef.id;
  }

  async listLogBefore(roomId: string, before: number, max: number): Promise<LogEntry[]> {
    // The `max` entries strictly older than `before`, oldest-first: query the
    // newest of the older-than set (`desc` + `limit`), then reverse.
    const col = query(
      collection(this.client.db, 'rooms', roomId, 'log'),
      where('ts', '<', before),
      orderBy('ts', 'desc'),
      limit(max),
    ).withConverter(logEntryConverter);
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data()).reverse();
  }

  async pruneEntriesBefore(
    roomId: string,
    before: number,
  ): Promise<{ log: number; rolls: number }> {
    // GM maintenance (Master Plan v2, R6.4) — delete log + roll docs older than
    // `before`, in ≤DELETE_BATCH_LIMIT-doc batches, reporting the counts.
    const [logSnap, rollSnap] = await Promise.all([
      getDocs(query(collection(this.client.db, 'rooms', roomId, 'log'), where('ts', '<', before))),
      getDocs(
        query(collection(this.client.db, 'rooms', roomId, 'rolls'), where('ts', '<', before)),
      ),
    ]);
    await this.deleteDocRefs(logSnap.docs.map((d) => d.ref));
    await this.deleteDocRefs(rollSnap.docs.map((d) => d.ref));
    return { log: logSnap.size, rolls: rollSnap.size };
  }

  // ---- rolls ----

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe {
    // Capped like `subscribeLog` — the U18 "rolls/log grow unbounded" fix only
    // ever covered the log half, so a long campaign loaded every roll ever made
    // on every join. Newest-first with a limit, then reversed back to
    // chronological, exactly as the log does.
    const col = query(
      collection(this.client.db, 'rooms', roomId, 'rolls'),
      orderBy('ts', 'desc'),
      limit(LIVE_LOG_LIMIT),
    ).withConverter(rollConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data()).reverse()));
  }

  async writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'rolls').withConverter(rollConverter);
    const rollRef = doc(col);
    await setDoc(rollRef, { ...roll, id: rollRef.id });
    // Roll resolution — the settled end of the dice pipeline (the rolling
    // animation itself is client-local and writes nothing).
    this.touchRoomActivity(roomId);
    return rollRef.id;
  }

  // ---- shared rolls (Master Plan v2, R3.6) — stored split across a
  // `sharedRoll/current` metadata doc and a `slots/{slotId}` subcollection so
  // a player's own-slot-or-GM write only ever targets their own doc, the same
  // `players/{uid}` rules pattern used everywhere else (see firestore.rules).

  subscribeSharedRoll(roomId: string, cb: (sharedRoll: SharedRoll | null) => void): Unsubscribe {
    const metaRef = doc(this.client.db, 'rooms', roomId, 'sharedRoll', 'current');
    const slotsCol = collection(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots');

    let meta: Omit<SharedRoll, 'slots'> | null = null;
    let slots: Record<string, SharedRollSlot> = {};
    let metaLoaded = false;
    let slotsLoaded = false;

    const emit = () => {
      if (!metaLoaded || !slotsLoaded) return;
      cb(meta ? { ...meta, slots } : null);
    };

    const unsubMeta = onSnapshot(metaRef, (snap) => {
      if (!snap.exists()) {
        meta = null;
      } else {
        const parsed = SharedRollMetaSchema.safeParse(snap.data());
        meta = parsed.success ? parsed.data : null;
      }
      metaLoaded = true;
      emit();
    });

    const unsubSlots = onSnapshot(slotsCol, (snap) => {
      const next: Record<string, SharedRollSlot> = {};
      for (const d of snap.docs) {
        const parsed = SharedRollSlotSchema.safeParse(d.data());
        if (parsed.success) next[d.id] = parsed.data;
      }
      slots = next;
      slotsLoaded = true;
      emit();
    });

    return () => {
      unsubMeta();
      unsubSlots();
    };
  }

  async openSharedRoll(
    roomId: string,
    input: { openedBy: string; label?: string; kind?: 'initiative' },
  ): Promise<void> {
    const metaRef = doc(this.client.db, 'rooms', roomId, 'sharedRoll', 'current');
    const slotsCol = collection(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots');
    const existing = await getDocs(slotsCol);
    const batch = writeBatch(this.client.db);
    for (const d of existing.docs) batch.delete(d.ref);
    const meta: Omit<SharedRoll, 'slots'> = {
      status: 'staging',
      openedBy: input.openedBy,
      ...(input.label ? { label: input.label } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
    };
    batch.set(metaRef, meta);
    await batch.commit();
  }

  async stageSharedSlot(roomId: string, slotId: string, slot: SharedRollSlot): Promise<void> {
    const slotRef = doc(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots', slotId);
    await setDoc(slotRef, slot);
  }

  async resolveSharedRoll(roomId: string, authorUid: string): Promise<Roll> {
    const metaRef = doc(this.client.db, 'rooms', roomId, 'sharedRoll', 'current');
    const slotsCol = collection(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots');
    const [metaSnap, slotsSnap] = await Promise.all([getDoc(metaRef), getDocs(slotsCol)]);

    const metaParsed = metaSnap.exists() ? SharedRollMetaSchema.safeParse(metaSnap.data()) : null;
    const label = metaParsed?.success ? metaParsed.data.label : undefined;

    const slots: Record<string, SharedRollSlot> = {};
    for (const d of slotsSnap.docs) {
      const parsed = SharedRollSlotSchema.safeParse(d.data());
      if (parsed.success) slots[d.id] = parsed.data;
    }

    const seed = createSeed();
    const parts = expandSharedRollSlots(seed, slots);
    const roll: Omit<Roll, 'id'> = {
      ts: Date.now(),
      authorUid,
      seed,
      dice: [],
      modifier: 0,
      advantage: 'normal',
      mode: 'separate',
      parts,
      ...(label ? { label } : {}),
    };
    const rollId = await this.writeRoll(roomId, roll);
    await updateDoc(metaRef, { status: 'resolved' });
    return { ...roll, id: rollId };
  }

  // ---- dice macros ----

  subscribeMacros(roomId: string, cb: (macros: DiceMacro[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'macros').withConverter(
      diceMacroConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async saveMacro(roomId: string, macro: Omit<DiceMacro, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'macros').withConverter(
      diceMacroConverter,
    );
    const macroRef = macro.id ? doc(col, macro.id) : doc(col);
    const full: DiceMacro = { ...macro, id: macroRef.id };
    await setDoc(macroRef, full);
    return macroRef.id;
  }

  async deleteMacro(roomId: string, macroId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'macros', macroId));
  }

  // ---- referee random tables (Plan §7 Phase 4) ----

  subscribeTables(roomId: string, cb: (tables: RandomTable[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'tables').withConverter(
      randomTableConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async upsertTable(roomId: string, table: RandomTable): Promise<void> {
    const ref = doc(this.client.db, 'rooms', roomId, 'tables', table.id).withConverter(
      randomTableConverter,
    );
    await setDoc(ref, table);
  }

  async deleteTable(roomId: string, tableId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'tables', tableId));
  }

  // ---- Assets activity — saved URL refs (Master Plan v2, R7.2) ----

  subscribeAssetRefs(roomId: string, cb: (assetRefs: AssetRef[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'assetRefs').withConverter(
      assetRefConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async saveAssetRef(
    roomId: string,
    assetRef: Omit<AssetRef, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'assetRefs').withConverter(
      assetRefConverter,
    );
    const assetRefRef = assetRef.id ? doc(col, assetRef.id) : doc(col);
    const full: AssetRef = { ...assetRef, id: assetRefRef.id };
    await setDoc(assetRefRef, full);
    return assetRefRef.id;
  }

  async deleteAssetRef(roomId: string, assetRefId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'assetRefs', assetRefId));
  }

  // ---- Blind Drawer (Plan §7 Phase 4 — hidden in gmPrivate per §3) ----

  subscribeBlindDraws(roomId: string, cb: (draws: BlindDraw[]) => void): Unsubscribe {
    // Reads the whole gmPrivate collection (GM-only per Security Rules) and
    // keeps just the blind-draw docs — other gmPrivate docs are ignored, not
    // mis-parsed. Players are denied this read entirely.
    const col = collection(this.client.db, 'rooms', roomId, 'gmPrivate');
    return onSnapshot(col, (snap) => {
      const draws: BlindDraw[] = [];
      for (const d of snap.docs) {
        const parsed = BlindDrawSchema.safeParse({ id: d.id, ...d.data() });
        if (parsed.success) draws.push(parsed.data as BlindDraw);
      }
      draws.sort((a, b) => a.ts - b.ts);
      cb(draws);
    });
  }

  async writeBlindDraw(
    roomId: string,
    draw: Omit<BlindDraw, 'id'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'gmPrivate');
    const ref = draw.id ? doc(col, draw.id) : doc(col);
    const { id: _id, ...body } = { ...draw, id: ref.id };
    await setDoc(ref, body);
    return ref.id;
  }

  async revealBlindDraw(roomId: string, draw: BlindDraw): Promise<void> {
    // Copy the hidden result into the shared log (now readable by all), then
    // flip the gmPrivate doc's flag so the GM panel shows it as spent. The
    // secret only ever leaves gmPrivate through this deliberate action.
    await this.writeLog(roomId, {
      ts: Date.now(),
      authorUid: draw.authorUid,
      type: 'system',
      text: `${draw.title}: ${draw.text}`,
    });
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'gmPrivate', draw.id), { revealed: true });
  }

  // ---- handouts (Plan §7 Phase 5 — "reveal image to players") ----

  subscribeHandoutLibrary(roomId: string, cb: (handouts: HandoutRecord[]) => void): Unsubscribe {
    // Same physical-denial pattern as subscribeBlindDraws: reads the whole
    // GM-only gmPrivate collection and keeps just the handout-kind docs.
    const col = collection(this.client.db, 'rooms', roomId, 'gmPrivate');
    return onSnapshot(col, (snap) => {
      const handouts: HandoutRecord[] = [];
      for (const d of snap.docs) {
        const parsed = HandoutRecordSchema.safeParse({ id: d.id, ...d.data() });
        if (parsed.success) handouts.push(parsed.data as HandoutRecord);
      }
      handouts.sort((a, b) => a.ts - b.ts);
      cb(handouts);
    });
  }

  async saveHandout(
    roomId: string,
    handout: Omit<HandoutRecord, 'id' | 'kind' | 'revealed'> & { id?: string },
  ): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'gmPrivate');
    const ref = handout.id ? doc(col, handout.id) : doc(col);
    const { id: _id, ...body } = { ...handout, kind: 'handout' as const, revealed: false };
    await setDoc(ref, body);
    return ref.id;
  }

  async deleteHandout(roomId: string, handoutId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'gmPrivate', handoutId));
  }

  async revealHandout(roomId: string, handout: HandoutRecord): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), {
      handout: { ref: handout.ref, ...(handout.title ? { title: handout.title } : {}) },
    });
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'gmPrivate', handout.id), {
      revealed: true,
    });
  }

  async hideHandout(roomId: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { handout: null });
  }

  // ---- `.vttcamp` portability (Plan §5, §7 Phase 5) ----

  async exportRoom(roomId: string): Promise<CampaignSnapshot> {
    const roomSnap = await getDoc(doc(this.client.db, 'rooms', roomId));
    if (!roomSnap.exists()) {
      throw new Error(`exportRoom: room ${roomId} not found`);
    }
    const room = roomSnap.data() as Record<string, unknown>;

    const collections: Record<string, Array<Record<string, unknown>>> = {};
    for (const name of EXPORTED_COLLECTIONS) {
      const snap = await getDocs(collection(this.client.db, 'rooms', roomId, name));
      collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const mapsSnap = await getDocs(collection(this.client.db, 'rooms', roomId, 'maps'));
    const maps: CampaignSnapshot['maps'] = [];
    for (const mapDoc of mapsSnap.docs) {
      const mapCollections: Record<string, Array<Record<string, unknown>>> = {};
      for (const name of EXPORTED_MAP_COLLECTIONS) {
        const snap = await getDocs(
          collection(this.client.db, 'rooms', roomId, 'maps', mapDoc.id, name),
        );
        mapCollections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      maps.push({ doc: { id: mapDoc.id, ...mapDoc.data() }, collections: mapCollections });
    }

    const encounterSnap = await getDoc(
      doc(this.client.db, 'rooms', roomId, 'encounter', 'current'),
    );
    const encounter = encounterSnap.exists()
      ? (encounterSnap.data() as Record<string, unknown>)
      : null;

    const notesState = await this.getYState(roomId, 'notes');
    const yjs: Record<string, string> = {};
    if (notesState) yjs['notes'] = bytesToBase64(notesState);

    return { room, collections, maps, encounter, yjs };
  }

  async importRoom(snapshot: CampaignSnapshot): Promise<string> {
    const uid = await this.ensureAuth();

    // Run the room doc through the migration scaffold first — this is what
    // upgrades an older `.vttcamp` export (Plan §5, Gate 5). `id` never
    // lived in the doc body (Firestore ids aren't stored fields), and
    // `gmUid` is forced to the importer: Security Rules require a room's
    // creator to own it (`allow create: gmUid == request.auth.uid`), so an
    // import can never resurrect the original GM's identity.
    const migrated = migrateRoom(snapshot.room) as Record<string, unknown>;
    const { gmUid: _oldGmUid, ...roomBody } = migrated;
    const roomRef = doc(collection(this.client.db, 'rooms')).withConverter(roomConverter);
    const room: Room = { ...(roomBody as Omit<Room, 'id' | 'gmUid'>), id: roomRef.id, gmUid: uid };
    await setDoc(roomRef, room);
    const newRoomId = roomRef.id;

    // Every other collection is written back verbatim, preserving each doc's
    // original id, so cross-references (groupId, ownerSeatId, encounter
    // refIds, …) stay valid. Note: a `players` doc keyed by the *original*
    // GM's uid comes along for the ride as historical data — it grants no
    // authority, since `isGM` only ever checks the room doc's `gmUid` above.
    for (const name of EXPORTED_COLLECTIONS) {
      const docs = snapshot.collections[name] ?? [];
      for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(this.client.db);
        for (const record of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
          const { id, ...body } = record;
          batch.set(doc(this.client.db, 'rooms', newRoomId, name, String(id)), body);
        }
        await batch.commit();
      }
    }

    // Every map (R17.3), preserving its original id and every map-scoped
    // collection's original doc ids (`vttcamp.ts`'s `archiveToSnapshot`
    // guarantees `maps` is always non-empty, adopting a pre-v11 archive's
    // flat data into one synthetic map — see its doc comment).
    for (const { doc: mapDoc, collections: mapCollections } of snapshot.maps) {
      const { id: mapId, ...mapBody } = mapDoc;
      await setDoc(doc(this.client.db, 'rooms', newRoomId, 'maps', String(mapId)), mapBody);
      for (const name of EXPORTED_MAP_COLLECTIONS) {
        const docs = mapCollections[name] ?? [];
        for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(this.client.db);
          for (const record of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
            const { id, ...body } = record;
            batch.set(
              doc(this.client.db, 'rooms', newRoomId, 'maps', String(mapId), name, String(id)),
              body,
            );
          }
          await batch.commit();
        }
      }
    }
    if (!snapshot.maps || snapshot.maps.length === 0) {
      // Defensive fallback for a hand-built snapshot with no `maps` at all
      // (never produced by `vttcamp.ts`, which always synthesizes one).
      await this.ensureActiveMap(newRoomId);
    }

    if (snapshot.encounter) {
      await setDoc(
        doc(this.client.db, 'rooms', newRoomId, 'encounter', 'current'),
        snapshot.encounter,
      );
    }

    for (const [docName, base64] of Object.entries(snapshot.yjs)) {
      await this.mergeYUpdate(newRoomId, docName, base64ToBytes(base64));
    }

    return newRoomId;
  }

  // ---- Yjs transport over RTDB (Plan §7 Phase 5 — concurrent Notes) ----

  subscribeYState(
    roomId: string,
    docName: string,
    cb: (state: Uint8Array | null) => void,
  ): Unsubscribe {
    const stateRef = ref(this.client.rtdb, `rooms/${roomId}/yjs/${docName}`);
    return onValue(stateRef, (snap) => {
      const value = snap.val() as string | null;
      cb(value ? base64ToBytes(value) : null);
    });
  }

  async mergeYUpdate(roomId: string, docName: string, update: Uint8Array): Promise<void> {
    const stateRef = ref(this.client.rtdb, `rooms/${roomId}/yjs/${docName}`);
    // Yjs updates are commutative and idempotent: merging the incoming
    // update with whatever's currently stored (inside an RTDB transaction,
    // so concurrent merges from other clients can't race each other) always
    // converges to the same state regardless of arrival order — the
    // no-last-write-wins-stomp guarantee Gate 5 tests.
    await runTransaction(stateRef, (current: string | null) => {
      const updates = current ? [base64ToBytes(current), update] : [update];
      return bytesToBase64(mergeUpdates(updates));
    });
  }

  async getYState(roomId: string, docName: string): Promise<Uint8Array | null> {
    const stateRef = ref(this.client.rtdb, `rooms/${roomId}/yjs/${docName}`);
    const snap = await get(stateRef);
    const value = snap.val() as string | null;
    return value ? base64ToBytes(value) : null;
  }

  // ---- RTDB ephemeral channels (Plan §2.2, §4) — never Firestore ----

  publishCursor(roomId: string, pos: { x: number; y: number }): void {
    const uid = this.requireUid();
    const cursorRef = ref(this.client.rtdb, `rooms/${roomId}/cursors/${uid}`);
    // Register a one-time onDisconnect so a client that closes its tab / drops
    // its connection leaves no stale cursor node behind (Master Plan v2, R6.4).
    // Guarded per room+uid so the hot per-frame publish path only arms it once.
    const key = `${roomId}/${uid}`;
    if (!this.cursorDisconnects.has(key)) {
      this.cursorDisconnects.add(key);
      void onDisconnect(cursorRef).remove();
    }
    const cursor: CursorPos = { uid, x: pos.x, y: pos.y, ts: Date.now() };
    void set(cursorRef, cursor);
  }

  subscribeCursors(roomId: string, cb: (cursors: CursorPos[]) => void): Unsubscribe {
    const cursorsRef = ref(this.client.rtdb, `rooms/${roomId}/cursors`);
    return onValue(cursorsRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, CursorPos>;
      cb(Object.values(value));
    });
  }

  publishDrag(roomId: string, tokenId: string, pos: DragFrame): void {
    const dragRef = ref(this.client.rtdb, `rooms/${roomId}/dragging/${tokenId}`);
    // `clearDrag` is the normal path; this is the crash path (R25.3). A client
    // that closes or drops mid-drag otherwise leaves the frame behind forever,
    // and every other client keeps rendering that token mid-flight. Guarded per
    // room+token because this is a per-frame publish — arm once, not 60×/s.
    const key = `${roomId}/${tokenId}`;
    if (!this.dragDisconnects.has(key)) {
      this.dragDisconnects.add(key);
      void onDisconnect(dragRef).remove();
    }
    void set(dragRef, pos);
  }

  subscribeDrag(
    roomId: string,
    tokenId: string,
    cb: (frame: DragFrame | null) => void,
  ): Unsubscribe {
    const dragRef = ref(this.client.rtdb, `rooms/${roomId}/dragging/${tokenId}`);
    return onValue(dragRef, (snap) => cb((snap.val() as DragFrame | null) ?? null));
  }

  clearDrag(roomId: string, tokenId: string): void {
    void remove(ref(this.client.rtdb, `rooms/${roomId}/dragging/${tokenId}`));
  }

  // ---- ping (Spec §3) ----

  publishPing(roomId: string, pos: { x: number; y: number }): void {
    const uid = this.requireUid();
    const pingsRef = ref(this.client.rtdb, `rooms/${roomId}/pings`);
    const pingRef = push(pingsRef);
    const ping: Omit<PingPos, 'id'> = { uid, x: pos.x, y: pos.y, ts: Date.now() };
    void set(pingRef, ping);
    // Pings are a transient visual pulse, not persistent state — self-clean
    // so the RTDB node doesn't grow unbounded over a session.
    //
    // The timeout is the normal path; `onDisconnect` is the crash path
    // (R25.3). If the tab closes inside the 3-second window the timer dies
    // with it and the node leaks permanently. Armed per push rather than
    // guarded like the cursor/drag nodes because each ping is its own
    // `push()` id — there is nothing to arm it twice for, and the server
    // discards the registration once the node is removed normally.
    void onDisconnect(pingRef).remove();
    setTimeout(() => void remove(pingRef), PING_TTL_MS);
  }

  subscribePings(roomId: string, cb: (pings: PingPos[]) => void): Unsubscribe {
    const pingsRef = ref(this.client.rtdb, `rooms/${roomId}/pings`);
    return onValue(pingsRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, Omit<PingPos, 'id'>>;
      cb(Object.entries(value).map(([id, ping]) => ({ id, ...ping })));
    });
  }

  // ---- Presence (R26.1) ----

  publishPresence(roomId: string, name: string): void {
    const uid = this.requireUid();
    const key = `${roomId}/${uid}`;
    // Idempotent: `RoomShell` may re-run its effect (a rename, a role change)
    // and must not end up with two heartbeats for one seat.
    if (this.presenceTimers.has(key)) return;

    const presenceRef = ref(this.client.rtdb, `rooms/${roomId}/presence/${uid}`);
    // Armed once per room+uid, the same guarded one-time pattern `publishCursor`
    // uses — this is the whole reason a closed tab stops reading as present
    // rather than lingering until its `ts` goes stale.
    void onDisconnect(presenceRef).remove();

    const beat = (): void => void set(presenceRef, { uid, name, ts: Date.now() });
    beat();
    this.presenceTimers.set(key, setInterval(beat, PRESENCE_HEARTBEAT_MS));

    // The durable half (R26.2). Ephemeral presence cannot answer "has this seat
    // been gone a month", so the first publish of a session stamps the seat doc
    // — throttled, because this is the one Firestore write in a channel that is
    // otherwise entirely RTDB and must stay that way (write discipline).
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
    void remove(ref(this.client.rtdb, `rooms/${roomId}/presence/${uid}`));
  }

  subscribePresence(roomId: string, cb: (present: PresenceEntry[]) => void): Unsubscribe {
    // Listens at the PARENT node, which is why `database.rules.json` needs an
    // explicit `.read` there — RTDB rules cascade down, not up.
    const presenceRef = ref(this.client.rtdb, `rooms/${roomId}/presence`);
    return onValue(presenceRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, PresenceEntry>;
      cb(Object.values(value));
    });
  }

  /** Stamps `PlayerSeat.lastPresentAt`, at most once per hour per client. */
  private async touchLastPresent(roomId: string, uid: string): Promise<void> {
    const key = `${roomId}/${uid}`;
    const last = this.lastPresentWrites.get(key) ?? 0;
    const now = Date.now();
    if (now - last < LAST_PRESENT_THROTTLE_MS) return;
    this.lastPresentWrites.set(key, now);
    const seatRef = doc(this.client.db, 'rooms', roomId, 'players', uid);
    // A seat only exists after `joinRoom`; presence can legitimately be
    // published from the join gate a moment earlier, so a missing doc is an
    // ordinary outcome rather than an error. `updateDoc` rejects in that case,
    // and the next heartbeat's write will land once the seat is real.
    await updateDoc(seatRef, { lastPresentAt: now }).catch(() => {
      this.lastPresentWrites.delete(key);
    });
  }
}

const PING_TTL_MS = 3000;

// Firestore batch writes cap at 500 ops; importRoom chunks each collection
// to that limit rather than assuming a campaign is always small.
const FIRESTORE_BATCH_LIMIT = 500;

// Recursive delete / prune batch size (Master Plan v2, R6.3 — "≤400-doc
// batches"). Kept under the 500 hard cap for headroom.
const DELETE_BATCH_LIMIT = 400;

/** Narrows a Firebase `User` (structurally, to avoid importing the SDK type)
 * to the app-facing `AccountInfo`. */
function toAccountInfo(user: {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
}): AccountInfo {
  return {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    displayName: user.displayName,
    email: user.email,
  };
}

/** Maps a raw `users/{uid}/rooms/{roomId}` doc back to a `MyRoomEntry`, folding
 * the doc id in as `roomId` and defaulting best-effort so a partially-written
 * or legacy entry still renders rather than throwing (Master Plan v2, R6.2). */
function toMyRoomEntry(id: string, data: Record<string, unknown>): MyRoomEntry {
  const role = data['role'];
  return {
    roomId: id,
    name: typeof data['name'] === 'string' ? (data['name'] as string) : id,
    role: role === 'gm' || role === 'player' || role === 'viewer' ? role : 'player',
    lastSeenAt: typeof data['lastSeenAt'] === 'number' ? (data['lastSeenAt'] as number) : 0,
    ...(typeof data['dormantDismissedUntil'] === 'number'
      ? { dormantDismissedUntil: data['dormantDismissedUntil'] as number }
      : {}),
  };
}

/** Classifies a `linkWithPopup` rejection into the `LinkAccountResult` failure
 * shape (Master Plan v2, R6.1). */
function classifyAuthError(err: unknown): {
  reason: 'credential-already-in-use' | 'cancelled' | 'error';
  message?: string;
} {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
    return { reason: 'credential-already-in-use' };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return { reason: 'cancelled' };
  }
  return { reason: 'error', message: err instanceof Error ? err.message : String(err) };
}

/** Cross-environment (browser + Node/Vitest) byte<->base64 codecs for the
 * RTDB-stored Yjs state (Plan §7 Phase 5) — RTDB has no native binary type. */
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
