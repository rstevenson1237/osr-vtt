import { describe, expect, it } from 'vitest';
import type { SharedRollSlot } from '../types.js';
import {
  createSeed,
  expandDiceExprs,
  expandSharedRollSlots,
  parseDieExpr,
  rollFaces,
  rollTray,
  separateFlags,
  summedTotal,
} from './engine.js';

describe('parseDieExpr', () => {
  it('parses a bare die', () => {
    expect(parseDieExpr('d6')).toEqual({ count: 1, sides: 6 });
  });

  it('parses a compound expression', () => {
    expect(parseDieExpr('2d20')).toEqual({ count: 2, sides: 20 });
  });

  it('is case-insensitive', () => {
    expect(parseDieExpr('3D8')).toEqual({ count: 3, sides: 8 });
  });

  it('returns null for free text (never throws)', () => {
    expect(parseDieExpr('a fine sword')).toBeNull();
    expect(parseDieExpr('')).toBeNull();
    expect(parseDieExpr('d0')).toBeNull();
  });
});

describe('expandDiceExprs', () => {
  it('expands a compound expression into one slot per die', () => {
    expect(expandDiceExprs(['2d6'])).toEqual([
      { die: 'd6', sides: 6 },
      { die: 'd6', sides: 6 },
    ]);
  });

  it('mixes multiple staged expressions in order', () => {
    expect(expandDiceExprs(['d20', 'd6'])).toEqual([
      { die: 'd20', sides: 20 },
      { die: 'd6', sides: 6 },
    ]);
  });

  it('silently drops unparseable entries', () => {
    expect(expandDiceExprs(['d6', 'nonsense', 'd8'])).toEqual([
      { die: 'd6', sides: 6 },
      { die: 'd8', sides: 8 },
    ]);
  });
});

describe('rollFaces', () => {
  it('is deterministic for a given seed', () => {
    expect(rollFaces('abc', [6, 6, 6])).toEqual(rollFaces('abc', [6, 6, 6]));
  });

  it('produces faces within [1, sides] per entry', () => {
    for (const face of rollFaces('xyz', [4, 6, 20, 100])) {
      expect(face).toBeGreaterThanOrEqual(1);
    }
    const [d4, d6, d20, d100] = rollFaces('xyz', [4, 6, 20, 100]);
    expect(d4).toBeLessThanOrEqual(4);
    expect(d6).toBeLessThanOrEqual(6);
    expect(d20).toBeLessThanOrEqual(20);
    expect(d100).toBeLessThanOrEqual(100);
  });
});

describe('createSeed', () => {
  it('produces unique-enough seeds across calls', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => createSeed()));
    expect(seeds.size).toBe(20);
  });
});

describe('rollTray — normal', () => {
  it('rolls one face per slot, no dropped die', () => {
    const dice = rollTray('seed-1', [{ die: 'd6', sides: 6 }], 'normal');
    expect(dice).toHaveLength(1);
    expect(dice[0]!.dropped).toBeUndefined();
    expect(dice[0]!.kept).toBeGreaterThanOrEqual(1);
    expect(dice[0]!.kept).toBeLessThanOrEqual(6);
  });

  it('is deterministic for a given seed', () => {
    const slots = [{ die: 'd20', sides: 20 }, { die: 'd6', sides: 6 }];
    expect(rollTray('same-seed', slots, 'normal')).toEqual(rollTray('same-seed', slots, 'normal'));
  });
});

describe('rollTray — advantage/disadvantage', () => {
  const slots = [{ die: 'd20', sides: 20 }];

  it('advantage keeps the higher of two rolls', () => {
    for (let i = 0; i < 50; i++) {
      const [die] = rollTray(`adv-${i}`, slots, 'advantage');
      expect(die!.dropped).toBeDefined();
      expect(die!.kept).toBeGreaterThanOrEqual(die!.dropped!);
    }
  });

  it('disadvantage keeps the lower of two rolls', () => {
    for (let i = 0; i < 50; i++) {
      const [die] = rollTray(`dis-${i}`, slots, 'disadvantage');
      expect(die!.dropped).toBeDefined();
      expect(die!.kept).toBeLessThanOrEqual(die!.dropped!);
    }
  });
});

describe('summedTotal', () => {
  it('sums kept faces plus the flat modifier', () => {
    const dice = [
      { die: 'd6', sides: 6, kept: 4 },
      { die: 'd6', sides: 6, kept: 2 },
    ];
    expect(summedTotal(dice, 3)).toBe(9);
  });

  it('handles a negative modifier', () => {
    const dice = [{ die: 'd20', sides: 20, kept: 10 }];
    expect(summedTotal(dice, -2)).toBe(8);
  });
});

describe('separateFlags', () => {
  it('flags each die independently via the fixed success/complication/failure thresholds', () => {
    const dice = [
      { die: 'd6', sides: 6, kept: 6 },
      { die: 'd6', sides: 6, kept: 3 },
      { die: 'd6', sides: 6, kept: 1 },
    ];
    expect(separateFlags(dice)).toEqual(['success', 'complication', 'failure']);
  });
});

describe('expandSharedRollSlots — shared rolls (Master Plan v2, R3.6)', () => {
  const slot = (over: Partial<SharedRollSlot> = {}): SharedRollSlot => ({
    die: 'd20',
    modifier: 0,
    advantage: 'normal',
    ready: true,
    ...over,
  });

  it('same seed + same slots ⇒ identical faces regardless of slot-write order', () => {
    const forward: Record<string, SharedRollSlot> = {
      alice: slot({ modifier: 2 }),
      bob: slot({ modifier: 1 }),
      carol: slot({ modifier: 0 }),
    };
    // Same entries, deliberately inserted in a different order — plain JS
    // objects/Firestore maps give no write-order guarantee.
    const backward: Record<string, SharedRollSlot> = {
      carol: slot({ modifier: 0 }),
      bob: slot({ modifier: 1 }),
      alice: slot({ modifier: 2 }),
    };

    const a = expandSharedRollSlots('shared-seed-1', forward);
    const b = expandSharedRollSlots('shared-seed-1', backward);
    expect(a).toEqual(b);
    // And the output itself is seat-id-sorted.
    expect(a.map((p) => p.seatId)).toEqual(['alice', 'bob', 'carol']);
  });

  it('a seat that never staged (absent) or never flipped ready is cleanly skipped', () => {
    const parts = expandSharedRollSlots('seed-x', {
      alice: slot({ ready: true }),
      bob: slot({ ready: false }),
    });
    expect(parts).toHaveLength(1);
    expect(parts[0]!.seatId).toBe('alice');
  });

  it('computes total (sum + modifier) and per-die flags for each part', () => {
    const parts = expandSharedRollSlots('seed-total', {
      alice: slot({ die: '2d6', modifier: 3, ready: true }),
    });
    const part = parts[0]!;
    expect(part.dice).toHaveLength(2);
    expect(part.total).toBe(summedTotal(part.dice, 3));
    expect(part.flags).toEqual(separateFlags(part.dice));
  });

  it('honors each slot’s own advantage/disadvantage independently', () => {
    const parts = expandSharedRollSlots('seed-adv', {
      alice: slot({ advantage: 'advantage' }),
      bob: slot({ advantage: 'disadvantage' }),
    });
    const alice = parts.find((p) => p.seatId === 'alice')!;
    const bob = parts.find((p) => p.seatId === 'bob')!;
    expect(alice.dice[0]!.dropped).toBeDefined();
    expect(alice.dice[0]!.kept).toBeGreaterThanOrEqual(alice.dice[0]!.dropped!);
    expect(bob.dice[0]!.dropped).toBeDefined();
    expect(bob.dice[0]!.kept).toBeLessThanOrEqual(bob.dice[0]!.dropped!);
  });

  it('re-deriving from the same seed on a third client matches exactly', () => {
    const slots: Record<string, SharedRollSlot> = {
      alice: slot({ die: 'd20', modifier: 2 }),
      bob: slot({ die: 'd6', modifier: 0 }),
    };
    const client1 = expandSharedRollSlots('shared-seed-2', slots);
    const client2 = expandSharedRollSlots('shared-seed-2', slots);
    const client3 = expandSharedRollSlots('shared-seed-2', slots);
    expect(client1).toEqual(client2);
    expect(client2).toEqual(client3);
  });
});
