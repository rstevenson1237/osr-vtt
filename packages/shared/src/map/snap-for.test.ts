import { describe, expect, it } from 'vitest';
import { snapTokenPosition, type SnapMode } from './snap.js';
import { snapPoint, type VectorSnapMode, type VertexAttraction } from './vector/snap.js';
import { snapFor } from './snap-for.js';

// SPEC-055 §4 — `snapFor` must dispatch to byte-identical output as calling
// `snapTokenPosition`/`snapPoint` directly, for every mode on both a square
// and a hex map, before any caller switches over to it.

describe('snapFor (kind: token) matches snapTokenPosition', () => {
  const cellSize = 70;
  const hexSize = 48;
  const point = { x: 103, y: 61 };
  const modes: SnapMode[] = ['cell', 'half', 'hex', 'free'];

  it.each(modes)('mode %s, size 1, square map (no hexSize)', (mode) => {
    expect(snapFor('token', mode, point, { cellSize, size: 1 })).toEqual(
      snapTokenPosition(point, cellSize, 1, mode),
    );
  });

  it.each(modes)('mode %s, size 2, square map (no hexSize)', (mode) => {
    expect(snapFor('token', mode, point, { cellSize, size: 2 })).toEqual(
      snapTokenPosition(point, cellSize, 2, mode),
    );
  });

  it.each(modes)('mode %s, hex map (hexSize set)', (mode) => {
    expect(snapFor('token', mode, point, { cellSize, size: 1, hexSize })).toEqual(
      snapTokenPosition(point, cellSize, 1, mode, hexSize),
    );
  });
});

describe('snapFor (kind: tool) matches snapPoint', () => {
  const point = { x: 3.2, y: -1.7 };
  const modes: VectorSnapMode[] = ['free', 'full', 'half', 'hex'];
  const attract: VertexAttraction = { vertices: [{ x: 3, y: -2 }], radius: 1 };

  it.each(modes)('mode %s, no attraction', (mode) => {
    expect(snapFor('tool', mode, point)).toEqual(snapPoint(point, mode));
  });

  it.each(modes)('mode %s, with vertex attraction', (mode) => {
    expect(snapFor('tool', mode, point, { attract })).toEqual(snapPoint(point, mode, attract));
  });
});
