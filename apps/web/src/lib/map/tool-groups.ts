import type { MapToolId } from '../shell/map-tool-controller.svelte';
import type { IconId } from '../shell/types';

/**
 * How the map tools are organised in the palette, and what the pointer looks
 * like while each one is active.
 *
 * The palette used to be one flat run of fourteen text buttons, which said
 * nothing about which tools *behave the same way*. Grouping them by gesture is
 * the actual distinction a referee needs at the moment of picking one: what you
 * are selecting, a click-and-drag shape, a multi-click run you finish
 * deliberately, something you put on top of the map, or a way of reading the
 * map without changing it. Each group carries its own icon and its own cursor
 * (with per-tool overrides where a tool's pointer still has something of its
 * own to say), so both the palette and the canvas answer "what kind of thing am
 * I about to do" without reading a label.
 *
 * Five groups: the Pen (formerly Annotate) joined Overlay, and Pan/Eye/Ping
 * gathered with the new Measure tool under View. Select is a one-tool group
 * again since SPEC-037 merged its three modes back into a single tool — the
 * fallback for a single-tool group (render the one button wearing the group's
 * icon) has a user once more.
 *
 * Pure data + lookups — no Svelte, no Pixi — so the grouping is unit-testable
 * and the canvas (`VectorMapView`'s `setCursor` effect) and the palette
 * (`MapToolbar`) read the same catalog rather than each keeping its own list.
 */

export type MapToolGroupId = 'select' | 'view' | 'shapes' | 'multipoint' | 'overlay';

/** Every `MapToolId` the map-tools palette can actually render. `capture` is
 * excluded (DEC-066): its entry point is the battle-map quick sheet's
 * "Capture area" button, not `TOOL_GROUPS`, so it can never appear in a
 * group's `tools` list. */
export type PaletteToolId = Exclude<MapToolId, 'capture'>;

export interface MapToolGroup {
  id: MapToolGroupId;
  /** Shown as the row's `title`; the icon carries the visual identity. */
  label: string;
  icon: IconId;
  /** CSS `cursor` value applied to the map canvas while a tool in this group
   * is active. Keyword where one fits; an inline SVG data-URI otherwise. */
  cursor: string;
  /** Per-tool cursor overrides, for the tools whose gesture is shared with
   * their group-mates but whose *pointer* still wants to say something of its
   * own — the pen's nib, the eye's query, the ruler's crosshair. Everything
   * not listed here takes the group's `cursor`. */
  toolCursors?: Partial<Record<MapToolId, string>>;
  tools: PaletteToolId[];
}

/**
 * A cursor built from an inline SVG, with a keyword fallback for browsers
 * that reject the URI. Hotspot coordinates are in the SVG's own pixel space.
 * The art is white with a dark outline so it reads on both floor and rock.
 */
function svgCursor(inner: string, hotX: number, hotY: number, fallback: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ` +
    `fill="none" stroke="%23fff" stroke-width="2.4" stroke-linecap="round" ` +
    `stroke-linejoin="round" paint-order="stroke">${inner}</svg>`;
  return `url("data:image/svg+xml,${svg}") ${hotX} ${hotY}, ${fallback}`;
}

/** Tool groups in palette order (top to bottom). */
export const TOOL_GROUPS: MapToolGroup[] = [
  {
    id: 'select',
    // One tool, and the pointer decides what it grabs (SPEC-037, DEC-060):
    // click a vertex or an object, or drag a lasso over both. It was briefly
    // three tools — Vertex/Edge/Object — which turned "what am I about to
    // grab" into a choice you had to make before pointing at anything.
    label: 'Select — click a vertex or object, drag to lasso',
    icon: 'cursor',
    cursor: 'default',
    tools: ['select'],
  },
  {
    id: 'view',
    // Everything that reads the map rather than changes its geometry: move the
    // camera, ask what an eye can see, measure a span, point at something.
    label: 'View — move, look, measure, point',
    icon: 'viewfinder',
    cursor: 'grab',
    toolCursors: {
      eye: 'help',
      ping: 'pointer',
      measure: svgCursor('<path d="M3 21L21 3M3 21l3-9 9-3-3 9-9 3z"/>', 3, 21, 'crosshair'),
    },
    tools: ['pan', 'eye', 'measure', 'ping'],
  },
  {
    id: 'shapes',
    label: 'Shapes — click and drag',
    icon: 'shapes',
    cursor: 'crosshair',
    tools: ['room', 'corridor', 'ngon', 'carve'],
  },
  {
    id: 'multipoint',
    label: 'Runs — click each point, double-click to finish',
    icon: 'multipoint',
    // A precision cursor with a trailing dot: the click *places a vertex*
    // rather than sweeping out a shape.
    cursor: svgCursor(
      '<path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="1.6" fill="%23fff"/>',
      12,
      12,
      'crosshair',
    ),
    tools: ['wall', 'path', 'polygon'],
  },
  {
    id: 'overlay',
    // The Pen belongs here rather than in a group of its own: like a label, a
    // symbol or a door, it puts a thing on top of the map without touching the
    // floor geometry underneath. It keeps its own nib cursor.
    label: 'Overlay — put something on top of the map',
    icon: 'stamp',
    cursor: 'copy',
    toolCursors: {
      pen: svgCursor(
        '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
        3,
        21,
        'crosshair',
      ),
    },
    tools: ['label', 'symbol', 'door', 'pen'],
  },
];

/**
 * The `view` group's tools, in palette order — Pan, Eye, Measure, Ping.
 *
 * This is the subset a **battle map**'s palette is restricted to (SPEC-029
 * §4): the map is a snapshot of another one, so every carve, overlay and
 * select tool is hidden rather than disabled — editing it would desynchronize
 * it from its source. Read off `TOOL_GROUPS` rather than listed a second time,
 * so the palette and the subset cannot drift apart.
 */
export const VIEW_TOOL_IDS: readonly MapToolId[] =
  TOOL_GROUPS.find((g) => g.id === 'view')?.tools ?? [];

/**
 * The subset a **hex crawl**'s palette is restricted to (SPEC-030 §5, WI-041):
 * the View tools plus **Select**, and nothing else.
 *
 * Select is here because on a hex map it is the whole authoring gesture: a
 * click picks the hex under the pointer, and the Map tools sheet's hex-tile
 * body edits that hex's terrain, contents and note. There is no vertex, edge or
 * object to grab — a hex map has no carved floor — so "the pointer decides what
 * it grabs" (SPEC-037) has exactly one answer here.
 *
 * Everything else is excluded on one rule rather than two: **a tool may only
 * write in the coordinate space its map declares** (RULE-006, as amended by
 * WI-037). Every carve tool writes square-lattice floor geometry, and so does
 * every *overlay* tool — a `MapSymbol.cell`, a `MapRoom.labelAnchor`, a
 * `Drawing.points`, a door's endpoints are all lattice units multiplied by
 * `grid.cellSize`, which is not a hex map's multiplier (`hex.size` is). Placing
 * one on a hex crawl would put a second coordinate space inside a single map,
 * which is the thing RULE-006 forbids in as many words. Label is doubly out:
 * SPEC-030 §1 makes coordinates *the* addressing scheme, superseding the labels
 * a referee used to invent and place.
 *
 * So this is narrower than SPEC-030 §5's literal "View and overlay tools only",
 * and deliberately: §5's stated reasoning is about carved floor, which the
 * overlay tools do not touch, but the coordinate space is what actually decides
 * it. See `docs/completed/WI-041.md` → Deviations.
 */
export const HEX_TOOL_IDS: readonly MapToolId[] = TOOL_GROUPS.filter(
  (g) => g.id === 'select' || g.id === 'view',
).flatMap((g) => g.tools);

/** The group a tool belongs to. Every `MapToolId` but `capture` is in exactly
 * one group — `TOOL_GROUPS` is the map-tools palette's only source of tools,
 * so a tool missing from it would otherwise be unreachable; the accompanying
 * test guards that. `capture` is the one deliberate exception (DEC-066): its
 * entry point is the battle-map quick sheet's "Capture area" button, not the
 * palette, so it resolves to `undefined` here by design. */
export function groupForTool(tool: MapToolId): MapToolGroup | undefined {
  // The cast is safe: `.includes` only ever compares by value, and `capture`
  // (the one `MapToolId` outside `PaletteToolId`) correctly finds no match.
  return TOOL_GROUPS.find((g) => g.tools.includes(tool as PaletteToolId));
}

/** The canvas cursor for the active tool (`VectorMapView`'s `setCursor`) — the
 * tool's own override where it has one, otherwise its group's. */
export function cursorForTool(tool: MapToolId): string {
  const group = groupForTool(tool);
  if (!group) return 'default';
  return group.toolCursors?.[tool] ?? group.cursor;
}

/** Every tool id the palette renders, in palette order. */
export function toolsInGroupOrder(): MapToolId[] {
  return TOOL_GROUPS.flatMap((g) => g.tools);
}

/** Whether a tool only reads the map rather than changing its geometry —
 * the exact partition the Edit/View soft lock (IN-031) gates on: every tool
 * outside the `view` group carves or places something. */
export function isViewTool(tool: MapToolId): boolean {
  return groupForTool(tool)?.id === 'view';
}

/** Whether a tool is one a hex crawl offers (SPEC-030 §5) — see
 * `HEX_TOOL_IDS`. `MapToolController.setHexMap` uses this to decide whether the
 * tool in hand survives entering a hex map, the way `isViewTool` decides it for
 * a battle map. */
export function isHexTool(tool: MapToolId): boolean {
  return HEX_TOOL_IDS.includes(tool);
}
