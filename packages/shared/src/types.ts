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
export const CURRENT_SCHEMA_VERSION = 28;

export type Role = 'gm' | 'player' | 'viewer';

export type ProfileFieldType =
  'text' | 'longtext' | 'number' | 'counter' | 'checkbox' | 'roll' | 'initiative';

/**
 * Is this field's value a die expression? `roll` and `initiative` share the
 * same storage and the same controls — `initiative` only adds *where the die
 * gets staged from* (see `ProfileTemplateField.type`). Every renderer that
 * offers a die control should branch on this rather than on `=== 'roll'`, so
 * the two stay in step.
 */
export function isDieField(type: ProfileFieldType): boolean {
  return type === 'roll' || type === 'initiative';
}

export interface ProfileTemplateField {
  id: string;
  label: string;
  /**
   * `'initiative'` is `roll`-shaped storage (a die expression string) with one
   * added *routing* meaning: it names the die a **Call for Initiative** stages
   * for this actor. That stays inside the §2.5 hard rule — the app never reads
   * the field's *value* to decide anything, exactly as
   * `applySharedRollToInitiative` routes a result without deriving it. Which
   * template the field lives in selects which initiative mode consults it:
   * `profileTemplate` for Individual, `encounterTemplate` for Side-based.
   */
  type: ProfileFieldType;
  /** Default value seeded into a freshly-created profile instance. */
  default?: string | number | boolean;
  /**
   * Encounter Board v2 (Master Plan v2, R8.1): a GM-set flag that surfaces
   * this field, read-only, as a `label: value` row on the actor card. Purely
   * a display choice — the app still never interprets the value (§2.5 hard
   * rule). Absent/false ⇒ the field only shows in the Character dock. */
  pinned?: boolean;
  /**
   * Segment count for a `counter` field — the generalization of the retired
   * danger clock's `size`. Purely a display/step bound the referee chose: the
   * counter renders as `max` pips and steps stop there, exactly as the clock
   * always did. The app reads no meaning into the number (§2.5 hard rule);
   * absent ⇒ a plain unbounded counter.
   */
  max?: number;
}

/**
 * The encounter fields a freshly-created room starts with: a single
 * `initiative`-type field routing **Call for Initiative**'s Side-based mode
 * (DEC-065), expressed in the same template vocabulary as every other field
 * so the referee can relabel, retype, reorder, unpin, delete or add their
 * own. Seeded by `createRoom` only — a room migrating forward through
 * v13->v14 gets `LEGACY_ENCOUNTER_TEMPLATE_V14` instead
 * (`migrations/index.ts`), the frozen widgets that version actually seeded.
 */
export const DEFAULT_ENCOUNTER_TEMPLATE: ProfileTemplateField[] = [
  { id: 'initiative', label: 'Initiative', type: 'initiative', default: 'd6', pinned: true },
];

/** rooms/{roomId} */
export interface Room {
  id: string;
  name: string;
  /** UID of the room creator. The one authority boundary in the whole app:
   * Security Rules gate `gmPrivate/**` reads/writes on this field. */
  gmUid: string;
  schemaVersion: number;
  /**
   * @deprecated Legacy tension defaults. Dumb data — a die expression string
   * (e.g. "d6"), never interpreted.
   *
   * These are **write-only history**: the Session-settings controls that set
   * them are gone (v16), because nothing ever read them back. The live tension
   * values are `Encounter.values[fieldId]`, driven by `Room.encounterTemplate`.
   * They stay on the schema because existing rooms carry real data here, and
   * `TensionBar` still reads the *encounter*-doc counterparts as a fallback
   * for pre-template rooms. Don't add new writers.
   */
  difficultyDie: string;
  dangerDie: string;
  createdAt: number;
  /**
   * When this room last saw a **settled** write (R25.1) — the missing input to
   * every lifecycle decision: `users/{uid}/rooms/{roomId}.lastSeenAt` is
   * per-user, self-owned and rules-denied to everyone else, so nothing can read
   * it to tell a live campaign from an abandoned one.
   *
   * Written only from the moments that already produce a Firestore write
   * (token add/move/remove, floor commit, roll resolution, profile save), and
   * throttled to at most once per `ROOM_ACTIVITY_THROTTLE_MS` per client, so it
   * never becomes a write channel of its own. Never written from an RTDB path,
   * a cursor, or a timer.
   *
   * Optional so a room doc written before the field parses. Absent is *not*
   * "abandoned": the v18->v19 migration seeds the migration timestamp, and
   * `isRoomDormant` requires a real value older than `STALE_ROOM_DAYS`.
   */
  lastActivityAt?: number;
  profileTemplate: ProfileTemplateField[];
  /**
   * The encounter's own field template — the same `ProfileTemplateField`
   * shape, the same field types, edited with the same editor as
   * `profileTemplate`, so a referee configures both from one vocabulary.
   * Where a profile instance exists per seat, there is exactly one encounter
   * instance per room (`Encounter.values`). `pinned` fields surface read-only
   * in the top status bar (editable there by the referee, read-only for
   * players), mirroring what `pinned` means on an actor card. Seeded with
   * `DEFAULT_ENCOUNTER_TEMPLATE`; may be emptied entirely by the referee.
   */
  encounterTemplate: ProfileTemplateField[];
  /**
   * Referee-authored result conventions (see `RollConvention`). Absent or
   * empty ⇒ rolls render faces and totals with no success/failure
   * classification at all. Seeded with `DEFAULT_ROLL_CONVENTIONS`.
   */
  rollConventions?: RollConvention[];
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
   * (see `GameMap` for grid/background/measure, moved off `Room` in the
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
  /** Managed background **colour** (Master Plan v2, R15/WI-19; narrowed to
   * colour-only at schema v23 — SPEC-038 §1, DEC-062). A `#rrggbb` hex string
   * fills the stage with that solid colour, which is the renderer's clear
   * colour (`setBackgroundColor`), not a `layers.background` sprite. `null`
   * was explicitly cleared → the stage shows bare rock.
   *
   * Background **images** are no longer this field: they live one per document
   * in `maps/{mapId}/backgrounds` (`MapBackground`), so a map may carry
   * several, each independently placed. The two coexist — a colour shows
   * through anywhere no image covers it. A pre-v23 `{ ref }` is folded into
   * one full-grid `MapBackground` by `foldLegacyMapBackground`. */
  background?: { color: string } | null;
  /** Measurement ruler config (moved off `Room.settings`, R9.3 — per-map
   * since different maps may use different scales). */
  measure: RoomMeasure;
  /** Render-only grid display settings (moved off `Room.settings`, R9.6). */
  gridSettings: RoomGridSettings;
  /** Fog of war, per map. When `enabled`, everything outside the map's
   * revealed geometry (`maps/{mapId}/fogRegions`) is hidden from players and
   * shown to the referee as a translucent wash. Absent/`false` = no fog, which
   * is what every map created before fog existed gets.
   *
   * This is a *fresh vector-native build*, not a revival of the cellular
   * `fog` field deleted in the WI-D cutover: there is no `fogChunks` grid and
   * no fog mode enum — revealed area is polygon geometry committed through the
   * same carve pipeline the floor uses. See `docs/VTT_Master_Plan.md` Part II §2 (fog). */
  fog?: { enabled: boolean };
  /** Battle map provenance (SPEC-029 §3, v22). **Present only on a temporary
   * battle map** — a smaller-scale map the referee cuts out of another map for
   * a single fight and drops when it ends. Absent (the overwhelming case) means
   * an ordinary, permanent map; nothing else on `GameMap` changes meaning.
   *
   * The battle map is a real `GameMap` in the same room (DEC-026), switched
   * into view through the existing `Room.activeMapId`, so seats, tokens,
   * encounter, dice and log carry across untouched. Exactly one may exist at a
   * time, and it is deleted on Exit — it is scratch state, so **it never
   * survives a `.vttcamp` export** (`portability/vttcamp.ts` strips it on the
   * way out *and* on the way back in). */
  battle?: BattleMapCapture;
  /** Hex-crawl geometry (SPEC-030 §1, v24). **Present only on a hex-grid
   * map**; absent means a square-grid map, which is every map written before
   * v24 and every map a referee makes without asking for a hex crawl. Nothing
   * is backfilled — absence is already the right answer.
   *
   * This field is the map's **grid kind**, not a decoration on one: RULE-006
   * (as amended by WI-037) fixes a map's coordinate space per grid kind, so
   * its presence is what says the map's geometry is stored in axial hex
   * coordinates (`map/hex/`) rather than in square-lattice units
   * (`map/vector/`). Read it through `mapGridKind`/`isHexMap` rather than by
   * hand, so there is one predicate to grep for.
   *
   * `grid.w`/`grid.h` are meaningless on a hex map — a hex crawl is infinite
   * in every direction, with `0,0` at its centre — and `grid.cellSize` is not
   * its multiplier; `hex.size` is. The `grid` field stays present and valid
   * only so one `GameMapSchema` reads both kinds. */
  hex?: HexGridConfig;
}

/** Which coordinate space a map's stored geometry lives in (RULE-006, fixed
 * per grid kind by the WI-037 amendment). Derived from `GameMap.hex`, never
 * stored beside it — two fields could disagree, one cannot. */
export type MapGridKind = 'square' | 'hex';

/** A hex-grid map's geometry configuration (SPEC-030 §1). One number, because
 * orientation is fixed at the render boundary (flat-top hexes in columns) and
 * extent is infinite. */
export interface HexGridConfig {
  /** The hex **circumradius** in pixels — centre to corner. RULE-006's
   * render-time-only multiplier for this map: stored coordinates are integer
   * axial pairs, and this is applied once, at the render boundary, exactly as
   * `grid.cellSize` is for a square map. */
  size: number;
}

/** The coordinate space a map's geometry is in (RULE-006). The one predicate
 * every consumer should branch on — a square-lattice consumer (LoS,
 * `pointInFloorUnion`, token snapping) is undefined on a hex map and must not
 * be reached from one. */
export function mapGridKind(map: Pick<GameMap, 'hex'>): MapGridKind {
  return map.hex ? 'hex' : 'square';
}

/** Sugar for `mapGridKind(map) === 'hex'`. */
export function isHexMap(map: Pick<GameMap, 'hex'>): boolean {
  return mapGridKind(map) === 'hex';
}

/** What a battle map captured (SPEC-029 §§2–3). Not a raster: the rect alone,
 * because every client already holds the source map's geometry and re-renders
 * from it (DEC-025). */
export interface BattleMapCapture {
  /** The `GameMap` this was cut out of — where "Exit" returns to. */
  sourceMapId: string;
  /** The captured region, in the **source map's** lattice units (RULE-006) and
   * always whole cells, because the doubled-density grid must divide evenly
   * (SPEC-029 §§1, 4). Same shape as `BBox` in `map/vector/types.ts`; spelled
   * out here so this module stays dependency-free. */
  rect: { minX: number; minY: number; maxX: number; maxY: number };
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

/** Session-wide settings only — per-map display settings (grid/background/
 * measure) live on `GameMap` (moved there in the v10->v11 multi-map
 * migration). */
export interface RoomSettings {
  theme: string;
  /**
   * How the table runs initiative. Moved here from the Combat Tracker's mode
   * radios, which rendered for players who could never commit them.
   *
   *  - `'free'`   — the app tracks nothing: no order, no rounds, no tracker.
   *  - `'side'`   — one initiative row per active Group.
   *  - `'individual'` — one row per active Token.
   *
   * This is the *configured* mode. A running encounter keeps its own
   * `Encounter.mode` snapshot, taken from this value when combat starts, so
   * changing the setting mid-fight doesn't reshape a live order.
   */
  initiativeMode: EncounterMode;
  /**
   * Fallback initiative die expression, used for any row whose actor has no
   * `initiative` template field set — including every group or token with no
   * assigned player. Dumb data: a die expression string, expanded but never
   * interpreted.
   */
  initiativeDie: string;
  /**
   * Where a newly joined player seat lands (group ownership model). Either one
   * of the two sentinels or a literal `groupId`:
   *
   *  - `'first'`      — the first group in board order.
   *  - `'unassigned'` — leave the seat in no group at all.
   *  - a `groupId`    — that specific group.
   *
   * A stored groupId that no longer resolves (the referee deleted the group)
   * behaves exactly like `'first'`; see `resolveDefaultGroupId`. The board also
   * writes the setting back to `'first'` when it deletes the named group, so
   * the dangling state is transient rather than the normal case.
   */
  defaultPlayerGroup: DefaultPlayerGroup;
}

/**
 * `RoomSettings.defaultPlayerGroup`. Widened to `string` because a groupId is
 * a legal value alongside the two sentinels — the union is documentation, not
 * a constraint the type system can enforce here.
 */
export type DefaultPlayerGroup = 'first' | 'unassigned' | (string & {});

/**
 * One classification band within a `RollConvention` — an inclusive numeric
 * range and the referee's own word for it. `min`/`max` are both optional so a
 * band can be open-ended at either end (`{ max: 1 }` = "1 or less").
 */
export interface RollBand {
  min?: number;
  max?: number;
  class: ResultClass;
  label: string;
}

/**
 * A referee-authored result convention (the revamp's answer to "how do we
 * communicate results across rule sets?").
 *
 * This is **data the referee wrote, not logic the app knows** — the same
 * standing as a random table or a profile template. The app looks up which
 * band a rolled number falls in and paints that band's colour and word; it
 * never decides what the band *means*, never compares a roll against a stat,
 * and never reads a Profile value (§2.5 hard rule).
 *
 * `applies` narrows a convention to a resolution mode and/or a die size; the
 * most specific match wins. A room with no matching convention shows faces and
 * totals with **no** classification at all, which is strictly more honest than
 * the old hardcoded d6 bands being applied to a d20.
 */
export interface RollConvention {
  id: string;
  label: string;
  applies: { mode?: RollMode; sides?: number };
  bands: RollBand[];
}

/**
 * What a room starts with: the historical `resolveSeparate` convention
 * (4+ success / 2–3 complication / 1 failure), now expressed as data and —
 * the fix — scoped to the d6 it was always describing, so a d20 face of 4 no
 * longer reports "success". Seeded by `createRoom` and the v15->v16 migration;
 * nothing in the app depends on this id existing.
 */
export const DEFAULT_ROLL_CONVENTIONS: RollConvention[] = [
  {
    id: 'osr-d6',
    label: 'OSR d6',
    applies: { mode: 'separate', sides: 6 },
    bands: [
      { min: 4, class: 'success', label: 'Success' },
      { min: 2, max: 3, class: 'complication', label: 'Complication' },
      { max: 1, class: 'failure', label: 'Failure' },
    ],
  },
];

/** Default grid seeded onto a freshly created map (mapper-draws workflow,
 * square grid only — Plan §11). 64×64 cells at 70px is a generous dungeon
 * canvas; the grid can grow later without a migration since chunks are
 * allocated lazily. (Fog was removed in the vector cutover — SPEC §4.) */
export const DEFAULT_GRID_CONFIG: GameMap['grid'] = { w: 64, h: 64, cellSize: 70 };
/** Default hex geometry seeded onto a freshly created hex-crawl map (SPEC-030
 * §1). 48px centre-to-corner draws a 96×83 hex — roomier than the 70px square
 * above, because a hex tile carries terrain art, contents icons and its own
 * coordinate pill. The grid is infinite, so there is no extent to seed. */
export const DEFAULT_HEX_GRID_CONFIG: HexGridConfig = { size: 48 };
export const DEFAULT_HANDOUT: HandoutState = null;
/** Master Plan v2, R9.3: the default changes from the old implicit 5 ft/square
 * assumption to 10/feet, deliberately, per referee preference. */
export const DEFAULT_MEASURE: RoomMeasure = { perSquare: 10, unit: 'feet' };
/** Master Plan v2, R9.6: half-grid subdivision defaults off (full grid only). */
export const DEFAULT_GRID_SETTINGS: RoomGridSettings = { subdivide: false };
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  theme: 'parchment-dark',
  // Matches the historical `DEFAULT_ENCOUNTER.mode`, so a room that never
  // touches the new setting runs exactly as it did before.
  initiativeMode: 'side',
  initiativeDie: 'd6',
  // A room that never touches the setting drops joiners into whatever group
  // sorts first, which is the reading a referee with one party expects.
  defaultPlayerGroup: 'first',
};
/** The bundled starter map ref — the canonical default background. Lives in
 * shared (not just the web app) so the migration and store defaults can seed
 * it without importing app code; the web app re-exports it. */
export const STARTER_MAP_REF = 'maps/starter-room.svg';
/** Master Plan v2, R15/WI-19 (superseded WI-073): a freshly created map has no
 * default background — it shows bare rock until the GM explicitly sets one. */
export const DEFAULT_BACKGROUND: GameMap['background'] = null;
/** Name given to the one map a freshly created room starts with, and to the
 * map a pre-multi-map room's existing data is adopted into (`ensureActiveMap`,
 * `store/firebase-store.ts`). */
export const DEFAULT_MAP_NAME = 'Map 1';

/** Builds a freshly-seeded `GameMap` — shared by `createRoom` (a brand-new
 * room's first map) and `ensureActiveMap` (adopting a pre-v11 room's existing
 * flat map data into its first map), so both paths seed identical defaults.
 *
 * `gridKind` picks the map's coordinate space (RULE-006) and defaults to
 * `'square'`, which is what both of those callers want and what every map
 * before v24 is. `'hex'` seeds `hex: DEFAULT_HEX_GRID_CONFIG` — the whole of
 * the difference at creation time, since the square `grid` stays present and
 * valid (and unread) on a hex map. */
export function createDefaultGameMap(
  id: string,
  name: string = DEFAULT_MAP_NAME,
  gridKind: MapGridKind = 'square',
): GameMap {
  return {
    id,
    name,
    order: 0,
    createdAt: Date.now(),
    grid: DEFAULT_GRID_CONFIG,
    background: DEFAULT_BACKGROUND,
    measure: DEFAULT_MEASURE,
    gridSettings: DEFAULT_GRID_SETTINGS,
    ...(gridKind === 'hex' ? { hex: DEFAULT_HEX_GRID_CONFIG } : {}),
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
  /**
   * The seat whose character this player is currently playing — the last one
   * they selected from a group they own (group ownership model). Under that
   * model a player can act as any character in their groups, so "my sheet"
   * needs a pointer rather than being implicitly this seat's own profile.
   *
   * Absent ⇒ their own seat, which is the pre-groups reading and what every
   * seat starts as. Written by the seat itself (`players/{uid}` is own-uid-or-
   * GM writable), so no referee involvement is needed to switch character.
   */
  currentCharacterSeatId?: string;
  /**
   * Epoch ms of the last time this seat was observed present (R26.2).
   *
   * Presence itself is ephemeral by construction (an RTDB node removed by
   * `onDisconnect`), so it cannot answer "has this seat been gone a month" —
   * which is the only question the R26.3 prune needs. Hence a durable field,
   * written on the first presence publish of a session and then at most once
   * per hour (`LAST_PRESENT_THROTTLE_MS`).
   *
   * Absent ⇒ never observed. That is NOT abandoned: seats written before this
   * field existed have no value, and treating "unknown" as "dead" would offer
   * every pre-existing campaign's players up for pruning the moment the
   * feature shipped.
   */
  lastPresentAt?: number;
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
  /**
   * "Keep" on the R25.2 dormant affordance — this entry's owner has been shown
   * that the room is dormant and said to leave it alone until this timestamp
   * (another `STALE_ROOM_DAYS`). Stored on the user's **own** index entry
   * rather than the room doc: it is one user's opinion about their own list,
   * and the index is the one place a user may always write.
   *
   * Absent ⇒ never dismissed.
   */
  dormantDismissedUntil?: number;
}

export type ProfileValue = string | number | boolean;

/**
 * rooms/{roomId}/profiles/{actorId} — an instance of the room's
 * profileTemplate.
 *
 * **Keyed by an actor, not a seat** (SPEC-032 §2, schema v21). An actor id is
 * either:
 *
 *  - a **seat id** — a character, which is every profile that existed before
 *    v21; or
 *  - a **token id** — a creature, which has no seat and never will.
 *
 * The key space widened; no existing document changed. Creatures reuse the
 * room's `profileTemplate` — `encounterTemplate` is one instance per *room*
 * (`Encounter.values`) and so cannot carry per-creature fields.
 *
 * A token-keyed profile is owned by its token: `deleteToken` deletes it, the
 * same collection-enumeration duty the vector cutover's M2 imposed on
 * `deleteRoom`.
 */
export interface ProfileInstance {
  actorId: string;
  values: Record<string, ProfileValue>;
  portraitRef?: string;
  /** The character's own color (Master Plan v2 addendum, quick-sheet token
   * split) — a `#rrggbb` hex, same format as `GameMap.background`'s `color`.
   * Mirrored onto the owner's map `Token.color` when set from the quick sheet
   * so both the map background disc and that seat's dice follow it. This is
   * the *only* source of a die's colour.
   *
   * **Every character has one** (SPEC-031, schema v20). Optional in the type
   * only because a document written before that rule may not carry the field
   * yet — absence is a provenance marker, no longer a choice, and it resolves
   * through `assignedCharacterColor(seatId)` wherever a colour is read. There
   * is no UI that can return this field to absent.
   *
   * **The guarantee is a *character* guarantee, and stays one** (SPEC-032 §2,
   * DEC-042). It is scoped to seat-keyed actors: a token-keyed creature
   * profile carries a colour only if one was stored, exactly as `Token.color`
   * does, because a creature has no character behind it to always have one. */
  color?: string;
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
  /** The creature's name (SPEC-040 §3) — what the Encounter Board card, the
   * initiative order and the Character quick sheet's header call it. Absent ⇒
   * fall back to `creatureLabel(token)`, the ref-derived string those surfaces
   * used before this field existed, so a token written before v28 reads
   * exactly as it did.
   *
   * Absence stays a legitimate state, the same shape `color` below uses: the
   * v27->v28 migration deliberately does **not** backfill `creatureLabel`'s
   * output, because for a generated creature that output is a fragment of an
   * asset URL (`gen:disc:a1:%23aabbcc`) — the very string SPEC-040 exists to
   * stop showing — and storing it would make it permanent rather than merely
   * displayed.
   *
   * A **seat's** token never uses this: a character's name is its seat's
   * `displayName`, and always was. This is for actors with no seat behind
   * them. */
  name?: string;
  /** Background disc color behind this token's image (quick-sheet token
   * split) — a `#rrggbb` hex, rendered behind `imageRef` so it shows through
   * a transparent uploaded image and behind the default letter-token disc.
   * Distinct from the status ring (`tokenRingColor`, selection/group
   * indicator, not identity). Mirrors `ProfileInstance.color` for the token's
   * owner when set from the quick sheet; absent = no custom color, letter
   * tokens keep their auto-assigned `gen:disc:` fill.
   *
   * Unlike `ProfileInstance.color`, absence stays a legitimate state here
   * (SPEC-031 §5): a creature or a piece of scenery has no character behind it
   * and so has no colour to always have. */
  color?: string;
}

/** rooms/{roomId}/groups/{groupId} */
export interface Group {
  id: string;
  name: string;
  memberTokenIds: string[];
  /**
   * The player seats that own this group (group ownership model). A seat listed
   * here may act as **every** character in the group — open its sheet, edit its
   * profile, roll its fields — not just the one token linked to its own seat.
   *
   * The referee is deliberately **not** stored here. GM membership is derived
   * from `Room.gmUid` at read time (`canSeatActAs`), so transferring GM moves
   * that implicit membership across every group with no writes at all.
   *
   * Absent ⇒ no player seats yet; a group written before this field parses
   * unchanged and simply has no owners.
   */
  memberSeatIds?: string[];
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
  /**
   * Display order on the Encounter board, lowest first. Firestore returns a
   * collection in document-*id* order, which is arbitrary and — because group
   * ids are referenced by `Encounter.order` side refs, `Token.groupId`, shared
   * initiative slots and collapse anchors — cannot be rewritten to reorder
   * anything. So order is stored explicitly, the same way `MapRoom.order` is.
   *
   * Absent ⇒ unordered; those sort after every ordered group and fall back to
   * doc-id order among themselves, so a room written before this field keeps
   * exactly the ordering it had.
   */
  order?: number;
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
  /** Values for the room's `encounterTemplate` fields, keyed by field id —
   * the encounter's counterpart to a seat's `ProfileInstance.values`. Dumb
   * data like every other profile value (§2.5 hard rule). */
  values?: Record<string, ProfileValue>;
  /**
   * Refs the referee added to the order *directly*, outside the `[Active]`
   * group mechanism — which is what lets an **ungrouped** token be in
   * initiative at all. Before this, the only route into a fight was
   * token → Group → flip `[Active]`, so a lone wandering monster had to be
   * given a group first.
   *
   * `syncOrder`'s reconciliation preserves these alongside the group-derived
   * set. Absent = none, which is every encounter written before v16.
   */
  pinnedRefIds?: string[];
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
  /** Footprint in cells, top-left anchored at `cell`. Absent = 1x1. */
  cellSpan?: { w: number; h: number };
}

/**
 * rooms/{roomId}/maps/{mapId}/backgrounds/{bgId} — one placed background image
 * (SPEC-038 §1, DEC-062, schema v23). A sparse subcollection, the same
 * edit-locality pattern `floorRegions` uses: dragging one image rewrites one
 * small document rather than the whole map doc (RULE-003).
 *
 * `x, y, w, h` are the placed rect in the map's **lattice (cell) units as
 * floats** (RULE-006) — `cellSize` multiplies them once at the render
 * boundary, exactly as it does for every other stored geometry. `order` breaks
 * stacking ties when two images overlap: lowest is painted first, i.e.
 * furthest back.
 */
export interface MapBackground {
  id: string;
  /** The image, resolved through `AssetStore` like any other image ref. */
  ref: string;
  /** Top-left corner, lattice units. */
  x: number;
  y: number;
  /** Size in lattice units. A resize preserves the image's native aspect
   * ratio (SPEC-038 §3), which is a UI guarantee, not a stored one — nothing
   * here records the native ratio. */
  w: number;
  h: number;
  /** Paint order within `layers.background`, lowest first. */
  order: number;
  /**
   * Is this image pinned in place? (SPEC-039 §1, DEC-068, schema v27.)
   *
   * **Absent means unlocked.** A locked background is not an object as far as
   * the Select tool is concerned — a press inside its rect falls through to
   * whatever Select would otherwise have picked, exactly as a press outside
   * every rect does. There is no modifier key that overrides it; unlocking is
   * the override.
   *
   * A *stored* field rather than per-viewer client state, deliberately: a lock
   * is a statement about the asset, and two referees must see the same one.
   *
   * Every background that existed before v27 is migrated **locked**
   * (`lockLegacyBackground`, DEC-069) — those placements are overwhelmingly
   * full-grid, and migrating them unlocked would hand every Select click on
   * the whole map to the background. A newly added one starts **unlocked**,
   * because a referee who has just placed an image wants to position it, and
   * `CampaignStore.addBackground` writes `locked: false` explicitly so that
   * *absence* stays the unambiguous marker of a pre-v27 document.
   */
  locked?: boolean;
}

/**
 * rooms/{roomId}/maps/{mapId}/hexTiles/{axialKey} — what one hex of a hex-crawl
 * map carries (SPEC-030 §§2–3, schema v25). Sparse in exactly the way
 * `floorRegions` is: a hex nobody has painted has no document, and clearing a
 * hex deletes its document rather than leaving an empty one behind. An infinite
 * plane (SPEC-030 §1) can only be stored this way.
 *
 * **The document id is the coordinate** — `hexMap.axialKey(hex)`, the `"q,r"`
 * string that is also the hex's rendered coordinate pill. So the coordinate is
 * stored exactly once, in the id, and `hex` below is *derived from it on read*
 * rather than being a second copy that could disagree — the same one-truth
 * argument that made `GameMap.hex` the grid kind instead of a `gridKind` field
 * beside it. Nothing here is in lattice units, and nothing here is in pixels
 * (RULE-006): `q`/`r` are integer axial coordinates with `0,0` at the map's
 * centre, and `hex.size` multiplies them once at the render boundary.
 *
 * Both payload fields are optional because a hex may carry terrain with no
 * contents, contents with no terrain, or — from WI-041 — only a note. A tile
 * with none of them is not stored.
 */
export interface HexTile {
  /** `hexMap.axialKey(hex)` — the document id, `"q,r"`. */
  id: string;
  /** The hex this tile is on, parsed from `id`. Structurally `hexMap.Axial`;
   * spelled out here so `types.ts` stays import-free. */
  hex: { q: number; r: number };
  /** Terrain kind (SPEC-030 §2) — a `HEX_TERRAIN_CATALOG` key, resolved to a
   * background colour and an overlay ref at the render boundary. Never the
   * colour itself: re-drawing the terrain set must not need a migration. */
  terrain?: string;
  /** Contents kind (SPEC-030 §3) — a `HEX_CONTENTS_CATALOG` key, drawn as a
   * black icon over the terrain. */
  contents?: string;
  /**
   * The referee's note for this hex (SPEC-030 §4, schema v26) — markdown, shown
   * on mouseover through the same `map-label-tooltip` a room label uses.
   *
   * §4's "only hexes with a note attached are tracked" is not a separate index:
   * it is this collection's existing sparseness. There is no "add a note here"
   * step because §1's coordinates already name every hex, so a note is just a
   * third thing a painted hex may carry — and a hex carrying *only* a note is
   * as ordinary as one carrying only terrain.
   *
   * Stored on the tile rather than in the `room-notes` Yjs doc the *map-room*
   * notes use: that doc is keyed by map-room id and is per-room, not per-map,
   * so it has nowhere to file a coordinate that repeats on every hex map in
   * the session. A plain field here rides the `.vttcamp` export, the map
   * delete and the rules the rest of the tile already has.
   */
  note?: string;
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
  /**
   * The `rolls/{rollId}` this entry describes, for `type: 'roll'` entries.
   *
   * `text` stays the authoritative, self-contained record (and what search
   * matches on); this is an additive pointer that lets a log row re-render the
   * *structured* result — per-die badges, dimmed dropped dice, convention band
   * chips — whenever that `Roll` is still in the loaded window. Absent on every
   * entry written before v16, which falls back to `text` unchanged.
   */
  rollId?: string;
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
  /**
   * @deprecated Per-die result flags from the retired hardcoded d6 convention.
   * Written on every shared roll up to v16 and read by nothing — the overlay,
   * the roll strip and the log all used `total`. No longer written; kept
   * optional so pre-v16 rolls still parse. Classification now comes from the
   * room's `RollConvention`s at render time (`summarizeRoll`).
   */
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
  /**
   * What this staging round is for. `'initiative'` marks a **Call for
   * Initiative**, which changes three behaviours: a player's quick-die tap
   * *stages* their slot instead of rolling immediately, the actor shows READY
   * once staged, and resolving applies the results to the tracker
   * automatically instead of waiting for the referee's explicit Apply tap.
   *
   * Absent = an ordinary shared roll, which keeps the explicit Apply button
   * (Master Plan v2, R3.6.5). Additive, so pre-v16 docs still parse.
   */
  kind?: 'initiative';
  /** uid of the referee who opened this staging round. */
  openedBy: string;
  /**
   * Keyed by slot id:
   *  - a **groupId** in Side-based initiative (and for any monster side the
   *    referee stages themselves);
   *  - `{uid}:{tokenId}` in Individual initiative, so one player can stage
   *    several characters they own — the security rule checks only the uid
   *    prefix, so this needs no extra document read;
   *  - a bare **uid** for an ordinary (non-initiative) shared roll.
   */
  slots: Record<string, SharedRollSlot>;
}

/** Builds the Individual-mode slot id for one owned character. Kept beside the
 * type (and mirrored in `firestore.rules`) so the encoding has one home. */
export function characterSlotId(uid: string, tokenId: string): string {
  return `${uid}:${tokenId}`;
}

/** The uid that owns a slot id — the prefix for a `{uid}:{tokenId}` character
 * slot, or the whole id for a plain uid/groupId slot. Mirrors the rule
 * `slotId.split(':')[0] == request.auth.uid`. */
export function slotOwnerUid(slotId: string): string {
  return slotId.split(':')[0] ?? slotId;
}

/** The tokenId a `{uid}:{tokenId}` character slot refers to, or `null` for a
 * side/plain slot. */
export function slotTokenId(slotId: string): string | null {
  const parts = slotId.split(':');
  return parts.length > 1 ? (parts[1] ?? null) : null;
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
