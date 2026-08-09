import { describe, expect, it } from 'vitest';
import type { MapTheme } from '../theme/map-theme';
import { snapCursorColors } from './vector-engine';

const THEME: MapTheme = {
  rock: 0x1c1712,
  floor: 0xe8ddc4,
  wall: 0x14110d,
  door: 0x7a5230,
  secretDoor: 0xb04a4a,
  doorHazard: 0xd06a2f,
  doorOneWay: 0xf2c98a,
  fog: 0x0a0806,
  grid: 0x000000,
  selection: 0xffcc66,
  ping: 0xff5533,
  rulerText: 0xffffff,
  battleCapture: 0x4fd6c0,
};

describe('snapCursorColors', () => {
  it('paints the carve-floor dot in the theme floor color', () => {
    expect(snapCursorColors(THEME, 'floor', null).fill).toBe(THEME.floor);
  });

  it('paints the carve-rock dot in the theme rock color', () => {
    expect(snapCursorColors(THEME, 'rock', null).fill).toBe(THEME.rock);
  });

  it('keeps selection yellow for the non-carving snap tools (Wall/Door)', () => {
    expect(snapCursorColors(THEME, 'select', null).fill).toBe(THEME.selection);
  });

  it('tracks a map background color override for the rock dot', () => {
    // A map may set a solid `GameMap.background` color, which replaces
    // theme.rock as the visible backdrop — the dot has to match what's on
    // screen, not the theme default.
    expect(snapCursorColors(THEME, 'rock', 0x123456).fill).toBe(0x123456);
    // ...and only the rock case: floor/select are unaffected by the backdrop.
    expect(snapCursorColors(THEME, 'floor', 0x123456).fill).toBe(THEME.floor);
    expect(snapCursorColors(THEME, 'select', 0x123456).fill).toBe(THEME.selection);
  });

  it('outlines every dot in a contrasting color so it never vanishes', () => {
    // The whole point of the outline: a floor-colored dot sitting on floor
    // (or a rock-colored dot on rock) is invisible without one.
    for (const kind of ['floor', 'rock', 'select'] as const) {
      const { fill, stroke } = snapCursorColors(THEME, kind, null);
      expect(stroke).not.toBe(fill);
    }
    expect(snapCursorColors(THEME, 'floor', null).stroke).toBe(THEME.rock);
    expect(snapCursorColors(THEME, 'rock', null).stroke).toBe(THEME.floor);
  });
});
