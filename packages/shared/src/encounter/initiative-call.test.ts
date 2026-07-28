import { describe, expect, it } from 'vitest';
import type { Group, ProfileInstance, ProfileTemplateField, Token } from '../types.js';
import {
  initiativeActors,
  initiativeDieFor,
  initiativeSlotId,
  unassignedActors,
} from './initiative-call.js';

const GM = 'gm-uid';

function token(id: string, ownerSeatId?: string): Token {
  return {
    id,
    pos: { x: 0, y: 0 },
    size: 1,
    layer: 'tokens',
    imageRef: 'gen:disc:A:accent',
    ...(ownerSeatId ? { ownerSeatId } : {}),
  };
}

function group(id: string, memberTokenIds: string[], active = true): Group {
  return { id, name: id, memberTokenIds, active, showMap: true, showBoard: true };
}

describe('initiativeSlotId', () => {
  it('keys a side by its groupId', () => {
    expect(initiativeSlotId('side', { refId: 'party', die: 'd6' })).toBe('party');
  });

  it('keys an owned character by {uid}:{tokenId}, so one player can stage several', () => {
    expect(initiativeSlotId('individual', { refId: 'tok1', ownerUid: 'u1', die: 'd20' })).toBe(
      'u1:tok1',
    );
    expect(initiativeSlotId('individual', { refId: 'tok2', ownerUid: 'u1', die: 'd20' })).toBe(
      'u1:tok2',
    );
  });

  it('keys an unowned token by its bare id — only the referee can write it', () => {
    expect(initiativeSlotId('individual', { refId: 'goblin', die: 'd6' })).toBe('goblin');
  });
});

describe('initiativeDieFor', () => {
  const template: ProfileTemplateField[] = [
    { id: 'name', label: 'Name', type: 'text' },
    { id: 'init', label: 'Initiative', type: 'initiative', default: 'd6' },
  ];

  it('reads the actor’s own initiative field', () => {
    expect(initiativeDieFor(template, { init: 'd20' })).toBe('d20');
  });

  it('falls back to the field default when the instance has no value', () => {
    expect(initiativeDieFor(template, {})).toBe('d6');
  });

  it('returns undefined when the template defines no initiative field', () => {
    expect(initiativeDieFor([{ id: 'name', label: 'Name', type: 'text' }], {})).toBeUndefined();
  });

  it('treats a blank value as unset rather than staging an empty die', () => {
    expect(initiativeDieFor(template, { init: '   ' })).toBe('d6');
  });
});

describe('initiativeActors — side mode', () => {
  const tokens = [token('pc1', 'player-1'), token('gob1'), token('gob2')];
  const groups = [group('party', ['pc1']), group('monsters', ['gob1', 'gob2'])];

  it('produces one actor per active group', () => {
    const actors = initiativeActors({ mode: 'side', groups, tokens, gmUid: GM, defaultDie: 'd6' });
    expect(actors.map((a) => a.refId)).toEqual(['party', 'monsters']);
  });

  it('marks a group player-owned when any member belongs to a non-referee seat', () => {
    const actors = initiativeActors({ mode: 'side', groups, tokens, gmUid: GM, defaultDie: 'd6' });
    expect(actors.find((a) => a.refId === 'party')?.ownerUid).toBe('player-1');
    // Nobody will press a die for the monsters — the referee's client stages it.
    expect(actors.find((a) => a.refId === 'monsters')?.ownerUid).toBeUndefined();
  });

  it('does not count the referee’s own tokens as a player owner', () => {
    const actors = initiativeActors({
      mode: 'side',
      groups: [group('monsters', ['gob1'])],
      tokens: [token('gob1', GM)],
      gmUid: GM,
      defaultDie: 'd6',
    });
    expect(actors[0]?.ownerUid).toBeUndefined();
  });

  it('skips inactive groups', () => {
    const actors = initiativeActors({
      mode: 'side',
      groups: [group('party', ['pc1']), group('offstage', ['gob1'], false)],
      tokens,
      gmUid: GM,
      defaultDie: 'd6',
    });
    expect(actors.map((a) => a.refId)).toEqual(['party']);
  });

  it('takes the die from the encounter profile, falling back to the session default', () => {
    const encounterTemplate: ProfileTemplateField[] = [
      { id: 'init', label: 'Initiative', type: 'initiative' },
    ];
    expect(
      initiativeActors({
        mode: 'side',
        groups,
        tokens,
        gmUid: GM,
        defaultDie: 'd6',
        encounterTemplate,
        encounterValues: { init: 'd8' },
      })[0]?.die,
    ).toBe('d8');
    expect(
      initiativeActors({ mode: 'side', groups, tokens, gmUid: GM, defaultDie: 'd6' })[0]?.die,
    ).toBe('d6');
  });
});

describe('initiativeActors — individual mode', () => {
  const tokens = [token('pc1', 'player-1'), token('pc2', 'player-1'), token('gob1')];
  const groups = [group('party', ['pc1', 'pc2']), group('monsters', ['gob1'])];

  it('produces one actor per member token of every active group', () => {
    const actors = initiativeActors({
      mode: 'individual',
      groups,
      tokens,
      gmUid: GM,
      defaultDie: 'd6',
    });
    expect(actors.map((a) => a.refId)).toEqual(['pc1', 'pc2', 'gob1']);
  });

  it('gives one player both of their characters, under distinct slots', () => {
    const actors = initiativeActors({
      mode: 'individual',
      groups,
      tokens,
      gmUid: GM,
      defaultDie: 'd6',
    });
    const mine = actors.filter((a) => a.ownerUid === 'player-1');
    expect(mine).toHaveLength(2);
    expect(mine.map((a) => initiativeSlotId('individual', a))).toEqual([
      'player-1:pc1',
      'player-1:pc2',
    ]);
  });

  it('does not duplicate a token that is in two active groups', () => {
    const actors = initiativeActors({
      mode: 'individual',
      groups: [group('a', ['pc1']), group('b', ['pc1'])],
      tokens,
      gmUid: GM,
      defaultDie: 'd6',
    });
    expect(actors.map((a) => a.refId)).toEqual(['pc1']);
  });

  it('takes each character’s die from their own profile', () => {
    const profileTemplate: ProfileTemplateField[] = [
      { id: 'init', label: 'Initiative', type: 'initiative' },
    ];
    const profiles = [{ seatId: 'player-1', values: { init: 'd20' } } as ProfileInstance];
    const actors = initiativeActors({
      mode: 'individual',
      groups,
      tokens,
      gmUid: GM,
      defaultDie: 'd6',
      profileTemplate,
      profiles,
    });
    expect(actors.find((a) => a.refId === 'pc1')?.die).toBe('d20');
    // The unowned goblin has no profile, so it falls back to the session die.
    expect(actors.find((a) => a.refId === 'gob1')?.die).toBe('d6');
  });
});

describe('unassignedActors', () => {
  it('picks out exactly the actors the referee’s client must stage', () => {
    const actors = [
      { refId: 'party', ownerUid: 'u1', die: 'd6' },
      { refId: 'monsters', die: 'd6' },
    ];
    expect(unassignedActors(actors).map((a) => a.refId)).toEqual(['monsters']);
  });
});
