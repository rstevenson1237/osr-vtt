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

  subscribeGroups(roomId: string, cb: (groups: Group[]) => void): Unsubscribe;

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
}
