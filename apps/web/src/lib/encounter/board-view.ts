import type { Group } from '@osr-vtt/shared';

/**
 * Encounter Board v2 display helpers (Master Plan v2, R8.2). Pure, testable
 * logic the board component leans on for the group-box color strip and the
 * card "assign to group" menu — none of it interprets game data.
 */

/** A stable, pleasant color-strip hue for a group box, derived from its id so
 * every client (and both the box header and the collapsed count card) agree
 * without storing a color on the group doc. */
export function groupColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffffff;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 55%)`;
}

/**
 * The group-membership writes needed to (re)assign a token to exactly one
 * group — or to none (`targetGroupId === null`, the Unassigned bin). Adding to
 * the target group also removes the token from every other group, so a card
 * lives in one box at a time via the menu (the Groups roster still allows
 * multi-membership for advanced cases). Only the groups whose member list
 * actually changes are returned, so the caller writes the minimum.
 */
export function assignmentUpdates(
  groups: Group[],
  tokenId: string,
  targetGroupId: string | null,
): Array<{ groupId: string; memberTokenIds: string[] }> {
  return moveTokenUpdates(groups, tokenId, targetGroupId, null);
}

/**
 * `assignmentUpdates` with a *position*: the writes needed to drop a card at
 * index `targetIndex` within `targetGroupId`'s member list. This is what the
 * board's drag-and-drop commits — the same one-group-at-a-time membership
 * rule, but a drag says where in the box the card landed, not just which box.
 *
 * `targetIndex === null` appends (the menu's behaviour, which has no notion of
 * position). An index past the end clamps. Moving a card *within* its own
 * group is a pure reorder of that one list, so only that group is written.
 *
 * Order within `memberTokenIds` is the board's display order for the group's
 * cards, which is why an in-group reorder is persisted at all rather than
 * being a view-local nicety.
 */
export function moveTokenUpdates(
  groups: Group[],
  tokenId: string,
  targetGroupId: string | null,
  targetIndex: number | null,
): Array<{ groupId: string; memberTokenIds: string[] }> {
  const updates: Array<{ groupId: string; memberTokenIds: string[] }> = [];
  for (const group of groups) {
    const has = group.memberTokenIds.includes(tokenId);
    const shouldHave = group.id === targetGroupId;

    if (!shouldHave) {
      if (has) {
        updates.push({
          groupId: group.id,
          memberTokenIds: group.memberTokenIds.filter((id) => id !== tokenId),
        });
      }
      continue;
    }

    const without = group.memberTokenIds.filter((id) => id !== tokenId);
    const at = targetIndex === null ? without.length : clamp(targetIndex, 0, without.length);
    const memberTokenIds = [...without.slice(0, at), tokenId, ...without.slice(at)];
    if (!sameOrder(memberTokenIds, group.memberTokenIds)) {
      updates.push({ groupId: group.id, memberTokenIds });
    }
  }
  return updates;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
