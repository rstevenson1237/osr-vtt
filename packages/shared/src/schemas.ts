import { z } from 'zod';

/**
 * Zod schemas mirroring `types.ts`. Used by the Firestore converters (§8.2)
 * to validate documents at the read/write boundary — the only place
 * validation happens. This is structural validation only; it never inspects
 * *values* for game meaning (Plan hard rule, §2.5).
 */

export const RoleSchema = z.enum(['gm', 'player', 'viewer']);

// Leaf enums, hoisted above their first use: `RoomSettingsSchema` and
// `RollConventionSchema` (both defined below) reference these at *module
// evaluation* time, so they cannot live down beside the encounter/roll
// schemas that also use them.
export const EncounterModeSchema = z.enum(['side', 'individual', 'free']);
export const EncounterRefTypeSchema = z.enum(['side', 'actor']);
export const ResultClassSchema = z.enum(['success', 'complication', 'failure']);
export const RollModeSchema = z.enum(['summed', 'separate']);

export const ProfileFieldTypeSchema = z.enum([
  'text',
  'longtext',
  'number',
  'counter',
  'checkbox',
  'roll',
  // `roll`-shaped storage that also names the die a Call for Initiative
  // stages for this actor (routing, not interpretation — see the type doc).
  'initiative',
]);

export const ProfileTemplateFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: ProfileFieldTypeSchema,
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  // Encounter Board v2 (Master Plan v2, R8.1) — optional/additive, so older
  // room docs (no `pinned` on any field) still parse unchanged.
  pinned: z.boolean().optional(),
  // Counter segment count (the generalized danger-clock `size`) — optional/
  // additive, so templates written before it still parse.
  max: z.number().int().positive().optional(),
});

export const GridConfigSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  cellSize: z.number().positive(),
});

export const HandoutStateSchema = z
  .object({ ref: z.string().min(1), title: z.string().optional() })
  .nullable();

export const RoomMeasureSchema = z.object({
  perSquare: z.number().positive(),
  unit: z.string().min(1),
});

export const RoomGridSettingsSchema = z.object({
  subdivide: z.boolean(),
});

// What a battle map captured (SPEC-029 §§2–3, v22): the rect in the *source*
// map's lattice units (RULE-006), whole cells only. `min`/`max` are not
// cross-checked here — an inverted rect is a bug in the capture tool, not a
// document to reject on read.
export const BattleMapCaptureSchema = z.object({
  sourceMapId: z.string().min(1),
  rect: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
});

// A hex-crawl map's geometry (SPEC-030 §1, v24): the hex circumradius in
// pixels, which is RULE-006's render-time-only multiplier for a map whose
// coordinates are integer axial pairs. No orientation and no extent — the
// first is fixed at the render boundary (flat-top), the second is infinite.
export const HexGridConfigSchema = z.object({
  size: z.number().positive(),
});

// Session-wide only — per-map settings moved to `GameMapSchema` below
// (v10->v11 multi-map migration).
export const RoomSettingsSchema = z.object({
  theme: z.string().min(1),
  // Initiative config moved off the Combat Tracker's radios (v15->v16).
  // Defaulted rather than required so a room doc written before the migration
  // ran still parses as the behaviour it already had.
  initiativeMode: EncounterModeSchema.default('side'),
  initiativeDie: z.string().min(1).default('d6'),
  // Group ownership (v16->v17): `'first'` | `'unassigned'` | a groupId.
  // Defaulted for the same reason as the initiative pair above — a room doc
  // written before the migration ran keeps parsing as the behaviour it had.
  defaultPlayerGroup: z.string().min(1).default('first'),
});

export const RollBandSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    class: ResultClassSchema,
    label: z.string(),
  })
  // An band open at both ends would swallow every roll and make the rest of
  // the convention unreachable — almost certainly an authoring slip.
  .refine((b) => b.min !== undefined || b.max !== undefined, {
    message: 'a band needs at least one of min/max',
  });

export const RollConventionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  applies: z.object({
    mode: RollModeSchema.optional(),
    sides: z.number().int().positive().optional(),
  }),
  bands: z.array(RollBandSchema),
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  gmUid: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  difficultyDie: z.string(),
  dangerDie: z.string(),
  createdAt: z.number(),
  // Room activity clock (R25.1). Optional rather than defaulted: a room doc
  // written before the field exists is walked through the v18->v19 migration
  // first, which seeds it — so absence here only ever means "this doc was
  // parsed outside that path".
  lastActivityAt: z.number().optional(),
  profileTemplate: z.array(ProfileTemplateFieldSchema),
  // The encounter's field template (same shape/types as `profileTemplate`).
  // Defaulted rather than required so a room doc written before the v13->v14
  // migration ran still parses — absence means "no encounter fields yet".
  encounterTemplate: z.array(ProfileTemplateFieldSchema).default([]),
  // Referee-authored result conventions. Optional rather than defaulted: an
  // absent list and an empty list mean the same thing (no classification), and
  // a room written before v15->v16 must keep parsing.
  rollConventions: z.array(RollConventionSchema).optional(),
  password: z.string().optional(),
  handout: HandoutStateSchema,
  settings: RoomSettingsSchema,
  // The active `GameMap` (multi-map, R17.3). Optional only for the brief
  // migration window before `ensureActiveMap` runs on a pre-v11 room.
  activeMapId: z.string().min(1).optional(),
});

export const GameMapSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  order: z.number(),
  createdAt: z.number(),
  grid: GridConfigSchema,
  // Managed background COLOUR only, since schema v23 (SPEC-038 §1, DEC-062):
  // `{ color }` fills the stage with that `#rrggbb` hex colour, `null` was
  // explicitly cleared (bare rock), absent = pre-migration fallback to the
  // starter ref. Background *images* moved to the `backgrounds` subcollection
  // (`MapBackgroundSchema`) — a pre-v23 `{ ref }` is folded out of this field
  // by `foldLegacyMapBackground` before the document is ever parsed here, so a
  // `{ ref }` reaching this schema is a genuine error rather than old data.
  background: z
    .object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
    .nullable()
    .optional(),
  measure: RoomMeasureSchema,
  gridSettings: RoomGridSettingsSchema,
  // Fog of war (per map). Absent = off, which is every map created before fog
  // existed — so this stays optional rather than being backfilled.
  fog: z.object({ enabled: z.boolean() }).optional(),
  // Battle map provenance (SPEC-029 §3, v22). Absent = an ordinary permanent
  // map, which is every map that existed before v22 — optional, never
  // backfilled. Present marks a temporary cut-out that is deleted on Exit and
  // is stripped from every `.vttcamp` archive.
  battle: BattleMapCaptureSchema.optional(),
  // Hex-crawl geometry (SPEC-030 §1, v24). Absent = a square-grid map, which
  // is every map written before v24 — optional, never backfilled. Present is
  // what makes the map's coordinate space axial rather than square-lattice
  // (RULE-006); read it through `mapGridKind`/`isHexMap`.
  hex: HexGridConfigSchema.optional(),
});

export const PlayerSeatSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1),
  seatId: z.string().min(1),
  role: RoleSchema,
  joinedAt: z.number().optional(),
  // The character this seat is currently playing (group ownership, v17).
  // Optional/additive: absent means this seat's own profile.
  currentCharacterSeatId: z.string().min(1).optional(),
  // Last time this seat was observed present (R26.2, v18). Optional/additive:
  // ABSENT MEANS "never observed", which is deliberately NOT the same as
  // "abandoned" — see `abandonedSeatUids`.
  lastPresentAt: z.number().optional(),
});

export const ProfileValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const ProfileInstanceSchema = z.object({
  // The actor this profile belongs to (SPEC-032 §2, v21): a seat id for a
  // character, a token id for a creature. Never stored in the document body —
  // it is the document id, which `profileInstanceConverter` strips on the way
  // out and restores on the way in. Renamed from `seatId` when the key space
  // widened; nothing on disk changed, because the field was never on disk.
  actorId: z.string().min(1),
  // Absent and empty mean the same thing — a seat with no sheet fields filled
  // in. This has to *default* rather than be required, because a profile doc
  // can legitimately be created by a portrait/color write before any field is
  // set (`setProfilePortrait`/`setProfileColor` are `merge: true` patches that
  // carry no `values`). Requiring it made the converter throw on such a doc,
  // which took down the whole `subscribeProfiles` snapshot for every client in
  // the room — so picking a character color before touching the sheet silently
  // broke profiles, dice color included. Defaulting here also heals docs
  // already written in that shape, which a write-side fix alone would not.
  values: z.record(z.string(), ProfileValueSchema).default({}),
  portraitRef: z.string().optional(),
  // Character color (quick-sheet token split) — mirrored onto the owner's
  // Token.color; same `#rrggbb` format as GameMap.background's color.
  color: z.string().regex(HEX_COLOR_RE).optional(),
});

export const StageLayerSchema = z.enum(['background', 'mapping', 'gm', 'tokens', 'fow']);

export const TokenSchema = z.object({
  id: z.string().min(1),
  pos: z.object({ x: z.number(), y: z.number() }),
  size: z.number().positive(),
  layer: StageLayerSchema,
  groupId: z.string().optional(),
  imageRef: z.string().min(1),
  ownerSeatId: z.string().optional(),
  // Background disc color behind imageRef (quick-sheet token split) —
  // independent of the status ring; absent = no custom color.
  color: z.string().regex(HEX_COLOR_RE).optional(),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  memberTokenIds: z.array(z.string()),
  // Group ownership (v17): the player seats that may act as every character in
  // this group. Optional/additive — the referee's own membership is derived
  // from `Room.gmUid`, never stored, so it never appears here.
  memberSeatIds: z.array(z.string()).optional(),
  showMap: z.boolean(),
  showBoard: z.boolean(),
  active: z.boolean(),
  // Collapse-to-one-token (Master Plan v2, R8.4) — all optional/additive, so
  // groups written before v2 (never collapsed) still parse unchanged.
  collapsed: z.boolean().optional(),
  anchorTokenId: z.string().optional(),
  memberOffsets: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
  // Board display order. Additive and optional for the same reason as the
  // collapse fields above: a group written before it still parses, and sorts
  // after every ordered group rather than jumping to the front.
  order: z.number().int().optional(),
});

export const EncounterOrderEntrySchema = z.object({
  refType: EncounterRefTypeSchema,
  refId: z.string().min(1),
  // Whole numbers only: nothing in the app produces a fractional initiative,
  // and a stray float would sort in surprising places.
  init: z.number().int().optional(),
  acted: z.boolean(),
});

export const EncounterSchema = z
  .object({
    mode: EncounterModeSchema,
    round: z.number().int().positive(),
    order: z.array(EncounterOrderEntrySchema),
    currentIndex: z.number().int().nonnegative(),
    callerSeatId: z.string().optional(),
    difficultyDie: z.string().optional(),
    dangerDie: z
      .object({
        value: z.string().optional(),
        clock: z
          .object({ filled: z.number().int().nonnegative(), size: z.number().int().positive() })
          .optional(),
      })
      .optional(),
    // Values for the room's `encounterTemplate` fields, keyed by field id.
    values: z.record(z.string(), ProfileValueSchema).optional(),
    // Refs the referee added directly, so an *ungrouped* token can be in
    // initiative without the mandatory group-building detour. Additive.
    pinnedRefIds: z.array(z.string().min(1)).optional(),
  })
  // `currentIndex` must actually point at a row (or the order is empty) —
  // an out-of-range index used to be a perfectly valid document.
  .refine((e) => e.order.length === 0 || e.currentIndex < e.order.length, {
    message: 'currentIndex must be within order',
    path: ['currentIndex'],
  });

export const DrawingKindSchema = z.enum(['freehand', 'text']);

export const DrawingSchema = z.object({
  id: z.string().min(1),
  layer: StageLayerSchema,
  kind: DrawingKindSchema,
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  style: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const WallStyleSchema = z.enum(['solid', 'masonry', 'natural', 'dashed']);

export const MapSymbolSchema = z.object({
  id: z.string().min(1),
  cell: z.object({ x: z.number().int(), y: z.number().int() }),
  kind: z.string().min(1),
  rotation: z.number(),
  // Footprint in cells, top-left anchored at `cell`. Absent = 1x1 (added
  // schema v11 -> v12 for the dungeon-symbol art pack, which includes
  // multi-cell pieces like 2x2 stair landings and 3x1 table sets).
  cellSpan: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
});

// One placed background image (SPEC-038 §1, v23). Geometry is lattice units as
// floats (RULE-006), so nothing here is `.int()`; `w`/`h` must be positive —
// a zero- or negative-sized rect is not a placement.
export const MapBackgroundSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  order: z.number(),
});

// One painted hex of a hex-crawl map (SPEC-030 §§2–3, v25). The coordinate is
// the document id, so the *stored* document is payload only — `id`/`hex` are
// rebuilt from it on read (`hexTileConverter`), which is why the converter omits
// both rather than parsing them. `terrain`/`contents` are catalog keys, never
// colours or refs, and both are optional: a hex may carry either alone.
export const HexTileSchema = z.object({
  id: z.string().min(1),
  hex: z.object({ q: z.number().int(), r: z.number().int() }),
  terrain: z.string().min(1).optional(),
  contents: z.string().min(1).optional(),
});

export const MapRoomSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string(),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  labelAnchor: z.object({ x: z.number(), y: z.number() }),
  wallStyle: WallStyleSchema,
});

export const LogEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.number(),
  authorUid: z.string().min(1),
  type: z.enum(['system', 'chat', 'roll']),
  text: z.string(),
  resultClass: ResultClassSchema.optional(),
  // Additive pointer at the `Roll` this entry describes (v16) — absent on
  // every pre-v16 entry, which renders from `text` exactly as before.
  rollId: z.string().min(1).optional(),
});

export const AdvantageModeSchema = z.enum(['normal', 'advantage', 'disadvantage']);

export const RolledDieSchema = z.object({
  die: z.string().min(1),
  sides: z.number().int().positive(),
  kept: z.number().int().positive(),
  dropped: z.number().int().positive().optional(),
  // Additive (Master Plan v2, R20.3): summed-mode drop-highest/lowest marks the
  // removed die so the total excludes it and the scene dims it. Absent on every
  // pre-R20 roll, so old docs still parse unchanged.
  poolDropped: z.boolean().optional(),
});

export const RollPartSchema = z.object({
  seatId: z.string().min(1),
  dice: z.array(RolledDieSchema),
  modifier: z.number(),
  advantage: AdvantageModeSchema,
  total: z.number().optional(),
  flags: z.array(ResultClassSchema).optional(),
});

export const RollSchema = z.object({
  id: z.string().min(1),
  ts: z.number(),
  authorUid: z.string().min(1),
  seed: z.string().min(1),
  dice: z.array(RolledDieSchema),
  modifier: z.number(),
  advantage: AdvantageModeSchema,
  mode: RollModeSchema,
  total: z.number().optional(),
  label: z.string().optional(),
  // Additive (Master Plan v2, R3.6) — see `types.ts` `Roll.parts` doc comment
  // for why this needs no migration.
  parts: z.array(RollPartSchema).optional(),
});

export const SharedRollSlotSchema = z.object({
  die: z.string().min(1),
  modifier: z.number(),
  advantage: AdvantageModeSchema,
  ready: z.boolean(),
});

export const SharedRollStatusSchema = z.enum(['staging', 'resolved']);

export const SharedRollSchema = z.object({
  status: SharedRollStatusSchema,
  label: z.string().optional(),
  // Marks a Call for Initiative (v16). Additive: absent = ordinary shared
  // roll, which keeps the explicit Apply-to-initiative tap.
  kind: z.literal('initiative').optional(),
  openedBy: z.string().min(1),
  slots: z.record(z.string(), SharedRollSlotSchema),
});

/** The Firestore-storage split of `SharedRollSchema`: `rooms/{roomId}/
 * sharedRoll/current` holds everything but `slots`, which lives in a
 * `slots/{slotId}` subcollection instead — so a player's own-slot-or-GM
 * write only ever touches their own doc (mirrors `players/{uid}`), rather
 * than needing map-diff Security Rules against a single shared doc. */
export const SharedRollMetaSchema = SharedRollSchema.omit({ slots: true });

export const DiceMacroSchema = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  name: z.string().min(1),
  dice: z.array(z.string().min(1)),
  modifier: z.number(),
  mode: RollModeSchema,
  advantage: AdvantageModeSchema,
});

export const RandomTableSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  rows: z.array(z.string()),
});

/** Blind Drawer result stored under gmPrivate (Plan §7 Phase 4). `passthrough`
 * keeps any extra gmPrivate fields intact; the `kind` literal is what
 * `subscribeBlindDraws` filters gmPrivate docs by. */
export const BlindDrawSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('blindDraw'),
    ts: z.number(),
    authorUid: z.string().min(1),
    title: z.string(),
    text: z.string(),
    seed: z.string().optional(),
    dice: z.array(RolledDieSchema).optional(),
    revealed: z.boolean(),
  })
  .passthrough();

/** GM handout library entry stored under gmPrivate (Plan §7 Phase 5). Same
 * `kind`-discriminated + `passthrough` shape as `BlindDrawSchema` above, so
 * `subscribeHandoutLibrary` can filter the shared gmPrivate collection. */
export const HandoutRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('handout'),
    ts: z.number(),
    title: z.string(),
    ref: z.string().min(1),
    revealed: z.boolean(),
  })
  .passthrough();

/** The Assets activity's saved-URL list (Master Plan v2, R7.2). */
export const AssetRefSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  label: z.string().optional(),
  addedBy: z.string().min(1),
  ts: z.number(),
});

// ---- Vector Map System (WI-B storage boundary) ----
//
// Firestore-boundary validation for the WI-A vector-map primitives
// (`map/vector/types.ts`): `FloorRegion`, the wall `Segment`, and the overlay
// `Door`. Distinct from the cellular `MapWall`/`SightWall`/`CircleWall`/
// `MapDoor` schemas above — the two systems coexisted during the POC replacement
// (SPEC/DECISIONS in `docs/VTT_Master_Plan.md` (Part II §2, Part V §2)).
// Structural validation only; it never
// inspects coordinate values for game meaning (Plan hard rule, §2.5). All
// coordinates are lattice units, floats (SPEC §2.0).

/** A lattice-space point (SPEC §2.0). */
export const VectorPointSchema = z.object({ x: z.number(), y: z.number() });

/** A closed ring of lattice points (SPEC §2.1). */
export const VectorRingSchema = z.array(VectorPointSchema);

/** Derived, recomputed-every-commit bounding range (SPEC §2.1). */
export const VectorBBoxSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number(),
});

/**
 * A baked-union floor region (SPEC §2.1, Model A). `rings[0]` is the outer
 * boundary, `rings[1..]` are holes; the primitive that produced it is not
 * persisted. `bbox` is denormalized for spatial queries. This is the *model*
 * shape (`rings: Point[][]`, matching the WI-A `FloorRegion` type).
 */
export const VectorFloorRegionSchema = z.object({
  id: z.string().min(1),
  rings: z.array(VectorRingSchema),
  bbox: VectorBBoxSchema,
});

/**
 * The *stored* floor-region shape (Firestore document body). Firestore forbids
 * nested arrays (an array directly containing another array), so the model's
 * `rings: Point[][]` cannot be written as-is — each ring is wrapped in an
 * object (`{ points: Point[] }`), making `rings` an array of maps instead of an
 * array of arrays. The converter transforms to/from the model shape; this is a
 * permanent Firestore constraint, not a coexistence crutch, so it survives the
 * WI-D pure rollout (see DECISIONS B6). The RTDB draft and MemoryStore keep the
 * model shape — only the Firestore boundary wraps.
 */
export const VectorStoredFloorRegionSchema = z.object({
  rings: z.array(z.object({ points: VectorRingSchema })),
  bbox: VectorBBoxSchema,
});

export const WallSourceSchema = z.enum(['perimeter', 'explicit', 'imported']);

/**
 * The single wall primitive (SPEC §3.1) as stored. Only `explicit`/`imported`
 * segments are persisted — `perimeter` segments are derived at build time and
 * never written (SPEC §3.1) — but `source` is kept on the doc so an imported
 * wall stays distinguishable. `blocksSight`/`blocksMovement` decouple LoS from
 * passage.
 */
export const VectorWallSchema = z.object({
  id: z.string().min(1),
  a: VectorPointSchema,
  b: VectorPointSchema,
  source: WallSourceSchema,
  blocksSight: z.boolean(),
  blocksMovement: z.boolean(),
});

export const VectorDoorTypeSchema = z.enum([
  'single',
  'double',
  'secret',
  'trapped',
  'oneWay',
  'barred',
]);
export const VectorDoorStateSchema = z.enum(['open', 'closed']);
export const VectorDoorFacingSchema = z.enum(['a', 'b']);

/**
 * A geometry-anchored overlay door (SPEC §3.2) — free endpoints on the floating
 * layer, no durable wall attachment. Distinct from the cellular `MapDoor`
 * (which is edge-attached and carries `facing: 'ab'|'ba'`); a vector door owns
 * its own `{a,b}` span and faces one of its two endpoints.
 */
export const VectorDoorSchema = z.object({
  id: z.string().min(1),
  a: VectorPointSchema,
  b: VectorPointSchema,
  type: VectorDoorTypeSchema,
  state: VectorDoorStateSchema,
  facing: VectorDoorFacingSchema.optional(),
  // Which door-art asset to render (a kind id from the door art catalog).
  // Purely a display choice, independent of `type` (which still drives
  // LoS/secret-visibility semantics) — absent falls back to a default art
  // piece keyed off `type`. Added schema v11 -> v12.
  art: z.string().min(1).optional(),
});
