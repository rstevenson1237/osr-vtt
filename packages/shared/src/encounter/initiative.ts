import type { Encounter, EncounterOrderEntry, EncounterRefType, RollPart } from '../types.js';

/**
 * Initiative arrangement (Encounter Screen Spec §4). Mechanics-agnostic:
 * every function here *arranges, sorts, or steps* a pool the GM already
 * populated — none of it computes a number from a stat. Numbers are typed
 * by the GM or pulled from `rollInitiative`, a plain die roll.
 */

/** Build a fresh `order` from the currently `[Active]` refs, in Side mode
 * (`refId` = groupId) or Individual mode (`refId` = tokenId). Used both to
 * start an encounter and to reconcile the pool when `[Active]` toggles
 * while combat is already running. */
export function buildOrder(refType: EncounterRefType, activeIds: string[]): EncounterOrderEntry[] {
  return activeIds.map((refId) => ({ refType, refId, acted: false }));
}

/** Reconcile an in-progress `order` against the current `[Active]` set,
 * preserving `init`/`acted` for refs that remain active, dropping refs no
 * longer active, and appending newly-active refs at the end (Spec §9: the
 * `[Active]` pool is one shared thing a toggle can add to or remove from
 * mid-encounter). */
export function syncOrder(
  order: EncounterOrderEntry[],
  refType: EncounterRefType,
  activeIds: string[],
): EncounterOrderEntry[] {
  const activeSet = new Set(activeIds);
  const kept = order.filter((e) => e.refType === refType && activeSet.has(e.refId));
  const keptIds = new Set(kept.map((e) => e.refId));
  const added: EncounterOrderEntry[] = activeIds
    .filter((id) => !keptIds.has(id))
    .map((refId) => ({ refType, refId, acted: false }));
  return [...kept, ...added];
}

/** Stable sort by `init` descending; entries with no `init` yet sort last
 * (a pure arrangement step — never a derivation). */
export function sortOrder(order: EncounterOrderEntry[]): EncounterOrderEntry[] {
  return [...order]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const ai = a.entry.init;
      const bi = b.entry.init;
      if (ai === undefined && bi === undefined) return a.index - b.index;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      if (ai !== bi) return bi - ai;
      return a.index - b.index;
    })
    .map((x) => x.entry);
}

/** Set (or clear) the typed/rolled initiative number for one entry. */
export function setInit(
  order: EncounterOrderEntry[],
  refId: string,
  init: number | undefined,
): EncounterOrderEntry[] {
  return order.map((e) => (e.refId === refId ? { ...e, init } : e));
}

/** Flip the GM's manual "acted this round" flag (display only — Spec §4). */
export function toggleActed(order: EncounterOrderEntry[], refId: string): EncounterOrderEntry[] {
  return order.map((e) => (e.refId === refId ? { ...e, acted: !e.acted } : e));
}

/** A plain die roll (1..dieMax) to drop into an initiative slot — the "or
 * pulled from a dice roll" path in Spec §4. Never a stat computation. */
export function rollInitiative(dieMax = 6): number {
  return Math.floor(Math.random() * dieMax) + 1;
}

/**
 * "Apply results to initiative" (Master Plan v2, R3.6.5) — routes a resolved
 * shared roll's `parts` onto the matching tracker rows. Results are *routed*,
 * never derived: this only copies `part.total` into `init`, the same field a
 * typed or rolled entry already carries. One mechanism handles both modes —
 *
 *  - Individual mode: a row's `refId` is a tokenId; matched via the token's
 *    owning seat (`ownerSeatByTokenId`), since a shared roll's slots are
 *    keyed by seatId.
 *  - Side mode: a row's `refId` is a groupId, matched directly — the referee
 *    stages a side's slot under that same groupId as its key.
 *
 * A row with no matching part is left exactly as it was — apply is explicit,
 * never a partial guess (Gate 4b).
 */
export function applySharedRollToInitiative(
  order: EncounterOrderEntry[],
  parts: RollPart[],
  ownerSeatByTokenId: Record<string, string | undefined>,
): EncounterOrderEntry[] {
  const bySlot = new Map(parts.map((p) => [p.seatId, p]));
  return order.map((entry) => {
    const slotId = entry.refType === 'actor' ? ownerSeatByTokenId[entry.refId] : entry.refId;
    const part = slotId !== undefined ? bySlot.get(slotId) : undefined;
    if (!part || part.total === undefined) return entry;
    return { ...entry, init: part.total };
  });
}

/** Step to the next entry in `order`. Wrapping past the end increments
 * `round`, resets `currentIndex` to 0, and clears every `acted` flag (a new
 * round starts fresh). A no-op on an empty order. */
export function advanceTurn(encounter: Encounter): Encounter {
  if (encounter.order.length === 0) return encounter;
  const next = encounter.currentIndex + 1;
  if (next >= encounter.order.length) {
    return {
      ...encounter,
      currentIndex: 0,
      round: encounter.round + 1,
      order: encounter.order.map((e) => ({ ...e, acted: false })),
    };
  }
  return { ...encounter, currentIndex: next };
}

/** Step to the previous entry, symmetric with `advanceTurn`. Wrapping
 * before the start decrements `round` (never below 1) and jumps to the
 * last entry; `acted` flags are left as-is (undoing a round doesn't erase
 * what happened in it). A no-op on an empty order. */
export function previousTurn(encounter: Encounter): Encounter {
  if (encounter.order.length === 0) return encounter;
  if (encounter.currentIndex === 0) {
    return {
      ...encounter,
      currentIndex: encounter.order.length - 1,
      round: Math.max(1, encounter.round - 1),
    };
  }
  return { ...encounter, currentIndex: encounter.currentIndex - 1 };
}
