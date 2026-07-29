import { describe, expect, it } from 'vitest';
import type { Group } from '@osr-vtt/shared';
import { assignmentUpdates, groupColor, moveTokenUpdates } from './board-view';

function group(id: string, memberTokenIds: string[]): Group {
  return { id, name: id, memberTokenIds, showMap: false, showBoard: false, active: false };
}

describe('groupColor', () => {
  it('is deterministic for a given id', () => {
    expect(groupColor('party')).toBe(groupColor('party'));
  });

  it('returns a well-formed hsl string', () => {
    expect(groupColor('monsters')).toMatch(/^hsl\(\d+ 55% 55%\)$/);
  });

  it('generally differs between distinct ids', () => {
    expect(groupColor('a')).not.toBe(groupColor('bcdef'));
  });
});

describe('assignmentUpdates', () => {
  const groups = [group('party', ['t1']), group('monsters', ['t2'])];

  it('moves a token into a target group and out of its old one', () => {
    const updates = assignmentUpdates(groups, 't1', 'monsters');
    expect(updates).toEqual([
      { groupId: 'party', memberTokenIds: [] },
      { groupId: 'monsters', memberTokenIds: ['t2', 't1'] },
    ]);
  });

  it('assigns an unassigned token to a single group', () => {
    const updates = assignmentUpdates(groups, 't3', 'party');
    expect(updates).toEqual([{ groupId: 'party', memberTokenIds: ['t1', 't3'] }]);
  });

  it('removes a token from every group when the target is null (Unassigned)', () => {
    const multi = [group('party', ['t1']), group('monsters', ['t1', 't2'])];
    const updates = assignmentUpdates(multi, 't1', null);
    expect(updates).toEqual([
      { groupId: 'party', memberTokenIds: [] },
      { groupId: 'monsters', memberTokenIds: ['t2'] },
    ]);
  });

  it('writes nothing when the token is already exactly where asked', () => {
    expect(assignmentUpdates(groups, 't1', 'party')).toEqual([]);
    expect(assignmentUpdates(groups, 't3', null)).toEqual([]);
  });
});

describe('moveTokenUpdates', () => {
  const groups = [group('party', ['a', 'b', 'c']), group('monsters', ['x', 'y'])];

  it('inserts at the drop index in the target group', () => {
    expect(moveTokenUpdates(groups, 'x', 'party', 1)).toEqual([
      { groupId: 'party', memberTokenIds: ['a', 'x', 'b', 'c'] },
      { groupId: 'monsters', memberTokenIds: ['y'] },
    ]);
  });

  it('reorders within one group without touching any other', () => {
    expect(moveTokenUpdates(groups, 'c', 'party', 0)).toEqual([
      { groupId: 'party', memberTokenIds: ['c', 'a', 'b'] },
    ]);
  });

  it('appends when no index is given, matching the menu path', () => {
    expect(moveTokenUpdates(groups, 'x', 'party', null)).toEqual([
      { groupId: 'party', memberTokenIds: ['a', 'b', 'c', 'x'] },
      { groupId: 'monsters', memberTokenIds: ['y'] },
    ]);
  });

  it('clamps an index past the end', () => {
    expect(moveTokenUpdates(groups, 'a', 'party', 99)).toEqual([
      { groupId: 'party', memberTokenIds: ['b', 'c', 'a'] },
    ]);
  });

  it('drops the token out of every group for the Unassigned bin', () => {
    expect(moveTokenUpdates(groups, 'b', null, 0)).toEqual([
      { groupId: 'party', memberTokenIds: ['a', 'c'] },
    ]);
  });

  it('writes nothing when the drop lands the card back where it was', () => {
    expect(moveTokenUpdates(groups, 'b', 'party', 1)).toEqual([]);
  });
});
