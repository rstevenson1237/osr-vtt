import { describe, expect, it } from 'vitest';
import type { EncounterOrderEntry, Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { refLabel, tokenLabel } from './labels.js';

function seat(uid: string, displayName: string, seatId = uid): PlayerSeat {
  return { uid, displayName, seatId, role: 'player' };
}

function token(overrides: Partial<Token> = {}): Token {
  return { id: 't1', pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', ...overrides };
}

describe('tokenLabel', () => {
  it('reads a seat-owned token as the seat displayName, not Token.name', () => {
    const players = [seat('u1', 'Aeryn', 'seat-1')];
    const t = token({ ownerSeatId: 'seat-1', name: 'ignored' });
    expect(tokenLabel(t, t.id, players)).toBe('Aeryn');
  });

  it('falls back to name when no players are given', () => {
    const t = token({ ownerSeatId: 'seat-1', name: 'Fallback' });
    expect(tokenLabel(t, t.id)).toBe('Fallback');
  });

  it('reads a named creature as its name', () => {
    const t = token({ name: 'Goblin Boss' });
    expect(tokenLabel(t, t.id)).toBe('Goblin Boss');
  });

  it('reads an unnamed creature as its letter', () => {
    const t = token({ letter: 'A' });
    expect(tokenLabel(t, t.id)).toBe('A');
  });

  it('prefers name over letter when both are present', () => {
    const t = token({ name: 'Orc', letter: 'B' });
    expect(tokenLabel(t, t.id)).toBe('Orc');
  });

  it('falls back to the id fragment when neither name, letter nor art exist', () => {
    const t = token({ id: 'abcdef123' });
    expect(tokenLabel(t, t.id)).toBe('Token abcdef');
  });

  it('falls back to the ref-plus-id fragment when only art exists', () => {
    const t = token({ id: 'abcdef123', imageRef: 'assets/goblin.png' });
    expect(tokenLabel(t, t.id)).toBe('goblin.png · abcdef');
  });

  it('falls back to the id fragment when there is no token at all', () => {
    expect(tokenLabel(undefined, 'zzz999')).toBe('Token zzz999');
  });
});

describe('refLabel', () => {
  const groups: Group[] = [
    { id: 'g1', name: 'The Party', memberTokenIds: [], showMap: true, showBoard: true, active: true },
  ];

  it('reads a side row as the group name', () => {
    const entry: EncounterOrderEntry = { refType: 'side', refId: 'g1', acted: false };
    expect(refLabel(entry, groups, [])).toBe('The Party');
  });

  it('reads an actor row for a seat-owned token as the seat displayName', () => {
    const players = [seat('u1', 'Aeryn', 'seat-1')];
    const t = token({ id: 'tok1', ownerSeatId: 'seat-1', name: 'ignored' });
    const entry: EncounterOrderEntry = { refType: 'actor', refId: 'tok1', acted: false };
    expect(refLabel(entry, groups, [t], players)).toBe('Aeryn');
  });

  it('reads an actor row for an unnamed creature as its letter', () => {
    const t = token({ id: 'tok2', letter: 'C' });
    const entry: EncounterOrderEntry = { refType: 'actor', refId: 'tok2', acted: false };
    expect(refLabel(entry, groups, [t])).toBe('C');
  });
});
