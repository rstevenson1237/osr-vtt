import { z } from 'zod';
import type { MapLight, SightWall } from '../types.js';

/**
 * Universal VTT import (`.uvtt` / `.dd2vtt` / `.df2vtt`) — Plan §7 Phase 4,
 * Map Tooling Spec §6. These files (DungeonDraft, Dungeondraft, etc.) carry
 * line-of-sight polylines, door "portals", and light sources in *grid units*.
 * We convert geometry to pixel space (× cellSize) and hand back store-shaped
 * `SightWall` / `MapLight` records the importer commits via the CampaignStore.
 *
 * The embedded background image (`image`, base64) is intentionally ignored —
 * v1 is card-free with bundled/URL assets only (Plan §6); we import the
 * vision geometry, not the art.
 */

const PointSchema = z.object({ x: z.number(), y: z.number() });

const UvttSchema = z.object({
  format: z.number().optional(),
  resolution: z
    .object({
      map_origin: PointSchema.optional(),
      map_size: PointSchema.optional(),
      pixels_per_grid: z.number().positive().optional(),
    })
    .optional(),
  line_of_sight: z.array(z.array(PointSchema)).optional(),
  objects_line_of_sight: z.array(z.array(PointSchema)).optional(),
  portals: z
    .array(
      z.object({
        position: PointSchema.optional(),
        bounds: z.array(PointSchema),
        closed: z.boolean().optional(),
        // present in some exports; unused here but tolerated
        rotation: z.number().optional(),
        freestanding: z.boolean().optional(),
      }),
    )
    .optional(),
  lights: z
    .array(
      z.object({
        position: PointSchema,
        range: z.number().optional(),
        intensity: z.number().optional(),
        color: z.string().optional(),
      }),
    )
    .optional(),
});

export type UvttFile = z.infer<typeof UvttSchema>;

export interface UvttImportResult {
  grid: { w: number; h: number };
  /** Pixels-per-cell used to convert grid-unit geometry to pixel space. */
  cellSize: number;
  /** Vision-blocking walls + door portals, in pixel space, sans Firestore id. */
  walls: Array<Omit<SightWall, 'id'>>;
  lights: Array<Omit<MapLight, 'id'>>;
}

export class UvttParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UvttParseError';
  }
}

/** Parses `.uvtt`/`.dd2vtt` JSON (string or object) into store-shaped records. */
export function parseUvtt(raw: unknown, opts?: { cellSize?: number }): UvttImportResult {
  let json: unknown = raw;
  if (typeof raw === 'string') {
    try {
      json = JSON.parse(raw);
    } catch (err) {
      throw new UvttParseError(`Not valid JSON: ${(err as Error).message}`);
    }
  }
  const parsed = UvttSchema.safeParse(json);
  if (!parsed.success) {
    throw new UvttParseError(`Not a recognizable .uvtt file: ${parsed.error.issues[0]?.message ?? ''}`);
  }
  const file = parsed.data;

  const ppg = file.resolution?.pixels_per_grid ?? 70;
  const cellSize = opts?.cellSize ?? ppg;
  const size = file.resolution?.map_size ?? { x: 0, y: 0 };
  const grid = { w: Math.max(0, Math.round(size.x)), h: Math.max(0, Math.round(size.y)) };

  const walls: Array<Omit<SightWall, 'id'>> = [];

  const pushPolylines = (polylines: { x: number; y: number }[][] | undefined): void => {
    for (const line of polylines ?? []) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i]!;
        const b = line[i + 1]!;
        walls.push({
          ax: a.x * cellSize,
          ay: a.y * cellSize,
          bx: b.x * cellSize,
          by: b.y * cellSize,
        });
      }
    }
  };
  pushPolylines(file.line_of_sight);
  pushPolylines(file.objects_line_of_sight);

  for (const portal of file.portals ?? []) {
    const [a, b] = portal.bounds;
    if (!a || !b) continue;
    walls.push({
      ax: a.x * cellSize,
      ay: a.y * cellSize,
      bx: b.x * cellSize,
      by: b.y * cellSize,
      // `closed` (default true) → the door blocks sight; open portals pass it.
      // Imported portals are plain single doors (Master Plan v2, R11.1).
      door: { type: 'single', state: portal.closed === false ? 'open' : 'closed' },
    });
  }

  const lights: Array<Omit<MapLight, 'id'>> = (file.lights ?? []).map((light) => ({
    x: light.position.x * cellSize,
    y: light.position.y * cellSize,
    range: (light.range ?? 0) * cellSize,
    ...(light.intensity !== undefined ? { intensity: light.intensity } : {}),
    ...(light.color ? { color: light.color } : {}),
  }));

  return { grid, cellSize, walls, lights };
}
