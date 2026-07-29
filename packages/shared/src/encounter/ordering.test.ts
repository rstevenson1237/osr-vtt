import { describe, expect, it } from 'vitest';
import type { Group } from '../types.js';
import { renumberGroupsByOrder, sortGroups } from './ordering.js';

function group(id: string, order?: number): Group {
  const base: Group = {
    id,
    name: id,
    memberTokenIds: [],
    showMap: false,
    showBoard: false,
    active: false,
  };
  return order === undefined ? base : { ...base, order };
}

describe('sortGroups', () => {
  it('sorts by order, with un-ordered groups last and stable among themselves', () => {
    const list = [group('c'), group('b', 1), group('d'), group('a', 0)];
    expect(sortGroups(list).map((g) => g.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves a room that predates `order` in exactly the order it came in', () => {
    const list = [group('x'), group('y'), group('z')];
    expect(sortGroups(list).map((g) => g.id)).toEqual(['x', 'y', 'z']);
  });

  it('does not mutate its input', () => {
    const list = [group('b', 1), group('a', 0)];
    sortGroups(list);
    expect(list.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('renumberGroupsByOrder', () => {
  it('numbers every group on the first drag, not just the moved one', () => {
    expect(renumberGroupsByOrder([group('b'), group('a'), group('c')])).toEqual([
      { groupId: 'b', order: 0 },
      { groupId: 'a', order: 1 },
      { groupId: 'c', order: 2 },
    ]);
  });

  it('writes only the groups whose stored order actually changes', () => {
    const list = [group('a', 0), group('b', 2), group('c', 2)];
    expect(renumberGroupsByOrder(list)).toEqual([{ groupId: 'b', order: 1 }]);
  });

  it('is a no-op once the order already matches', () => {
    expect(renumberGroupsByOrder([group('a', 0), group('b', 1)])).toEqual([]);
  });
});
