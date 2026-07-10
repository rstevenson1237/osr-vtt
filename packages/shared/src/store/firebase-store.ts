import { signInAnonymously } from 'firebase/auth';
import { onValue, push, ref, remove, set } from 'firebase/database';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  drawingConverter,
  encounterConverter,
  floorChunkConverter,
  fogChunkConverter,
  groupConverter,
  logEntryConverter,
  mapRoomConverter,
  mapSymbolConverter,
  mapWallConverter,
  playerSeatConverter,
  profileInstanceConverter,
  rollConverter,
  roomConverter,
  tokenConverter,
} from '../converters.js';
import type { FirebaseClient } from '../firebase-config.js';
import { CURRENT_SCHEMA_VERSION, DEFAULT_FOG_CONFIG, DEFAULT_GRID_CONFIG } from '../types.js';
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
import type {
  CampaignStore,
  CursorPos,
  DragFrame,
  MapDraft,
  PingPos,
  Unsubscribe,
} from './campaign-store.js';

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

  // ---- players ----

  async joinRoom(roomId: string, displayName: string): Promise<void> {
    const uid = await this.ensureAuth();
    const room = await this.getRoom(roomId);
    const role = room?.gmUid === uid ? 'gm' : 'player';
    const seatRef = doc(this.client.db, 'rooms', roomId, 'players', uid).withConverter(
      playerSeatConverter,
    );
    const seat: PlayerSeat = { uid, displayName, seatId: uid, role };
    await setDoc(seatRef, seat);
  }

  subscribePlayers(roomId: string, cb: (players: PlayerSeat[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'players').withConverter(
      playerSeatConverter,
    );
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
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

  async resizeToken(roomId: string, tokenId: string, size: number): Promise<void> {
    const tokenRef = doc(this.client.db, 'rooms', roomId, 'tokens', tokenId);
    await updateDoc(tokenRef, { size });
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

  // ---- log ----

  subscribeLog(roomId: string, cb: (entries: LogEntry[]) => void): Unsubscribe {
    const col = query(
      collection(this.client.db, 'rooms', roomId, 'log'),
      orderBy('ts', 'asc'),
    ).withConverter(logEntryConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async writeLog(roomId: string, entry: Omit<LogEntry, 'id'>): Promise<string> {
    const col = collection(this.client.db, 'rooms', roomId, 'log').withConverter(logEntryConverter);
    const entryRef = doc(col);
    await setDoc(entryRef, { ...entry, id: entryRef.id });
    return entryRef.id;
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
