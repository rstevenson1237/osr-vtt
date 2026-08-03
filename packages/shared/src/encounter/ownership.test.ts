import { describe, expect, it } from 'vitest';
import type { Group, PlayerSeat, Token } from '../types.js';
import {
  actorIdForToken,
  canActOnActor,
  canActOnToken,
  canSeatActAs,
  defaultGroupPatches,
  groupsForSeat,
  resolveDefaultGroupId,
  seatIsInGroup,
} from './ownership.js';

function group(id: string, patch: Partial<Group> = {}): Group {
  return {
    id,
    name: id,
    memberTokenIds: [],
    showMap: true,
    showBoard: true,
    active: false,
    ...patch,
  };
}

function token(id: string, ownerSeatId?: string): Token {
  return {
    id,
    pos: { x: 0, y: 0 },
    size: 1,
    layer: 'tokens',
    imageRef: 'tokens/fighter.svg',
    ...(ownerSeatId ? { ownerSeatId } : {}),
  };
}

function seat(uid: string): PlayerSeat {
  return { uid, displayName: uid, seatId: uid, role: 'player' };
}

describe('seatIsInGroup / groupsForSeat', () => {
  it('treats an absent memberSeatIds as no owners', () => {
    expect(seatIsInGroup(group('g1'), 'seat-a')).toBe(false);
  });

  it('returns a seat’s groups in display order', () => {
    const groups = [
      group('g2', { order: 1, memberSeatIds: ['seat-a'] }),
      group('g1', { order: 0, memberSeatIds: ['seat-a', 'seat-b'] }),
      group('g3', { order: 2, memberSeatIds: ['seat-b'] }),
    ];
    expect(groupsForSeat(groups, 'seat-a').map((g) => g.id)).toEqual(['g1', 'g2']);
  });
});

describe('resolveDefaultGroupId', () => {
  const groups = [group('g2', { order: 1 }), group('g1', { order: 0 })];

  it('resolves "first" to the first group in board order, not source order', () => {
    expect(resolveDefaultGroupId('first', groups)).toBe('g1');
  });

  it('resolves an absent setting like "first"', () => {
    expect(resolveDefaultGroupId(undefined, groups)).toBe('g1');
  });

  it('resolves "unassigned" to no group', () => {
    expect(resolveDefaultGroupId('unassigned', groups)).toBeNull();
  });

  it('resolves an explicit groupId to that group', () => {
    expect(resolveDefaultGroupId('g2', groups)).toBe('g2');
  });

  // The stated behaviour when the referee deletes the group they had chosen.
  it('falls back to the first group when the named group is gone', () => {
    expect(resolveDefaultGroupId('deleted-group', groups)).toBe('g1');
  });

  it('resolves to no group when the room has none yet', () => {
    expect(resolveDefaultGroupId('first', [])).toBeNull();
    expect(resolveDefaultGroupId('deleted-group', [])).toBeNull();
  });
});

describe('canSeatActAs', () => {
  const tokens = [token('t-a', 'seat-a'), token('t-b', 'seat-b'), token('t-mob')];
  const groups = [
    group('party', { memberTokenIds: ['t-a', 't-b'], memberSeatIds: ['seat-a', 'seat-b'] }),
    group('mobs', { memberTokenIds: ['t-mob'] }),
  ];

  it('lets a seat act as itself', () => {
    expect(canSeatActAs([], tokens, 'seat-a', 'seat-a', false)).toBe(true);
  });

  it('lets a group owner act as every character in that group', () => {
    expect(canSeatActAs(groups, tokens, 'seat-a', 'seat-b', false)).toBe(true);
    expect(canSeatActAs(groups, tokens, 'seat-b', 'seat-a', false)).toBe(true);
  });

  it('refuses a character in a group the seat does not own', () => {
    const solo = [group('other', { memberTokenIds: ['t-b'], memberSeatIds: ['seat-b'] })];
    expect(canSeatActAs(solo, tokens, 'seat-a', 'seat-b', false)).toBe(false);
  });

  it('refuses ownership of a group that holds no token for the target', () => {
    // seat-a owns `mobs`, but nothing in it is linked to seat-b.
    const shifted = [group('mobs', { memberTokenIds: ['t-mob'], memberSeatIds: ['seat-a'] })];
    expect(canSeatActAs(shifted, tokens, 'seat-a', 'seat-b', false)).toBe(false);
  });

  // Implicit and derived — the referee is never written into memberSeatIds, so
  // transferring GM moves this with no writes at all.
  it('lets the referee act as anyone, in any group or none', () => {
    expect(canSeatActAs([], tokens, 'seat-gm', 'seat-b', true)).toBe(true);
  });

  it('refuses empty seat ids rather than matching them against each other', () => {
    expect(canSeatActAs(groups, tokens, '', '', false)).toBe(false);
  });
});

describe('actorIdForToken', () => {
  it('keys a character by its seat and a creature by its own id', () => {
    expect(actorIdForToken(token('t-a', 'seat-a'))).toBe('seat-a');
    expect(actorIdForToken(token('t-mob'))).toBe('t-mob');
  });
});

describe('canActOnToken / canActOnActor', () => {
  // `t-a` and `t-b` are characters; `t-npc` is a creature travelling with the
  // party; `t-mob` is a creature in a group no player owns; `t-scenery` is
  // seatless and in no group at all.
  const tokens = [
    token('t-a', 'seat-a'),
    token('t-b', 'seat-b'),
    token('t-npc'),
    token('t-mob'),
    token('t-scenery'),
  ];
  const groups = [
    group('party', {
      memberTokenIds: ['t-a', 't-b', 't-npc'],
      memberSeatIds: ['seat-a', 'seat-b'],
    }),
    group('mobs', { memberTokenIds: ['t-mob'] }),
  ];

  it('reaches a character through its seat, exactly as canSeatActAs does', () => {
    expect(canActOnToken(groups, tokens, 'seat-a', 't-a', false)).toBe(true);
    expect(canActOnToken(groups, tokens, 'seat-a', 't-b', false)).toBe(true);
    const solo = [group('other', { memberTokenIds: ['t-b'], memberSeatIds: ['seat-b'] })];
    expect(canActOnToken(solo, tokens, 'seat-a', 't-b', false)).toBe(false);
  });

  // DEC-035's motivating case: an NPC in the party, owned by no one player.
  it('lets a group owner act on a seatless creature in that group', () => {
    expect(canActOnToken(groups, tokens, 'seat-a', 't-npc', false)).toBe(true);
    expect(canActOnActor(groups, tokens, 'seat-b', 't-npc', false)).toBe(true);
  });

  it('refuses a creature in a group the seat does not own', () => {
    expect(canActOnToken(groups, tokens, 'seat-a', 't-mob', false)).toBe(false);
    expect(canActOnActor(groups, tokens, 'seat-a', 't-mob', false)).toBe(false);
  });

  // DEC-036: it matches no ownership rule, so it is referee furniture.
  it('makes a seatless, ungrouped token referee-only', () => {
    expect(canActOnToken(groups, tokens, 'seat-a', 't-scenery', false)).toBe(false);
    expect(canActOnToken(groups, tokens, 'seat-gm', 't-scenery', true)).toBe(true);
  });

  it('refuses an unknown token, and empty ids, to anyone but the referee', () => {
    expect(canActOnToken(groups, tokens, 'seat-a', 't-gone', false)).toBe(false);
    expect(canActOnToken(groups, tokens, '', 't-a', false)).toBe(false);
    expect(canActOnToken(groups, tokens, 'seat-a', '', false)).toBe(false);
    expect(canActOnToken(groups, tokens, 'seat-gm', 't-gone', true)).toBe(true);
  });

  it('lets the referee act on every token, in any group or none', () => {
    for (const t of tokens) {
      expect(canActOnToken(groups, tokens, 'seat-gm', t.id, true)).toBe(true);
    }
  });

  // The actor-keyed face takes what the selection spine carries: a seat id for
  // a character, a token id for a creature.
  it('resolves a seat-keyed actor through canSeatActAs', () => {
    expect(canActOnActor(groups, tokens, 'seat-a', 'seat-a', false)).toBe(true);
    expect(canActOnActor(groups, tokens, 'seat-a', 'seat-b', false)).toBe(true);
    const solo = [group('other', { memberTokenIds: ['t-b'], memberSeatIds: ['seat-b'] })];
    expect(canActOnActor(solo, tokens, 'seat-a', 'seat-b', false)).toBe(false);
  });

  // A seat that holds no token yet is still itself — the id belongs to no
  // token, so it must not fall into the creature branch.
  it('lets a tokenless seat act as itself', () => {
    expect(canActOnActor(groups, tokens, 'seat-c', 'seat-c', false)).toBe(true);
  });

  // A character's *token* id is not its actor id, so it is not a creature key.
  it('does not treat a seatful token id as a creature key', () => {
    expect(canActOnActor(groups, tokens, 'seat-a', 't-b', false)).toBe(false);
  });
});

describe('defaultGroupPatches', () => {
  const players = [seat('seat-gm'), seat('seat-a'), seat('seat-b')];

  it('appends unplaced player seats to the resolved default group', () => {
    const groups = [group('g1', { order: 0 }), group('g2', { order: 1 })];
    expect(defaultGroupPatches(groups, players, 'first', 'seat-gm')).toEqual([
      { groupId: 'g1', memberSeatIds: ['seat-a', 'seat-b'] },
    ]);
  });

  it('honours an explicit group', () => {
    const groups = [group('g1', { order: 0 }), group('g2', { order: 1 })];
    expect(defaultGroupPatches(groups, players, 'g2', 'seat-gm')).toEqual([
      { groupId: 'g2', memberSeatIds: ['seat-a', 'seat-b'] },
    ]);
  });

  it('falls back to the first group when the named one is gone', () => {
    const groups = [group('g1', { order: 0 })];
    expect(defaultGroupPatches(groups, players, 'gone', 'seat-gm')).toEqual([
      { groupId: 'g1', memberSeatIds: ['seat-a', 'seat-b'] },
    ]);
  });

  it('never places the referee — GM membership is implicit', () => {
    const groups = [group('g1', { order: 0 })];
    const [patch] = defaultGroupPatches(groups, players, 'first', 'seat-gm');
    expect(patch?.memberSeatIds).not.toContain('seat-gm');
  });

  it('leaves a seat that already owns some other group alone', () => {
    const groups = [
      group('g1', { order: 0 }),
      group('g2', { order: 1, memberSeatIds: ['seat-b'] }),
    ];
    expect(defaultGroupPatches(groups, players, 'first', 'seat-gm')).toEqual([
      { groupId: 'g1', memberSeatIds: ['seat-a'] },
    ]);
  });

  it('is idempotent — a second pass over its own result writes nothing', () => {
    const groups = [group('g1', { order: 0 })];
    const first = defaultGroupPatches(groups, players, 'first', 'seat-gm');
    const settled = [group('g1', { order: 0, memberSeatIds: first[0]!.memberSeatIds })];
    expect(defaultGroupPatches(settled, players, 'first', 'seat-gm')).toEqual([]);
  });

  it('writes nothing when the default is Unassigned', () => {
    const groups = [group('g1', { order: 0 })];
    expect(defaultGroupPatches(groups, players, 'unassigned', 'seat-gm')).toEqual([]);
  });

  it('writes nothing when the room has no groups to place anyone in', () => {
    expect(defaultGroupPatches([], players, 'first', 'seat-gm')).toEqual([]);
  });
});
