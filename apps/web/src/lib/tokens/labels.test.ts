import { describe, expect, it } from 'vitest';
import type { PlayerSeat, Token } from '@osr-vtt/shared';
import {
  defaultCreatureRefs,
  defaultPortraitRef,
  nextCreatureTypeLetter,
  seatLetterFor,
  seatOrder,
} from './labels.js';

function seat(uid: string, joinedAt?: number): PlayerSeat {
  return { uid, displayName: uid, seatId: uid, role: 'player', joinedAt };
}

function creatureToken(imageRef: string, ownerSeatId?: string): Token {
  return { id: imageRef, pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', imageRef, ownerSeatId };
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
