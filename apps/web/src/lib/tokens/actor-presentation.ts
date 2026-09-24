import type { Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { groupColor } from '../encounter/board-view';

/**
 * One resolver for "what does this actor look like" (SPEC-055 §4): a name, a
 * letter, a colour and a portrait, for either a token (a character's or a
 * creature's) or a side/group. This owns the `name` algorithm the old
 * `tokenLabel`/`refLabel` (`encounter/labels.ts`) carried — they now call
 * this instead, rather than the other way round, so `encounter/labels.ts` can
 * depend on this module without a cycle.
 *
 * `creatureLabel`/`creatureDisplayName` (`tokens/labels.ts`) are a **second,
 * disagreeing** name algorithm — a letter-only creature and an art-only
 * creature with no name read differently through them than through the
 * algorithm below (no id-fragment suffix, no letter fallback before art).
 * That disagreement is logged as IN-218 rather than resolved here (SPEC-055
 * §4: "today's per-surface answer is kept"); `CharacterDock`'s creature
 * header and `EncounterBoard`'s card name keep calling `creatureDisplayName`
 * directly. `letterStyleFor` (`tokens/letter-style.ts`) is a render-detail
 * function, not an identity lookup — it stays a direct `Token.letter` reader
 * too.
 */
export type ActorRef = { kind: 'token'; token: Token } | { kind: 'side'; groupId: string };

export interface ActorPresentation {
  name: string;
  /** The raw stored letter, trimmed — `null` when there is none to show.
   * Never seat-derived: a character's token shows the letter actually stored
   * on it, exactly what `letterStyleFor` already reads today. */
  letter: string | null;
  /** The stored token colour, or the side's derived colour. `undefined` for a
   * token with no colour of its own — a legitimate state (SPEC-031 §5) this
   * does not paper over with a computed default. */
  color: string | undefined;
  /** The token's art ref, `undefined` for a side or a letter-only token. */
  portrait: string | undefined;
}

export function actorPresentation(
  actor: ActorRef,
  players: PlayerSeat[],
  groups: Group[],
): ActorPresentation {
  if (actor.kind === 'side') {
    const group = groups.find((g) => g.id === actor.groupId);
    return {
      name: group?.name ?? `Side ${actor.groupId.slice(0, 6)}`,
      letter: null,
      color: groupColor(actor.groupId),
      portrait: undefined,
    };
  }
  const { token } = actor;
  return {
    name: tokenName(token, players),
    letter: token.letter?.trim() || null,
    color: token.color,
    portrait: token.imageRef,
  };
}

/**
 * The name algorithm moved from `tokenLabel` (SPEC-055 §4), unchanged: a
 * seat-owned token reads as its seat's `displayName` (SPEC-050 §4); everything
 * else falls through name → letter → art-derived label → id fragment, exactly
 * as `encounter/labels.test.ts` already pinned down.
 */
function tokenName(token: Token, players: PlayerSeat[]): string {
  if (token.ownerSeatId) {
    const seat = players.find((p) => p.seatId === token.ownerSeatId);
    if (seat) return seat.displayName;
  }
  const name = token.name?.trim();
  if (name) return name;
  const letter = token.letter?.trim();
  if (letter) return letter;
  if (!token.imageRef) return `Token ${token.id.slice(0, 6)}`;
  const basename = token.imageRef.split('/').pop() ?? token.imageRef;
  return `${basename} · ${token.id.slice(0, 6)}`;
}
