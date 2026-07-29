import { describe, expect, it } from 'vitest';
import type { MapToolId } from '../shell/map-tool-controller.svelte';
import { TOOL_GROUPS, cursorForTool, groupForTool, toolsInGroupOrder } from './tool-groups';

/** Every member of the `MapToolId` union, listed exhaustively. TypeScript
 * fails the build here if a tool is added to the union without being placed
 * in a group — which would otherwise make it silently unreachable, since
 * `TOOL_GROUPS` is the palette's only source of tool buttons. */
const ALL_TOOLS: Record<MapToolId, true> = {
  select: true,
  pan: true,
  room: true,
  corridor: true,
  path: true,
  polygon: true,
  ngon: true,
  carve: true,
  wall: true,
  door: true,
  eye: true,
  annotate: true,
  ping: true,
  label: true,
  symbol: true,
};

describe('map tool groups', () => {
  it('places every tool in exactly one group', () => {
    const ordered = toolsInGroupOrder();
    expect(new Set(ordered).size).toBe(ordered.length);
    expect([...ordered].sort()).toEqual(Object.keys(ALL_TOOLS).sort());
  });

  it('groups the tools by the gesture they use', () => {
    expect(groupForTool('room')?.id).toBe('shapes');
    expect(groupForTool('carve')?.id).toBe('shapes');
    expect(groupForTool('polygon')?.id).toBe('multipoint');
    expect(groupForTool('door')?.id).toBe('overlay');
    expect(groupForTool('symbol')?.id).toBe('overlay');
  });

  it('gives every group its own cursor', () => {
    const cursors = TOOL_GROUPS.map((g) => g.cursor);
    expect(new Set(cursors).size).toBe(cursors.length);
  });

  it('shares one cursor across the tools within a group', () => {
    expect(cursorForTool('room')).toBe(cursorForTool('corridor'));
    expect(cursorForTool('pan')).toBe('grab');
    expect(cursorForTool('select')).toBe('default');
  });

  it('every SVG cursor declares a hotspot and a keyword fallback', () => {
    for (const group of TOOL_GROUPS) {
      if (!group.cursor.startsWith('url(')) continue;
      expect(group.cursor).toMatch(/url\("data:image\/svg\+xml,.+"\) \d+ \d+, [a-z-]+$/);
    }
  });
});
