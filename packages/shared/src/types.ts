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
export const CURRENT_SCHEMA_VERSION = 11;

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
  /** The one handout currently shown to the whole table (Plan §7 Phase 5 —
   * "reveal image to players"), or `null` if nothing is revealed. Player-
   * readable (it's on the room doc); the GM's saved library of *unrevealed*
   * handouts lives under `gmPrivate` (see `HandoutRecord`) so players can't
   * see what's queued up next. */
  handout: HandoutState;
  /** Session-wide display settings (Master Plan v2, R2/R4) — not per-map
   * (see `GameMap` for grid/fog/background/measure, moved off `Room` in the
   * v10->v11 multi-map migration). */
  settings: RoomSettings;
  /**
   * The `GameMap` every client renders (Master Plan v2 — multiple full map
   * builds per session, one "active" at a time, R17.3). Always a valid
   * `maps/{activeMapId}` doc once the room has been opened at least once
   * post-migration; `undefined` only on a room whose GM client hasn't yet run
   * `ensureActiveMap` (a very short-lived state — see `ensureActiveMap` doc).
   * A fresh room created at schema v11+ gets this set inline by `createRoom`,
   * so `undefined` in practice only covers the migration window for rooms
   * created before v11.
   */
  activeMapId?: string;
}

/**
 * rooms/{roomId}/maps/{mapId} — one full map build (Master Plan v2, R17.3:
 * "multiple full map builds within the session... different background,
 * different rooms, same players/tokens... referee selects one 'active' map
 * visible to all players"). Everything cellular-map-shaped (floor/fog chunks,
 * walls, sight-walls, circle-walls, symbols, mapRooms/labels, drawings — see
 * each type's own doc comment) lives in this doc's subcollections, so
 * switching `Room.activeMapId` swaps the whole map build without touching any
 * other map's data, session state (players/tokens/encounter/log), or the
 * session-wide `RoomSettings.theme`.
 */
export interface GameMap {
  id: string;
  name: string;
  /** Display/creation order in the Maps manager (lower first). */
  order: number;
  createdAt: number;
  /** Map grid dimensions (Map Tooling Spec §7). Square grid only — v1. */
  grid: { w: number; h: number; cellSize: number };
  /** Fog of War mode (Spec §6): `emergent` = unexplored is uncarved rock
   * (default, mapper-draws workflow); `manual` = GM-prepped map, revealed
   * cell-by-cell via the FoW eraser; `dynamic` = raycasting LoS from walls,
   * recomputed live from viewpoints. NOTE: fog rendering/LoS was removed in the
   * vector cutover (SPEC §4); this persisted field is retained for map config /
   * `.vttcamp` round-trip but no map view currently consumes `dynamic`. */
  fog: { mode: 'emergent' | 'manual' | 'dynamic' };
  /** Managed background image (Master Plan v2, R15/WI-19). Resolved through
   * `AssetStore` like any other image ref. `{ ref }` renders that image;
   * `null` was explicitly cleared → the stage shows bare rock. */
  background?: { ref: string } | null;
  /** Measurement ruler config (moved off `Room.settings`, R9.3 — per-map
   * since different maps may use different scales). */
  measure: RoomMeasure;
  /** Render-only grid display settings (moved off `Room.settings`, R9.6). */
  gridSettings: RoomGridSettings;
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

/** Session-wide settings only — per-map display settings (grid/fog/
 * background/measure) live on `GameMap` (moved there in the v10->v11
 * multi-map migration). */
export interface RoomSettings {
  theme: string;
}

/** Default grid/fog seeded onto a freshly created map (mapper-draws
 * workflow, square grid only — Plan §11). 64×64 cells at 70px is a generous
 * dungeon canvas; the grid can grow later without a migration since chunks
 * are allocated lazily. */
export const DEFAULT_GRID_CONFIG: GameMap['grid'] = { w: 64, h: 64, cellSize: 70 };
export const DEFAULT_FOG_CONFIG: GameMap['fog'] = { mode: 'emergent' };
export const DEFAULT_HANDOUT: HandoutState = null;
/** Master Plan v2, R9.3: the default changes from the old implicit 5 ft/square
 * assumption to 10/feet, deliberately, per referee preference. */
export const DEFAULT_MEASURE: RoomMeasure = { perSquare: 10, unit: 'feet' };
/** Master Plan v2, R9.6: half-grid subdivision defaults off (full grid only). */
export const DEFAULT_GRID_SETTINGS: RoomGridSettings = { subdivide: false };
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  theme: 'parchment-dark',
};
/** The bundled starter map ref — the canonical default background. Lives in
 * shared (not just the web app) so the migration and store defaults can seed
 * it without importing app code; the web app re-exports it. */
export const STARTER_MAP_REF = 'maps/starter-room.svg';
/** Master Plan v2, R15/WI-19: a freshly created map seeds the starter map as
 * its managed background, matching the old hard-coded sprite's look. */
export const DEFAULT_BACKGROUND: NonNullable<GameMap['background']> = { ref: STARTER_MAP_REF };
/** Name given to the one map a freshly created room starts with, and to the
 * map a pre-multi-map room's existing data is adopted into (`ensureActiveMap`,
 * `store/firebase-store.ts`). */
export const DEFAULT_MAP_NAME = 'Map 1';

/** Builds a freshly-seeded `GameMap` — shared by `createRoom` (a brand-new
 * room's first map) and `ensureActiveMap` (adopting a pre-v11 room's existing
 * flat map data into its first map), so both paths seed identical defaults. */
export function createDefaultGameMap(id: string, name: string = DEFAULT_MAP_NAME): GameMap {
  return {
    id,
    name,
    order: 0,
    createdAt: Date.now(),
    grid: DEFAULT_GRID_CONFIG,
    fog: DEFAULT_FOG_CONFIG,
    background: DEFAULT_BACKGROUND,
    measure: DEFAULT_MEASURE,
    gridSettings: DEFAULT_GRID_SETTINGS,
  };
}

/** rooms/{roomId}/players/{uid} */
export interface PlayerSeat {
  uid: string;
  displayName: string;
  seatId: string;
  role: Role;
  /** Set once, at `joinRoom` time. Drives deterministic default-token
   * lettering (Master Plan v2, R7.1 — "players A, B, C… by seat join
   * order"). Optional/additive so seats written before this field existed
   * still parse; they just sort last (§`tokens/labels.ts` in apps/web). */
  joinedAt?: number;
}

/**
 * The current Auth identity, surfaced to the UI (Master Plan v2, R6.1).
 * Anonymous by default; `linkWithGoogle` upgrades the *same* uid in place, so
 * the uid never changes when an anonymous seat saves its identity. `email`/
 * `displayName` are populated only once a provider (Google) is linked.
 */
export interface AccountInfo {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
}

/**
 * users/{uid}/rooms/{roomId} — a per-user convenience index of the rooms they
 * created/joined/opened (Master Plan v2, R6.2), written self-owned (rules:
 * a user may only write their own index). Best-effort: a dangling entry left
 * behind after a room was deleted elsewhere just renders a "room gone — remove?"
 * row in the Lobby, it grants no authority of its own.
 */
export interface MyRoomEntry {
  roomId: string;
  name: string;
  role: Role;
  lastSeenAt: number;
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

/** rooms/{roomId}/maps/{mapId}/drawings/{strokeId} — Annotate overlay only. */
export interface Drawing {
  id: string;
  layer: StageLayer;
  kind: DrawingKind;
  points: { x: number; y: number }[];
  style: Record<string, string | number>;
}

/**
 * A wall's render style (Master Plan v2, R10.1). Widened from the original
 * `'masonry' | 'natural'` to a 4-way set: `'solid'` (single stroke),
 * `'masonry'` (the historic solid + masonry treatment), `'natural'` (organic
 * cave-edge curve), and `'dashed'`. Kept for `MapRoom.wallStyle` (symbol/label
 * authoring, unaffected by the vector map cutover).
 */
export type WallStyle = 'solid' | 'masonry' | 'natural' | 'dashed';

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

/** rooms/{roomId}/maps/{mapId}/symbols/{id} — an icon bound to one grid cell. */
export interface MapSymbol {
  id: string;
  cell: { x: number; y: number };
  kind: string;
  rotation: number;
}

/** rooms/{roomId}/maps/{mapId}/mapRooms/{id} — a keyed/named region of floor cells (a
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

/**
 * One physical die's outcome within a Roll (Master Plan v2, R20).
 *
 * Two independent "dropped" concepts, one per resolution mode:
 *  - `dropped` (a *value*): Separate mode advantage/disadvantage rolls each die
 *    a second time and keeps the better face; `dropped` records the companion
 *    face that was rolled but not kept. The kept die and its dimmed companion
 *    are both rendered (R20.2).
 *  - `poolDropped` (a *flag*): Summed mode "drop highest"/"drop lowest" rolls
 *    each staged die once, then removes one whole die from the pool. The
 *    removed die keeps its rolled `kept` face for display but is excluded from
 *    the total (`summedTotal`) and rendered dimmed. No extra dice are rolled.
 */
export interface RolledDie {
  die: string;
  sides: number;
  kept: number;
  dropped?: number;
  poolDropped?: boolean;
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

/**
 * rooms/{roomId}/assetRefs/{id} — the Assets activity's "By URL" tab (Master
 * Plan v2, R7.2): a referee-or-player-pasted external image URL, saved once
 * so it's reusable across the Add-creature / My-token flows and everyone
 * else's client (Plan §2.5 trust model — all-readable, member-or-GM
 * writable, same as tokens/drawings). Bundled starter-pack refs never go
 * through this list — they're a static catalog resolved straight off
 * `STARTER_TOKEN_REFS`, nothing to save.
 */
export interface AssetRef {
  id: string;
  ref: string;
  label?: string;
  addedBy: string;
  ts: number;
}
