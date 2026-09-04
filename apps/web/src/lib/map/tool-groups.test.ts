import { describe, expect, it } from 'vitest';
import type { MapToolId } from '../shell/map-tool-controller.svelte';
import {
  HEX_TOOL_IDS,
  isHexTool,
  isViewTool,
  TOOL_GROUPS,
  cursorForTool,
  groupForTool,
  toolsInGroupOrder,
  VIEW_TOOL_IDS,
} from './tool-groups';

/** Every member of the `MapToolId` union, listed exhaustively. TypeScript
 * fails the build here if a tool is added to the union without being placed
 * somewhere reachable — either a `TOOL_GROUPS` group or, for a hex-only tool
 * (SPEC-047 §4), `HEX_TOOL_IDS` — which would otherwise make it silently
 * unreachable, since those two are the palette's only sources of tool
 * buttons (`TOOL_GROUPS` for the square palette, `HEX_TOOL_IDS` plus
 * `MapToolbar`'s hex-only row for the hex one). */
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
  measure: true,
  pen: true,
  ping: true,
  label: true,
  symbol: true,
  capture: true,
  hexSymbol: true,
  road: true,
  river: true,
  hexLabel: true,
};

/** The four hex-only tools (SPEC-047 §§4–5, WI-105/WI-106): reachable only
 * through `HEX_TOOL_IDS` and `MapToolbar`'s own hex-only row, never through
 * `TOOL_GROUPS` — see `PaletteToolId`. */
const HEX_ONLY_TOOLS: MapToolId[] = ['hexLabel', 'hexSymbol', 'road', 'river'];

/** Every tool but `capture` and the hex-only tools, which are exempted by
 * name: `capture`'s entry point is the battle-map quick sheet's "Capture
 * area" button (DEC-066), and the hex-only tools' is `MapToolbar`'s own
 * hex-only row (SPEC-047 §4) — both reachable only from outside
 * `TOOL_GROUPS`. */
const GROUPED_TOOLS = Object.keys(ALL_TOOLS).filter(
  (t) => t !== 'capture' && !HEX_ONLY_TOOLS.includes(t as MapToolId),
);

describe('map tool groups', () => {
  it('places every tool but capture and the hex-only tools in exactly one group', () => {
    const ordered = toolsInGroupOrder();
    expect(new Set(ordered).size).toBe(ordered.length);
    expect([...ordered].sort()).toEqual(GROUPED_TOOLS.sort());
    expect(ordered).not.toContain('capture');
  });

  it("capture belongs to no group — its entry point is the battle-map quick sheet, not the palette", () => {
    expect(groupForTool('capture')).toBeUndefined();
  });

  it('groups the tools by the gesture they use', () => {
    expect(groupForTool('room')?.id).toBe('shapes');
    expect(groupForTool('carve')?.id).toBe('shapes');
    expect(groupForTool('polygon')?.id).toBe('multipoint');
    expect(groupForTool('door')?.id).toBe('overlay');
    expect(groupForTool('symbol')?.id).toBe('overlay');
    // The Pen is an overlay tool, not a family of one: like a label or a
    // symbol, it puts something on top without touching the floor.
    expect(groupForTool('pen')?.id).toBe('overlay');
    // Select is one tool again (SPEC-037) — a group of exactly one.
    expect(groupForTool('select')?.id).toBe('select');
    expect(TOOL_GROUPS.find((g) => g.id === 'select')?.tools).toEqual(['select']);
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
    expect(cursorForTool('select')).toBe('default');
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
    for (const t of ['room', 'carve', 'capture', 'wall', 'door', 'select'] as const) {
      expect(VIEW_TOOL_IDS).not.toContain(t);
    }
  });

  it('HEX_TOOL_IDS is the hex crawl palette: Select, the View tools, and the hex-only overlay tools (SPEC-030 §5, SPEC-047 §§4–5)', () => {
    // Select first, because on a hex map it is the authoring gesture — it
    // picks the hex the hex-tile sheet edits. Group order, read off
    // `TOOL_GROUPS` rather than listed again, then the four hex-only tools
    // appended (WI-105, WI-106).
    expect(HEX_TOOL_IDS).toEqual([
      'select',
      'pan',
      'eye',
      'measure',
      'ping',
      'hexLabel',
      'hexSymbol',
      'road',
      'river',
    ]);
    expect(HEX_TOOL_IDS).toEqual(['select', ...VIEW_TOOL_IDS, ...HEX_ONLY_TOOLS]);
  });

  it('the hex-only tools are reachable through HEX_TOOL_IDS, not through TOOL_GROUPS (SPEC-047 §§4–5)', () => {
    // `hexLabel`/`hexSymbol`/`road`/`river` are not square-map tools wearing
    // a hex hat: `hexLabel` writes `HexTile.note` (a field that already
    // exists), the other three write `HexSymbol`/`HexLine` in `HexPoint`
    // space, and `MapToolbar` renders all four in their own hex-only row
    // rather than a `TOOL_GROUPS` group the square palette would also have to
    // render (RULE-006).
    for (const t of HEX_ONLY_TOOLS) {
      expect(HEX_TOOL_IDS).toContain(t);
      expect(toolsInGroupOrder()).not.toContain(t);
      expect(groupForTool(t)).toBeUndefined();
      expect(isHexTool(t)).toBe(true);
    }
  });

  it('no tool that writes lattice geometry survives onto a hex map (RULE-006)', () => {
    // The whole point of the subset. A hex map's space is axial; every carve
    // tool *and* every overlay tool stores square-lattice units multiplied by
    // `grid.cellSize`, which is not a hex map's multiplier — so placing one
    // would put two coordinate spaces inside one map.
    for (const t of ['room', 'corridor', 'ngon', 'carve', 'wall', 'path', 'polygon'] as const) {
      expect(isHexTool(t)).toBe(false);
    }
    for (const t of ['label', 'symbol', 'door', 'pen'] as const) {
      expect(isHexTool(t)).toBe(false);
    }
    // `capture` is not in any group, so it can never reach a palette at all.
    expect(isHexTool('capture')).toBe(false);
    // And the converse: exactly Select plus the View tools among the
    // `TOOL_GROUPS` tools are in — the four hex-only tools are also
    // `isHexTool`, but they are never `TOOL_GROUPS` members (see the
    // "reachable through HEX_TOOL_IDS" test above), so `toolsInGroupOrder()`
    // does not surface them here.
    const inSubset = toolsInGroupOrder().filter((t) => isHexTool(t));
    expect(inSubset).toEqual(['select', ...VIEW_TOOL_IDS]);
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
