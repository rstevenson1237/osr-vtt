import type { Group, Token } from '../types.js';

/**
 * Collapse-to-one-token math (Encounter Screen Spec / Master Plan v2, R8.4).
 *
 * Pure helpers the Map View and Groups roster share so the "collapse a group
 * to a single stacked token, drag it as a unit, expand with the formation
 * intact" behavior lives in one tested place rather than inside the Pixi
 * component. None of this inspects a value for game meaning — it only moves
 * positions relative to an anchor member.
 */

/** The anchor member's id for a group: the stored `anchorTokenId` if it's
 * still a member, else the first member — so a collapsed group whose anchor
 * token was deleted still has a sensible stack origin. `null` when the group
 * has no members at all. */
export function groupAnchorId(group: Group): string | null {
  const { anchorTokenId, memberTokenIds } = group;
  if (anchorTokenId && memberTokenIds.includes(anchorTokenId)) return anchorTokenId;
  return memberTokenIds[0] ?? null;
}

/**
 * The patch that collapses a group: pick an anchor (the first member), record
 * every member's offset *relative to that anchor's current position*, and flip
 * `collapsed` on. Returns `null` for an empty group (nothing to collapse).
 * `tokens` is the live token list; members without a matching token are
 * skipped (they carry no position to offset).
 */
export function collapseGroupPatch(
  group: Group,
  tokens: Token[],
): Pick<Group, 'collapsed' | 'anchorTokenId' | 'memberOffsets'> | null {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const members = group.memberTokenIds
    .map((id) => byId.get(id))
    .filter((t): t is Token => t !== undefined);
  if (members.length === 0) return null;
  const anchor = members[0]!;
  const memberOffsets: Record<string, { x: number; y: number }> = {};
  for (const member of members) {
    memberOffsets[member.id] = {
      x: member.pos.x - anchor.pos.x,
      y: member.pos.y - anchor.pos.y,
    };
  }
  return { collapsed: true, anchorTokenId: anchor.id, memberOffsets };
}

/** The patch that expands a group back to individually-placed tokens. Member
 * positions are already kept at anchor + offset throughout a collapsed drag,
 * so expand only clears the flag. */
export function expandGroupPatch(): Pick<Group, 'collapsed'> {
  return { collapsed: false };
}

/**
 * Given a collapsed group and a new anchor position, the batched per-member
 * position updates that keep the stored formation: each member lands at
 * `anchorPos + storedOffset`. Members with no recorded offset are skipped.
 * Feeds straight into `CampaignStore.moveTokens` (one write burst — R8.4).
 */
export function collapsedDragUpdates(
  group: Group,
  anchorPos: { x: number; y: number },
): Array<{ tokenId: string; pos: { x: number; y: number } }> {
  const offsets = group.memberOffsets ?? {};
  return group.memberTokenIds
    .filter((id) => offsets[id] !== undefined)
    .map((id) => ({
      tokenId: id,
      pos: { x: anchorPos.x + offsets[id]!.x, y: anchorPos.y + offsets[id]!.y },
    }));
}

/** Columns before a "Tidy" grid wraps to a new row (DEC-067 — "4 or more wrap
 * to a new row", i.e. rows of 3). */
const TIDY_GRID_COLUMNS = 3;

/** One cell of lattice spacing between tidied members (RULE-006: lattice
 * units, `cellSize` is a render-time-only multiplier). */
const TIDY_GRID_SPACING = 1;

/**
 * "Tidy" (DEC-067): an explicit, on-demand grid re-layout of a group's
 * members, distinct from collapse/expand and leaving `memberOffsets`
 * untouched. Members land in row-major order — `memberTokenIds` order,
 * skipping ids with no matching token — starting from the first member's
 * current position, which is also the grid's origin and does not move.
 * Returns `[]` for a group with no positioned members. Feeds straight into
 * `CampaignStore.moveTokens` (one write burst, same as a collapsed drag).
 */
export function tidyGroupUpdates(
  group: Group,
  tokens: Token[],
): Array<{ tokenId: string; pos: { x: number; y: number } }> {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const members = group.memberTokenIds
    .map((id) => byId.get(id))
    .filter((t): t is Token => t !== undefined);
  if (members.length === 0) return [];
  const origin = members[0]!.pos;
  return members.map((member, i) => ({
    tokenId: member.id,
    pos: {
      x: origin.x + (i % TIDY_GRID_COLUMNS) * TIDY_GRID_SPACING,
      y: origin.y + Math.floor(i / TIDY_GRID_COLUMNS) * TIDY_GRID_SPACING,
    },
  }));
}
