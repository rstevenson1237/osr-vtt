import type { Group } from '@osr-vtt/shared';

/**
 * Encounter Board v2 display helpers (Master Plan v2, R8.2). Pure, testable
 * logic the board component leans on for the group-box color strip and
 * drag-and-drop membership — none of it interprets game data.
 *
 * `setGhostImage` is the one DOM-touching export, kept here because it is the
 * shared half of every drag the app starts: board cards, group headers, and the
 * character sheet's token drag onto the map.
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
 * A translucent copy of `node` as the drag image. The browser's default is a
 * snapshot of the element at full opacity, which hides whatever it passes over;
 * a ghost makes the drop target readable underneath it.
 *
 * Used by every drag the app starts — board cards, group headers, and the
 * character sheet's token drag onto the map, where the translucent token image
 * following the pointer *is* the feedback that the token has been picked up.
 */
export function setGhostImage(e: DragEvent, node: HTMLElement): void {
  if (!e.dataTransfer) return;
  const ghost = node.cloneNode(true) as HTMLElement;
  const rect = node.getBoundingClientRect();
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.opacity = '0.6';
  ghost.style.position = 'fixed';
  ghost.style.top = '-1000px';
  ghost.style.left = '-1000px';
  ghost.style.pointerEvents = 'none';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
  // The drag image is captured synchronously, so the node only has to exist
  // for this frame.
  requestAnimationFrame(() => ghost.remove());
}

/**
 * The writes needed to drop a card at index `targetIndex` within
 * `targetGroupId`'s member list — or to no group at all (`null`, the
 * Unassigned bin). This is what the board's drag-and-drop commits, and since
 * the per-card group dropdown was retired it is the *only* membership path.
 *
 * Adding to the target group also removes the token from every other group, so
 * a card lives in exactly one box. Only the groups whose member list actually
 * changes are returned, so the caller writes the minimum.
 *
 * `targetIndex === null` appends. An index past the end clamps. Moving a card
 * *within* its own group is a pure reorder of that one list, so only that
 * group is written.
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
