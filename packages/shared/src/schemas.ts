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

export const StageLayerSchema = z.enum(['background', 'gm', 'tokens', 'fow']);

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

export const DrawingKindSchema = z.enum(['line', 'rect', 'ellipse', 'wall', 'door', 'text']);

export const DrawingSchema = z.object({
  id: z.string().min(1),
  layer: StageLayerSchema,
  kind: DrawingKindSchema,
  points: z.array(z.object({ x: z.number(), y: z.number() })),
  style: z.record(z.string(), z.union([z.string(), z.number()])),
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

export const RollSchema = z.object({
  id: z.string().min(1),
  ts: z.number(),
  authorUid: z.string().min(1),
  seed: z.string().min(1),
  params: z.object({ die: z.string(), count: z.number().int().positive() }),
  dice: z.array(z.number()),
  mode: RollModeSchema,
  results: z.array(z.number()),
});

export const RandomTableSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  rows: z.array(z.string()),
});
