import { resolveSeparate } from '../resolution.js';
import type { AdvantageMode, ResultClass, RolledDie, RollPart, SharedRollSlot } from '../types.js';

/**
 * Dice engine (Plan §7 Phase 3, Encounter Screen Spec §6). Mechanics-agnostic:
 * this module rolls and arranges numbers; it never reads a Profile field
 * value to decide anything. Mode/modifier/advantage are roll-time choices a
 * human sets on the tray before hitting Roll — not derivations from a stat
 * (Plan §2.5 hard rule).
 */

// ---- deterministic seeded PRNG — every client re-derives the same faces
// from the same seed, so a single Firestore write settles the result for
// everyone without a server round-trip (Plan §1.2, §4). ----

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

/** Deterministically derives one face (1..sides) per entry in `sidesList`,
 * in order. The lower-level primitive `rollTray` builds on. */
export function rollFaces(seed: string, sidesList: number[]): number[] {
  const rng = mulberry32(hashSeed(seed));
  return sidesList.map((sides) => Math.floor(rng() * sides) + 1);
}

// ---- dice expressions: "d6", "2d20", "d100" (case-insensitive) ----

export interface DieExpr {
  count: number;
  sides: number;
}

/** Parses a die expression like "d6" or "2d20". Returns `null` for anything
 * else — an unparseable string (e.g. free text typed into a `roll` field)
 * simply can't be staged, rather than throwing. The app stores whatever a
 * `roll` field holds without judging it (Plan §2.5); parsing failure here is
 * a UI no-op, not an error condition. */
export function parseDieExpr(raw: string): DieExpr | null {
  const match = /^(\d*)d(\d+)$/i.exec(raw.trim());
  if (!match) return null;
  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = Number.parseInt(match[2]!, 10);
  if (count < 1 || sides < 1) return null;
  return { count, sides };
}

export interface DieSlot {
  /** The single die expression this slot came from, e.g. "d6" — always one
   * physical die, even when expanded out of a compound "2d6". */
  die: string;
  sides: number;
}

/** Expands staged expressions into one slot per individual die — "2d6"
 * becomes two `d6` slots — so Separate mode can flag each die on its own
 * (Encounter Screen Spec §6). Unparseable entries are dropped silently. */
export function expandDiceExprs(exprs: string[]): DieSlot[] {
  const slots: DieSlot[] = [];
  for (const raw of exprs) {
    const parsed = parseDieExpr(raw);
    if (!parsed) continue;
    const die = `d${parsed.sides}`;
    for (let i = 0; i < parsed.count; i++) slots.push({ die, sides: parsed.sides });
  }
  return slots;
}

/** Rolls one value per `DieSlot`, deterministically from `seed`. Under
 * advantage/disadvantage every die is rolled twice and the higher/lower
 * face kept — a roll-time toggle the human sets on the tray, never a
 * derivation from a stat. */
export function rollTray(
  seed: string,
  slots: DieSlot[],
  advantage: AdvantageMode,
): RolledDie[] {
  const rng = mulberry32(hashSeed(seed));
  const roll = (sides: number) => Math.floor(rng() * sides) + 1;
  return slots.map(({ die, sides }) => {
    const a = roll(sides);
    if (advantage === 'normal') return { die, sides, kept: a };
    const b = roll(sides);
    const kept = advantage === 'advantage' ? Math.max(a, b) : Math.min(a, b);
    const dropped = kept === a ? b : a;
    return { die, sides, kept, dropped };
  });
}

/** Summed (OSE) mode: every kept face plus the flat modifier (Encounter
 * Screen Spec §6). */
export function summedTotal(dice: RolledDie[], modifier: number): number {
  return dice.reduce((sum, d) => sum + d.kept, 0) + modifier;
}

/** Separate mode: each die flagged on its own via the fixed Success(4+)/
 * Complication(2-3)/Failure(1) convention (Encounter Screen Spec §6). This
 * classifies the rolled *face*, never a Profile value. */
export function separateFlags(dice: RolledDie[]): ResultClass[] {
  return dice.map((d) => resolveSeparate(d.kept));
}

/** Starter die-size palette for the tray's "add a die" buttons — a display
 * convenience, not an exhaustive whitelist (any `NdM` expression parses). */
export const DIE_SIDE_OPTIONS = [4, 6, 8, 10, 12, 20, 100] as const;

/**
 * Expands a shared roll's staged slots into `Roll.parts` (Master Plan v2,
 * R3.6.2). The one invariant every client depends on: consume the seed's RNG
 * stream in **seat-id-sorted order**, never `Object.keys` insertion order —
 * Firestore doesn't preserve map key write order, so this is what makes
 * re-deriving the same `parts` from the same `(seed, slots)` pair on any
 * client, regardless of which player staged first, land on identical faces.
 *
 * A slot that never flipped `ready` (or was never staged at all) is cleanly
 * skipped — absent from the result, not rolled with a placeholder.
 */
export function expandSharedRollSlots(
  seed: string,
  slots: Record<string, SharedRollSlot>,
): RollPart[] {
  const seatIds = Object.keys(slots)
    .filter((seatId) => slots[seatId]!.ready)
    .sort();

  const rng = mulberry32(hashSeed(seed));
  const roll = (sides: number) => Math.floor(rng() * sides) + 1;

  return seatIds.map((seatId) => {
    const slot = slots[seatId]!;
    const dieSlots = expandDiceExprs([slot.die]);
    const dice: RolledDie[] = dieSlots.map(({ die, sides }) => {
      const a = roll(sides);
      if (slot.advantage === 'normal') return { die, sides, kept: a };
      const b = roll(sides);
      const kept = slot.advantage === 'advantage' ? Math.max(a, b) : Math.min(a, b);
      const dropped = kept === a ? b : a;
      return { die, sides, kept, dropped };
    });
    return {
      seatId,
      dice,
      modifier: slot.modifier,
      advantage: slot.advantage,
      total: summedTotal(dice, slot.modifier),
      flags: separateFlags(dice),
    };
  });
}
