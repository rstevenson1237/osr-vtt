import type { ResultClass } from './types.js';

/**
 * Separate resolution mode (Plan §8.2): classify a single d6 face.
 * 4+ = success, 2-3 = complication, 1 = failure.
 *
 * This is roll-resolution *logic*, not game-mechanics interpretation — it
 * classifies a die face, not a character stat, and applies identically
 * regardless of what any Profile field is labeled or holds (§2.5 hard rule).
 */
export function resolveSeparate(die: number): ResultClass {
  if (!Number.isInteger(die)) {
    throw new RangeError(`resolveSeparate expects an integer die face, got ${die}`);
  }
  if (die >= 4) return 'success';
  if (die >= 2) return 'complication';
  return 'failure';
}

// Summed (OSE) resolution mode is Phase 3 scope (Plan §7) — not implemented here.
