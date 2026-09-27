import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUvtt, UvttParseError } from './uvtt.js';

/**
 * Universal VTT import (SPEC-056 §8, DEC-112) — the pure parser, against the
 * bundled `sample-dungeon.dd2vtt` fixture and hand-built edge cases.
 */

const SAMPLE = readFileSync(
  fileURLToPath(
    new URL('../../../../apps/web/public/assets/maps/sample-dungeon.dd2vtt', import.meta.url),
  ),
  'utf8',
);

describe('parseUvtt — the bundled sample', () => {
  const out = parseUvtt(SAMPLE);

  it('sizes the grid from resolution.map_size', () => {
    expect(out.grid).toEqual({ w: 10, h: 10 });
  });

  it('turns line_of_sight into imported walls in lattice units', () => {
    expect(out.walls).toEqual([
      {
        a: { x: 5, y: 0 },
        b: { x: 5, y: 7 },
        source: 'imported',
        blocksSight: true,
        blocksMovement: true,
      },
    ]);
  });

  it('turns portals into doors, bounds → a/b, closed → state', () => {
    expect(out.doors).toEqual([
      { a: { x: 5, y: 7 }, b: { x: 5, y: 8 }, type: 'single', state: 'closed' },
    ]);
  });

  it('ignores lights, the image and pixels_per_grid', () => {
    // 70 px/grid in the file: nothing in the output is scaled by it.
    const flat = JSON.stringify(out);
    expect(flat).not.toContain('70');
    expect(Object.keys(out).sort()).toEqual(['doors', 'grid', 'walls']);
  });
});

describe('parseUvtt — conversion', () => {
  const base = {
    format: 0.3,
    resolution: { map_origin: { x: 2, y: -1 }, map_size: { x: 4.5, y: 3 }, pixels_per_grid: 256 },
  };

  it('subtracts map_origin and keeps floats', () => {
    const out = parseUvtt({
      ...base,
      line_of_sight: [
        [
          { x: 2.25, y: -1 },
          { x: 3.5, y: 0.5 },
          { x: 3.5, y: 0.5 },
          { x: 6, y: 1 },
        ],
      ],
      objects_line_of_sight: [
        [
          { x: 4, y: 0 },
          { x: 4, y: 1 },
        ],
      ],
      portals: [
        {
          bounds: [
            { x: 3, y: 0 },
            { x: 4, y: 0 },
          ],
          closed: false,
        },
      ],
    });
    // Fractional map size rounds up to whole cells.
    expect(out.grid).toEqual({ w: 5, h: 3 });
    // A polyline of n points is n−1 segments; the zero-length step is dropped.
    expect(out.walls.map((w) => [w.a, w.b])).toEqual([
      [
        { x: 0.25, y: 0 },
        { x: 1.5, y: 1.5 },
      ],
      [
        { x: 1.5, y: 1.5 },
        { x: 4, y: 2 },
      ],
      [
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
    ]);
    expect(out.doors).toEqual([
      { a: { x: 1, y: 1 }, b: { x: 2, y: 1 }, type: 'single', state: 'open' },
    ]);
  });

  it('treats absent collections and origin as empty / 0,0', () => {
    const out = parseUvtt({ resolution: { map_size: { x: 1, y: 1 } } });
    expect(out).toEqual({ grid: { w: 1, h: 1 }, walls: [], doors: [] });
  });
});

describe('parseUvtt — rejection', () => {
  const cases: [string, unknown][] = [
    ['not JSON', '{ nope'],
    ['not an object', '[1, 2]'],
    ['no resolution', { line_of_sight: [] }],
    ['no map_size', { resolution: {} }],
    ['a zero map_size', { resolution: { map_size: { x: 0, y: 4 } } }],
    [
      'a non-numeric wall point',
      { resolution: { map_size: { x: 4, y: 4 } }, line_of_sight: [[{ x: 1, y: 'a' }]] },
    ],
    ['line_of_sight not a list', { resolution: { map_size: { x: 4, y: 4 } }, line_of_sight: {} }],
    [
      'a portal with one bound',
      { resolution: { map_size: { x: 4, y: 4 } }, portals: [{ bounds: [{ x: 1, y: 1 }] }] },
    ],
  ];

  it.each(cases)('rejects %s', (_label, input) => {
    expect(() => parseUvtt(input)).toThrow(UvttParseError);
  });
});
