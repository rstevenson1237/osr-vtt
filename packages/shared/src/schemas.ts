import { z } from 'zod';
import { WORDS_PER_CHUNK } from './map/grid.js';

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

export const RoomSettingsSchema = z.object({
  theme: z.string().min(1),
  measure: RoomMeasureSchema,
  grid: RoomGridSettingsSchema,
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
  grid: GridConfigSchema,
  fog: RoomFogSchema,
  handout: HandoutStateSchema,
  settings: RoomSettingsSchema,
});

export const PlayerSeatSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1),
  seatId: z.string().min(1),
  role: RoleSchema,
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
      clock: z.object({ filled: z.number().int().nonnegative(), size: z.number().int().positive() }).optional(),
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

// ---- cellular map model (Map Tooling Spec §7) ----

const ChunkBitsSchema = z.array(z.number().int()).length(WORDS_PER_CHUNK);

export const FloorChunkSchema = z.object({
  id: z.string().min(1),
  bits: ChunkBitsSchema,
});

export const FogChunkSchema = z.object({
  id: z.string().min(1),
  bits: ChunkBitsSchema,
});

export const EdgeSideSchema = z.enum(['N', 'E', 'S', 'W']);
export const DoorStateSchema = z.enum(['open', 'closed']);

export const MapDoorSchema = z.object({
  state: DoorStateSchema,
  secret: z.boolean(),
});

export const MapWallSchema = z.object({
  id: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  side: EdgeSideSchema,
  door: MapDoorSchema.optional(),
});

export const WallStyleSchema = z.enum(['masonry', 'natural']);

export const SightWallSchema = z.object({
  id: z.string().min(1),
  ax: z.number(),
  ay: z.number(),
  bx: z.number(),
  by: z.number(),
  door: MapDoorSchema.optional(),
  visible: z.boolean().optional(),
  style: WallStyleSchema.optional(),
});

export const MapLightSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  range: z.number().nonnegative(),
  intensity: z.number().optional(),
  color: z.string().optional(),
});

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
