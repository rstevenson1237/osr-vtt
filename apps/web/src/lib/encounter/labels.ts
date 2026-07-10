import type { EncounterOrderEntry, Group, Token } from '@osr-vtt/shared';

/** Display-only labeling — no game meaning, just "what do we call this row
 * in the UI". Tokens have no `name` field yet (that's a Profile concern,
 * Phase 3's Dock link per Encounter Screen Spec §12), so an actor label
 * falls back to a short id fragment. */
export function tokenLabel(token: Token | undefined, tokenId: string): string {
  if (!token) return `Token ${tokenId.slice(0, 6)}`;
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
