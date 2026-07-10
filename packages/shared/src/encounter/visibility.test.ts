import { describe, expect, it } from 'vitest';
import type { Encounter, Group, Token } from '../types.js';
import { currentActorTokenIds, visibleTokenIds } from './visibility.js';

function token(id: string): Token {
  return { id, pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', imageRef: 'tokens/x.png' };
}

function group(overrides: Partial<Group> & { id: string }): Group {
  return {
    name: overrides.id,
    memberTokenIds: [],
    showMap: false,
    showBoard: false,
    active: false,
    ...overrides,
  };
}

describe('visibleTokenIds', () => {
  it('always shows ungrouped tokens on both surfaces', () => {
    const tokens = [token('t1')];
    expect(visibleTokenIds(tokens, [], 'map').has('t1')).toBe(true);
    expect(visibleTokenIds(tokens, [], 'board').has('t1')).toBe(true);
  });

  it('hides a grouped token when its group toggle is off', () => {
    const tokens = [token('t1')];
    const groups = [group({ id: 'g1', memberTokenIds: ['t1'], showMap: false, showBoard: true })];
    expect(visibleTokenIds(tokens, groups, 'map').has('t1')).toBe(false);
    expect(visibleTokenIds(tokens, groups, 'board').has('t1')).toBe(true);
  });

  it('shows a token if any of its groups has the toggle on', () => {
    const tokens = [token('t1')];
    const groups = [
      group({ id: 'g1', memberTokenIds: ['t1'], showMap: false }),
      group({ id: 'g2', memberTokenIds: ['t1'], showMap: true }),
    ];
    expect(visibleTokenIds(tokens, groups, 'map').has('t1')).toBe(true);
  });
});

describe('currentActorTokenIds', () => {
  it('returns the current side group members in side mode', () => {
    const groups = [group({ id: 'party', memberTokenIds: ['t1', 't2'] })];
    const encounter: Encounter = {
      mode: 'side',
      round: 1,
      currentIndex: 0,
      order: [{ refType: 'side', refId: 'party', acted: false }],
    };
    expect(currentActorTokenIds(encounter, groups)).toEqual(new Set(['t1', 't2']));
  });

  it('returns just the current actor token in individual mode', () => {
    const encounter: Encounter = {
      mode: 'individual',
      round: 1,
      currentIndex: 0,
      order: [{ refType: 'actor', refId: 't1', acted: false }],
    };
    expect(currentActorTokenIds(encounter, [])).toEqual(new Set(['t1']));
  });

  it('returns an empty set when the order is empty', () => {
    const encounter: Encounter = { mode: 'side', round: 1, currentIndex: 0, order: [] };
    expect(currentActorTokenIds(encounter, [])).toEqual(new Set());
  });
});
