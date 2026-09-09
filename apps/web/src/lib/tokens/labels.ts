import {
  buildGenTokenRef,
  genColorToken,
  letterLabel,
  type Group,
  type PlayerSeat,
  type Token,
} from '@osr-vtt/shared';
import { groupColor } from '../encounter/board-view';

/** Seats ordered by join time (Master Plan v2, R7.1 — "players A, B, C… by
 * seat join order"). Seats written before `joinedAt` existed sort last, by
 * uid, rather than crashing on a missing field. */
export function seatOrder(players: PlayerSeat[]): PlayerSeat[] {
  return [...players].sort((a, b) => {
    const at = a.joinedAt ?? Number.POSITIVE_INFINITY;
    const bt = b.joinedAt ?? Number.POSITIVE_INFINITY;
    return at - bt || a.uid.localeCompare(b.uid);
  });
}

/** A seat's default letter, purely from its position in join order — the
 * same letter every client derives independently from `players` alone, no
 * extra state to sync. */
export function seatLetterFor(players: PlayerSeat[], seatId: string): string {
  const ordered = seatOrder(players);
  const idx = ordered.findIndex((p) => p.seatId === seatId || p.uid === seatId);
  return letterLabel(idx < 0 ? 0 : idx);
}

/** The `gen:disc:` ref a seat's portrait/token falls back to until the
 * player (or the GM) picks something else via "My token" (R7.3). */
export function defaultPortraitRef(players: PlayerSeat[], seatId: string): string {
  const label = seatLetterFor(players, seatId);
  return buildGenTokenRef(label, genColorToken(seatId));
}

const PLAIN_UPPERCASE_RUN_RE = /^[A-Z]+$/;

/** The uppercase symbol letters already worn by a group's creatures
 * (SPEC-040 §4, SPEC-048 §3). Reads `Token.letter` — the stored field, not
 * a parse of `Token.imageRef` — which is where the symbol has lived since
 * schema v30.
 *
 * Three kinds of member are skipped, each deliberately: a **seat's** token,
 * because seat letters are a separate room-wide scheme (`seatLetterFor`)
 * that this one is allowed to collide with; a token with **no** `letter` —
 * bundled art, a saved URL, an upload — which has no symbol to hold one;
 * and a `letter` that is not a plain uppercase run — a hand-typed label or a
 * migrated pre-v28 `a1`/`a2` ref — which the old regex excluded for free and
 * this predicate now has to say explicitly. */
function usedGroupLetters(groupTokens: Token[]): Set<string> {
  const used = new Set<string>();
  for (const token of groupTokens) {
    if (token.ownerSeatId) continue;
    if (!token.letter) continue;
    if (!PLAIN_UPPERCASE_RUN_RE.test(token.letter)) continue;
    used.add(token.letter);
  }
  return used;
}

/** The next `count` symbol letters for a batch joining `groupTokens`
 * (SPEC-040 §4): uppercase, unique **within the group**, and always the
 * lowest unused ones — so removing "B" and adding a creature reuses B rather
 * than jumping past it. Past Z the scheme continues AA, AB, … , the same
 * base-26 progression `letterLabel` already gives seats.
 *
 * Scoped to one group on purpose. Two groups on the same map may both read
 * A, B, C; the letter's job is to tell one goblin from another goblin, and
 * the card showing it already says which group it belongs to. */
export function nextCreatureLetters(count: number, groupTokens: Token[]): string[] {
  const used = usedGroupLetters(groupTokens);
  const letters: string[] = [];
  for (let i = 0; letters.length < count; i++) {
    const letter = letterLabel(i);
    if (used.has(letter)) continue;
    used.add(letter);
    letters.push(letter);
  }
  return letters;
}

const NUMBERED_NAME_RE = /^(.*?) (\d+)$/;

/** The numbers already taken under `base` inside a group. A bare "Goblin"
 * counts as number 1 — it is the first Goblin, it simply had no sibling to
 * be told apart from when it was made — which is what makes the next one
 * "Goblin 2" rather than a second unnumbered Goblin. */
function usedNameNumbers(base: string, groupTokens: Token[]): Set<number> {
  const used = new Set<number>();
  for (const token of groupTokens) {
    const name = token.name?.trim();
    if (!name) continue;
    if (name === base) {
      used.add(1);
      continue;
    }
    const m = NUMBERED_NAME_RE.exec(name);
    if (m && m[1] === base) used.add(Number(m[2]));
  }
  return used;
}

/** The names for one "Add creature" batch (SPEC-040 §2). `base` is what the
 * referee typed in the picker; an empty one yields no names at all, leaving
 * `Token.name` absent and the `creatureLabel` fallback live.
 *
 * A batch of **one** into a group holding no creature of that name is just
 * `Goblin`, with no trailing number — the number exists to tell several
 * apart, and "Goblin 1" on its own reads like there is a Goblin 2 somewhere.
 * Every other case numbers from the lowest free number up, so adding a second
 * Goblin makes it "Goblin 2" without retroactively renaming the first. */
export function creatureBatchNames(base: string, count: number, groupTokens: Token[]): string[] {
  const trimmed = base.trim();
  if (!trimmed) return [];
  const used = usedNameNumbers(trimmed, groupTokens);
  if (count === 1 && used.size === 0) return [trimmed];
  const names: string[] = [];
  for (let n = 1; names.length < count; n++) {
    if (used.has(n)) continue;
    used.add(n);
    names.push(`${trimmed} ${n}`);
  }
  return names;
}

/** One colour for a whole generated batch, so a group reads as a group
 * (SPEC-040 §4). The seed is the creature's **name** — the thing that now
 * identifies the kind, where the type letter used to — so a second batch of
 * Goblins added later comes out the same colour as the first. `override` is
 * the swatch the referee picked in the picker, which wins outright. */
export function creatureBatchColor(name: string, override?: string): string {
  return override ?? genColorToken(name.trim() || 'creature');
}

/** A generated "Add creature" batch (SPEC-040 §4, SPEC-048 §3): the group's
 * next free symbol letters, all sharing one colour. Renamed from
 * `defaultCreatureRefs` — a letter is stored data now, not a ref fragment,
 * so this hands the caller what a batch actually needs (letters and one
 * shared colour) rather than building `gen:disc:` refs itself. A caller
 * that still needs a resolvable image builds one with `buildGenTokenRef`. */
export function defaultCreatureBatch(
  count: number,
  groupTokens: Token[],
  color: string,
): { letters: string[]; color: string } {
  return { letters: nextCreatureLetters(count, groupTokens), color };
}

/** A short label for a seatless token when nothing seat-derived is
 * available: its image ref's filename, extension stripped. Shared by the
 * Encounter Board's card title and the Character quick sheet's header, so a
 * creature reads the same name in both places (SPEC-032 §4). */
export function creatureLabel(token: Token): string {
  // A token with no art at all (`imageRef` optional since v30, SPEC-048 §1)
  // has no filename to shorten, so it reads as its id fragment rather than as
  // the empty string — `creatureDisplayName` falls through to this whenever a
  // creature has no stored `name`, and an empty header is worse than a dull
  // one. Unreachable at v30, where every ref is left in place.
  if (!token.imageRef) return `Token ${token.id.slice(0, 6)}`;
  const basename = token.imageRef.split('/').pop() ?? token.imageRef;
  return basename.replace(/\.[a-z0-9]+$/i, '');
}

/** What to call a seatless token, in one place (SPEC-040 §3/§5): its stored
 * `name` if it has one, else the ref-derived `creatureLabel` it read as
 * before v28. Every surface that names a creature — the Encounter Board
 * card, the initiative order, the quick sheet header — goes through this, so
 * they cannot disagree (SPEC-032 §4's agreement rule, now over a stored
 * field). A *character* never reaches here: its name is its seat's
 * `displayName`. */
export function creatureDisplayName(token: Token): string {
  return token.name?.trim() || creatureLabel(token);
}

/** The group a token belongs to, if any. `Token.groupId` is checked first
 * (the field the spec names), but group membership in this codebase is
 * actually tracked on `Group.memberTokenIds` (the Encounter Board's "assign
 * to group" menu writes there, never to `Token.groupId`), so that's the
 * authoritative source in practice. */
export function tokenGroupId(token: Token, groups: Group[]): string | undefined {
  return token.groupId ?? groups.find((g) => g.memberTokenIds.includes(token.id))?.id;
}

/** The map-token status ring color (Master Plan v2, R21/WI-24): white when
 * selected or owned by the viewer, else the token's group color (shared
 * with the Encounter Board's group-box strip so a group reads the same
 * color everywhere), else black for an ungrouped token. Precedence is
 * selected/owned > group > none. */
export function tokenRingColor(
  token: Token,
  groups: Group[],
  selectedTokenId: string | null,
  myUid: string | null,
): string {
  if (token.id === selectedTokenId || (!!token.ownerSeatId && token.ownerSeatId === myUid)) {
    return '#ffffff';
  }
  const groupId = tokenGroupId(token, groups);
  if (groupId) return groupColor(groupId);
  return '#000000';
}
