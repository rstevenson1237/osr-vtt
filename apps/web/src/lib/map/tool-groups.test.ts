import { describe, expect, it } from 'vitest';
import type { MapToolId } from '../shell/map-tool-controller.svelte';
import {
  isViewTool,
  TOOL_GROUPS,
  cursorForTool,
  groupForTool,
  toolsInGroupOrder,
  VIEW_TOOL_IDS,
} from './tool-groups';

/** Every member of the `MapToolId` union, listed exhaustively. TypeScript
 * fails the build here if a tool is added to the union without being placed
 * in a group — which would otherwise make it silently unreachable, since
 * `TOOL_GROUPS` is the palette's only source of tool buttons. */
const ALL_TOOLS: Record<MapToolId, true> = {
  selectVertex: true,
  selectEdge: true,
  selectObject: true,
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
  measure: true,
  pen: true,
  ping: true,
  label: true,
  symbol: true,
  capture: true,
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
    expect(groupForTool('capture')?.id).toBe('shapes');
    expect(groupForTool('polygon')?.id).toBe('multipoint');
    expect(groupForTool('door')?.id).toBe('overlay');
    expect(groupForTool('symbol')?.id).toBe('overlay');
    // The Pen is an overlay tool, not a family of one: like a label or a
    // symbol, it puts something on top without touching the floor.
    expect(groupForTool('pen')?.id).toBe('overlay');
    // Select's three modes are three tools sharing one group.
    for (const t of ['selectVertex', 'selectEdge', 'selectObject'] as const) {
      expect(groupForTool(t)?.id).toBe('select');
    }
    // Everything that reads the map rather than changing it.
    for (const t of ['pan', 'eye', 'measure', 'ping'] as const) {
      expect(groupForTool(t)?.id).toBe('view');
    }
  });

  it('gives every group its own cursor', () => {
    const cursors = TOOL_GROUPS.map((g) => g.cursor);
    expect(new Set(cursors).size).toBe(cursors.length);
  });

  it("resolves a tool's cursor to its own override, else its group's", () => {
    // No override: the group's cursor, shared with its group-mates.
    expect(cursorForTool('room')).toBe(cursorForTool('corridor'));
    expect(cursorForTool('pan')).toBe('grab');
    expect(cursorForTool('selectVertex')).toBe(cursorForTool('selectEdge'));
    expect(cursorForTool('selectEdge')).toBe('default');
    // Overridden: same gesture family, but the pointer still says which tool.
    expect(cursorForTool('eye')).toBe('help');
    expect(cursorForTool('ping')).toBe('pointer');
    expect(cursorForTool('measure')).not.toBe(cursorForTool('pan'));
    expect(cursorForTool('pen')).not.toBe(cursorForTool('label'));
  });

  it('isViewTool (IN-031 soft lock) is true for exactly the view group', () => {
    for (const t of ['pan', 'eye', 'measure', 'ping'] as const) {
      expect(isViewTool(t)).toBe(true);
    }
    const rest = toolsInGroupOrder().filter((t) => !(['pan', 'eye', 'measure', 'ping'] as MapToolId[]).includes(t));
    for (const t of rest) {
      expect(isViewTool(t)).toBe(false);
    }
  });

  it('VIEW_TOOL_IDS is the battle map palette: Pan, Eye, Measure, Ping', () => {
    // SPEC-029 §4 names these four, in this order. It is read off the `view`
    // group rather than listed a second time, so the assertion pins both.
    expect(VIEW_TOOL_IDS).toEqual(['pan', 'eye', 'measure', 'ping']);
    expect(VIEW_TOOL_IDS.every((t) => isViewTool(t))).toBe(true);
    // Everything that carves, overlays or selects is outside it — a battle
    // map is a snapshot, and editing it would desynchronize it from source.
    for (const t of ['room', 'carve', 'capture', 'wall', 'door', 'selectObject'] as const) {
      expect(VIEW_TOOL_IDS).not.toContain(t);
    }
  });

  it('every SVG cursor declares a hotspot and a keyword fallback', () => {
    const shape = /url\("data:image\/svg\+xml,.+"\) \d+ \d+, [a-z-]+$/;
    for (const group of TOOL_GROUPS) {
      if (group.cursor.startsWith('url(')) expect(group.cursor).toMatch(shape);
      for (const cursor of Object.values(group.toolCursors ?? {})) {
        if (cursor.startsWith('url(')) expect(cursor).toMatch(shape);
      }
    }
  });
});
