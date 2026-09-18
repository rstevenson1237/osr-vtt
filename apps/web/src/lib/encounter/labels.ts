import type { EncounterOrderEntry, Group, PlayerSeat, Token } from '@osr-vtt/shared';

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
 * — SPEC-050 §4. */
export function tokenLabel(
  token: Token | undefined,
  tokenId: string,
  players: PlayerSeat[] = [],
): string {
  if (!token) return `Token ${tokenId.slice(0, 6)}`;
  if (token.ownerSeatId) {
    const seat = players.find((p) => p.seatId === token.ownerSeatId);
    if (seat) return seat.displayName;
  }
  const name = token.name?.trim();
  if (name) return name;
  // No art at all — every letter-only token, since §5 cleared the ref that
  // used to stand in for one (SPEC-048 §§1, 5) — leaves nothing to derive a
  // fallback from, so the row reads as its letter (SPEC-048), the creature
  // designation the referee gave it, before falling back to the id fragment.
  const letter = token.letter?.trim();
  if (letter) return letter;
  if (!token.imageRef) return `Token ${token.id.slice(0, 6)}`;
  const basename = token.imageRef.split('/').pop() ?? token.imageRef;
  return `${basename} · ${token.id.slice(0, 6)}`;
}

export function refLabel(
  entry: EncounterOrderEntry,
  groups: Group[],
  tokens: Token[],
  players: PlayerSeat[] = [],
): string {
  if (entry.refType === 'side') {
    const group = groups.find((g) => g.id === entry.refId);
    return group?.name ?? `Side ${entry.refId.slice(0, 6)}`;
  }
  const token = tokens.find((t) => t.id === entry.refId);
  return tokenLabel(token, entry.refId, players);
}
