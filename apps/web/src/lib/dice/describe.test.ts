import type { PlayerSeat, Roll } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { describeRoll, describeSharedRoll } from './describe';

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
    expect(describeRoll(r)).toContain('= 9');
    expect(describeRoll(r)).toContain('+ 3');
  });

  it('describes a separate roll with each die flagged', () => {
    const r = roll({
      mode: 'separate',
      dice: [
        { die: 'd6', sides: 6, kept: 6 },
        { die: 'd6', sides: 6, kept: 1 },
      ],
    });
    const text = describeRoll(r);
    expect(text).toContain('6 (success)');
    expect(text).toContain('1 (failure)');
  });

  it('notes advantage/disadvantage in the summary', () => {
    expect(describeRoll(roll({ advantage: 'advantage' }))).toContain('(adv)');
    expect(describeRoll(roll({ advantage: 'disadvantage' }))).toContain('(dis)');
    expect(describeRoll(roll({ advantage: 'normal' }))).not.toContain('(adv)');
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
    const text = describeSharedRoll(r, players);
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
    expect(describeSharedRoll(r, players)).toContain('monster-side');
  });

  it('omits the label suffix when the shared roll has none', () => {
    const r = roll({ parts: [] });
    expect(describeSharedRoll(r, players).split('\n')[0]).toBe('Shared roll');
  });
});
