import { characterSlotId } from '../types.js';
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
  /**
   * Every ref that still *exists* (live groupIds in Side mode, tokenIds in
   * Individual). Without it a row whose group or token was deleted lingers in
   * `order` forever — `deleteGroup`/`deleteToken` don't touch the encounter
   * doc, and the row is only "inactive", not gone. Omit to keep the old
   * behaviour of pruning on `activeIds` alone.
   */
  liveIds?: Set<string>,
): EncounterOrderEntry[] {
  // Filter the *wanted* set once, up front: dropping a dead ref from `kept`
  // alone would just see it re-added below as a "newly active" ref.
  const wanted = liveIds ? activeIds.filter((id) => liveIds.has(id)) : activeIds;
  const activeSet = new Set(wanted);
  const kept = order.filter((e) => e.refType === refType && activeSet.has(e.refId));
  const keptIds = new Set(kept.map((e) => e.refId));
  const added: EncounterOrderEntry[] = wanted
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

/**
 * Add a ref to the order directly, outside the `[Active]` group mechanism.
 *
 * This is what lets an **ungrouped** token be in a fight at all: before it,
 * the only route in was token → Group → flip `[Active]`, so a lone wandering
 * monster had to be given a group first. The ref is also recorded in
 * `pinnedRefIds` so `syncOrder`'s reconciliation keeps it rather than pruning
 * it as "not in an active group".
 *
 * A ref already in the order is left alone (adding twice is a no-op).
 */
export function addRefToEncounter(
  encounter: Encounter,
  refType: EncounterRefType,
  refId: string,
): Encounter {
  if (encounter.order.some((e) => e.refId === refId && e.refType === refType)) return encounter;
  return {
    ...encounter,
    order: [...encounter.order, { refType, refId, acted: false }],
    pinnedRefIds: [...new Set([...(encounter.pinnedRefIds ?? []), refId])],
  };
}

/** Remove a ref from the order, dropping it from `pinnedRefIds` too and
 * keeping `currentIndex` in range. */
export function removeRefFromEncounter(encounter: Encounter, refId: string): Encounter {
  const order = encounter.order.filter((e) => e.refId !== refId);
  return {
    ...encounter,
    order,
    currentIndex: Math.min(encounter.currentIndex, Math.max(order.length - 1, 0)),
    pinnedRefIds: (encounter.pinnedRefIds ?? []).filter((id) => id !== refId),
  };
}

/** Set (or clear) the typed/rolled initiative number for one entry. */
export function setInit(
  order: EncounterOrderEntry[],
  refId: string,
  init: number | undefined,
  /** Match the row's kind too, so a tokenId that happens to equal a groupId
   * can't double-write. The entry type carries the discriminator; the mutators
   * used to ignore it. */
  refType?: EncounterRefType,
): EncounterOrderEntry[] {
  return order.map((e) =>
    e.refId === refId && (refType === undefined || e.refType === refType) ? { ...e, init } : e,
  );
}

/** Flip the GM's manual "acted this round" flag (display only — Spec §4). */
export function toggleActed(
  order: EncounterOrderEntry[],
  refId: string,
  refType?: EncounterRefType,
): EncounterOrderEntry[] {
  return order.map((e) =>
    e.refId === refId && (refType === undefined || e.refType === refType)
      ? { ...e, acted: !e.acted }
      : e,
  );
}

// `rollInitiative(dieMax = 6)` lived here: a bare `Math.random()` that produced
// no seed, no `Roll` doc, no log entry, no dice animation and no broadcast, so
// players never saw the most important roll of a fight — only the number that
// appeared in the tracker. It is gone; initiative now goes through
// `dice/publish.ts`'s `publishRoll` like every other roll, and the referee's
// staged Call for Initiative resolves through the shared-roll machinery.

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
    // An `actor` row can have staged under any of three slot ids, so try them
    // in the order they're produced (see `initiativeSlotId`):
    //   1. `{uid}:{tokenId}` — an owned character in a Call for Initiative,
    //      which is what lets one player stage several characters;
    //   2. the bare tokenId — an unowned token the referee staged;
    //   3. the owning seat id — an ordinary shared roll, where a player's slot
    //      is keyed by their bare uid.
    const candidates =
      entry.refType === 'actor'
        ? [
            ...(ownerSeatByTokenId[entry.refId]
              ? [characterSlotId(ownerSeatByTokenId[entry.refId]!, entry.refId)]
              : []),
            entry.refId,
            ...(ownerSeatByTokenId[entry.refId] ? [ownerSeatByTokenId[entry.refId]!] : []),
          ]
        : [entry.refId];
    const part = candidates.map((id) => bySlot.get(id)).find((p) => p !== undefined);
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
