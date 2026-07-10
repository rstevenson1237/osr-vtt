import { describe, expect, it } from 'vitest';
import type { Encounter, EncounterOrderEntry } from '../types.js';
import {
  advanceTurn,
  buildOrder,
  previousTurn,
  rollInitiative,
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
    const order: EncounterOrderEntry[] = [{ refType: 'side', refId: 'party', init: 4, acted: false }];
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

describe('rollInitiative', () => {
  it('returns a value within 1..dieMax', () => {
    for (let i = 0; i < 50; i++) {
      const roll = rollInitiative(6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
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
