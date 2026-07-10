/**
 * CampaignState types (Plan §2.1, §2.5).
 *
 * HARD RULE (Plan, top of doc + §2.5): the app stores and displays this data
 * but never interprets it. No field here drives calculation, validation, or
 * value-triggered behavior anywhere in the app. "HP", "AC", etc. are just
 * labels a referee chose for a field — the code must stay ignorant of them.
 */

/** Current schema version new rooms are created at. Bump + add a migration
 * in `migrations/` whenever a room-doc-shaped change ships. */
export const CURRENT_SCHEMA_VERSION = 1;

export type Role = 'gm' | 'player' | 'viewer';

export type ProfileFieldType = 'text' | 'longtext' | 'number' | 'counter' | 'checkbox' | 'roll';

export interface ProfileTemplateField {
  id: string;
  label: string;
  type: ProfileFieldType;
  /** Default value seeded into a freshly-created profile instance. */
  default?: string | number | boolean;
}

/** rooms/{roomId} */
export interface Room {
  id: string;
  name: string;
  /** UID of the room creator. The one authority boundary in the whole app:
   * Security Rules gate `gmPrivate/**` reads/writes on this field. */
  gmUid: string;
  schemaVersion: number;
  /** Dumb data — a die expression string (e.g. "d6"). Never interpreted. */
  difficultyDie: string;
  dangerDie: string;
  createdAt: number;
  profileTemplate: ProfileTemplateField[];
  /** Optional, unenforced in Phase 0 (Plan §8.5: "stored for later"). Plain
   * dumb data — no auth check reads this field yet. */
  password?: string;
}

/** rooms/{roomId}/players/{uid} */
export interface PlayerSeat {
  uid: string;
  displayName: string;
  seatId: string;
  role: Role;
}

export type ProfileValue = string | number | boolean;

/** rooms/{roomId}/profiles/{seatId} — an instance of the room's profileTemplate. */
export interface ProfileInstance {
  seatId: string;
  values: Record<string, ProfileValue>;
  portraitRef?: string;
}

export type StageLayer = 'background' | 'gm' | 'tokens' | 'fow';

/** rooms/{roomId}/tokens/{tokenId} */
export interface Token {
  id: string;
  pos: { x: number; y: number };
  size: number;
  layer: StageLayer;
  groupId?: string;
  imageRef: string;
  ownerSeatId?: string;
}

/** rooms/{roomId}/groups/{groupId} */
export interface Group {
  id: string;
  name: string;
  memberTokenIds: string[];
  showMap: boolean;
  showBoard: boolean;
  active: boolean;
}

export type DrawingKind = 'line' | 'rect' | 'ellipse' | 'wall' | 'door' | 'text';

/** rooms/{roomId}/drawings/{strokeId} */
export interface Drawing {
  id: string;
  layer: StageLayer;
  kind: DrawingKind;
  points: { x: number; y: number }[];
  style: Record<string, string | number>;
}

export type ResultClass = 'success' | 'complication' | 'failure';

/** rooms/{roomId}/log/{entryId} */
export interface LogEntry {
  id: string;
  ts: number;
  authorUid: string;
  type: 'system' | 'chat' | 'roll';
  text: string;
  resultClass?: ResultClass;
}

export type RollMode = 'summed' | 'separate';

/** rooms/{roomId}/rolls/{rollId} */
export interface Roll {
  id: string;
  ts: number;
  authorUid: string;
  /** Deterministic seed every client re-simulates in Rapier for the animation. */
  seed: string;
  params: { die: string; count: number };
  dice: number[];
  mode: RollMode;
  results: number[];
}

/** rooms/{roomId}/tables/{tableId} — referee random tables (Phase 4). Declared
 * now for schema completeness; no UI reads/writes this in Phase 0. */
export interface RandomTable {
  id: string;
  name: string;
  rows: string[];
}

/** rooms/{roomId}/gmPrivate/{docId} — GM-only, enforced by Security Rules. */
export interface GmPrivateDoc {
  id: string;
  [key: string]: unknown;
}
