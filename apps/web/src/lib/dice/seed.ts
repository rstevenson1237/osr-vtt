/**
 * Deterministic seeded dice engine (Plan §1.2, §8.8): "the rolling client
 * computes seed + params + result and writes it once." Every client derives
 * the same face values from the same seed via this pure function — no
 * server round-trip needed to agree on a result.
 *
 * `scene.ts` re-simulates the same seed in Rapier for the visual tumble, but
 * the *authoritative* face values come from here, not from reading resting
 * physics state. Rationale: Owlbear's own roller derives the result directly
 * from cross-client-identical Rapier physics steps, which they can rely on
 * because they control the whole physics/animation pipeline end to end. Our
 * simpler Phase-0 Three.js/Rapier tumble is a decorative re-simulation of the
 * same seed, not a bit-for-bit reimplementation of their engine — so we
 * don't assume float-identical physics settling across every browser/CPU.
 * Anchoring the log/result to this cheap, provably-deterministic PRNG (and
 * having the animation land on that precomputed face) is a small, testable
 * building block that gets the "both clients render the same face" Phase 0
 * acceptance criterion right without betting on cross-platform physics
 * determinism we haven't verified for our simplified die.
 */

function hashSeed(seed: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a new roll. Not cryptographically secure — fine for a
 * trust-based home game (Plan: no anti-cheat needed). */
export function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deterministically derive `count` face values (1..sides) from a seed. */
export function rollDice(seed: string, count: number, sides = 6): number[] {
  const rng = mulberry32(hashSeed(seed));
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(rng() * sides) + 1);
  }
  return results;
}
