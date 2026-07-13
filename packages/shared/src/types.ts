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
export const CURRENT_SCHEMA_VERSION = 7;

export type Role = 'gm' | 'player' | 'viewer';

export type ProfileFieldType = 'text' | 'longtext' | 'number' | 'counter' | 'checkbox' | 'roll';

export interface ProfileTemplateField {
  id: string;
  label: string;
  type: ProfileFieldType;
  /** Default value seeded into a freshly-created profile instance. */
  default?: string | number | boolean;
  /**
   * Encounter Board v2 (Master Plan v2, R8.1): a GM-set flag that surfaces
   * this field, read-only, as a `label: value` row on the actor card. Purely
   * a display choice — the app still never interprets the value (§2.5 hard
   * rule). Absent/false ⇒ the field only shows in the Character dock. */
  pinned?: boolean;
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
   * cell-by-cell via the FoW eraser; `dynamic` = Phase 4 raycasting LoS from
   * walls, recomputed live from viewpoints (see `map/los.ts`). */
  fog: { mode: 'emergent' | 'manual' | 'dynamic' };
  /** The one handout currently shown to the whole table (Plan §7 Phase 5 —
   * "reveal image to players"), or `null` if nothing is revealed. Player-
   * readable (it's on the room doc); the GM's saved library of *unrevealed*
   * handouts lives under `gmPrivate` (see `HandoutRecord`) so players can't
   * see what's queued up next. */
  handout: HandoutState;
  /** Room-level display settings (Master Plan v2, R2/R4) — GM-set so every
   * player sees the same map colors; not game data. */
  settings: RoomSettings;
}

/** rooms/{roomId}'s currently-revealed handout pointer — just an asset ref
 * and a display title, resolved through `AssetStore` like any other image. */
export type HandoutState = { ref: string; title?: string } | null;

/** Measurement ruler config (Master Plan v2, R9.3). `unit` is a free-text
 * label the referee chooses (e.g. "feet", "meters") — the app formats
 * `${squares} sq / ${squares*perSquare} ${unit}` and never interprets it. */
export interface RoomMeasure {
  perSquare: number;
  unit: string;
}

/** Render-only grid display settings (Master Plan v2, R9.6). `subdivide` draws
 * lighter half-spacing interlines between the full grid lines (10′/5′ dual-mark
 * style); it changes nothing in the cellular model or LoS. */
export interface RoomGridSettings {
  subdivide: boolean;
}

export interface RoomSettings {
  theme: string;
  measure: RoomMeasure;
  grid: RoomGridSettings;
}

/** Default grid/fog seeded onto a freshly created room (mapper-draws
 * workflow, square grid only — Plan §11). 64×64 cells at 70px is a generous
 * dungeon canvas; the grid can grow later without a migration since chunks
 * are allocated lazily. */
export const DEFAULT_GRID_CONFIG: Room['grid'] = { w: 64, h: 64, cellSize: 70 };
export const DEFAULT_FOG_CONFIG: Room['fog'] = { mode: 'emergent' };
export const DEFAULT_HANDOUT: HandoutState = null;
/** Master Plan v2, R9.3: the default changes from the old implicit 5 ft/square
 * assumption to 10/feet, deliberately, per referee preference. */
export const DEFAULT_MEASURE: RoomMeasure = { perSquare: 10, unit: 'feet' };
/** Master Plan v2, R9.6: half-grid subdivision defaults off (full grid only). */
export const DEFAULT_GRID_SETTINGS: RoomGridSettings = { subdivide: false };
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  theme: 'parchment-dark',
  measure: DEFAULT_MEASURE,
  grid: DEFAULT_GRID_SETTINGS,
};

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
  /**
   * Collapse-to-one-token on the Map (Master Plan v2, R8.4). When `true` the
   * group's members render as a single stacked token (a count bubble) at the
   * anchor member's position; dragging it moves every member by the same
   * delta and lands all their new positions in one batched `moveTokens`
   * write. Expand (back to `false`) restores each member at anchor + offset.
   * Absent ⇒ not collapsed. */
  collapsed?: boolean;
  /** The member whose position the collapsed stack sits on and drags from.
   * Set alongside `memberOffsets` when the group is collapsed. */
  anchorTokenId?: string;
  /**
   * Each member token's position *relative to the anchor* at the moment of
   * collapse — the anchor's own offset is `{ x: 0, y: 0 }`. Preserving these
   * is what keeps the formation intact across a collapsed drag and on expand
   * (R8.4 — "stored member offsets relative to an anchor member"). */
  memberOffsets?: Record<string, { x: number; y: number }>;
}

/**
 * Combat tracker (Encounter Screen Spec §4, §10). Three ways to order a
 * scene — the app arranges and steps through them; it never computes an
 * order from a stat. `'free'` (Caller mode) is Phase 4 scope; Phase 2 only
 * drives `'side'` and `'individual'`.
 */
export type EncounterMode = 'side' | 'individual' | 'free';

/** A row's referent: a Group (side mode) or a Token (individual mode). */
export type EncounterRefType = 'side' | 'actor';

export interface EncounterOrderEntry {
  refType: EncounterRefType;
  /** groupId (side mode) or tokenId (individual mode). */
  refId: string;
  /** Typed or rolled — never derived from a stat (Spec §4). */
  init?: number;
  acted: boolean;
}

/**
 * rooms/{roomId}/encounter/current — the one encounter doc a room has at a
 * time (Spec §10). Shared between Map View and the Encounter Board: the
 * `[Active]` pool, round, and current pointer are the same regardless of
 * which Main Stage mode is showing (Spec §9).
 */
export interface Encounter {
  mode: EncounterMode;
  round: number;
  order: EncounterOrderEntry[];
  currentIndex: number;
  /** Phase 4 (Free/Caller mode) — declared now for schema stability. */
  callerSeatId?: string;
  /** Phase 4 (tension widgets) — declared now for schema stability. */
  difficultyDie?: string;
  dangerDie?: { value?: string; clock?: { filled: number; size: number } };
}

export const DEFAULT_ENCOUNTER: Encounter = {
  mode: 'side',
  round: 1,
  order: [],
  currentIndex: 0,
};

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

/**
 * rooms/{roomId}/sightWalls/{id} — a vector (non-grid-aligned) vision-blocking
 * wall, in pixel space. Produced by `.uvtt` import (Plan §7 Phase 4; see
 * `map/uvtt.ts`) for walls that don't lie on the cellular grid's edges, and
 * by the Wall tool's diagonal-run mode (Master Plan v2, R9.2). An optional
 * `door` follows the same open-passes/closed-blocks rule as grid doors (Map
 * Tooling Spec §6) — diagonals never carry one (v2 scope). Grid-aligned
 * walls stay in `walls/{edgeId}`.
 *
 * `visible`/`style` are additive (R9.2): a diagonal wall placed with the Wall
 * tool sets `visible: true` and a render `style`, so it draws like a grid
 * wall and already blocks LoS (`sightSegments` never filters on `visible` —
 * it's render-only). An older/imported `SightWall` with no `visible` field is
 * treated as `false`-equivalent (drawn over pre-rendered `.uvtt` art, so
 * re-drawing it as a line would double up) — no migration needed, this is a
 * purely additive optional field on an existing doc shape.
 */
export interface SightWall {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  door?: MapDoor;
  visible?: boolean;
  style?: WallStyle;
}

/**
 * rooms/{roomId}/lights/{id} — an imported light source (`.uvtt`), pixel
 * space. Stored as dumb data for display/future dynamic lighting; nothing
 * interprets it as a mechanic (Plan hard rule).
 */
export interface MapLight {
  id: string;
  x: number;
  y: number;
  /** Illumination radius in pixels (0 if the file omitted a range). */
  range: number;
  intensity?: number;
  /** Hex string as authored in the file (e.g. "ffd9a0"); never parsed. */
  color?: string;
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

/**
 * Advantage/Disadvantage (Plan §7 Phase 3): a roll-time toggle the human sets
 * on the tray before rolling. Under `'advantage'`/`'disadvantage'` every die
 * is rolled twice and the higher/lower face kept — never a derivation from a
 * Profile value (§2.5 hard rule).
 */
export type AdvantageMode = 'normal' | 'advantage' | 'disadvantage';

/** One physical die's outcome within a Roll. `dropped` is only present under
 * advantage/disadvantage — the face that was rolled but not kept. */
export interface RolledDie {
  die: string;
  sides: number;
  kept: number;
  dropped?: number;
}

/** One seat's contribution within a shared roll (Master Plan v2, R3.6). A
 * single physical-or-compound die expression, never interpreted beyond
 * expansion — same trust model as everything else in `Roll`. */
export interface RollPart {
  /** The seat (or GM-chosen slot id, e.g. a groupId for a monster side)
   * this part rolled for — matches a `SharedRoll.slots` key. */
  seatId: string;
  dice: RolledDie[];
  modifier: number;
  advantage: AdvantageMode;
  /** sum(dice[].kept) + modifier — always present; a shared roll has no
   * separate "mode" toggle, so both this and `flags` are provided and the
   * UI picks whichever fits the context (e.g. initiative wants `total`). */
  total?: number;
  /** Per-die success/complication/failure flags (`resolveSeparate`), same
   * fixed convention `separateFlags` already applies elsewhere. */
  flags?: ResultClass[];
}

/** rooms/{roomId}/rolls/{rollId} */
export interface Roll {
  id: string;
  ts: number;
  authorUid: string;
  /** Deterministic seed every client re-derives the same dice from (§4). */
  seed: string;
  dice: RolledDie[];
  modifier: number;
  advantage: AdvantageMode;
  mode: RollMode;
  /** Present only in Summed mode: sum(dice[].kept) + modifier. */
  total?: number;
  /** Optional origin tag (a macro name or the Profile field label it came
   * from) — purely descriptive text, never interpreted. */
  label?: string;
  /**
   * Present only for a referee-triggered shared roll (Master Plan v2, R3.6):
   * one entry per staged, ready seat, expanded in deterministic seat-id-sorted
   * order from `seed` (see `dice/engine.ts` `expandSharedRollSlots`) — every
   * client re-derives identical faces regardless of slot-write order. The
   * top-level `dice`/`modifier`/`advantage`/`mode`/`total` fields are unused
   * placeholders on a parts roll; consumers must check `parts` first.
   *
   * Purely additive: this is an optional field on an existing doc shape, so
   * older `Roll` docs (which never set it) still parse unchanged — no
   * migration step is needed the way `Room.schemaVersion` needs one (Roll
   * docs carry no schema version of their own; `RollSchema.parse` already
   * tolerates the field's absence via `.optional()`).
   */
  parts?: RollPart[];
}

/** A single seat's staged entry in a shared roll (Master Plan v2, R3.6.1) —
 * one die expression, a flat modifier, and the roll-time advantage toggle,
 * same shape a solo tray roll would carry, plus a readiness flag the
 * referee watches live. */
export interface SharedRollSlot {
  die: string;
  modifier: number;
  advantage: AdvantageMode;
  ready: boolean;
}

export type SharedRollStatus = 'staging' | 'resolved';

/**
 * rooms/{roomId}/sharedRoll/current (Master Plan v2, R3.6.1) — the one
 * in-progress (or just-resolved) shared roll a room has at a time. The
 * referee opens it (optionally with a label, e.g. from the Encounter
 * tracker); each participant writes only their own `slots` entry (own-slot-
 * or-GM, mirroring Profiles); the referee's "Roll" resolves it into a
 * `Roll.parts` doc and flips `status` to `'resolved'` — slot edits after
 * that are simply ignored (single writer, no race).
 */
export interface SharedRoll {
  status: SharedRollStatus;
  label?: string;
  /** uid of the referee who opened this staging round. */
  openedBy: string;
  /** Keyed by seatId (a player writing their own slot) or any GM-chosen id
   * (e.g. a groupId, for a monster side the referee stages themselves). */
  slots: Record<string, SharedRollSlot>;
}

/**
 * rooms/{roomId}/macros/{macroId} — a saved tray configuration a player can
 * replay (Plan §7 Phase 3). Dumb data: a snapshot of dice/modifier/mode/
 * advantage: nothing evaluative, nothing the app reads for meaning.
 */
export interface DiceMacro {
  id: string;
  ownerUid: string;
  name: string;
  dice: string[];
  modifier: number;
  mode: RollMode;
  advantage: AdvantageMode;
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

/**
 * The Blind Drawer (Plan §7 Phase 4). A referee makes a secret roll/draw whose
 * result lives ONLY under `gmPrivate/{id}` — players' clients physically cannot
 * read it (Plan §3). Revealing copies `text` into the shared `log`, at which
 * point it becomes visible to everyone; `revealed` flips so the GM's own panel
 * shows it as spent. `kind` discriminates it from other gmPrivate docs.
 */
export interface BlindDraw extends GmPrivateDoc {
  kind: 'blindDraw';
  ts: number;
  authorUid: string;
  /** What the GM drew for, e.g. "Wandering monster check" — GM label. */
  title: string;
  /** The hidden result text revealed later (a table result or a note). */
  text: string;
  /** Present when the draw came from a dice roll; purely descriptive. */
  seed?: string;
  dice?: RolledDie[];
  revealed: boolean;
}

/**
 * The GM's handout library (Plan §7 Phase 5 — "reveal image to players").
 * Saved handouts live under `gmPrivate/{id}` so the GM can prep several
 * without players seeing what's queued; revealing one copies its `ref`/
 * `title` onto the player-readable `Room.handout` pointer (kept in sync via
 * `revealed`, mirroring the Blind Drawer's copy-on-reveal pattern above).
 */
export interface HandoutRecord extends GmPrivateDoc {
  kind: 'handout';
  ts: number;
  title: string;
  ref: string;
  revealed: boolean;
}
