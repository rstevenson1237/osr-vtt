import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDieGeometry, topFaceIndex } from './geometry';
import { assignTarget, hundredSplit, labelPool, toPhysicalDice } from './resolve';

/**
 * The value-mapping half of the no-flip settle (Master Plan v2, R3.1). These
 * are the checks that a die shows the *right number* — the remap must land the
 * required value on whatever face physics chose, without a corrective flip.
 */

function die(sides: number, kept: number) {
  return { die: `d${sides}`, sides, kept };
}

describe('toPhysicalDice', () => {
  it('renders a d100 as a tinted tens + units pair that sums to the roll', () => {
    const [tens, units] = toPhysicalDice([die(100, 47)]);
    expect(tens).toEqual({ kind: 'd10', variant: 'tens', targetLabel: '40' });
    expect(units).toEqual({ kind: 'd10', variant: 'normal', targetLabel: '7' });
  });

  it('shows a d10 value of 10 as "0"', () => {
    expect(toPhysicalDice([die(10, 10)])[0]!.targetLabel).toBe('0');
    expect(toPhysicalDice([die(10, 3)])[0]!.targetLabel).toBe('3');
  });

  it('maps each standard die onto its shape', () => {
    expect(toPhysicalDice([die(4, 1)])[0]!.kind).toBe('d4');
    expect(toPhysicalDice([die(20, 20)])[0]!.kind).toBe('d20');
    expect(toPhysicalDice([die(12, 12)])[0]!.targetLabel).toBe('12');
  });

  it('never marks a plain kept die dimmed', () => {
    expect(toPhysicalDice([die(6, 4)])[0]!.dimmed).toBeUndefined();
  });

  it('renders a Separate companion (dropped value) as a second dimmed die (R20.2)', () => {
    const out = toPhysicalDice([{ die: 'd20', sides: 20, kept: 17, dropped: 6 }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: 'd20', variant: 'normal', targetLabel: '17' });
    expect(out[1]).toEqual({ kind: 'd20', variant: 'normal', targetLabel: '6', dimmed: true });
  });

  it('renders a Summed poolDropped die as a single dimmed die (R20.1)', () => {
    const out = toPhysicalDice([{ die: 'd6', sides: 6, kept: 2, poolDropped: true }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ kind: 'd6', variant: 'normal', targetLabel: '2', dimmed: true });
  });

  it('dims a dropped d100 companion as its full tens/units pair', () => {
    const out = toPhysicalDice([{ die: 'd100', sides: 100, kept: 80, dropped: 23 }]);
    // kept 80 → 2 dice, dropped 23 → 2 dimmed dice.
    expect(out).toHaveLength(4);
    expect(out[2]).toEqual({ kind: 'd10', variant: 'tens', targetLabel: '20', dimmed: true });
    expect(out[3]).toEqual({ kind: 'd10', variant: 'normal', targetLabel: '3', dimmed: true });
  });
});

describe('hundredSplit', () => {
  it.each([
    [1, '00', '1'],
    [5, '00', '5'],
    [10, '10', '0'],
    [47, '40', '7'],
    [90, '90', '0'],
    [99, '90', '9'],
    [100, '00', '0'],
  ])('splits %i into %s + %s', (kept, tens, units) => {
    expect(hundredSplit(kept)).toEqual({ tens, units });
  });
});

describe('assignTarget (no-flip remap)', () => {
  it('places the target on the landed face and keeps all labels distinct', () => {
    const labels = labelPool('d20', 'normal', 20);
    const out = assignTarget(labels, 7, '13');
    expect(out[7]).toBe('13');
    expect(new Set(out).size).toBe(20); // still one of each
    expect(out).toHaveLength(20);
  });

  it('stamps an out-of-range value straight onto the landed face', () => {
    const out = assignTarget(labelPool('d20', 'normal', 20), 3, '27');
    expect(out[3]).toBe('27');
  });
});

describe('round-trip: physics orientation → remap → correct top face', () => {
  // For every kind and a spread of orientations, the number the remap assigns
  // to the landed face is exactly the number the locator scan reads back up —
  // i.e. what physics lands on always shows the required value (no flip).
  const cases: Array<[number, number]> = [
    [4, 3],
    [6, 5],
    [8, 8],
    [10, 10],
    [12, 7],
    [20, 20],
  ];
  it.each(cases)('d%i landing target %i', (sides, kept) => {
    const g = buildDieGeometry(toPhysicalDice([die(sides, kept)])[0]!.kind);
    const pd = toPhysicalDice([die(sides, kept)])[0]!;
    const pool = labelPool(pd.kind, pd.variant, g.faceCount);
    for (let s = 0; s < 12; s++) {
      const q = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 2, 3).normalize(), (s * Math.PI) / 6)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s * 0.7));
      const landed = topFaceIndex(g.locators, q);
      const faces = assignTarget(pool, landed, pd.targetLabel);
      expect(faces[landed]).toBe(pd.targetLabel);
    }
  });
});
