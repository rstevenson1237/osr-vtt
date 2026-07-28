import type { PlayerSeat, Roll } from '../types.js';
import { DEFAULT_ROLL_CONVENTIONS } from '../types.js';
import { describe, expect, it } from 'vitest';
import { describeRoll, describeSharedRoll, overallResultClass, summarizeRoll } from './describe.js';

function roll(overrides: Partial<Roll>): Roll {
  return {
    id: 'r1',
    ts: 0,
    authorUid: 'u1',
    seed: 'seed',
    dice: [{ die: 'd6', sides: 6, kept: 4 }],
    modifier: 0,
    advantage: 'normal',
    mode: 'separate',
    ...overrides,
  };
}

describe('describeRoll', () => {
  it('describes a summed roll with its total and modifier', () => {
    const r = roll({
      mode: 'summed',
      dice: [
        { die: 'd6', sides: 6, kept: 4 },
        { die: 'd6', sides: 6, kept: 2 },
      ],
      modifier: 3,
      total: 9,
    });
    expect(describeRoll(r, DEFAULT_ROLL_CONVENTIONS)).toContain('= 9');
    expect(describeRoll(r, DEFAULT_ROLL_CONVENTIONS)).toContain('+ 3');
  });

  it('describes a separate roll with each die flagged', () => {
    const r = roll({
      mode: 'separate',
      dice: [
        { die: 'd6', sides: 6, kept: 6 },
        { die: 'd6', sides: 6, kept: 1 },
      ],
    });
    const text = describeRoll(r, DEFAULT_ROLL_CONVENTIONS);
    // The referee's *label* for the band, not the internal class name — the
    // whole point of conventions being data they author.
    expect(text).toContain('6 (Success)');
    expect(text).toContain('1 (Failure)');
  });

  it('prints faces bare when no convention applies, rather than guessing', () => {
    // Pre-v16 this ran every die through the hardcoded d6 bands, so a d20
    // face of 4 was described as a success.
    const r = roll({ mode: 'separate', dice: [{ die: 'd20', sides: 20, kept: 4 }] });
    const text = describeRoll(r, DEFAULT_ROLL_CONVENTIONS);
    expect(text).toBe('Rolled 4');
  });

  it('carries the label as a prefix when the roll has one', () => {
    expect(describeRoll(roll({ label: 'Initiative' }), DEFAULT_ROLL_CONVENTIONS)).toBe(
      'Initiative — Rolled 4 (Success)',
    );
  });
});

describe('summarizeRoll', () => {
  it('presents a solo roll as a one-part summary keyed by its author', () => {
    const summary = summarizeRoll(roll({}), DEFAULT_ROLL_CONVENTIONS);
    expect(summary.summed).toBe(false);
    expect(summary.parts).toHaveLength(1);
    expect(summary.parts[0]?.slotId).toBe('u1');
    expect(summary.parts[0]?.dice[0]?.band).toEqual({ class: 'success', label: 'Success' });
  });

  it('bands the total in summed mode and the faces in separate mode', () => {
    const summed = summarizeRoll(
      roll({ mode: 'summed', dice: [{ die: 'd6', sides: 6, kept: 5 }], total: 5 }),
      DEFAULT_ROLL_CONVENTIONS,
    );
    // Summed classifies the total, so the individual face carries no band.
    expect(summed.parts[0]?.dice[0]?.band).toBeUndefined();
    // ...and the default convention is separate-only, so nothing bands here.
    expect(summed.parts[0]?.band).toBeUndefined();
  });

  it('leaves a mixed summed pool unbanded by a die-size-scoped convention', () => {
    const conventions = [
      {
        id: 'd6-pool',
        label: 'd6 pool',
        applies: { mode: 'summed' as const, sides: 6 },
        bands: [{ min: 1, class: 'success' as const, label: 'Any' }],
      },
    ];
    const mixed = summarizeRoll(
      roll({
        mode: 'summed',
        dice: [
          { die: 'd6', sides: 6, kept: 3 },
          { die: 'd8', sides: 8, kept: 5 },
        ],
        total: 8,
      }),
      conventions,
    );
    // No single die size ⇒ a sides-scoped convention can't honestly apply.
    expect(mixed.parts[0]?.band).toBeUndefined();
  });

  it('presents a shared roll as one part per slot, always summed', () => {
    const summary = summarizeRoll(
      roll({
        label: 'Initiative',
        parts: [
          {
            seatId: 'a',
            dice: [{ die: 'd6', sides: 6, kept: 5 }],
            modifier: 0,
            advantage: 'normal',
            total: 5,
          },
          {
            seatId: 'b',
            dice: [{ die: 'd6', sides: 6, kept: 2 }],
            modifier: 1,
            advantage: 'normal',
            total: 3,
          },
        ],
      }),
      DEFAULT_ROLL_CONVENTIONS,
    );
    expect(summary.summed).toBe(true);
    expect(summary.label).toBe('Initiative');
    expect(summary.parts.map((p) => p.slotId)).toEqual(['a', 'b']);
    expect(summary.parts[1]?.total).toBe(3);
  });
});

describe('overallResultClass', () => {
  it('tints a single-die separate roll', () => {
    expect(overallResultClass(summarizeRoll(roll({}), DEFAULT_ROLL_CONVENTIONS))).toBe('success');
  });

  it('gives a multi-die separate roll no single class', () => {
    const summary = summarizeRoll(
      roll({
        dice: [
          { die: 'd6', sides: 6, kept: 6 },
          { die: 'd6', sides: 6, kept: 1 },
        ],
      }),
      DEFAULT_ROLL_CONVENTIONS,
    );
    expect(overallResultClass(summary)).toBeUndefined();
  });

  it('gives a shared roll no single class', () => {
    const summary = summarizeRoll(
      roll({
        parts: [
          {
            seatId: 'a',
            dice: [{ die: 'd6', sides: 6, kept: 5 }],
            modifier: 0,
            advantage: 'normal',
            total: 5,
          },
          {
            seatId: 'b',
            dice: [{ die: 'd6', sides: 6, kept: 2 }],
            modifier: 0,
            advantage: 'normal',
            total: 2,
          },
        ],
      }),
      DEFAULT_ROLL_CONVENTIONS,
    );
    expect(overallResultClass(summary)).toBeUndefined();
  });
});

describe('describeRoll — advantage and drops', () => {
  it('notes advantage/disadvantage in the summary', () => {
    expect(describeRoll(roll({ advantage: 'advantage' }), DEFAULT_ROLL_CONVENTIONS)).toContain(
      '(adv)',
    );
    expect(describeRoll(roll({ advantage: 'disadvantage' }), DEFAULT_ROLL_CONVENTIONS)).toContain(
      '(dis)',
    );
    expect(describeRoll(roll({ advantage: 'normal' }), DEFAULT_ROLL_CONVENTIONS)).not.toContain(
      '(adv)',
    );
  });

  it('describes a summed drop-lowest roll, excluding the dropped die from the sum', () => {
    const r = roll({
      mode: 'summed',
      advantage: 'advantage',
      dice: [
        { die: 'd6', sides: 6, kept: 6 },
        { die: 'd6', sides: 6, kept: 4 },
        { die: 'd6', sides: 6, kept: 1, poolDropped: true },
      ],
      total: 10,
    });
    const text = describeRoll(r, DEFAULT_ROLL_CONVENTIONS);
    expect(text).toContain('(drop lowest)');
    expect(text).toContain('dropped d6:1');
    expect(text).toContain('= 10');
    // The dropped die isn't part of the kept list.
    expect(text.indexOf('d6:1')).toBeGreaterThan(text.indexOf('dropped'));
  });

  it('says (drop highest) for a summed disadvantage roll', () => {
    expect(
      describeRoll(
        roll({ mode: 'summed', advantage: 'disadvantage', total: 4 }),
        DEFAULT_ROLL_CONVENTIONS,
      ),
    ).toContain('(drop highest)');
  });

  it('annotates the dropped companion of a separate advantage die', () => {
    const r = roll({
      mode: 'separate',
      advantage: 'advantage',
      dice: [{ die: 'd20', sides: 20, kept: 17, dropped: 6 }],
    });
    expect(describeRoll(r, DEFAULT_ROLL_CONVENTIONS)).toContain('[dropped 6]');
  });
});

describe('describeSharedRoll', () => {
  const players: PlayerSeat[] = [
    { uid: 'alice-uid', seatId: 'alice-uid', displayName: 'Alice', role: 'player' },
    { uid: 'bob-uid', seatId: 'bob-uid', displayName: 'Bob', role: 'player' },
  ];

  it('groups a header line with one indented line per part, resolving display names', () => {
    const r = roll({
      label: 'Initiative',
      parts: [
        {
          seatId: 'alice-uid',
          dice: [{ die: 'd20', sides: 20, kept: 15 }],
          modifier: 2,
          advantage: 'normal',
          total: 17,
        },
        {
          seatId: 'bob-uid',
          dice: [{ die: 'd20', sides: 20, kept: 4 }],
          modifier: 0,
          advantage: 'normal',
          total: 4,
        },
      ],
    });
    const text = describeSharedRoll(r, players, DEFAULT_ROLL_CONVENTIONS);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Shared roll — Initiative');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('= 17');
    expect(lines[2]).toContain('Bob');
    expect(lines[2]).toContain('= 4');
  });

  it('falls back to the raw slot id for a GM-staged side with no matching seat', () => {
    const r = roll({
      parts: [
        {
          seatId: 'monster-side',
          dice: [{ die: 'd6', sides: 6, kept: 3 }],
          modifier: 0,
          advantage: 'normal',
          total: 3,
        },
      ],
    });
    expect(describeSharedRoll(r, players, DEFAULT_ROLL_CONVENTIONS)).toContain('monster-side');
  });

  it('omits the label suffix when the shared roll has none', () => {
    const r = roll({ parts: [] });
    expect(describeSharedRoll(r, players, DEFAULT_ROLL_CONVENTIONS).split('\n')[0]).toBe(
      'Shared roll',
    );
  });
});
