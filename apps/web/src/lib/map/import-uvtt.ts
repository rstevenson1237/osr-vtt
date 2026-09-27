import {
  DEFAULT_GRID_CONFIG,
  parseUvtt,
  type CampaignStore,
  type StoredVectorWall,
} from '@osr-vtt/shared';
import { nextVectorId } from './vector-tools';

/**
 * Wall writes per `setWalls` call. Firestore caps one batch at 500 writes; an
 * exported dungeon easily has more wall steps than that, so a large file lands
 * as several batches of the existing method rather than one oversize commit.
 */
export const UVTT_WALL_BATCH = 400;

/** A map name from the file name: extension dropped, never empty. */
export function uvttMapName(fileName: string): string {
  return fileName.replace(/\.(dd2vtt|uvtt|df2vtt|json)$/i, '').trim() || 'Imported map';
}

/**
 * Imports a Universal VTT file as a **new square-grid map** (SPEC-056 §8,
 * DEC-112) and resolves to its id. The file is parsed in full before anything
 * is written, so a file that fails to parse throws `UvttParseError` and writes
 * nothing. Every write is an existing store method: `createMap`,
 * `setMapGridDimensions` (the file's size, the default cell size — the file's
 * `pixels_per_grid` is never stored, RULE-006), `setWalls` in batches, and
 * one `setDoor` per portal. The new map is not made active.
 */
export async function importUvttMap(
  store: CampaignStore,
  roomId: string,
  name: string,
  text: string,
): Promise<string> {
  const parsed = parseUvtt(text);
  const mapId = await store.createMap(roomId, { name, gridKind: 'square' });
  await store.setMapGridDimensions(roomId, mapId, {
    ...parsed.grid,
    cellSize: DEFAULT_GRID_CONFIG.cellSize,
  });
  const walls: StoredVectorWall[] = parsed.walls.map((w) => ({ ...w, id: nextVectorId('wall') }));
  for (let i = 0; i < walls.length; i += UVTT_WALL_BATCH)
    await store.setWalls(roomId, mapId, walls.slice(i, i + UVTT_WALL_BATCH));
  for (const door of parsed.doors) await store.setDoor(roomId, mapId, door);
  return mapId;
}
