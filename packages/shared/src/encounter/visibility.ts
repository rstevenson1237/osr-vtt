import type { Encounter, Group, Token } from '../types.js';

/**
 * Surface visibility (Encounter Screen Spec §9, §10). Group membership
 * (`Group.memberTokenIds`) is the single source of truth for what's on a
 * surface — there is no separate actor store. A token with no group at all
 * is always visible on both surfaces; a grouped token is visible if *any*
 * group it belongs to has that surface's toggle on.
 */

export type EncounterSurface = 'map' | 'board';

function groupsForToken(tokenId: string, groups: Group[]): Group[] {
  return groups.filter((g) => g.memberTokenIds.includes(tokenId));
}

/** Token ids visible on the given surface — ungrouped tokens always pass;
 * grouped tokens pass if any of their groups has `showMap`/`showBoard` on. */
export function visibleTokenIds(
  tokens: Token[],
  groups: Group[],
  surface: EncounterSurface,
): Set<string> {
  const flag = surface === 'map' ? 'showMap' : 'showBoard';
  const visible = new Set<string>();
  for (const token of tokens) {
    const memberOf = groupsForToken(token.id, groups);
    if (memberOf.length === 0 || memberOf.some((g) => g[flag])) {
      visible.add(token.id);
    }
  }
  return visible;
}

/** Token ids belonging to whoever's turn it currently is — for the
 * current-turn highlight, shared across both surfaces (Spec §9). */
export function currentActorTokenIds(encounter: Encounter, groups: Group[]): Set<string> {
  const current = encounter.order[encounter.currentIndex];
  if (!current) return new Set();
  if (current.refType === 'actor') return new Set([current.refId]);
  const group = groups.find((g) => g.id === current.refId);
  return new Set(group?.memberTokenIds ?? []);
}
