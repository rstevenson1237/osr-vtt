import type { EncounterOrderEntry, Group, PlayerSeat, Token } from '@osr-vtt/shared';
import { actorPresentation } from '../tokens/actor-presentation';

/** Display-only labeling — no game meaning, just "what do we call this row
 * in the UI".
 *
 * A named creature reads as its name (SPEC-040 §3): the initiative order is
 * one of the surfaces §5 forbids from showing a `gen:disc:` fragment as a
 * creature's name, and it was showing the whole ref. A token with no `name`
 * keeps the ref-plus-id-fragment fallback it always had — unhelpful, but
 * unchanged, and it is what a scenery token or a pre-v28 creature has.
 *
 * A seat-owned token carries no `Token.name` by design (SPEC-040 §3: "a
 * seat's name is the seat's `displayName`"), so `players` is consulted first
 * — SPEC-050 §4.
 *
 * The algorithm itself now lives in `actorPresentation`
 * (`tokens/actor-presentation.ts`, SPEC-055 §4) — this is a thin wrapper
 * kept for the "no token at all" case `actorPresentation` doesn't model (it
 * always takes a concrete `Token`). */
export function tokenLabel(
  token: Token | undefined,
  tokenId: string,
  players: PlayerSeat[] = [],
): string {
  if (!token) return `Token ${tokenId.slice(0, 6)}`;
  return actorPresentation({ kind: 'token', token }, players, []).name;
}

export function refLabel(
  entry: EncounterOrderEntry,
  groups: Group[],
  tokens: Token[],
  players: PlayerSeat[] = [],
): string {
  if (entry.refType === 'side') {
    return actorPresentation({ kind: 'side', groupId: entry.refId }, players, groups).name;
  }
  const token = tokens.find((t) => t.id === entry.refId);
  return tokenLabel(token, entry.refId, players);
}
