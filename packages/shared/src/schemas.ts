import { z } from 'zod';

/**
 * Zod schemas mirroring `types.ts`. Used by the Firestore converters (§8.2)
 * to validate documents at the read/write boundary — the only place
 * validation happens. This is structural validation only; it never inspects
 * *values* for game meaning (Plan hard rule, §2.5).
 */

export const RoleSchema = z.enum(['gm', 'player', 'viewer']);

export const ProfileFieldTypeSchema = z.enum([
  'text',
  'longtext',
  'number',
  'counter',
  'checkbox',
  'roll',
]);

export const ProfileTemplateFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: ProfileFieldTypeSchema,
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  // Encounter Board v2 (Master Plan v2, R8.1) — optional/additive, so older
  // room docs (no `pinned` on any field) still parse unchanged.
  pinned: z.boolean().optional(),
});

export const GridConfigSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  cellSize: z.number().positive(),
});

export const FogModeSchema = z.enum(['emergent', 'manual', 'dynamic']);

export const RoomFogSchema = z.object({ mode: FogModeSchema });

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

// Session-wide only — per-map settings moved to `GameMapSchema` below
// (v10->v11 multi-map migration).
export const RoomSettingsSchema = z.object({
  theme: z.string().min(1),
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  gmUid: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  difficultyDie: z.string(),
  dangerDie: z.string(),
  createdAt: z.number(),
  profileTemplate: z.array(ProfileTemplateFieldSchema),
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
  fog: RoomFogSchema,
  // Managed background (R15/WI-19): `{ ref }` renders that image, `null` was
  // explicitly cleared (bare rock), absent = pre-migration fallback to the
  // starter ref.
  background: z
    .object({ ref: z.string().min(1) })
    .nullable()
    .optional(),
  measure: RoomMeasureSchema,
  gridSettings: RoomGridSettingsSchema,
});

export const PlayerSeatSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1),
  seatId: z.string().min(1),
  role: RoleSchema,
  joinedAt: z.number().optional(),
});

export const ProfileValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const ProfileInstanceSchema = z.object({
  seatId: z.string().min(1),
  values: z.record(z.string(), ProfileValueSchema),
  portraitRef: z.string().optional(),
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
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  memberTokenIds: z.array(z.string()),
  showMap: z.boolean(),
  showBoard: z.boolean(),
  active: z.boolean(),
  // Collapse-to-one-token (Master Plan v2, R8.4) — all optional/additive, so
  // groups written before v2 (never collapsed) still parse unchanged.
  collapsed: z.boolean().optional(),
  anchorTokenId: z.string().optional(),
  memberOffsets: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
});

export const EncounterModeSchema = z.enum(['side', 'individual', 'free']);
export const EncounterRefTypeSchema = z.enum(['side', 'actor']);

export const EncounterOrderEntrySchema = z.object({
  refType: EncounterRefTypeSchema,
  refId: z.string().min(1),
  init: z.number().optional(),
  acted: z.boolean(),
});

export const EncounterSchema = z.object({
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
});

export const MapRoomSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string(),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  labelAnchor: z.object({ x: z.number(), y: z.number() }),
  wallStyle: WallStyleSchema,
});

export const ResultClassSchema = z.enum(['success', 'complication', 'failure']);

export const LogEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.number(),
  authorUid: z.string().min(1),
  type: z.enum(['system', 'chat', 'roll']),
  text: z.string(),
  resultClass: ResultClassSchema.optional(),
});

export const RollModeSchema = z.enum(['summed', 'separate']);
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
// `MapDoor` schemas above — the two systems coexist during the POC replacement
// (SPEC/DECISIONS in `poc/vector-floor/`). Structural validation only; it never
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
});
