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
  const updates: Array<{ groupId: string; memberTokenIds: string[] }> = [];
  for (const group of groups) {
    const has = group.memberTokenIds.includes(tokenId);
    const shouldHave = group.id === targetGroupId;
    if (has === shouldHave) continue;
    const memberTokenIds = shouldHave
      ? [...group.memberTokenIds, tokenId]
      : group.memberTokenIds.filter((id) => id !== tokenId);
    updates.push({ groupId: group.id, memberTokenIds });
  }
  return updates;
}
