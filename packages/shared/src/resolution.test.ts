import { describe, expect, it } from 'vitest';
import { classify, pickConvention, resolveSeparate } from './resolution.js';
import { DEFAULT_ROLL_CONVENTIONS, type RollConvention } from './types.js';

describe('resolveSeparate', () => {
  it('classifies 4-6 as success', () => {
    expect(resolveSeparate(4)).toBe('success');
    expect(resolveSeparate(5)).toBe('success');
    expect(resolveSeparate(6)).toBe('success');
  });

  it('classifies 2-3 as complication', () => {
    expect(resolveSeparate(2)).toBe('complication');
    expect(resolveSeparate(3)).toBe('complication');
  });

  it('classifies 1 as failure', () => {
    expect(resolveSeparate(1)).toBe('failure');
  });

  it('rejects non-integer input', () => {
    expect(() => resolveSeparate(2.5)).toThrow(RangeError);
  });
});

describe('pickConvention', () => {
  const catchAll: RollConvention = {
    id: 'any',
    label: 'Any',
    applies: {},
    bands: [{ min: 1, class: 'success', label: 'Any' }],
  };
  const byMode: RollConvention = {
    id: 'sep',
    label: 'Separate',
    applies: { mode: 'separate' },
    bands: [{ min: 1, class: 'success', label: 'Sep' }],
  };
  const bySides: RollConvention = {
    id: 'd20',
    label: 'd20',
    applies: { sides: 20 },
    bands: [{ min: 1, class: 'success', label: 'D20' }],
  };
  const byBoth: RollConvention = {
    id: 'sep-d20',
    label: 'Separate d20',
    applies: { mode: 'separate', sides: 20 },
    bands: [{ min: 1, class: 'success', label: 'Both' }],
  };

  it('returns null when the referee has authored none', () => {
    expect(pickConvention(undefined, { mode: 'separate', sides: 6 })).toBeNull();
    expect(pickConvention([], { mode: 'separate', sides: 6 })).toBeNull();
  });

  it('prefers the most specific match', () => {
    const all = [catchAll, byMode, bySides, byBoth];
    expect(pickConvention(all, { mode: 'separate', sides: 20 })?.id).toBe('sep-d20');
  });

  it('falls back through specificity as narrower conventions stop applying', () => {
    const all = [catchAll, byMode, bySides, byBoth];
    // d6 rules out both `sides: 20` entries, leaving the mode match.
    expect(pickConvention(all, { mode: 'separate', sides: 6 })?.id).toBe('sep');
    // Summed d6 rules out the mode match too, leaving the catch-all.
    expect(pickConvention(all, { mode: 'summed', sides: 6 })?.id).toBe('any');
  });

  it('breaks specificity ties on authoring order, which the referee can see', () => {
    const first: RollConvention = { ...byMode, id: 'first' };
    const second: RollConvention = { ...byMode, id: 'second' };
    expect(pickConvention([first, second], { mode: 'separate', sides: 6 })?.id).toBe('first');
  });

  it('skips conventions that do not apply at all', () => {
    expect(pickConvention([bySides], { mode: 'separate', sides: 6 })).toBeNull();
  });
});

describe('classify', () => {
  const d6 = { mode: 'separate' as const, sides: 6 };

  it('reproduces the historical d6 bands from the seeded default', () => {
    expect(classify(DEFAULT_ROLL_CONVENTIONS, d6, 6)).toEqual({
      class: 'success',
      label: 'Success',
    });
    expect(classify(DEFAULT_ROLL_CONVENTIONS, d6, 4)).toEqual({
      class: 'success',
      label: 'Success',
    });
    expect(classify(DEFAULT_ROLL_CONVENTIONS, d6, 3)).toEqual({
      class: 'complication',
      label: 'Complication',
    });
    expect(classify(DEFAULT_ROLL_CONVENTIONS, d6, 1)).toEqual({
      class: 'failure',
      label: 'Failure',
    });
  });

  it('does NOT apply the d6 bands to a d20 — the bug this replaces', () => {
    // Pre-v16 this went through `resolveSeparate` unconditionally, so a d20
    // face of 4 reported "success". The default convention is scoped to
    // `sides: 6`, so a d20 now classifies as nothing at all.
    expect(classify(DEFAULT_ROLL_CONVENTIONS, { mode: 'separate', sides: 20 }, 4)).toBeNull();
  });

  it('returns null when no convention applies, rather than guessing', () => {
    expect(classify([], d6, 6)).toBeNull();
    expect(classify(undefined, d6, 6)).toBeNull();
  });

  it('honours open-ended bands at either end', () => {
    const conv: RollConvention[] = [
      {
        id: 'under',
        label: 'Roll under',
        applies: {},
        bands: [
          { max: 10, class: 'success', label: 'Under' },
          { min: 11, class: 'failure', label: 'Over' },
        ],
      },
    ];
    // A roll-under table needs no direction flag — the bands say it directly.
    expect(classify(conv, { mode: 'summed', sides: 20 }, 3)?.class).toBe('success');
    expect(classify(conv, { mode: 'summed', sides: 20 }, 17)?.class).toBe('failure');
  });

  it('returns the first matching band when bands overlap', () => {
    const conv: RollConvention[] = [
      {
        id: 'overlap',
        label: 'Overlapping',
        applies: {},
        bands: [
          { min: 5, class: 'success', label: 'First' },
          { min: 1, class: 'failure', label: 'Second' },
        ],
      },
    ];
    expect(classify(conv, { mode: 'summed', sides: 6 }, 6)?.label).toBe('First');
  });

  it('returns null when a value falls in no band', () => {
    const conv: RollConvention[] = [
      {
        id: 'gap',
        label: 'Gapped',
        applies: {},
        bands: [{ min: 10, class: 'success', label: 'High' }],
      },
    ];
    expect(classify(conv, { mode: 'summed', sides: 20 }, 2)).toBeNull();
  });
});
