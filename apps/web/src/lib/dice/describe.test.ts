import type { Roll } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { describeRoll } from './describe';

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
