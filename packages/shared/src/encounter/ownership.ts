import type { DefaultPlayerGroup, Group, PlayerSeat, Token } from '../types.js';
import { sortGroups } from './ordering.js';

/**
 * Group ownership.
 *
 * Authority used to sit on the token: `Token.ownerSeatId` meant both "who owns
 * this" and "which character profile this token shows", and it gated nothing —
 * no client check and no security rule ever read it. It now means only the
 * second of those. Ownership is a property of the **group**: a seat listed in
 * `Group.memberSeatIds` may act as every character in that group, equally.
 *
 * Two things are deliberately derived rather than stored:
 *
 *  - **The referee is a member of every group.** It follows from `Room.gmUid`,
 *    so transferring GM moves that membership across every group at once, with
 *    no writes and nothing to keep in sync.
 *  - **A dangling `defaultPlayerGroup`** (the referee deleted the group it
 *    names) reads as `'first'`. The board also writes the setting back on
 *    delete, but the read-side fallback is what makes a racing or stale value
 *    harmless rather than a room with nowhere to put joiners.
 *
 * Since SPEC-032 §3 the rule also has to answer for an actor with **no seat at
 * all** — a creature. `canSeatActAs` cannot: it resolves a target seat by
 * looking for a group token linked to it, and a creature has no seat to link
 * to. `canActOnToken`/`canActOnActor` are its token-keyed siblings, not its
 * replacements; a character is still reached through its seat.
 *
 * This module is pure: no store, no Svelte, no Firebase. Enforcement lives in
 * the UI (a sheet you may not act as renders read-only) — `firestore.rules`
 * keeps the room's "any authenticated member" trust model, the same standing
 * token ownership always had.
 */

/** A seat is an owner of `group` if it is listed on it. GM-ness is not
 * considered here — see `canSeatActAs`, which layers it on. */
export function seatIsInGroup(group: Group, seatId: string): boolean {
  return (group.memberSeatIds ?? []).includes(seatId);
}

/** Every group this seat owns, in display order. */
export function groupsForSeat(groups: readonly Group[], seatId: string): Group[] {
  return sortGroups(groups).filter((g) => seatIsInGroup(g, seatId));
}

/**
 * The group a newly joined seat lands in, or `null` for "leave it unassigned".
 *
 * `'unassigned'` is the only setting that yields `null` on purpose. `'first'`
 * yields the first group in board order (also `null` when the room has no
 * groups yet). A literal groupId yields that group — unless it no longer
 * exists, in which case it falls back to `'first'`'s answer, which is the
 * documented behaviour when the referee deletes the group they had chosen.
 */
export function resolveDefaultGroupId(
  setting: DefaultPlayerGroup | undefined,
  groups: readonly Group[],
): string | null {
  if (setting === 'unassigned') return null;
  const ordered = sortGroups(groups);
  const first = ordered[0]?.id ?? null;
  if (setting === undefined || setting === 'first') return first;
  return ordered.some((g) => g.id === setting) ? setting : first;
}

/**
 * May `mySeatId` act as the character whose profile is `targetSeatId` — open
 * its sheet as editable, roll its fields, place its token?
 *
 * True when the seat is the referee, when it is that character's own seat, or
 * when some group lists `mySeatId` as an owner **and** holds a member token
 * linked to `targetSeatId`. The token list is what ties a character (a profile
 * seat) to a group, since groups hold token ids, not seats.
 */
export function canSeatActAs(
  groups: readonly Group[],
  tokens: readonly Token[],
  mySeatId: string,
  targetSeatId: string,
  isGM: boolean,
): boolean {
  if (isGM) return true;
  if (!mySeatId || !targetSeatId) return false;
  if (mySeatId === targetSeatId) return true;
  const ownerBySeat = new Map(tokens.map((t) => [t.id, t.ownerSeatId]));
  return groups.some(
    (g) =>
      seatIsInGroup(g, mySeatId) &&
      g.memberTokenIds.some((id) => ownerBySeat.get(id) === targetSeatId),
  );
}

/**
 * The actor id a token's profile is keyed by (SPEC-032 §2): its owning seat
 * when it has one — a character — and its own token id when it does not — a
 * creature.
 *
 * This is the whole of the key rule, in one place, so that a caller never has
 * to spell `token.ownerSeatId ?? token.id` and get the fallback direction
 * wrong. A character is still reached through its seat, which is what keeps
 * every seat-keyed profile document valid without a rewrite.
 */
export function actorIdForToken(token: Token): string {
  return token.ownerSeatId ?? token.id;
}

/** Does some group list `mySeatId` as an owner *and* hold `tokenId`? The
 * seatless half of the §3 rule, and the inner test `canSeatActAs` performs
 * once it has resolved a target seat back to a token. */
function tokenIsInOwnedGroup(
  groups: readonly Group[],
  mySeatId: string,
  tokenId: string,
): boolean {
  return groups.some((g) => seatIsInGroup(g, mySeatId) && g.memberTokenIds.includes(tokenId));
}

/**
 * May `mySeatId` act on `tokenId` — select it, open its sheet as editable,
 * drag it on the map (SPEC-032 §3)?
 *
 * For a token with an owning seat this is exactly `canSeatActAs` on that seat:
 * a character is still reached through its character, so nothing about the
 * existing rule changes. For a **seatless** token — a creature — the rule is
 * one step shorter, because `canSeatActAs`'s inner "holds a token linked to
 * the target seat" test can never pass when there is no target seat: **is this
 * token in a group I own.** The motivating case is an NPC travelling with the
 * party, in the group and owned by no one player.
 *
 * A token that is **both seatless and ungrouped** — scenery, and the single
 * creature `addCreature` leaves ungrouped — matches no ownership rule at all
 * and is therefore **referee-only** (DEC-036). That falls out of the rule
 * rather than being special-cased: no group holds it, so no group I own holds
 * it.
 *
 * An unknown token id is `false` for anyone but the referee. There is nothing
 * to own.
 */
export function canActOnToken(
  groups: readonly Group[],
  tokens: readonly Token[],
  mySeatId: string,
  tokenId: string,
  isGM: boolean,
): boolean {
  if (isGM) return true;
  if (!mySeatId || !tokenId) return false;
  const token = tokens.find((t) => t.id === tokenId);
  if (!token) return false;
  if (token.ownerSeatId) return canSeatActAs(groups, tokens, mySeatId, token.ownerSeatId, isGM);
  return tokenIsInOwnedGroup(groups, mySeatId, tokenId);
}

/**
 * The same §3 rule, keyed by an **actor id** rather than a token id — what the
 * selection spine carries since the WI-055 re-key, and therefore what decides
 * whether the quick sheet renders editable.
 *
 * An actor id is a creature's only when a seatless token carries it
 * (`actorIdForToken`'s own fallback, read backwards). Everything else — a seat
 * id, and an id nothing on the board answers to — goes to `canSeatActAs`,
 * which keeps "a seat may always act as itself" true even for a seat holding
 * no token yet.
 */
export function canActOnActor(
  groups: readonly Group[],
  tokens: readonly Token[],
  mySeatId: string,
  actorId: string,
  isGM: boolean,
): boolean {
  if (isGM) return true;
  if (!mySeatId || !actorId) return false;
  const creature = tokens.find((t) => t.id === actorId && !t.ownerSeatId);
  if (creature) return tokenIsInOwnedGroup(groups, mySeatId, actorId);
  return canSeatActAs(groups, tokens, mySeatId, actorId, isGM);
}

/**
 * The referee-side reconciliation behind `RoomSettings.defaultPlayerGroup`:
 * every player seat that owns no group at all is appended to the resolved
 * default group.
 *
 * Returns only the groups that actually change, so a caller can fire the
 * result at the store unconditionally and settle after one pass — the same
 * "return nothing when nothing moved" discipline `moveTokenUpdates` uses.
 * Returns `[]` when the setting resolves to no group (`'unassigned'`, or a room
 * with no groups yet), which is the correct no-op rather than an error.
 *
 * The referee's own seat is skipped: GM membership is implicit everywhere, so
 * placing it in one group would be both redundant and misleading.
 */
export function defaultGroupPatches(
  groups: readonly Group[],
  players: readonly PlayerSeat[],
  setting: DefaultPlayerGroup | undefined,
  gmUid: string,
): Array<{ groupId: string; memberSeatIds: string[] }> {
  const targetId = resolveDefaultGroupId(setting, groups);
  if (targetId === null) return [];
  const target = groups.find((g) => g.id === targetId);
  if (!target) return [];

  const placed = new Set(groups.flatMap((g) => g.memberSeatIds ?? []));
  const missing = players
    .filter((p) => p.uid !== gmUid && p.seatId && !placed.has(p.seatId))
    .map((p) => p.seatId);
  if (missing.length === 0) return [];

  // Dedupe against itself as well as the group: two seats sharing a seatId
  // would otherwise be appended twice.
  const next = [...(target.memberSeatIds ?? [])];
  for (const seatId of missing) if (!next.includes(seatId)) next.push(seatId);
  if (next.length === (target.memberSeatIds ?? []).length) return [];
  return [{ groupId: target.id, memberSeatIds: next }];
}
