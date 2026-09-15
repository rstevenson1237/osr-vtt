import { describe, expect, it } from 'vitest';
import { axialToPixel, pixelToAxial } from './hex/axial.js';
import { snapModeFromModifiers, snapTokenPosition } from './snap.js';

describe('snapModeFromModifiers (Master Plan v2, R9.7)', () => {
  it('plain drop uses the base mode (cell by default)', () => {
    expect(snapModeFromModifiers(false, false)).toBe('cell');
    expect(snapModeFromModifiers(false, false, 'half')).toBe('half');
  });

  it('Alt forces half-grid; Alt+Shift is free; Shift alone is ignored', () => {
    expect(snapModeFromModifiers(true, false)).toBe('half');
    expect(snapModeFromModifiers(true, true)).toBe('free');
    expect(snapModeFromModifiers(false, true)).toBe('cell');
  });

  it('Alt is ignored under a hex base — no half-grid on a hex map (SPEC-047 §15)', () => {
    expect(snapModeFromModifiers(true, false, 'hex')).toBe('hex');
    expect(snapModeFromModifiers(true, true, 'hex')).toBe('free');
  });
});

describe('snapTokenPosition (Master Plan v2, R9.7)', () => {
  const cellSize = 70;

  it('cell mode snaps a 1×1 to the nearest cell center', () => {
    expect(snapTokenPosition({ x: 100, y: 100 }, cellSize, 1, 'cell')).toEqual({ x: 105, y: 105 });
  });

  it('cell mode snaps a 2×2 to a grid intersection so it covers whole cells', () => {
    // A 2×2 centered on the corner between cells 0..1 covers exactly cells 0,1
    // on each axis (leading edge lands on the grid line).
    expect(snapTokenPosition({ x: 100, y: 100 }, cellSize, 2, 'cell')).toEqual({ x: 70, y: 70 });
  });

  it('half mode lands on the half-grid where cell mode would round to a cell center', () => {
    // (75,75): cell mode rounds to the cell-1 center (105); half mode keeps the
    // in-between position on the grid line at 70.
    expect(snapTokenPosition({ x: 75, y: 75 }, cellSize, 1, 'cell')).toEqual({ x: 105, y: 105 });
    expect(snapTokenPosition({ x: 75, y: 75 }, cellSize, 1, 'half')).toEqual({ x: 70, y: 70 });
  });

  it('free mode returns the raw position untouched', () => {
    expect(snapTokenPosition({ x: 123, y: 45 }, cellSize, 1, 'free')).toEqual({ x: 123, y: 45 });
  });
});

describe('snapTokenPosition — hex mode (SPEC-047 §15)', () => {
  const hexSize = 40;

  it('snaps to the centre of the hex under the pointer via pixelToAxial/axialToPixel', () => {
    const hex = { q: 2, r: -1 };
    const centre = axialToPixel(hex, hexSize);
    const nearby = { x: centre.x + 5, y: centre.y - 3 };
    expect(snapTokenPosition(nearby, 70, 1, 'hex', hexSize)).toEqual(centre);
    expect(pixelToAxial(snapTokenPosition(nearby, 70, 1, 'hex', hexSize), hexSize)).toEqual(hex);
  });

  it('centres on the same hex regardless of token size — a larger token overflows (DEC-094)', () => {
    const hex = { q: 0, r: 0 };
    const centre = axialToPixel(hex, hexSize);
    const pos = { x: centre.x + 2, y: centre.y + 2 };
    expect(snapTokenPosition(pos, 70, 1, 'hex', hexSize)).toEqual(
      snapTokenPosition(pos, 70, 3, 'hex', hexSize),
    );
  });
});
