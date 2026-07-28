import type { ResultClass, RollConvention, RollMode } from './types.js';

/**
 * Separate resolution mode (Plan §8.2): classify a single d6 face.
 * 4+ = success, 2-3 = complication, 1 = failure.
 *
 * This is roll-resolution *logic*, not game-mechanics interpretation — it
 * classifies a die face, not a character stat, and applies identically
 * regardless of what any Profile field is labeled or holds (§2.5 hard rule).
 *
 * **Scope note (v16).** This function is the historical hardcoded convention.
 * It survives as the definition of `DEFAULT_ROLL_CONVENTIONS`' bands and for
 * the unit tests that pin them, but it is no longer the display path: it was
 * being applied to *every* die size, so a d20 face of 4 reported "success".
 * All classification for display now goes through `classify`, which consults
 * the room's referee-authored conventions and returns `null` when none match.
 */
export function resolveSeparate(die: number): ResultClass {
  if (!Number.isInteger(die)) {
    throw new RangeError(`resolveSeparate expects an integer die face, got ${die}`);
  }
  if (die >= 4) return 'success';
  if (die >= 2) return 'complication';
  return 'failure';
}

/**
 * What a roll being classified looks like to a convention.
 *
 * `sides` is optional because a **mixed** summed pool (`2d6 + 1d8`) has no one
 * die size. Leaving it undefined means any convention that names a `sides`
 * simply doesn't apply, so a mixed pool falls through to the mode-only or
 * catch-all convention — which is the honest answer rather than picking one of
 * the pool's die sizes arbitrarily.
 */
export interface RollContext {
  mode: RollMode;
  sides?: number;
}

/**
 * Specificity score for a convention against a context: a convention naming
 * both `mode` and `sides` beats one naming either, which beats a catch-all.
 * Returns `-1` when the convention doesn't apply at all.
 */
function specificity(convention: RollConvention, ctx: RollContext): number {
  const { mode, sides } = convention.applies;
  if (mode !== undefined && mode !== ctx.mode) return -1;
  if (sides !== undefined && sides !== ctx.sides) return -1;
  return (mode !== undefined ? 1 : 0) + (sides !== undefined ? 1 : 0);
}

/**
 * The convention that governs a given roll, or `null` if the referee has
 * authored none that applies. Most specific wins; ties go to the earlier
 * entry, so the referee's own ordering is the tie-break they can see.
 */
export function pickConvention(
  conventions: RollConvention[] | undefined,
  ctx: RollContext,
): RollConvention | null {
  let best: RollConvention | null = null;
  let bestScore = -1;
  for (const convention of conventions ?? []) {
    const score = specificity(convention, ctx);
    if (score > bestScore) {
      best = convention;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Classify one number against the room's conventions.
 *
 * The app looks up which band the number falls in and hands back that band's
 * colour class and the referee's own word for it. It never decides what the
 * band *means* — that is the whole point of conventions being data (§2.5).
 *
 * `null` means "no convention applies", which renders as faces and totals with
 * no classification at all. That is deliberate and strictly more honest than
 * the pre-v16 behaviour of applying d6 bands to every die.
 *
 * Separate mode classifies each die face; Summed mode classifies the total.
 */
export function classify(
  conventions: RollConvention[] | undefined,
  ctx: RollContext,
  value: number,
): { class: ResultClass; label: string } | null {
  const convention = pickConvention(conventions, ctx);
  if (!convention) return null;
  for (const band of convention.bands) {
    if (band.min !== undefined && value < band.min) continue;
    if (band.max !== undefined && value > band.max) continue;
    return { class: band.class, label: band.label };
  }
  return null;
}
