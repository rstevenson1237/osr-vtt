import { describe, expect, it } from 'vitest';
import type { Encounter, EncounterOrderEntry, RollPart } from '../types.js';
import {
  addRefToEncounter,
  advanceTurn,
  applySharedRollToInitiative,
  buildOrder,
  previousTurn,
  removeRefFromEncounter,
  setInit,
  sortOrder,
  syncOrder,
  toggleActed,
} from './initiative.js';

function encounter(order: EncounterOrderEntry[], overrides: Partial<Encounter> = {}): Encounter {
  return { mode: 'side', round: 1, order, currentIndex: 0, ...overrides };
}

describe('buildOrder', () => {
  it('builds one entry per active ref, unacted and uninitiated', () => {
    const order = buildOrder('side', ['party', 'goblins']);
    expect(order).toEqual([
      { refType: 'side', refId: 'party', acted: false },
      { refType: 'side', refId: 'goblins', acted: false },
    ]);
  });
});

describe('syncOrder', () => {
  it('preserves init/acted for refs that stay active', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', init: 4, acted: true },
      { refType: 'side', refId: 'goblins', init: 2, acted: false },
    ];
    const result = syncOrder(order, 'side', ['party', 'goblins']);
    expect(result).toEqual(order);
  });

  it('drops refs no longer active', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', init: 4, acted: false },
      { refType: 'side', refId: 'goblins', init: 2, acted: false },
    ];
    const result = syncOrder(order, 'side', ['party']);
    expect(result.map((e) => e.refId)).toEqual(['party']);
  });

  it('appends newly-active refs at the end, uninitiated', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', init: 4, acted: false },
    ];
    const result = syncOrder(order, 'side', ['party', 'cultists']);
    expect(result).toEqual([
      { refType: 'side', refId: 'party', init: 4, acted: false },
      { refType: 'side', refId: 'cultists', acted: false },
    ]);
  });
});

describe('sortOrder', () => {
  it('sorts by init descending', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'a', init: 2, acted: false },
      { refType: 'side', refId: 'b', init: 5, acted: false },
      { refType: 'side', refId: 'c', init: 3, acted: false },
    ];
    expect(sortOrder(order).map((e) => e.refId)).toEqual(['b', 'c', 'a']);
  });

  it('sorts uninitiated entries last, preserving their relative order', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'a', acted: false },
      { refType: 'side', refId: 'b', init: 5, acted: false },
      { refType: 'side', refId: 'c', acted: false },
    ];
    expect(sortOrder(order).map((e) => e.refId)).toEqual(['b', 'a', 'c']);
  });
});

describe('setInit / toggleActed', () => {
  it('sets a specific entry without touching others', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'a', acted: false },
      { refType: 'side', refId: 'b', acted: false },
    ];
    const result = setInit(order, 'b', 6);
    expect(result[0]?.init).toBeUndefined();
    expect(result[1]?.init).toBe(6);
  });

  it('flips the acted flag for one entry', () => {
    const order: EncounterOrderEntry[] = [{ refType: 'side', refId: 'a', acted: false }];
    expect(toggleActed(order, 'a')[0]?.acted).toBe(true);
    expect(toggleActed(toggleActed(order, 'a'), 'a')[0]?.acted).toBe(false);
  });
});

describe('advanceTurn', () => {
  const order: EncounterOrderEntry[] = [
    { refType: 'side', refId: 'party', init: 5, acted: false },
    { refType: 'side', refId: 'goblins', init: 3, acted: false },
  ];

  it('steps to the next index within the round', () => {
    const result = advanceTurn(encounter(order, { currentIndex: 0 }));
    expect(result.currentIndex).toBe(1);
    expect(result.round).toBe(1);
  });

  it('wraps past the end: increments round, resets index, clears acted flags', () => {
    const actedOrder = order.map((e) => ({ ...e, acted: true }));
    const result = advanceTurn(encounter(actedOrder, { currentIndex: 1, round: 1 }));
    expect(result.currentIndex).toBe(0);
    expect(result.round).toBe(2);
    expect(result.order.every((e) => !e.acted)).toBe(true);
  });

  it('is a no-op on an empty order', () => {
    const empty = encounter([]);
    expect(advanceTurn(empty)).toEqual(empty);
  });
});

describe('previousTurn', () => {
  const order: EncounterOrderEntry[] = [
    { refType: 'side', refId: 'party', init: 5, acted: false },
    { refType: 'side', refId: 'goblins', init: 3, acted: false },
  ];

  it('steps back within the round', () => {
    const result = previousTurn(encounter(order, { currentIndex: 1 }));
    expect(result.currentIndex).toBe(0);
    expect(result.round).toBe(1);
  });

  it('wraps before the start: decrements round (never below 1), jumps to the last entry', () => {
    const result = previousTurn(encounter(order, { currentIndex: 0, round: 2 }));
    expect(result.currentIndex).toBe(1);
    expect(result.round).toBe(1);
  });

  it('never decrements round below 1', () => {
    const result = previousTurn(encounter(order, { currentIndex: 0, round: 1 }));
    expect(result.round).toBe(1);
  });
});

describe('applySharedRollToInitiative (Master Plan v2, R3.6.5)', () => {
  const part = (over: Partial<RollPart> = {}): RollPart => ({
    seatId: 'seat-a',
    dice: [{ die: 'd20', sides: 20, kept: 15 }],
    modifier: 0,
    advantage: 'normal',
    total: 15,
    ...over,
  });

  it('individual mode: matches a part to a row via the token owner', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'actor', refId: 'token-alice', acted: false },
      { refType: 'actor', refId: 'token-bob', acted: false },
    ];
    const parts = [part({ seatId: 'alice-uid', total: 17 }), part({ seatId: 'bob-uid', total: 9 })];
    const ownerSeatByTokenId = { 'token-alice': 'alice-uid', 'token-bob': 'bob-uid' };
    const result = applySharedRollToInitiative(order, parts, ownerSeatByTokenId);
    expect(result[0]?.init).toBe(17);
    expect(result[1]?.init).toBe(9);
  });

  it('side mode: matches a part to a row directly via groupId', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', acted: false },
      { refType: 'side', refId: 'goblins', acted: false },
    ];
    const parts = [part({ seatId: 'party', total: 12 }), part({ seatId: 'goblins', total: 6 })];
    const result = applySharedRollToInitiative(order, parts, {});
    expect(result[0]?.init).toBe(12);
    expect(result[1]?.init).toBe(6);
  });

  it('leaves a row untouched when no part matches it (unstaged seat)', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'actor', refId: 'token-alice', init: 3, acted: true },
      { refType: 'actor', refId: 'token-bob', acted: false },
    ];
    const parts = [part({ seatId: 'alice-uid', total: 20 })];
    const ownerSeatByTokenId = { 'token-alice': 'alice-uid', 'token-bob': 'bob-uid' };
    const result = applySharedRollToInitiative(order, parts, ownerSeatByTokenId);
    expect(result[0]).toEqual({ refType: 'actor', refId: 'token-alice', init: 20, acted: true });
    // Bob never staged — his row is untouched, not zeroed or removed.
    expect(result[1]).toEqual({ refType: 'actor', refId: 'token-bob', acted: false });
  });

  it('leaves a row untouched when its token has no owning seat', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'actor', refId: 'token-monster', acted: false },
    ];
    const result = applySharedRollToInitiative(order, [part()], {});
    expect(result[0]?.init).toBeUndefined();
  });

  it('matches a Call for Initiative’s {uid}:{tokenId} character slots', () => {
    // Individual mode keys owned characters compositely so one player can
    // stage several; the bare-uid form still works for an ordinary shared roll.
    const order: EncounterOrderEntry[] = [
      { refType: 'actor', refId: 'tok1', acted: false },
      { refType: 'actor', refId: 'tok2', acted: false },
    ];
    const parts = [part({ seatId: 'u1:tok1', total: 14 }), part({ seatId: 'u1:tok2', total: 5 })];
    const result = applySharedRollToInitiative(order, parts, { tok1: 'u1', tok2: 'u1' });
    expect(result[0]?.init).toBe(14);
    expect(result[1]?.init).toBe(5);
  });

  it('matches an unowned token staged by the referee under its bare id', () => {
    const order: EncounterOrderEntry[] = [{ refType: 'actor', refId: 'goblin', acted: false }];
    const result = applySharedRollToInitiative(order, [part({ seatId: 'goblin', total: 8 })], {});
    expect(result[0]?.init).toBe(8);
  });

  it('prefers the character slot over the bare-uid slot when both exist', () => {
    const order: EncounterOrderEntry[] = [{ refType: 'actor', refId: 'tok1', acted: false }];
    const parts = [part({ seatId: 'u1', total: 2 }), part({ seatId: 'u1:tok1', total: 19 })];
    const result = applySharedRollToInitiative(order, parts, { tok1: 'u1' });
    expect(result[0]?.init).toBe(19);
  });
});

describe('syncOrder liveIds', () => {
  it('drops a row whose group/token no longer exists, not just an inactive one', () => {
    // `deleteGroup`/`deleteToken` never touch the encounter doc, so without
    // this a deleted ref's row lingered in the order indefinitely.
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', init: 5, acted: false },
      { refType: 'side', refId: 'ghosts', init: 3, acted: false },
    ];
    const result = syncOrder(order, 'side', ['party', 'ghosts'], new Set(['party']));
    expect(result.map((e) => e.refId)).toEqual(['party']);
  });

  it('keeps every active ref when no liveIds set is supplied', () => {
    const order: EncounterOrderEntry[] = [
      { refType: 'side', refId: 'party', init: 5, acted: false },
    ];
    expect(syncOrder(order, 'side', ['party'])).toHaveLength(1);
  });
});

describe('addRefToEncounter / removeRefFromEncounter', () => {
  const base = { mode: 'individual' as const, round: 1, order: [], currentIndex: 0 };

  it('adds an ungrouped token to the order and pins it', () => {
    // The only route into a fight used to be token -> Group -> flip [Active].
    const result = addRefToEncounter(base, 'actor', 'lone-wolf');
    expect(result.order).toEqual([{ refType: 'actor', refId: 'lone-wolf', acted: false }]);
    expect(result.pinnedRefIds).toEqual(['lone-wolf']);
  });

  it('is a no-op when the ref is already in the order', () => {
    const once = addRefToEncounter(base, 'actor', 'lone-wolf');
    expect(addRefToEncounter(once, 'actor', 'lone-wolf')).toBe(once);
  });

  it('treats the same id under a different refType as a different row', () => {
    const asActor = addRefToEncounter(base, 'actor', 'x');
    expect(addRefToEncounter(asActor, 'side', 'x').order).toHaveLength(2);
  });

  it('removes a ref, unpins it, and keeps currentIndex in range', () => {
    const two = addRefToEncounter(addRefToEncounter(base, 'actor', 'a'), 'actor', 'b');
    const result = removeRefFromEncounter({ ...two, currentIndex: 1 }, 'b');
    expect(result.order.map((e) => e.refId)).toEqual(['a']);
    expect(result.pinnedRefIds).toEqual(['a']);
    expect(result.currentIndex).toBe(0);
  });
});
