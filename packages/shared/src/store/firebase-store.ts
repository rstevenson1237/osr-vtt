import { signInAnonymously } from 'firebase/auth';
import { onValue, ref, remove, set } from 'firebase/database';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  groupConverter,
  logEntryConverter,
  playerSeatConverter,
  profileInstanceConverter,
  rollConverter,
  roomConverter,
  tokenConverter,
} from '../converters.js';
import type { FirebaseClient } from '../firebase-config.js';
import { CURRENT_SCHEMA_VERSION } from '../types.js';
import type {
  Group,
  LogEntry,
  PlayerSeat,
  ProfileInstance,
  ProfileTemplateField,
  ProfileValue,
  Roll,
  Room,
  Token,
} from '../types.js';
import type { CampaignStore, CursorPos, DragFrame, Unsubscribe } from './campaign-store.js';

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

  // ---- groups ----

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe {
    const col = collection(this.client.db, 'rooms', roomId, 'groups').withConverter(groupConverter);
    return onSnapshot(col, (snap) => cb(snap.docs.map((d) => d.data())));
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
}
