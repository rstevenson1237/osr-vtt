import type { Door, Point, Segment } from '../map/vector/types.js';

/**
 * Universal VTT (`.dd2vtt` / `.uvtt`) import — the pure half (SPEC-056 §8,
 * DEC-112). Turns a file's text into what a **new square-grid map** holds:
 * grid dimensions, `imported` walls and doors. Nothing here touches a store;
 * the caller writes the result through existing store methods.
 *
 * **Coordinates (RULE-006).** UVTT points are already in grid units, so a
 * lattice point is `point − resolution.map_origin`, kept as a float.
 * `pixels_per_grid` is never read — a pixel is never stored. The embedded
 * `image`, `lights` and `environment` are ignored silently.
 *
 * A file that fails any check throws `UvttParseError` and yields nothing, so
 * a malformed import writes nothing.
 */

export class UvttParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UvttParseError';
  }
}

export interface UvttImport {
  /** Whole cells, at least 1×1 — `resolution.map_size` rounded up. */
  grid: { w: number; h: number };
  /** `line_of_sight` + `objects_line_of_sight`, one segment per polyline
   * step, each `source: 'imported'` and blocking both sight and movement. */
  walls: Segment[];
  /** `portals`: `bounds[0]`/`bounds[1]` → `a`/`b`, `closed` → state. */
  doors: Omit<Door, 'id'>[];
}

function fail(message: string): never {
  throw new UvttParseError(message);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readPoint(v: unknown, where: string): Point {
  if (!isRecord(v)) fail(`${where} is not a point.`);
  const { x, y } = v;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
    fail(`${where} has a non-numeric coordinate.`);
  return { x, y };
}

function readPolylines(v: unknown, key: string): Point[][] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(`"${key}" is not a list.`);
  return v.map((line, i) => {
    if (!Array.isArray(line)) fail(`"${key}"[${i}] is not a list of points.`);
    return line.map((p, j) => readPoint(p, `"${key}"[${i}][${j}]`));
  });
}

/** Parses a Universal VTT file's text (or already-parsed JSON). */
export function parseUvtt(input: unknown): UvttImport {
  let doc: unknown = input;
  if (typeof input === 'string') {
    try {
      doc = JSON.parse(input);
    } catch {
      fail('The file is not valid JSON.');
    }
  }
  if (!isRecord(doc)) fail('The file is not a Universal VTT map.');

  const resolution = doc['resolution'];
  if (!isRecord(resolution)) fail('The file has no "resolution" — not a Universal VTT map.');
  const size = readPoint(resolution['map_size'], '"resolution.map_size"');
  if (size.x <= 0 || size.y <= 0) fail('"resolution.map_size" must be positive.');
  const origin =
    resolution['map_origin'] === undefined
      ? { x: 0, y: 0 }
      : readPoint(resolution['map_origin'], '"resolution.map_origin"');
  const toLattice = (p: Point): Point => ({ x: p.x - origin.x, y: p.y - origin.y });

  const walls: Segment[] = [];
  const lines = [
    ...readPolylines(doc['line_of_sight'], 'line_of_sight'),
    ...readPolylines(doc['objects_line_of_sight'], 'objects_line_of_sight'),
  ];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = toLattice(line[i]!);
      const b = toLattice(line[i + 1]!);
      if (a.x === b.x && a.y === b.y) continue; // zero-length step: nothing to block
      walls.push({ a, b, source: 'imported', blocksSight: true, blocksMovement: true });
    }
  }

  const doors: Omit<Door, 'id'>[] = [];
  const portals = doc['portals'];
  if (portals !== undefined) {
    if (!Array.isArray(portals)) fail('"portals" is not a list.');
    portals.forEach((portal, i) => {
      if (!isRecord(portal)) fail(`"portals"[${i}] is not an object.`);
      const bounds = portal['bounds'];
      if (!Array.isArray(bounds) || bounds.length < 2)
        fail(`"portals"[${i}].bounds needs two points.`);
      const a = toLattice(readPoint(bounds[0], `"portals"[${i}].bounds[0]`));
      const b = toLattice(readPoint(bounds[1], `"portals"[${i}].bounds[1]`));
      doors.push({ a, b, type: 'single', state: portal['closed'] === false ? 'open' : 'closed' });
    });
  }

  return {
    grid: { w: Math.max(1, Math.ceil(size.x)), h: Math.max(1, Math.ceil(size.y)) },
    walls,
    doors,
  };
}
