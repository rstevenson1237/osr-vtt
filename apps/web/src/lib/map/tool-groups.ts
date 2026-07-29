import type { MapToolId } from '../shell/map-tool-controller.svelte';
import type { IconId } from '../shell/types';

/**
 * How the map tools are organised in the palette, and what the pointer looks
 * like while each one is active.
 *
 * The palette used to be one flat run of fourteen text buttons, which said
 * nothing about which tools *behave the same way*. Grouping them by gesture is
 * the actual distinction a referee needs at the moment of picking one: a
 * click-and-drag shape, a multi-click run you finish deliberately, an object
 * you stamp down, or a one-shot action. Each group carries its own icon and
 * its own cursor, so both the palette and the canvas answer "what kind of
 * thing am I about to do" without reading a label.
 *
 * Pure data + lookups — no Svelte, no Pixi — so the grouping is unit-testable
 * and the canvas (`VectorMapView`'s `setCursor` effect) and the palette
 * (`MapToolbar`) read the same catalog rather than each keeping its own list.
 */

export type MapToolGroupId =
  | 'select'
  | 'pan'
  | 'shapes'
  | 'multipoint'
  | 'overlay'
  | 'eye'
  | 'annotate'
  | 'ping';

export interface MapToolGroup {
  id: MapToolGroupId;
  /** Shown as the row's `title`; the icon carries the visual identity. */
  label: string;
  icon: IconId;
  /** CSS `cursor` value applied to the map canvas while a tool in this group
   * is active. Keyword where one fits; an inline SVG data-URI otherwise. */
  cursor: string;
  tools: MapToolId[];
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
    label: 'Select',
    icon: 'cursor',
    cursor: 'default',
    tools: ['select'],
  },
  {
    id: 'pan',
    label: 'Pan',
    icon: 'hand',
    cursor: 'grab',
    tools: ['pan'],
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
    label: 'Overlay — stamp an object down',
    icon: 'stamp',
    cursor: 'copy',
    tools: ['label', 'symbol', 'door'],
  },
  {
    id: 'eye',
    label: 'Line of sight',
    icon: 'eye',
    cursor: 'help',
    tools: ['eye'],
  },
  {
    id: 'annotate',
    label: 'Annotate',
    icon: 'pencil',
    cursor: svgCursor(
      '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
      3,
      21,
      'crosshair',
    ),
    tools: ['annotate'],
  },
  {
    id: 'ping',
    label: 'Ping',
    icon: 'ping',
    cursor: 'pointer',
    tools: ['ping'],
  },
];

/** The group a tool belongs to. Every `MapToolId` is in exactly one group —
 * `TOOL_GROUPS` is the palette's only source of tools, so a tool missing from
 * it would be unreachable; the accompanying test guards that. */
export function groupForTool(tool: MapToolId): MapToolGroup | undefined {
  return TOOL_GROUPS.find((g) => g.tools.includes(tool));
}

/** The canvas cursor for the active tool (`VectorMapView`'s `setCursor`). */
export function cursorForTool(tool: MapToolId): string {
  return groupForTool(tool)?.cursor ?? 'default';
}

/** Every tool id the palette renders, in palette order. */
export function toolsInGroupOrder(): MapToolId[] {
  return TOOL_GROUPS.flatMap((g) => g.tools);
}
