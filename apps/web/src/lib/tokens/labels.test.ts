import { describe, expect, it } from 'vitest';
import type { Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { groupColor } from '../encounter/board-view.js';
import {
  creatureBatchColor,
  creatureBatchNames,
  creatureDisplayName,
  creatureLabel,
  defaultCreatureRefs,
  defaultPortraitRef,
  nextCreatureLetters,
  seatLetterFor,
  seatOrder,
  tokenGroupId,
  tokenRingColor,
} from './labels.js';

function seat(uid: string, joinedAt?: number): PlayerSeat {
  return { uid, displayName: uid, seatId: uid, role: 'player', joinedAt };
}

function creatureToken(imageRef: string, ownerSeatId?: string, name?: string): Token {
  return {
    id: imageRef,
    pos: { x: 0, y: 0 },
    size: 1,
    layer: 'tokens',
    imageRef,
    ownerSeatId,
    name,
  };
}

function mapToken(overrides: Partial<Token> = {}): Token {
  return {
    id: 't1',
    pos: { x: 0, y: 0 },
    size: 1,
    layer: 'tokens',
    imageRef: 'gen:disc:A:hsl(0,50%,50%)',
    ...overrides,
  };
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

describe('nextCreatureLetters (SPEC-040 §4)', () => {
  it('starts at A in an empty group', () => {
    expect(nextCreatureLetters(3, [])).toEqual(['A', 'B', 'C']);
  });

  it('restarts at A for every group — two groups may both read A, B, C', () => {
    // The orcs' brand-new group knows nothing about the goblins', so it
    // starts at A as well. That collision is the accepted cost (§4).
    const goblins = ['A', 'B', 'C'].map((l) => creatureToken(`gen:disc:${l}:hsl(10, 65%, 45%)`));
    expect(nextCreatureLetters(3, goblins)).toEqual(['D', 'E', 'F']);
    expect(nextCreatureLetters(3, [])).toEqual(['A', 'B', 'C']);
  });

  it('takes the LOWEST unused letter, so a freed B is reused rather than skipped', () => {
    const group = [
      creatureToken('gen:disc:A:hsl(10, 65%, 45%)'),
      creatureToken('gen:disc:C:hsl(10, 65%, 45%)'),
    ];
    expect(nextCreatureLetters(2, group)).toEqual(['B', 'D']);
  });

  it('ignores seat-owned tokens — seat letters are a separate scheme', () => {
    const group = [creatureToken('gen:disc:A:hsl(10, 65%, 45%)', 'seat-1')];
    expect(nextCreatureLetters(1, group)).toEqual(['A']);
  });

  it('ignores refs that are not plain-letter discs, pre-v28 a1/a2 included', () => {
    const group = [
      creatureToken('gen:disc:a1:hsl(10, 65%, 45%)'),
      creatureToken('tokens/goblin.png'),
      creatureToken('gen:disc:%F0%9F%90%89:hsl(10, 65%, 45%)'),
    ];
    expect(nextCreatureLetters(1, group)).toEqual(['A']);
  });

  it('continues past Z as AA, AB… rather than failing', () => {
    const full = Array.from({ length: 26 }, (_, i) =>
      creatureToken(`gen:disc:${String.fromCharCode(65 + i)}:hsl(10, 65%, 45%)`),
    );
    expect(nextCreatureLetters(2, full)).toEqual(['AA', 'AB']);
  });
});

describe('creatureBatchNames (SPEC-040 §2)', () => {
  it('numbers a batch of three from 1', () => {
    expect(creatureBatchNames('Goblin', 3, [])).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
  });

  it('leaves a lone creature unnumbered', () => {
    // "Goblin 1" on its own reads like there is a Goblin 2 somewhere.
    expect(creatureBatchNames('Goblin', 1, [])).toEqual(['Goblin']);
  });

  it('gives the second Goblin the next number without renaming the first', () => {
    const group = [creatureToken('gen:disc:A:hsl(10, 65%, 45%)', undefined, 'Goblin')];
    expect(creatureBatchNames('Goblin', 1, group)).toEqual(['Goblin 2']);
  });

  it('fills the lowest free numbers around the survivors of a batch', () => {
    const group = [
      creatureToken('gen:disc:A:hsl(10, 65%, 45%)', undefined, 'Goblin 1'),
      creatureToken('gen:disc:C:hsl(10, 65%, 45%)', undefined, 'Goblin 3'),
    ];
    expect(creatureBatchNames('Goblin', 2, group)).toEqual(['Goblin 2', 'Goblin 4']);
  });

  it('counts only the same base name — an Orc beside a Goblin takes nothing', () => {
    const group = [creatureToken('gen:disc:A:hsl(10, 65%, 45%)', undefined, 'Orc 1')];
    expect(creatureBatchNames('Goblin', 1, group)).toEqual(['Goblin']);
  });

  it('yields no names at all for an empty base, leaving Token.name absent', () => {
    expect(creatureBatchNames('   ', 3, [])).toEqual([]);
  });
});

describe('creatureBatchColor / defaultCreatureRefs (SPEC-040 §4)', () => {
  it('gives one colour to the whole batch, seeded from the name', () => {
    const color = creatureBatchColor('Goblin');
    const refs = defaultCreatureRefs(3, [], color);
    expect(refs).toEqual([
      `gen:disc:A:${color}`,
      `gen:disc:B:${color}`,
      `gen:disc:C:${color}`,
    ]);
    // A later batch of the same creature comes out the same colour, so a
    // reinforcing pair of Goblins still reads as Goblins.
    expect(creatureBatchColor('Goblin')).toBe(color);
    expect(creatureBatchColor('Orc')).not.toBe(color);
  });

  it('lets a picked swatch win over the name-derived colour', () => {
    expect(creatureBatchColor('Goblin', 'hsl(200, 65%, 45%)')).toBe('hsl(200, 65%, 45%)');
  });
});

describe('creatureDisplayName (SPEC-040 §3)', () => {
  it('is the stored name when there is one', () => {
    const token = creatureToken('gen:disc:A:hsl(10, 65%, 45%)', undefined, 'Goblin 2');
    expect(creatureDisplayName(token)).toBe('Goblin 2');
  });

  it('falls back to the ref-derived label for a token written before v28', () => {
    const token = creatureToken('tokens/goblin.svg');
    expect(creatureDisplayName(token)).toBe(creatureLabel(token));
    expect(creatureDisplayName(token)).toBe('goblin');
  });

  it('treats a whitespace-only name as absent', () => {
    const token = creatureToken('tokens/goblin.svg', undefined, '   ');
    expect(creatureDisplayName(token)).toBe('goblin');
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
