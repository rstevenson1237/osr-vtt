import { describe, expect, it } from 'vitest';
import { createSeed, rollDice } from './seed';

describe('rollDice', () => {
  it('is deterministic for a given seed', () => {
    expect(rollDice('abc', 4)).toEqual(rollDice('abc', 4));
  });

  it('produces faces within [1, sides]', () => {
    for (const r of rollDice('xyz', 30, 6)) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
  });

  it('produces different sequences for different seeds', () => {
    expect(rollDice('seed-1', 6)).not.toEqual(rollDice('seed-2', 6));
  });

  it('respects the requested die count', () => {
    expect(rollDice('n', 5)).toHaveLength(5);
  });
});

describe('createSeed', () => {
  it('produces unique-enough seeds across calls', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => createSeed()));
    expect(seeds.size).toBe(20);
  });
});
