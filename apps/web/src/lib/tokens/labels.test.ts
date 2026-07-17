import { describe, expect, it } from 'vitest';
import type { Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { groupColor } from '../encounter/board-view.js';
import {
  defaultCreatureRefs,
  defaultPortraitRef,
  nextCreatureTypeLetter,
  seatLetterFor,
  seatOrder,
  tokenGroupId,
  tokenRingColor,
} from './labels.js';

function seat(uid: string, joinedAt?: number): PlayerSeat {
  return { uid, displayName: uid, seatId: uid, role: 'player', joinedAt };
}

function creatureToken(imageRef: string, ownerSeatId?: string): Token {
  return { id: imageRef, pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', imageRef, ownerSeatId };
}

function mapToken(overrides: Partial<Token> = {}): Token {
  return { id: 't1', pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', imageRef: 'gen:disc:A:hsl(0,50%,50%)', ...overrides };
}

function group(id: string, memberTokenIds: string[]): Group {
  return { id, name: id, memberTokenIds, showMap: false, showBoard: false, active: false };
}

describe('seatOrder / seatLetterFor', () => {
  it('orders seats by joinedAt, earliest first', () => {
    const players = [seat('c', 300), seat('a', 100), seat('b', 200)];
    expect(seatOrder(players).map((p) => p.uid)).toEqual(['a', 'b', 'c']);
  });

  it('sorts seats missing joinedAt last, by uid', () => {
    const players = [seat('z'), seat('a', 100)];
    expect(seatOrder(players).map((p) => p.uid)).toEqual(['a', 'z']);
  });

  it('assigns A, B, C… by join order', () => {
    const players = [seat('c', 300), seat('a', 100), seat('b', 200)];
    expect(seatLetterFor(players, 'a')).toBe('A');
    expect(seatLetterFor(players, 'b')).toBe('B');
    expect(seatLetterFor(players, 'c')).toBe('C');
  });

  it('falls back to index 0 for an unknown seatId (fresh seat not yet in the list)', () => {
    expect(seatLetterFor([], 'ghost')).toBe('A');
  });
});

describe('defaultPortraitRef', () => {
  it('builds a deterministic gen:disc: ref from the seat letter and uid', () => {
    const players = [seat('a', 100), seat('b', 200)];
    const ref = defaultPortraitRef(players, 'b');
    expect(ref.startsWith('gen:disc:B:hsl(')).toBe(true);
    expect(defaultPortraitRef(players, 'b')).toBe(ref); // deterministic
  });
});

describe('nextCreatureTypeLetter / defaultCreatureRefs', () => {
  it('starts at "a" with no existing creature tokens', () => {
    expect(nextCreatureTypeLetter([])).toBe('a');
  });

  it('skips letters already used by unowned gen: creature tokens', () => {
    const tokens = [creatureToken('gen:disc:a1:hsl(10, 65%, 45%)'), creatureToken('gen:disc:a2:hsl(10, 65%, 45%)')];
    expect(nextCreatureTypeLetter(tokens)).toBe('b');
  });

  it('ignores owned tokens and non-gen refs', () => {
    const tokens = [
      creatureToken('gen:disc:a1:hsl(10, 65%, 45%)', 'seat-1'),
      creatureToken('tokens/goblin.png'),
    ];
    expect(nextCreatureTypeLetter(tokens)).toBe('a');
  });

  it('builds a numbered, same-type, same-color batch of refs', () => {
    const refs = defaultCreatureRefs(3, []);
    expect(refs).toHaveLength(3);
    expect(refs[0]).toMatch(/^gen:disc:a1:hsl\(/);
    expect(refs[1]).toMatch(/^gen:disc:a2:hsl\(/);
    expect(refs[2]).toMatch(/^gen:disc:a3:hsl\(/);
    const colors = refs.map((r) => r.slice(r.indexOf('hsl(')));
    expect(new Set(colors).size).toBe(1); // one color per creature type
  });
});

describe('tokenGroupId', () => {
  it('resolves via Group.memberTokenIds — the field the app actually writes', () => {
    const token = mapToken({ id: 't1' });
    const groups = [group('g1', ['other']), group('g2', ['t1'])];
    expect(tokenGroupId(token, groups)).toBe('g2');
  });

  it('prefers an explicit Token.groupId over membership lookup', () => {
    const token = mapToken({ id: 't1', groupId: 'g1' });
    expect(tokenGroupId(token, [group('g2', ['t1'])])).toBe('g1');
  });

  it('is undefined for a token in no group', () => {
    expect(tokenGroupId(mapToken(), [group('g1', ['someone-else'])])).toBeUndefined();
  });
});

describe('tokenRingColor', () => {
  it('is white when the token is the current selection', () => {
    const token = mapToken({ id: 'sel' });
    const groups = [group('g1', ['sel'])];
    expect(tokenRingColor(token, groups, 'sel', 'gm-uid')).toBe('#ffffff');
  });

  it('is white when the token is owned by the viewer, even unselected', () => {
    const token = mapToken({ ownerSeatId: 'alice' });
    const groups = [group('g1', ['t1'])];
    expect(tokenRingColor(token, groups, null, 'alice')).toBe('#ffffff');
  });

  it('selected/owned takes precedence over group color', () => {
    const token = mapToken({ id: 'sel', ownerSeatId: 'alice' });
    const groups = [group('g1', ['sel'])];
    expect(tokenRingColor(token, groups, 'sel', 'bob')).toBe('#ffffff');
    expect(tokenRingColor(token, groups, null, 'alice')).toBe('#ffffff');
  });

  it('falls back to the group color (via Group.memberTokenIds) when grouped but not selected/owned', () => {
    const token = mapToken({ id: 't1', ownerSeatId: 'alice' });
    const groups = [group('goblins', ['t1'])];
    expect(tokenRingColor(token, groups, null, 'bob')).toBe(groupColor('goblins'));
  });

  it('is black when ungrouped and not selected/owned', () => {
    const token = mapToken();
    expect(tokenRingColor(token, [], null, 'bob')).toBe('#000000');
  });

  it('is black when ungrouped and another token is selected', () => {
    const token = mapToken({ id: 't2' });
    expect(tokenRingColor(token, [], 't1', 'bob')).toBe('#000000');
  });
});
