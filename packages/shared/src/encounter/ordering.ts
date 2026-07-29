import type { Group } from '../types.js';

/**
 * Group display order.
 *
 * Firestore hands a collection back in document-*id* order, which is arbitrary
 * and cannot be rewritten: group ids are referenced by `Encounter.order` side
 * refs, `Token.groupId`, shared initiative slots and collapse anchors, so
 * "reordering" by recreating docs under new ids would break all of them. Order
 * is therefore an explicit field (`Group.order`), the same way `MapRoom.order`
 * is, and this module is the one place that interprets it.
 *
 * Both `CampaignStore` implementations sort through `sortGroups` so the board
 * receives groups already in display order and never has to re-sort — and so
 * `MemoryStore` and `FirebaseStore` cannot drift on ordering.
 */

/**
 * Groups in display order: by `order` ascending, with un-ordered groups after
 * every ordered one and stable among themselves (keeping the source order).
 * A room written before `order` existed therefore renders exactly as it did.
 */
export function sortGroups(groups: readonly Group[]): Group[] {
  return [...groups].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    return ao === bo ? 0 : ao - bo;
  });
}

/**
 * Renumber every group's `order` to match the given display sequence,
 * returning only the groups whose stored value actually changes. Mirrors
 * `renumberMapRoomsByOrder`: a caller splices its local array into the order
 * it wants and hands it here rather than doing index arithmetic per drop.
 *
 * Renumbering *all* of them — not just the dragged one — is what makes the
 * first drag in a room predating `order` produce a complete, stable ordering
 * instead of one ordered group and a tail of un-ordered ones.
 */
export function renumberGroupsByOrder(
  ordered: readonly Group[],
): Array<{ groupId: string; order: number }> {
  const updates: Array<{ groupId: string; order: number }> = [];
  ordered.forEach((group, i) => {
    if (group.order !== i) updates.push({ groupId: group.id, order: i });
  });
  return updates;
}
