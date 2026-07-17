import type { RolledDie } from '@osr-vtt/shared';
import { kindForSides, type DieKind, type FaceVariant } from './geometry';

/**
 * Pure value-mapping for the dice renderer (Master Plan v2, R3.1). Kept free of
 * Three.js / Rapier so the "which number ends up on top" logic — the part that
 * must be *correct*, not merely pretty — is unit tested on its own:
 *
 *  - `toPhysicalDice` expands a roll's logical dice into the physical dice the
 *    scene draws (d100 → a tinted tens/units pair; a d10's 10 reads as "0");
 *  - `assignTarget` performs the no-flip **remap**: given the face the die
 *    actually lands on, it reorders the printed numbers so that face carries
 *    the required value — no post-settle rotation, so no flip (U1).
 */

export interface PhysicalDie {
  kind: DieKind;
  variant: FaceVariant;
  /** The number that must read on top after this die settles. */
  targetLabel: string;
  /** A shared roll tints each seat's dice (Master Plan v2, R3.6.4) — an
   * `hsl()`/`#rrggbb` string multiplied onto the die's face color. Absent
   * for a solo roll. */
  tint?: string;
  /** A dropped die (Master Plan v2, R20.2): rendered dimmed so advantage is
   * visibly doing something — a Separate-mode companion that lost its pair, or
   * a Summed-mode die removed from the pool. Absent (falsy) for kept dice. */
  dimmed?: boolean;
}

/** Tens/units split for a d100 rolled as a single 1..100 value; rendered as
 * two d10s (R3.2). e.g. 47 ⇒ "40" + "7"; 5 ⇒ "00" + "5"; 100 ⇒ "00" + "0". */
export function hundredSplit(kept: number): { tens: string; units: string } {
  const n = kept % 100; // 100 → 0
  const tensVal = n - (n % 10);
  const units = n % 10;
  return { tens: tensVal === 0 ? '00' : String(tensVal), units: String(units) };
}

/** Pushes the physical die/dice that render one face value onto `out`. A d100
 * face becomes a tens/units pair; both inherit the same `tint`/`dimmed`. */
function pushPhysical(
  out: PhysicalDie[],
  sides: number,
  value: number,
  dimmed: boolean,
  tint: string | undefined,
): void {
  const extra = { ...(tint ? { tint } : {}), ...(dimmed ? { dimmed: true } : {}) };
  if (sides === 100) {
    const { tens, units } = hundredSplit(value);
    out.push({ kind: 'd10', variant: 'tens', targetLabel: tens, ...extra });
    out.push({ kind: 'd10', variant: 'normal', targetLabel: units, ...extra });
    return;
  }
  const kind = kindForSides(sides);
  const targetLabel = sides === 10 ? String(value % 10) : String(value); // d10 10 → "0"
  out.push({ kind, variant: 'normal', targetLabel, ...extra });
}

/**
 * Expands the roll's logical dice into physical dice to render. `tints`, when
 * given, is parallel to `dice` (one entry per logical die — a d100's pair both
 * inherit its single tint).
 *
 * Dropped dice are rendered too, dimmed (Master Plan v2, R20.2): a Separate
 * advantage/disadvantage die carries its `dropped` companion face, drawn as a
 * second dimmed die beside the kept one; a Summed drop-highest/lowest die is
 * flagged `poolDropped`, drawn as a single dimmed die.
 */
export function toPhysicalDice(dice: RolledDie[], tints?: (string | undefined)[]): PhysicalDie[] {
  const out: PhysicalDie[] = [];
  dice.forEach((d, i) => {
    const tint = tints?.[i];
    pushPhysical(out, d.sides, d.kept, Boolean(d.poolDropped), tint);
    if (d.dropped !== undefined) pushPhysical(out, d.sides, d.dropped, true, tint);
  });
  return out;
}

/** The natural label set printed on a die kind (before remap). */
export function labelPool(kind: DieKind, variant: FaceVariant, faceCount: number): string[] {
  if (variant === 'tens') {
    return Array.from({ length: 10 }, (_, i) => (i === 0 ? '00' : String(i * 10)));
  }
  if (kind === 'd10') return Array.from({ length: 10 }, (_, i) => String(i));
  return Array.from({ length: faceCount }, (_, i) => String(i + 1));
}

/**
 * Reorders `labels` so the die's landed face carries `target`, keeping every
 * label distinct (a swap, so the die still shows each number exactly once). If
 * `target` isn't in the natural set (an oddball die size), it is simply stamped
 * onto the landed face.
 */
export function assignTarget(labels: string[], landedIndex: number, target: string): string[] {
  const out = [...labels];
  const at = out.indexOf(target);
  if (at === -1) {
    out[landedIndex] = target;
    return out;
  }
  [out[landedIndex], out[at]] = [out[at]!, out[landedIndex]!];
  return out;
}
