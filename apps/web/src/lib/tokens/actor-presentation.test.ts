import { describe, expect, it } from 'vitest';
import type { Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { groupColor } from '../encounter/board-view.js';
import { refLabel, tokenLabel } from '../encounter/labels.js';
import { actorPresentation } from './actor-presentation.js';

// SPEC-055 §4 — `actorPresentation`'s `name` must match `tokenLabel`/`refLabel`
// exactly for every case those already cover, before/after the switch-over.

function seat(uid: string, displayName: string, seatId = uid): PlayerSeat {
  return { uid, displayName, seatId, role: 'player' };
}

function token(overrides: Partial<Token> = {}): Token {
  return { id: 't1', pos: { x: 0, y: 0 }, size: 1, layer: 'tokens', ...overrides };
}

describe('actorPresentation (kind: token) matches tokenLabel', () => {
  it('a seat-owned token reads as the seat displayName', () => {
    const players = [seat('u1', 'Aeryn', 'seat-1')];
    const t = token({ ownerSeatId: 'seat-1', name: 'ignored' });
    expect(actorPresentation({ kind: 'token', token: t }, players, []).name).toBe(
      tokenLabel(t, t.id, players),
    );
    expect(actorPresentation({ kind: 'token', token: t }, players, []).name).toBe('Aeryn');
  });

  it('a named creature reads as its name', () => {
    const t = token({ name: 'Goblin Boss' });
    expect(actorPresentation({ kind: 'token', token: t }, [], []).name).toBe(
      tokenLabel(t, t.id, []),
    );
  });

  it('an unnamed creature reads as its letter', () => {
    const t = token({ letter: 'A' });
    expect(actorPresentation({ kind: 'token', token: t }, [], []).name).toBe(
      tokenLabel(t, t.id, []),
    );
    expect(actorPresentation({ kind: 'token', token: t }, [], []).letter).toBe('A');
  });

  it('falls back to the ref-plus-id fragment when only art exists', () => {
    const t = token({ id: 'abcdef123', imageRef: 'assets/goblin.png' });
    expect(actorPresentation({ kind: 'token', token: t }, [], []).name).toBe(
      tokenLabel(t, t.id, []),
    );
  });

  it('carries the stored colour and portrait through unchanged', () => {
    const t = token({ color: '#abcdef', imageRef: 'assets/goblin.png' });
    const p = actorPresentation({ kind: 'token', token: t }, [], []);
    expect(p.color).toBe('#abcdef');
    expect(p.portrait).toBe('assets/goblin.png');
  });

  it('a letter-less, colour-less, art-less token has no letter/colour/portrait', () => {
    const t = token({ name: 'Orc' });
    const p = actorPresentation({ kind: 'token', token: t }, [], []);
    expect(p.letter).toBeNull();
    expect(p.color).toBeUndefined();
    expect(p.portrait).toBeUndefined();
  });
});

describe('actorPresentation (kind: side) matches refLabel', () => {
  const groups: Group[] = [
    { id: 'g1', name: 'The Party', memberTokenIds: [], showMap: true, showBoard: true, active: true },
  ];

  it('a known side reads as the group name, coloured by groupColor', () => {
    const p = actorPresentation({ kind: 'side', groupId: 'g1' }, [], groups);
    expect(p.name).toBe('The Party');
    expect(p.name).toBe(refLabel({ refType: 'side', refId: 'g1', acted: false }, groups, []));
    expect(p.color).toBe(groupColor('g1'));
    expect(p.letter).toBeNull();
    expect(p.portrait).toBeUndefined();
  });

  it('an unknown side falls back to the id fragment, matching refLabel', () => {
    const p = actorPresentation({ kind: 'side', groupId: 'zzz999' }, [], []);
    expect(p.name).toBe(
      refLabel({ refType: 'side', refId: 'zzz999', acted: false }, [], []),
    );
    expect(p.name).toBe('Side zzz999');
  });
});

// DEC-122 (IN-218): the one name rule for an unnamed, seatless creature, which
// `CharacterDock`'s creature header and `EncounterBoard`'s card name now read.
describe('actorPresentation — unnamed creature (DEC-122)', () => {
  const name = (t: Token) => actorPresentation({ kind: 'token', token: t }, [], []).name;

  it('shows the stored letter, even when there is art', () => {
    expect(name(token({ letter: 'B', imageRef: 'tokens/goblin.svg' }))).toBe('B');
  });

  it('shows `basename · id6` for art with no letter', () => {
    expect(name(token({ id: 'abcdef123', imageRef: 'tokens/goblin.svg' }))).toBe(
      'goblin.svg · abcdef',
    );
  });

  it('keeps two creatures sharing art distinguishable', () => {
    const a = token({ id: 'aaaaaa1', imageRef: 'tokens/goblin.svg' });
    const b = token({ id: 'bbbbbb2', imageRef: 'tokens/goblin.svg' });
    expect(name(a)).not.toBe(name(b));
  });

  it('treats a whitespace-only name and letter as absent', () => {
    expect(name(token({ id: 'abcdef123', name: '  ', letter: ' ', imageRef: 'tokens/x.svg' }))).toBe(
      'x.svg · abcdef',
    );
  });

  it('reads `Token <id6>` when there is no name, letter or art', () => {
    expect(name(token({ id: 'abcdef123' }))).toBe('Token abcdef');
  });
});
