import { describe, expect, it } from 'vitest';
import { parseUvtt, UvttParseError } from './uvtt.js';

const SAMPLE = {
  format: 0.3,
  resolution: {
    map_origin: { x: 0, y: 0 },
    map_size: { x: 10, y: 8 },
    pixels_per_grid: 70,
  },
  line_of_sight: [
    [
      { x: 5, y: 0 },
      { x: 5, y: 3 },
      { x: 7, y: 3 },
    ],
  ],
  portals: [
    {
      position: { x: 5, y: 3.5 },
      bounds: [
        { x: 5, y: 3 },
        { x: 5, y: 4 },
      ],
      closed: true,
      freestanding: false,
    },
    {
      position: { x: 2, y: 2 },
      bounds: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      closed: false,
    },
  ],
  lights: [{ position: { x: 2, y: 2 }, range: 4, intensity: 1, color: 'ffd9a0' }],
};

describe('parseUvtt', () => {
  it('splits line_of_sight polylines into per-segment walls (pixel space)', () => {
    const result = parseUvtt(SAMPLE, { cellSize: 70 });
    // A 3-point polyline → 2 segments; + 2 portals = 4 walls total.
    expect(result.walls).toHaveLength(4);
    expect(result.walls[0]).toMatchObject({ ax: 350, ay: 0, bx: 350, by: 210 });
    expect(result.walls[1]).toMatchObject({ ax: 350, ay: 210, bx: 490, by: 210 });
  });

  it('maps portals to doors (closed blocks, open passes)', () => {
    const result = parseUvtt(SAMPLE, { cellSize: 70 });
    const doors = result.walls.filter((w) => w.door);
    expect(doors).toHaveLength(2);
    expect(doors.find((d) => d.door?.state === 'closed')).toBeTruthy();
    expect(doors.find((d) => d.door?.state === 'open')).toBeTruthy();
  });

  it('converts lights to pixel space, preserving color/intensity', () => {
    const result = parseUvtt(SAMPLE, { cellSize: 70 });
    expect(result.lights).toHaveLength(1);
    expect(result.lights[0]).toEqual({ x: 140, y: 140, range: 280, intensity: 1, color: 'ffd9a0' });
  });

  it('reports the grid size', () => {
    const result = parseUvtt(SAMPLE, { cellSize: 70 });
    expect(result.grid).toEqual({ w: 10, h: 8 });
  });

  it('accepts a JSON string and defaults cellSize to pixels_per_grid', () => {
    const result = parseUvtt(JSON.stringify(SAMPLE));
    expect(result.cellSize).toBe(70);
    expect(result.walls[0]).toMatchObject({ ax: 350 });
  });

  it('throws on non-JSON input', () => {
    expect(() => parseUvtt('not json {')).toThrow(UvttParseError);
  });

  it('tolerates a minimal file with no walls or lights', () => {
    const result = parseUvtt({ resolution: { map_size: { x: 3, y: 3 } } });
    expect(result.walls).toEqual([]);
    expect(result.lights).toEqual([]);
    expect(result.grid).toEqual({ w: 3, h: 3 });
  });
});
