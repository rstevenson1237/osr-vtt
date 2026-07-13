import { describe, expect, it } from 'vitest';
import { collapseGroupPatch, collapsedDragUpdates, expandGroupPatch, groupAnchorId } from './collapse.js';
import type { Group, Token } from '../types.js';

function token(id: string, x: number, y: number): Token {
  return { id, pos: { x, y }, size: 1, layer: 'tokens', imageRef: `tokens/${id}.png` };
}

function group(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Goblins',
    memberTokenIds: ['a', 'b', 'c'],
    showMap: true,
    showBoard: true,
    active: false,
    ...overrides,
  };
}

describe('groupAnchorId', () => {
  it('returns the stored anchor when it is still a member', () => {
    expect(groupAnchorId(group({ anchorTokenId: 'b' }))).toBe('b');
  });

  it('falls back to the first member when the stored anchor was removed', () => {
    expect(groupAnchorId(group({ anchorTokenId: 'z' }))).toBe('a');
  });

  it('returns null for an empty group', () => {
    expect(groupAnchorId(group({ memberTokenIds: [], anchorTokenId: undefined }))).toBeNull();
  });
});

describe('collapseGroupPatch', () => {
  it('anchors on the first member and records offsets relative to it', () => {
    const tokens = [token('a', 100, 100), token('b', 130, 100), token('c', 100, 160)];
    const patch = collapseGroupPatch(group(), tokens);
    expect(patch).toEqual({
      collapsed: true,
      anchorTokenId: 'a',
      memberOffsets: {
        a: { x: 0, y: 0 },
        b: { x: 30, y: 0 },
        c: { x: 0, y: 60 },
      },
    });
  });

  it('skips members with no matching token but still collapses', () => {
    const tokens = [token('a', 10, 10), token('c', 40, 10)];
    const patch = collapseGroupPatch(group(), tokens);
    expect(patch?.memberOffsets).toEqual({ a: { x: 0, y: 0 }, c: { x: 30, y: 0 } });
  });

  it('returns null when no member has a token to anchor on', () => {
    expect(collapseGroupPatch(group(), [])).toBeNull();
  });
});

describe('expandGroupPatch', () => {
  it('only clears the collapsed flag', () => {
    expect(expandGroupPatch()).toEqual({ collapsed: false });
  });
});

describe('collapsedDragUpdates', () => {
  it('places every member at the new anchor position plus its stored offset', () => {
    const collapsed = group({
      collapsed: true,
      anchorTokenId: 'a',
      memberOffsets: { a: { x: 0, y: 0 }, b: { x: 30, y: 0 }, c: { x: 0, y: 60 } },
    });
    const updates = collapsedDragUpdates(collapsed, { x: 200, y: 300 });
    expect(updates).toEqual([
      { tokenId: 'a', pos: { x: 200, y: 300 } },
      { tokenId: 'b', pos: { x: 230, y: 300 } },
      { tokenId: 'c', pos: { x: 200, y: 360 } },
    ]);
  });

  it('preserves the formation across a round-trip collapse → drag → expand', () => {
    // Relative positions after a drag must equal the relative positions before
    // collapse — the R8.4 e2e invariant, checked here at the math layer.
    const tokens = [token('a', 100, 100), token('b', 130, 100), token('c', 100, 160)];
    const patch = collapseGroupPatch(group(), tokens)!;
    const collapsed = group({ ...patch });
    const updates = collapsedDragUpdates(collapsed, { x: 500, y: 500 });
    const posById = new Map(updates.map((u) => [u.tokenId, u.pos]));
    const relBefore = (id: string) => ({
      x: tokens.find((t) => t.id === id)!.pos.x - 100,
      y: tokens.find((t) => t.id === id)!.pos.y - 100,
    });
    const relAfter = (id: string) => ({
      x: posById.get(id)!.x - posById.get('a')!.x,
      y: posById.get(id)!.y - posById.get('a')!.y,
    });
    for (const id of ['a', 'b', 'c']) {
      expect(relAfter(id)).toEqual(relBefore(id));
    }
  });

  it('skips members lacking a recorded offset', () => {
    const collapsed = group({
      memberTokenIds: ['a', 'b'],
      memberOffsets: { a: { x: 0, y: 0 } },
    });
    expect(collapsedDragUpdates(collapsed, { x: 0, y: 0 })).toEqual([
      { tokenId: 'a', pos: { x: 0, y: 0 } },
    ]);
  });
});
