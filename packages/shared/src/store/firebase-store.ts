import { signInAnonymously } from 'firebase/auth';
import { get, onValue, push, ref, remove, runTransaction, set } from 'firebase/database';
import {
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
  floorChunkConverter,
  fogChunkConverter,
  groupConverter,
  logEntryConverter,
  mapLightConverter,
  mapRoomConverter,
  mapSymbolConverter,
  mapWallConverter,
  playerSeatConverter,
  profileInstanceConverter,
  randomTableConverter,
  rollConverter,
  roomConverter,
  sightWallConverter,
  tokenConverter,
} from '../converters.js';
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
  DEFAULT_FOG_CONFIG,
  DEFAULT_GRID_CONFIG,
  DEFAULT_HANDOUT,
  DEFAULT_ROOM_SETTINGS,
} from '../types.js';
import type {
  AssetRef,
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
 * The one `CampaignStore` implementation shipped in v1 (Plan §1.3). Every
 * Firebase SDK import in the whole app lives in this file (plus
 * `firebase-config.ts`) — Svelte components only ever see the
 * `CampaignStore` interface.
 */
export class FirebaseStore implements CampaignStore {
  constructor(private readonly client: FirebaseClient) {}

  async ensureAuth(): Promise<string> {
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

  // ---- rooms ----

  async createRoom(input: {
    name: string;
    profileTemplate: ProfileTemplateField[];
    difficultyDie?: string;
    dangerDie?: string;
    password?: string;
  }): Promise<string> {
    const uid = await this.ensureAuth();
    const roomRef = doc(collection(this.client.db, 'rooms')).withConverter(roomConverter);
    const room: Room = {
      id: roomRef.id,
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
    await setDoc(roomRef, room);
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

  async renameRoom(roomId: string, name: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { name });
  }

  async setTheme(roomId: string, theme: string): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { 'settings.theme': theme });
  }

  async setGridDimensions(roomId: string, grid: Room['grid']): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { grid });
  }

  async setTensionDefaults(
    roomId: string,
    input: { difficultyDie: string; dangerDie: string },
  ): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), input);
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

  async removePlayer(roomId: string, uid: string, opts?: { deleteProfile?: boolean }): Promise<void> {
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
    return tokenRef.id;
  }

  async moveToken(roomId: string, tokenId: string, pos: { x: number; y: number }): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { pos });
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
  }

  async resizeToken(roomId: string, tokenId: string, size: number): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { size });
  }

  async setTokenImage(roomId: string, tokenId: string, imageRef: string): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { imageRef });
  }

  async setTokenOwner(
    roomId: string,
    tokenId: string,
    ownerSeatId: string | undefined,
  ): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { ownerSeatId: ownerSeatId ?? deleteField() });
  }

  // ---- groups ----

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'groups').withConverter(groupConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
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

  // ---- cellular map model (Map Tooling Spec §7) ----

  subscribeFloorChunks(roomId: string, cb: (chunks: FloorChunk[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'floorChunks').withConverter(
      floorChunkConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async commitFloorChunks(roomId: string, chunks: FloorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const col = collection(this.client.db, 'rooms', roomId, 'floorChunks').withConverter(
      floorChunkConverter,
    );
    // One batched write per stroke, never one write per cell (Spec §7).
    const batch = writeBatch(this.client.db);
    for (const chunk of chunks) {
      batch.set(doc(col, chunk.id), chunk);
    }
    await batch.commit();
  }

  subscribeWalls(roomId: string, cb: (walls: MapWall[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'walls').withConverter(mapWallConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setWall(roomId: string, wall: Omit<MapWall, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'walls').withConverter(mapWallConverter);
    const wallRef = wall.id ? doc(col, wall.id) : doc(col);
    const full: MapWall = { ...wall, id: wallRef.id };
    await setDoc(wallRef, full);
    return wallRef.id;
  }

  async removeWall(roomId: string, edgeId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'walls', edgeId));
  }

  async setWalls(roomId: string, walls: MapWall[]): Promise<void> {
    if (walls.length === 0) return;
    const col = collection(this.client.db, 'rooms', roomId, 'walls').withConverter(mapWallConverter);
    // One batched write per drag-run, never one write per edge (R9.2, mirrors
    // `commitFloorChunks`'s carve-stroke write discipline).
    const batch = writeBatch(this.client.db);
    for (const wall of walls) batch.set(doc(col, wall.id), wall);
    await batch.commit();
  }

  async removeWalls(roomId: string, edgeIds: string[]): Promise<void> {
    if (edgeIds.length === 0) return;
    const batch = writeBatch(this.client.db);
    for (const id of edgeIds) batch.delete(doc(this.client.db, 'rooms', roomId, 'walls', id));
    await batch.commit();
  }

  subscribeSymbols(roomId: string, cb: (symbols: MapSymbol[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'symbols').withConverter(
      mapSymbolConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async placeSymbol(roomId: string, symbol: Omit<MapSymbol, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'symbols').withConverter(
      mapSymbolConverter,
    );
    const symbolRef = symbol.id ? doc(col, symbol.id) : doc(col);
    const full: MapSymbol = { ...symbol, id: symbolRef.id };
    await setDoc(symbolRef, full);
    return symbolRef.id;
  }

  async removeSymbol(roomId: string, symbolId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'symbols', symbolId));
  }

  subscribeMapRooms(roomId: string, cb: (mapRooms: MapRoom[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'mapRooms').withConverter(
      mapRoomConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async upsertMapRoom(roomId: string, mapRoom: MapRoom): Promise<void> {
    const roomRef = doc(this.client.db, 'rooms', roomId, 'mapRooms', mapRoom.id).withConverter(
      mapRoomConverter,
    );
    await setDoc(roomRef, mapRoom);
  }

  async removeMapRoom(roomId: string, mapRoomId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'mapRooms', mapRoomId));
  }

  subscribeFogChunks(roomId: string, cb: (chunks: FogChunk[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'fogChunks').withConverter(
      fogChunkConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async commitFogChunks(roomId: string, chunks: FogChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const col = collection(this.client.db, 'rooms', roomId, 'fogChunks').withConverter(
      fogChunkConverter,
    );
    const batch = writeBatch(this.client.db);
    for (const chunk of chunks) {
      batch.set(doc(col, chunk.id), chunk);
    }
    await batch.commit();
  }

  async resetFog(roomId: string): Promise<void> {
    const col = collection(this.client.db, 'rooms', roomId, 'fogChunks');
    const snap = await getDocs(col);
    if (snap.empty) return;
    const batch = writeBatch(this.client.db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }

  async setFogMode(roomId: string, mode: Room['fog']['mode']): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { fog: { mode } });
  }

  async setMeasurement(roomId: string, measure: Room['settings']['measure']): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { 'settings.measure': measure });
  }

  async setGridSubdivide(roomId: string, subdivide: boolean): Promise<void> {
    await updateDoc(doc(this.client.db, 'rooms', roomId), { 'settings.grid': { subdivide } });
  }

  // ---- imported vision geometry (Plan §7 Phase 4 — `.uvtt` import) ----

  subscribeSightWalls(roomId: string, cb: (walls: SightWall[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'sightWalls').withConverter(
      sightWallConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  subscribeLights(roomId: string, cb: (lights: MapLight[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'lights').withConverter(mapLightConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async importUvtt(
    roomId: string,
    input: { walls: Array<Omit<SightWall, 'id'>>; lights: Array<Omit<MapLight, 'id'>> },
  ): Promise<void> {
    const wallsCol = collection(this.client.db, 'rooms', roomId, 'sightWalls');
    const lightsCol = collection(this.client.db, 'rooms', roomId, 'lights');
    // A new import supersedes the previous one: clear both collections, then
    // write the fresh geometry — all in one batched commit.
    const [existingWalls, existingLights] = await Promise.all([
      getDocs(wallsCol),
      getDocs(lightsCol),
    ]);
    const batch = writeBatch(this.client.db);
    for (const d of existingWalls.docs) batch.delete(d.ref);
    for (const d of existingLights.docs) batch.delete(d.ref);
    for (const wall of input.walls) {
      const ref = doc(wallsCol).withConverter(sightWallConverter);
      batch.set(ref, { ...wall, id: ref.id });
    }
    for (const light of input.lights) {
      const ref = doc(lightsCol).withConverter(mapLightConverter);
      batch.set(ref, { ...light, id: ref.id });
    }
    await batch.commit();
  }

  async addSightWall(roomId: string, wall: Omit<SightWall, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'sightWalls').withConverter(
      sightWallConverter,
    );
    const wallRef = wall.id ? doc(col, wall.id) : doc(col);
    const full: SightWall = { ...wall, id: wallRef.id };
    await setDoc(wallRef, full);
    return wallRef.id;
  }

  async removeSightWall(roomId: string, sightWallId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'sightWalls', sightWallId));
  }

  // ---- annotate overlay (Spec §3 — demoted, not the map-making core) ----

  subscribeDrawings(roomId: string, cb: (drawings: Drawing[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'drawings').withConverter(
      drawingConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async writeDrawing(roomId: string, drawing: Omit<Drawing, 'id'> & { id?: string }): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'drawings').withConverter(
      drawingConverter,
    );
    const drawingRef = drawing.id ? doc(col, drawing.id) : doc(col);
    const full: Drawing = { ...drawing, id: drawingRef.id };
    await setDoc(drawingRef, full);
    return drawingRef.id;
  }

  async deleteDrawing(roomId: string, drawingId: string): Promise<void> {
    await deleteDoc(doc(this.client.db, 'rooms', roomId, 'drawings', drawingId));
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
    seatId: string,
    fieldId: string,
    value: ProfileValue,
  ): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', seatId);
    // merge:true deep-merges the `values` map, touching only this field —
    // every other field in the profile instance is left untouched.
    const patch: Partial<ProfileInstance> = { seatId, values: { [fieldId]: value } };
    await setDoc(profileRef, patch, { merge: true });
  }

  async updateProfileTemplate(roomId: string, template: ProfileTemplateField[]): Promise<void> {
    const roomRef = doc(this.client.db, 'rooms', roomId);
    await updateDoc(roomRef, { profileTemplate: template });
  }

  async setProfilePortrait(
    roomId: string,
    seatId: string,
    portraitRef: string | undefined,
  ): Promise<void> {
    const profileRef = doc(this.client.db, 'rooms', roomId, 'profiles', seatId);
    const patch: Partial<ProfileInstance> = {
      seatId,
      portraitRef: portraitRef ?? deleteField(),
    } as unknown as Partial<ProfileInstance>;
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

  // ---- rolls ----

  subscribeRolls(roomId: string, cb: (rolls: Roll[]) => void): Unsubscribe {
    const col = query(
      collection(this.client.db, 'rooms', roomId, 'rolls'),
      orderBy('ts', 'asc'),
    ).withConverter(rollConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async writeRoll(roomId: string, roll: Omit<Roll, 'id'>): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'rolls').withConverter(rollConverter);
    const rollRef = doc(col);
    await setDoc(rollRef, { ...roll, id: rollRef.id });
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

  async openSharedRoll(roomId: string, input: { openedBy: string; label?: string }): Promise<void> {
    const metaRef = doc(this.client.db, 'rooms', roomId, 'sharedRoll', 'current');
    const slotsCol = collection(this.client.db, 'rooms', roomId, 'sharedRoll', 'current', 'slots');
    const existing = await getDocs(slotsCol);
    const batch = writeBatch(this.client.db);
    for (const d of existing.docs) batch.delete(d.ref);
    const meta: Omit<SharedRoll, 'slots'> = {
      status: 'staging',
      openedBy: input.openedBy,
      ...(input.label ? { label: input.label } : {}),
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
    await updateDoc(doc(this.client.db, 'rooms', roomId, 'gmPrivate', handout.id), { revealed: true });
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

    const encounterSnap = await getDoc(doc(this.client.db, 'rooms', roomId, 'encounter', 'current'));
    const encounter = encounterSnap.exists() ? (encounterSnap.data() as Record<string, unknown>) : null;

    const notesState = await this.getYState(roomId, 'notes');
    const yjs: Record<string, string> = {};
    if (notesState) yjs['notes'] = bytesToBase64(notesState);

    return { room, collections, encounter, yjs };
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

    if (snapshot.encounter) {
      await setDoc(doc(this.client.db, 'rooms', newRoomId, 'encounter', 'current'), snapshot.encounter);
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
    const cursor: CursorPos = { uid, x: pos.x, y: pos.y, ts: Date.now() };
    void set(ref(this.client.rtdb, `rooms/${roomId}/cursors/${uid}`), cursor);
  }

  subscribeCursors(roomId: string, cb: (cursors: CursorPos[]) => void): Unsubscribe {
    const cursorsRef = ref(this.client.rtdb, `rooms/${roomId}/cursors`);
    return onValue(cursorsRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, CursorPos>;
      cb(Object.values(value));
    });
  }

  publishDrag(roomId: string, tokenId: string, pos: DragFrame): void {
    void set(ref(this.client.rtdb, `rooms/${roomId}/dragging/${tokenId}`), pos);
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
    setTimeout(() => void remove(pingRef), PING_TTL_MS);
  }

  subscribePings(roomId: string, cb: (pings: PingPos[]) => void): Unsubscribe {
    const pingsRef = ref(this.client.rtdb, `rooms/${roomId}/pings`);
    return onValue(pingsRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, Omit<PingPos, 'id'>>;
      cb(Object.entries(value).map(([id, ping]) => ({ id, ...ping })));
    });
  }

  // ---- map draft — in-progress carve/fill/eraser preview (Spec §7) ----

  publishMapDraft(roomId: string, draft: MapDraft): void {
    void set(ref(this.client.rtdb, `rooms/${roomId}/mapDraft/${draft.uid}`), draft);
  }

  subscribeMapDraft(roomId: string, cb: (drafts: MapDraft[]) => void): Unsubscribe {
    const draftRef = ref(this.client.rtdb, `rooms/${roomId}/mapDraft`);
    return onValue(draftRef, (snap) => {
      const value = (snap.val() ?? {}) as Record<string, MapDraft>;
      cb(Object.values(value));
    });
  }

  clearMapDraft(roomId: string, uid: string): void {
    void remove(ref(this.client.rtdb, `rooms/${roomId}/mapDraft/${uid}`));
  }
}

const PING_TTL_MS = 3000;

// Firestore batch writes cap at 500 ops; importRoom chunks each collection
// to that limit rather than assuming a campaign is always small.
const FIRESTORE_BATCH_LIMIT = 500;

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
