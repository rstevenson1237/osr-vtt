/**
 * CampaignState types (Plan §2.1, §2.5).
 *
 * HARD RULE (Plan, top of doc + §2.5): the app stores and displays this data
 * but never interprets it. No field here drives calculation, validation, or
 * value-triggered behavior anywhere in the app. "HP", "AC", etc. are just
 * labels a referee chose for a field — the code must stay ignorant of them.
 */

import type { EdgeSide } from './map/walls.js';

/** Current schema version new rooms are created at. Bump + add a migration
 * in `migrations/` whenever a room-doc-shaped change ships. */
export const CURRENT_SCHEMA_VERSION = 2;

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
  /** Map grid dimensions (Map Tooling Spec §7). Square grid only — v1. */
  grid: { w: number; h: number; cellSize: number };
  /** Fog of War mode (Spec §6): `emergent` = unexplored is uncarved rock
   * (default, mapper-draws workflow); `manual` = GM-prepped map, revealed
   * cell-by-cell via the FoW eraser. */
  fog: { mode: 'emergent' | 'manual' };
}

/** Default grid/fog seeded onto a freshly created room (mapper-draws
 * workflow, square grid only — Plan §11). 64×64 cells at 70px is a generous
 * dungeon canvas; the grid can grow later without a migration since chunks
 * are allocated lazily. */
export const DEFAULT_GRID_CONFIG: Room['grid'] = { w: 64, h: 64, cellSize: 70 };
export const DEFAULT_FOG_CONFIG: Room['fog'] = { mode: 'emergent' };

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

/** Plan §7 five-layer stack: Background → Player Mapping → GM/Hidden →
 * Tokens → FoW, rendered bottom to top. */
export type StageLayer = 'background' | 'mapping' | 'gm' | 'tokens' | 'fow';

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

/** The Annotate tool (Spec §3) is demoted, optional loose pen/text for
 * notes — NOT the map-making core, which is the cellular model above. */
export type DrawingKind = 'freehand' | 'text';

/** rooms/{roomId}/drawings/{strokeId} — Annotate overlay only. */
export interface Drawing {
  id: string;
  layer: StageLayer;
  kind: DrawingKind;
  points: { x: number; y: number }[];
  style: Record<string, string | number>;
}

/**
 * Cellular map model (Map Tooling Spec §7). The map is a grid of solid/floor
 * cells; everything else (rooms, walls, doors, symbols, labels) derives from
 * or attaches to that grid. See `packages/shared/src/map/` for the pure
 * grid/wall/fog math these types are persisted shapes of.
 */

/** rooms/{roomId}/floorChunks/{cx_cy} — 16×16 chunk of floor bits, packed as
 * 8×uint32 (see map/grid.ts). Carve = a handful of chunk writes, never one
 * write per cell. */
export interface FloorChunk {
  id: string;
  bits: number[];
}

/** rooms/{roomId}/fogChunks/{cx_cy} — manual-reveal mask, same chunk shape
 * as FloorChunk. Only meaningful when `Room.fog.mode === 'manual'`. */
export interface FogChunk {
  id: string;
  bits: number[];
}

export type DoorState = 'open' | 'closed';

export interface MapDoor {
  state: DoorState;
  /** Secret doors render as the GM-only "S" glyph until revealed (Spec §8). */
  secret: boolean;
}

/** rooms/{roomId}/walls/{edgeId} — ONLY explicit (floor↔floor) walls and
 * doors are stored; perimeter (floor↔rock) walls are always derived, never
 * persisted (Spec §1, §4). */
export interface MapWall {
  id: string;
  x: number;
  y: number;
  side: EdgeSide;
  door?: MapDoor;
}

export type WallStyle = 'masonry' | 'natural';

/** Starter symbol palette (Spec §3) — extensible via the bundled asset pack;
 * `MapSymbol.kind` is a plain string so custom kinds aren't blocked. */
export const MAP_SYMBOL_KINDS = [
  'stairs-down',
  'spiral-stair',
  'column',
  'secret-door',
  'compass-star',
  'water',
  'rubble',
  'altar',
  'statue',
  'chest',
  'trap',
  'pit',
  'portcullis',
  'lever',
  'campfire',
  'note-pin',
] as const;

/** rooms/{roomId}/symbols/{id} — an icon bound to one grid cell. */
export interface MapSymbol {
  id: string;
  cell: { x: number; y: number };
  kind: string;
  rotation: number;
}

/** rooms/{roomId}/mapRooms/{id} — a keyed/named region of floor cells (a
 * "Room" in the dungeon sense, distinct from the campaign `Room` doc). */
export interface MapRoom {
  id: string;
  /** Auto-incrementing key (1, 2, 3, 2a…). */
  key: string;
  name: string;
  bbox: { x: number; y: number; w: number; h: number };
  labelAnchor: { x: number; y: number };
  wallStyle: WallStyle;
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
