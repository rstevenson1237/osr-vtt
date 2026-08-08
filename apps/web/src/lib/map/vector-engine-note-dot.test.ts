import { describe, expect, it } from 'vitest';
import { noteDotRadiusPx } from './vector-engine';

/**
 * SPEC-033 §4 — the coarse pointer's tap target for a room's players' notes.
 * This is what the dot *looks* like; what it *catches* is `PICK_PX`, which is
 * deliberately larger (see `vector-tools`' `pickNoteDotAt`).
 */
describe('noteDotRadiusPx', () => {
  it('scales with the cell, like the label it belongs to', () => {
    expect(noteDotRadiusPx(40)).toBeCloseTo(5.6);
    expect(noteDotRadiusPx(80)).toBeCloseTo(11.2);
  });

  it('floors at a visible size when zoomed well out', () => {
    // Same shape of rule as MIN_LABEL_FONT_PX: proportion until proportion
    // would make it disappear.
    expect(noteDotRadiusPx(4)).toBe(3);
    expect(noteDotRadiusPx(0)).toBe(3);
  });

  it('stays inside the half-cell gap it is drawn in', () => {
    // The dot is centred on the cell's top edge and the chip is centred on the
    // cell, so anything past half a cell would start covering the label.
    for (const cellSize of [20, 40, 64, 120]) {
      expect(noteDotRadiusPx(cellSize)).toBeLessThan(cellSize / 2);
    }
  });
});
