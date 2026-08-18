import type { EncounterOrderEntry, Group, Token } from '@osr-vtt/shared';

/** Display-only labeling — no game meaning, just "what do we call this row
 * in the UI".
 *
 * A named creature reads as its name (SPEC-040 §3): the initiative order is
 * one of the surfaces §5 forbids from showing a `gen:disc:` fragment as a
 * creature's name, and it was showing the whole ref. A token with no `name`
 * keeps the ref-plus-id-fragment fallback it always had — unhelpful, but
 * unchanged, and it is what a scenery token or a pre-v28 creature has. */
export function tokenLabel(token: Token | undefined, tokenId: string): string {
  if (!token) return `Token ${tokenId.slice(0, 6)}`;
  const name = token.name?.trim();
  if (name) return name;
  const basename = token.imageRef.split('/').pop() ?? token.imageRef;
  return `${basename} · ${token.id.slice(0, 6)}`;
}

export function refLabel(entry: EncounterOrderEntry, groups: Group[], tokens: Token[]): string {
  if (entry.refType === 'side') {
    const group = groups.find((g) => g.id === entry.refId);
    return group?.name ?? `Side ${entry.refId.slice(0, 6)}`;
  }
  const token = tokens.find((t) => t.id === entry.refId);
  return tokenLabel(token, entry.refId);
}
