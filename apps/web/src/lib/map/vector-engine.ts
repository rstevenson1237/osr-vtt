import * as PIXI from 'pixi.js';
import {
  hexMap,
  vectorMap,
  type CursorPos,
  type Drawing,
  type HexTile,
  type MapRoom,
  type MapSymbol,
  type PingPos,
  type VectorDoor,
  type VectorFloorRegion,
  type VectorMapDraft,
  type VectorScene,
} from '@osr-vtt/shared';
import { hexToNumber, type MapTheme } from '../theme/map-theme';
import { MAP_EXPORT_LAYERS, type MapExportLayer } from './export-layers';
import {
  clampCameraToBounds,
  fitCameraToBounds,
  setupPanZoom,
  type CameraBounds,
} from './pan-zoom';
import { sameHandle, type Handle } from './vector-tools';

/**
 * The Pixi rendering engine for the Vector Map editor (WI-D). Mirrors the
 * cellular `map/engine.ts` engine/component split — Svelte only calls the
 * methods below — but renders the SPEC §2/§3 vector model (a floor
 * `MultiPoly` with holes, reconciled sight/movement segments, free-endpoint
 * doors) instead of a `FloorGrid`.
 *
 * Layer model (SPEC §3.4): `floor` is the map layer (structure — floor fill +
 * walls); `overlay` is the floating layer (doors, symbols, room labels);
 * `tools` carries everything that is never persisted (live stroke preview,
 * Select-tool handles, the LoS visibility polygon, peers' live-drag ghosts).
 */

export interface VectorMapEngine {
  app: PIXI.Application;
  world: PIXI.Container;
  layers: {
    background: PIXI.Container;
    floor: PIXI.Container;
    overlay: PIXI.Container;
    /** Fog of war (SPEC §4). Sits above `overlay` and below `tokens`, so a
     * fogged region hides the grid, floor, walls, doors, symbols, labels and
     * annotations under it, while tokens and the live tool ghosts still read
     * on top. Drawn by `renderFog` — see its doc for the player/GM split. */
    fog: PIXI.Container;
    /** Token/encounter sprites, rings, and collapsed-group badges. Sits above
     * the fog and below the tool ghosts, so tokens read on top of the map but
     * a live carve/handle preview reads on top of tokens. `VectorMapView` owns
     * the sprite lifecycle here (mirroring the former cellular `MapView`), the
     * same way it owns pointer wiring. */
    tokens: PIXI.Container;
    tools: PIXI.Container;
  };
  toWorld(global: { x: number; y: number }): { x: number; y: number };
  toScreen(world: { x: number; y: number }): { x: number; y: number };
  /** Draws the lattice grid lines (SPEC §3.4 / `RoomGridSettings.subdivide`)
   * between the `floor` and `overlay` layers (above the floor fill, below
   * placed symbols/doors/labels). Re-renders itself on pan/zoom/wheel/resize
   * — call this again only when `cellSize` or `subdivide` changes. */
  renderGrid(cellSize: number, subdivide: boolean): void;
  /** Draws the **hex** grid instead — the infinite flat-top lattice a hex-crawl
   * map has in place of the square one (SPEC-030 §1), plus each hex's `q,r`
   * coordinate pill. `size` is `GameMap.hex.size`, the circumradius in pixels
   * (RULE-006's render-time-only multiplier for a hex map).
   *
   * Occupies the same z-slot and the same pan/zoom redraw triggers as
   * `renderGrid`, and the two are **mutually exclusive**: calling either one
   * clears the other, because a map has exactly one coordinate space and
   * therefore exactly one grid. */
  renderHexGrid(size: number): void;
  /**
   * Draws the map's **painted hexes** (SPEC-030 §§2–3): each tile's terrain as
   * a filled hex plus its overlay art, and its contents as a black icon on top.
   * `size` is `GameMap.hex.size`, exactly as `renderHexGrid` takes it.
   *
   * This is the renderer's first **per-region fill**: a square map paints one
   * themed colour under its whole carved union, whereas here every hex carries
   * its own colour. The fill lands at the bottom of `floor` (terrain is the
   * ground, so grid lines draw over it) and the contents icon on `overlay`
   * (an object standing on the ground, so it draws over the grid).
   *
   * Unlike the grid, this does **not** redraw on pan/zoom: painted hexes are a
   * finite set of stored documents living in world space, like floor regions,
   * not an unbounded plane that has to be culled to the viewport. Call it again
   * when the tiles or `size` change. An empty list clears the layer, which is
   * what every square-grid map passes.
   */
  renderHexTiles(tiles: readonly HexTile[], size: number): void;
  renderScene(scene: VectorScene, cellSize: number): void;
  renderDoors(doors: readonly VectorDoor[], cellSize: number): void;
  /** Read-only pass-through for the coexisting overlay objects (SPEC §2.2 —
   * symbols/mapRooms are unaffected by the vector floor system). Authoring
   * tools for these stay on the cellular MapToolbar for now (WI-D follow-up:
   * see docs/VTT_Master_Plan.md Part V §2).
   *
   * `hiddenLabelId` suppresses one room's rendered label — the inline label
   * editor is a DOM textarea positioned over the canvas at the same spot, so
   * without this the baked Pixi text shows through behind whatever is being
   * typed.
   *
   * `noteDotRoomIds` are the rooms that draw a note dot above their label
   * (SPEC-033 §4): the coarse pointer's tap target for the tooltip a fine
   * pointer gets by hovering. `VectorMapView` decides membership — it is empty
   * on a fine pointer, so a mouse-driven desktop renders exactly as before. */
  renderOverlayObjects(
    symbols: readonly MapSymbol[],
    mapRooms: readonly MapRoom[],
    cellSize: number,
    hiddenLabelId?: string | null,
    noteDotRoomIds?: ReadonlySet<string>,
  ): void;
  /** Freehand/text annotations (the demoted Annotate layer, SPEC §3.4 — shares
   * the `overlay` container with doors/symbols/labels per DECISIONS.md D4).
   * `points`/positions are pixel-space, same as the drawing docs store. */
  renderAnnotations(drawings: readonly Drawing[]): void;
  /** Live peer cursor dots (RTDB `subscribeCursors`); the viewer's own cursor
   * (`myUid`) is skipped. Rendered on a top container above everything. */
  renderCursors(cursors: readonly CursorPos[], myUid: string | null): void;
  /** Transient ping rings (RTDB `subscribePings`), self-expiring from RTDB. */
  renderPings(pings: readonly PingPos[]): void;
  renderToolPreview(input: ToolPreviewInput, cellSize: number): void;
  renderPeerDrafts(drafts: readonly VectorMapDraft[], cellSize: number): void;
  /** Confine the camera to a world-space rectangle (SPEC-029 §4), or `null`
   * for the unbounded default every ordinary map keeps. Applied immediately,
   * so setting a bound snaps an out-of-bounds view back inside it, and
   * re-applied after every pan/zoom gesture and host resize. */
  setCameraBounds(bounds: CameraBounds | null): void;
  /** Scale and centre the view on the current camera bounds — what a battle
   * map opens at when the viewer has no remembered camera for it. A no-op
   * while unbounded, since there is nothing to fit to. */
  fitCamera(): void;
  setGestureListener(cb: (active: boolean) => void): void;
  /** Whether the dedicated Pan tool is the active map tool — lets a plain
   * left-drag pan without a modifier key (see `pan-zoom.ts`'s `isPanTool`). */
  setPanToolActive(active: boolean): void;
  /** The canvas cursor for the active tool group (`map/tool-groups.ts`'s
   * `cursorForTool`). A transient gesture cursor (space-drag's `grab`) layers
   * over this and restores it when the gesture ends. */
  setCursor(css: string): void;
  /** Fog of war (SPEC §4). `revealed` is the union of the map's `fogRegions`
   * in lattice units; everything on screen outside it is covered. Pass
   * `enabled: false` (fog off for this map) to clear the layer entirely.
   *
   * `mode` is the viewer's role: `'player'` paints opaque fog — a fogged
   * region is featureless — while `'gm'` paints a translucent wash so the
   * referee still reads the map underneath and can see where fog remains.
   *
   * Redraws itself on pan/zoom/wheel/resize alongside the grid; call again
   * only when the revealed geometry, `cellSize`, or the mode changes. */
  renderFog(input: {
    enabled: boolean;
    revealed: vectorMap.MultiPoly;
    cellSize: number;
    mode: 'player' | 'gm';
  }): void;
  /**
   * The selected background image's alignment overlay (SPEC-038 §4): the map's
   * own grid, redrawn over the image's rect in translucent yellow, plus the
   * rect's outline and its one resize handle (§3).
   *
   * `rect` is in lattice units like every other stored geometry (RULE-006);
   * `null` clears the overlay, which is what "nothing is selected" looks like.
   * Drawn on the never-persisted `tools` layer, so it is absent from a PNG
   * export the same way a tool ghost is.
   *
   * `gridStep` is one drawn grid square in **lattice units** — 1 on an
   * ordinary map, ½ on a battle map, matching whatever `renderGrid` was handed
   * (`battle-map.ts`'s `gridStepPx`). The overlay has to show the grid the
   * referee can actually see, or it aligns the art against the wrong lines.
   */
  renderBackgroundAlignment(
    rect: { x: number; y: number; w: number; h: number } | null,
    cellSize: number,
    gridStep: number,
    subdivide: boolean,
  ): void;
  setTheme(theme: MapTheme): void;
  /** Per-map solid background color override (`GameMap.background: { color }`
   * — a numeric Pixi color from `hexToNumber`), replacing `theme.rock` as the
   * "no image" backdrop. `null` reverts to the theme's rock color. */
  setBackgroundColor(color: number | null): void;
  /** "Download map as PNG" (M4 — repointed to the union of `FloorRegion.bbox`
   * instead of the cellular `carvedBoundingBox`, since a vector floor has no
   * chunk grid to scan). */
  exportPng(input: {
    regions: readonly VectorFloorRegion[];
    cellSize: number;
    marginCells: number;
    /** Highest layer to include, bottom-up (`MAP_EXPORT_LAYERS`). Everything
     * above it is hidden for the duration of the export, so a referee can hand
     * out a bare floor plan, a keyed map, or the whole board with tokens on it.
     * The never-persisted `tools` layer (live previews, handles, peer cursors
     * and pings) is always excluded. Defaults to the whole stack. */
    maxLayer?: MapExportLayer;
    /** An explicit world-pixel frame to extract, overriding the default
     * "union of `regions`' bboxes plus `marginCells`" frame — the battle map
     * quick sheet's preview (SPEC-029 §2) wants the *candidate capture rect*,
     * not the whole floor. */
    frame?: { x: number; y: number; width: number; height: number };
    /** Skips the one-shot export grid regardless of `maxLayer` — the battle
     * map preview never shows the source grid (SPEC-029 §4). */
    hideGrid?: boolean;
    /** Composited behind the extracted canvas — `extract.canvas` renders only
     * `world`'s children, and a solid `GameMap.background: { color }` lives on
     * the renderer's clear color rather than a `layers.background` sprite, so
     * it would otherwise be missing from the export entirely (SPEC-029 §2's
     * noted `exportPng` gotcha). `null`/omitted leaves the export transparent
     * there, unchanged from before this option existed. */
    backgroundColor?: number | null;
  }): Promise<Blob>;
  destroy(): void;
}

export interface ToolPreviewInput {
  /** The in-progress floor stroke (carve or hole), before commit. */
  strokePolys: vectorMap.MultiPoly | null;
  strokeSubtract: boolean;
  /** In-progress Wall/Door tool segments. */
  previewSegs: vectorMap.Segment[];
  /** Raw collected click points (Path/Polygon/Wall tools). */
  collecting: readonly vectorMap.Point[];
  /** Every grabbable vertex dot, drawn while the Select tool is active. */
  vertexHandles: readonly Handle[];
  hoveredHandle: Handle | null;
  /** The handles in the current selection (SPEC-037 §2) — drawn solid at the
   * enlarged radius, so a lasso's catch is visible without hovering it.
   * Matched by `sameHandle`, not identity: `vertexHandles` is rebuilt every
   * frame, so a handle held across frames is never the same object. */
  selectedHandles: readonly Handle[];
  /** The in-progress lasso region (SPEC-037 §2), in lattice units, or null
   * when the Select drag is a single-pick/move rather than a sweep. */
  lasso: vectorMap.BBox | null;
  /** Draw vertex handles at their enlarged radius unconditionally (SPEC-033
   * §4). The hover highlight is pre-aim feedback and touch has no pre-aim
   * phase, so on a coarse pointer the handle is simply always the bigger
   * target — the size a finger can hit, matching `PICK_PX`'s coarse radius. */
  coarsePointer: boolean;
  /** The Eye tool's live LoS visibility polygon, or null when no eye is placed. */
  visibility: vectorMap.Point[] | null;
  eye: vectorMap.Point | null;
  /** The point a snap-mode draw tool's next click will land on — a live
   * "you are about to place a vertex here" indicator, distinct from
   * `collecting` (points already placed). Null for tools that don't snap. */
  cursorSnap: vectorMap.Point | null;
  /** What the snap dot is about to *do*, which decides its color (see
   * `snapCursorColors`). Not derivable from `strokeSubtract` alone: that flag
   * is passed unconditionally, while only the floor tools actually carve —
   * keying the color off it would recolor the Wall/Door snap dots too, which
   * have no carve semantics. */
  cursorSnapKind: SnapCursorKind;
  /**
   * The cell (or half-cell) a cell-anchored tool is currently targeting, in
   * lattice units — drawn as a filled highlight so the referee can see which
   * cell a Room or Corridor will land in *before* pressing anything (SPEC-028).
   *
   * A separate channel from `cursorSnap` rather than a shape it could take,
   * because the two answer different questions and both are worth showing at
   * once: the dot says "this exact point", the highlight says "this whole
   * cell". Null for free snap, where there is no cell to target, and for the
   * tools that place geometry on vertices rather than filling cells.
   */
  cursorCell: { x: number; y: number; size: number } | null;
  /**
   * The band a Corridor or Path will actually carve at the pointer, in
   * lattice units — narrower than `cursorCell`'s whole tile whenever the
   * chosen width is below the snap step (SPEC-028 §6, WI-052). A `'rect'`
   * under Cell/Half snap (the width×width square centred in the tile); a
   * `'circle'` under Free snap, matching the round cap a free-snap Path
   * produces. Null for every other tool, and for Room, whose `cursorCell`
   * already tells the whole truth.
   */
  cursorBand:
    | { kind: 'rect'; x: number; y: number; size: number }
    | { kind: 'circle'; at: vectorMap.Point; radius: number }
    | null;
  /** The Select tool's currently selected objects (each a symbol/label/
   * drawing's bbox corners, or a door's own endpoints) — highlight boxes, not
   * `Handle`s (those are for vertex geometric edits, a different model). A
   * list since SPEC-037 §2: a lasso can catch several at once. */
  objectHighlights: readonly { a: vectorMap.Point; b: vectorMap.Point }[];
  /** Live "how big is this" readout for an in-progress click-and-drag shape
   * (`vector-tools.ts`'s `strokeMeasureText`), or the Measure tool's distance.
   * Null the moment the stroke is committed or cancelled, which is what makes
   * the chip disappear. */
  measure: { text: string; at: vectorMap.Point } | null;
  /** The Measure tool's in-progress span. Drawn as a ruler line with end caps;
   * its distance rides along in `measure` above, so the two clear together. */
  ruler: { a: vectorMap.Point; b: vectorMap.Point } | null;
  /** The in-progress Capture drag (SPEC-029 §1), in lattice units — always a
   * whole-cell rect (`vectorMap.captureRect`), regardless of the map's snap
   * mode. Drawn like a Room carve's fill but in `theme.battleCapture`, its
   * own colour: "rendered like a Room carve but in a distinct colour." */
  captureRect: vectorMap.BBox | null;
}

export interface VectorMapEngineOptions {
  theme: MapTheme;
  /** Resolves a bundled asset ref (e.g. `symbols/altar.svg`) to a loadable
   * URL — the same `AssetStore.resolve` tokens/backgrounds already use. */
  resolveAsset: (ref: string) => string;
}

// ---- floor-ring corner rounding (render-only), pure math ----
// Model A stores floor as a baked union of straight-line rings — a "circle"
// is just a 64-gon (SPEC §2.1/§2.5; see `vectorMap.regularPoly`) and there is
// no circle/ellipse primitive to smooth in the data itself, nor any retained
// shape identity to round *after the fact* in the store. What was agreed
// instead: round the corners at render time only, adaptively by how sharp
// each corner actually is — a dense ring of nearly-collinear vertices (a
// 64-gon circle, a freeform Path stroke) gets a large, edge-fraction radius
// with no fixed pixel cap, so neighboring fillets nearly meet and the ring
// reads as one continuous curve at any zoom/size; a deliberate sharp corner
// (a Room's 90°, a hand-placed Polygon vertex) gets the old small fixed-ish
// radius and stays crisp. Extracted as pure functions (no `PIXI.Graphics`)
// so the radius/blend math is unit-testable without a canvas.
/** Room labels render at half a cell (see `renderOverlayObjects`); this is the
 * floor that keeps them legible when zoomed well out. */
const MIN_LABEL_FONT_PX = 9;

/** Select-tool vertex handles. The large radius is the hover highlight on a
 * fine pointer, and the unconditional radius on a coarse one (SPEC-033 §4). */
const HANDLE_R = 4;
const HANDLE_R_LARGE = 6;

/**
 * The note dot's drawn radius, in world pixels (SPEC-033 §4).
 *
 * Scaled off the cell like the label it belongs to, so it stays in proportion
 * as the map zooms, with a floor that keeps it visible when zoomed well out —
 * the same shape of rule as `MIN_LABEL_FONT_PX`. This is what the dot *looks*
 * like; what it *catches* is `PICK_PX`, which is deliberately larger.
 */
const MIN_NOTE_DOT_PX = 3;
export function noteDotRadiusPx(cellSize: number): number {
  return Math.max(MIN_NOTE_DOT_PX, cellSize * 0.14);
}

// ---- Hex grid (SPEC-030 §1) ----
// The three numbers the hex grid is tuned by, exported so the tuning is
// unit-testable without a canvas — same treatment as `noteDotRadiusPx` above.

/** A coordinate pill's font size, in world pixels: a fraction of the hex's own
 * circumradius, so the pill scales with the map exactly as a room label scales
 * with its cell. No floor, unlike `MIN_LABEL_FONT_PX` — a pill too small to
 * read is not drawn at all (`hexPillsReadable`) rather than pinned to a size
 * that would collide with its neighbours as the map zooms out. */
export function hexPillFontPx(size: number): number {
  return size * 0.3;
}

/** Below this on-screen font size a pill is illegible, and several hundred of
 * them are noise rather than an addressing scheme. */
const HEX_PILL_MIN_SCREEN_PX = 8;

/** Whether the coordinate pills are worth drawing at the current zoom. `scale`
 * is `world.scale.x` — the pill's *world* font size times the scale is what
 * the viewer actually sees. */
export function hexPillsReadable(size: number, scale: number): boolean {
  return hexPillFontPx(size) * scale >= HEX_PILL_MIN_SCREEN_PX;
}

/**
 * The most hexes the grid will draw in one pass. A hex costs three line
 * segments where a square-lattice row costs one line across the whole
 * viewport, so the far-out end of the zoom range is the one place the two
 * grids differ in cost rather than in looks. Past this the grid is left blank
 * for that frame — at the zoom it takes to reach, a hex is a few pixels wide
 * and the grid reads as a grey wash either way.
 */
const MAX_HEXES_DRAWN = 20000;

// ---- Painted hexes (SPEC-030 §§2–3) ----
// Both art boxes are square and centred on the hex, sized as a fraction of the
// circumradius and exported so the fit is unit-testable without a canvas.
// A flat-top hex's tightest dimension is across the flats — `size * √3 / 2`
// from centre to edge — so what has to hold is that the box's half-diagonal
// stays inside that, or the art bleeds over the hex's own boundary and reads as
// belonging to its neighbour.

/** The terrain overlay's box, in world pixels. Generous: the overlay is the
 * hex's texture, so it should fill it rather than sit politely in the middle. */
export function hexTerrainArtPx(size: number): number {
  return size * 1.1;
}

/** The contents icon's box, in world pixels. Smaller than the terrain's, so the
 * black icon reads as *on* the terrain rather than as more of it. */
export function hexContentsArtPx(size: number): number {
  return size * 0.9;
}

/** The terrain overlay is texture, not subject: held back so a contents icon
 * (SPEC-030 §3) and the coordinate pill (§1) both stay legible over it. */
const HEX_TERRAIN_OVERLAY_ALPHA = 0.55;

/**
 * The most coordinate pills alive at once. Far lower than `MAX_HEXES_DRAWN`
 * because a pill is a `Text` (a texture each) rather than three line segments.
 * `hexPillsReadable` is what normally bounds this — pills stop being drawn long
 * before the grid does — and this is the floor under a very large canvas at a
 * zoom the legibility rule still allows.
 */
const MAX_HEX_PILLS = 1500;

/** The in-progress stroke's dimension chip. Both are screen pixels — the chip
 * counter-scales against the world transform, so these are literal on-screen
 * sizes at any zoom. */
const MEASURE_FONT_PX = 13;
const MEASURE_LIFT_PX = 26;

const CORNER_RADIUS_PX = 4;
const CORNER_RADIUS_EDGE_FRACTION = 0.4;
/** How much of the shorter adjacent edge a fully "curve-like" corner may claim
 * — kept under 0.5 so two neighboring fillets can't overlap past the edge's
 * midpoint. */
const SMOOTH_EDGE_FRACTION = 0.48;
/** Below this per-vertex turn (degrees), a corner is treated as a sampled
 * point on a curve (a 64-gon's ~5.6°/vertex) and gets full smoothing. */
const SHALLOW_TURN_DEG = 12;
/** Above this turn, a corner is treated as a deliberate sharp corner (a
 * room's 90°) and gets the old crisp, fixed-radius treatment. Between the two
 * thresholds the radius blends smoothly — no visible seam between "curve"
 * and "corner" regions of the same ring. */
const SHARP_TURN_DEG = 40;

function smoothstep01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Fills `color` behind `canvas` on a fresh canvas of the same size, or
 * returns `canvas` unchanged when `color` is `null`. `exportPng`'s
 * `renderer.extract.canvas` only ever draws `world`'s children, so a solid
 * `GameMap.background: { color }` — which lives on the renderer's clear
 * color, never a `layers.background` sprite — would otherwise be missing
 * from the export entirely (SPEC-029 §2).
 */
function compositeBackgroundColor(
  canvas: HTMLCanvasElement,
  color: number | null,
): HTMLCanvasElement {
  if (color === null) return canvas;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/**
 * The fillet radius for the corner at `cur`, given its neighbors. Blends from
 * a large edge-fraction radius (shallow turn — reads as a curve) down to the
 * small fixed-cap radius the renderer has always used for sharp corners.
 * Degenerate zero-length edges (duplicate points) get no fillet (radius 0).
 */
export function adaptiveCornerRadius(
  prev: { x: number; y: number },
  cur: { x: number; y: number },
  next: { x: number; y: number },
): number {
  const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y };
  const toNext = { x: next.x - cur.x, y: next.y - cur.y };
  const lenPrev = Math.hypot(toPrev.x, toPrev.y);
  const lenNext = Math.hypot(toNext.x, toNext.y);
  if (lenPrev === 0 || lenNext === 0) return 0;
  const cos = Math.min(
    1,
    Math.max(-1, (toPrev.x * toNext.x + toPrev.y * toNext.y) / (lenPrev * lenNext)),
  );
  const interiorDeg = (Math.acos(cos) * 180) / Math.PI;
  const turnDeg = 180 - interiorDeg;
  const t = smoothstep01((turnDeg - SHALLOW_TURN_DEG) / (SHARP_TURN_DEG - SHALLOW_TURN_DEG));
  const crispRadius = Math.min(
    CORNER_RADIUS_PX,
    lenPrev * CORNER_RADIUS_EDGE_FRACTION,
    lenNext * CORNER_RADIUS_EDGE_FRACTION,
  );
  const smoothRadius = Math.min(lenPrev, lenNext) * SMOOTH_EDGE_FRACTION;
  return smoothRadius + (crispRadius - smoothRadius) * t;
}

/**
 * What a live snap dot is about to do — `'floor'`/`'rock'` when a carve tool
 * will add or subtract floor, `'select'` for every other snapping tool (Wall,
 * Door), which places geometry rather than carving material.
 */
export type SnapCursorKind = 'select' | 'floor' | 'rock';

/**
 * The snap dot's fill + outline. The dot reads as *the material it is about to
 * produce*: floor-colored when carving floor, rock-colored when carving rock,
 * and the usual selection yellow for the non-carving snap tools. Each case
 * outlines itself in the opposing color, because a floor-colored dot sitting on
 * floor (or a rock-colored dot on rock) is otherwise invisible.
 *
 * `backgroundOverride` is the map's solid-color background when it has one
 * (`GameMap.background`), which replaces `theme.rock` as the visible backdrop —
 * so the rock dot tracks what's actually on screen, not the theme default.
 *
 * Pure, so it's unit-testable without a Pixi canvas.
 */
export function snapCursorColors(
  theme: MapTheme,
  kind: SnapCursorKind,
  backgroundOverride: number | null,
): { fill: number; stroke: number } {
  switch (kind) {
    case 'floor':
      return { fill: theme.floor, stroke: theme.rock };
    case 'rock':
      return { fill: backgroundOverride ?? theme.rock, stroke: theme.floor };
    case 'select':
      return { fill: theme.selection, stroke: theme.wall };
  }
}

/**
 * The lattice-line bounds (world/lattice units, expanded by a one-cell
 * margin and snapped outward to whole cells) that cover a given world-space
 * rectangle at `cellSize`. Pure so it's unit-testable without a Pixi canvas;
 * shared by the live on-screen grid (viewport rect) and PNG export (the
 * export frame rect) — see `paintGrid`/`drawGrid`/`exportPng` below.
 */
export function gridLineBounds(
  rect: { x: number; y: number; width: number; height: number },
  cellSize: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const margin = cellSize;
  const left = Math.min(rect.x, rect.x + rect.width);
  const right = Math.max(rect.x, rect.x + rect.width);
  const top = Math.min(rect.y, rect.y + rect.height);
  const bottom = Math.max(rect.y, rect.y + rect.height);
  return {
    minX: Math.floor((left - margin) / cellSize) * cellSize,
    maxX: Math.ceil((right + margin) / cellSize) * cellSize,
    minY: Math.floor((top - margin) / cellSize) * cellSize,
    maxY: Math.ceil((bottom + margin) / cellSize) * cellSize,
  };
}

/**
 * The lattice coordinates of every grid line crossing `rect` (SPEC-038 §4's
 * alignment overlay). Unlike the on-screen grid, this one is bounded — it
 * covers exactly the selected image and nothing beyond it, so the referee sees
 * the grid *on the art* rather than a second grid over the whole viewport.
 *
 * `step` is in lattice units: `1` for cell lines, `0.5` for the half-grid
 * subdivision. Pure so the clipping arithmetic is unit-testable without a Pixi
 * canvas.
 */
export function alignmentGridLines(
  rect: { x: number; y: number; w: number; h: number },
  step: number,
): { xs: number[]; ys: number[] } {
  if (!(step > 0)) return { xs: [], ys: [] };
  // A line sitting exactly on an edge belongs to the overlay: an image aligned
  // flush to a cell boundary is the case this whole overlay exists to confirm,
  // and float drift must not drop that line.
  const eps = step * 1e-6;
  const axis = (from: number, extent: number): number[] => {
    const lo = Math.min(from, from + extent);
    const hi = Math.max(from, from + extent);
    const out: number[] = [];
    // `v === 0 ? 0 : v` normalizes the `-0` that `Math.ceil` of a small
    // negative produces at the origin — harmless to draw, noise to assert on.
    for (let v = Math.ceil((lo - eps) / step) * step; v <= hi + eps; v += step)
      out.push(v === 0 ? 0 : v);
    return out;
  };
  return { xs: axis(rect.x, rect.w), ys: axis(rect.y, rect.h) };
}

/**
 * The world-space rectangle the fog layer fills before punching the revealed
 * geometry out of it: the visible viewport plus one cell of slack, expanded to
 * contain every revealed polygon (`revealed` is in lattice units, hence
 * `cellSize`).
 *
 * Containing the revealed geometry is a correctness requirement, not an
 * optimization — see `drawFog` for why a hole that straddles the covering
 * rect's edge renders as if it had lost vertices. Pure so it's unit-testable
 * without a Pixi canvas.
 */
export function fogCoverRect(
  viewport: { x: number; y: number; width: number; height: number },
  revealed: vectorMap.MultiPoly,
  cellSize: number,
): { x: number; y: number; width: number; height: number } {
  const margin = cellSize;
  let minX = viewport.x - margin;
  let minY = viewport.y - margin;
  let maxX = viewport.x + viewport.width + margin;
  let maxY = viewport.y + viewport.height + margin;
  for (const poly of revealed) {
    for (const ring of poly) {
      for (const p of ring) {
        const x = p.x * cellSize;
        const y = p.y * cellSize;
        if (x - margin < minX) minX = x - margin;
        if (y - margin < minY) minY = y - margin;
        if (x + margin > maxX) maxX = x + margin;
        if (y + margin > maxY) maxY = y + margin;
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The subset of `PIXI.Graphics`'s path-building API `roundedPolyPath` needs —
 * a structural interface so it's unit-testable with a plain recorder object,
 * no Pixi/WebGL context required. */
export interface PolyPathTarget {
  poly(points: { x: number; y: number }[]): unknown;
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): unknown;
  closePath(): unknown;
}

// ---- floor-ring corner rounding (render-only) ----
// The radius math (curve-like vs. sharp-corner blend) is the pure,
// unit-tested `adaptiveCornerRadius` above; this just replays it as path
// commands.

/** Traces a closed polygon into `g`'s current path with every corner
 * rounded — a quadratic-Bezier fillet per vertex, using the original
 * vertex as the curve's control point. Caller still calls `.fill()`/
 * `.cut()`/`.stroke()` afterward, same as a plain `g.poly(points)` would. */
export function roundedPolyPath(
  g: PolyPathTarget,
  points: readonly { x: number; y: number }[],
): void {
  const n = points.length;
  if (n < 3) {
    if (n > 0) g.poly([...points]);
    return;
  }
  const at = (i: number): { x: number; y: number } => points[((i % n) + n) % n]!;
  let started = false;
  for (let i = 0; i < n; i++) {
    const prev = at(i - 1);
    const cur = at(i);
    const next = at(i + 1);
    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y };
    const toNext = { x: next.x - cur.x, y: next.y - cur.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y);
    const lenNext = Math.hypot(toNext.x, toNext.y);
    if (lenPrev === 0 || lenNext === 0) {
      // Degenerate adjacent edge (duplicate/collinear vertex from a carve
      // seam) — draw a sharp corner at `cur` rather than dropping the
      // vertex from the path entirely, which would delete a real corner.
      if (!started) {
        g.moveTo(cur.x, cur.y);
        started = true;
      } else {
        g.lineTo(cur.x, cur.y);
      }
      continue;
    }
    const radius = adaptiveCornerRadius(prev, cur, next);
    const a = {
      x: cur.x + (toPrev.x / lenPrev) * radius,
      y: cur.y + (toPrev.y / lenPrev) * radius,
    };
    const b = {
      x: cur.x + (toNext.x / lenNext) * radius,
      y: cur.y + (toNext.y / lenNext) * radius,
    };
    if (!started) {
      g.moveTo(a.x, a.y);
      started = true;
    } else {
      g.lineTo(a.x, a.y);
    }
    g.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  g.closePath();
}

export async function createVectorMapEngine(
  hostEl: HTMLElement,
  options: VectorMapEngineOptions,
): Promise<VectorMapEngine> {
  let theme = options.theme;
  const resolveAsset = options.resolveAsset;
  // A per-map solid background color (`GameMap.background: { color }`)
  // overrides the renderer's clear color in place of `theme.rock` — the same
  // mechanism that already paints "bare rock" when there's no background
  // image, just pointed at a GM-chosen color instead. `null` reverts to
  // `theme.rock`. Tracked here (not just written once) so a later `setTheme`
  // call — e.g. a light/dark theme toggle — doesn't clobber an active
  // override back to the theme's rock color.
  let backgroundColorOverride: number | null = null;

  const app = new PIXI.Application();
  await app.init({ backgroundColor: theme.rock, resizeTo: hostEl, antialias: true });
  hostEl.appendChild(app.canvas);

  const world = new PIXI.Container();
  app.stage.addChild(world);

  const layers = {
    background: new PIXI.Container(),
    floor: new PIXI.Container(),
    overlay: new PIXI.Container(),
    fog: new PIXI.Container(),
    tokens: new PIXI.Container(),
    tools: new PIXI.Container(),
  };
  world.addChild(layers.background);
  world.addChild(layers.floor);
  // The grid sits between `floor` and `overlay` (i.e. immediately below the
  // symbol/door/label layer) — render-only, not part of the public
  // layer contract (SPEC §3.4), so it isn't exposed on `layers`. Placed
  // above `floor` so lattice lines aren't washed out by the floor fill, and
  // below `overlay` so placed symbols/doors read clearly on top of the grid
  // instead of the grid cutting across their art. It is therefore *under* the
  // fog layer too, which is intended: a fogged region reads as featureless for
  // players, grid included. See `renderGrid` below.
  const gridGraphics = new PIXI.Graphics();
  gridGraphics.eventMode = 'none';
  world.addChild(gridGraphics);
  // A hex map's coordinate pills (SPEC-030 §1) ride the same z-slot as the
  // grid lines they belong to, immediately above them. Their own container
  // rather than more `Graphics`, because each pill is a `Text` plus a chip and
  // they are cached per hex across redraws — see `drawHexPills`.
  const hexPills = new PIXI.Container();
  hexPills.eventMode = 'none';
  world.addChild(hexPills);
  world.addChild(layers.overlay);
  world.addChild(layers.fog);
  world.addChild(layers.tokens);
  world.addChild(layers.tools);

  // Only token sprites are interactive (they set eventMode='static' and
  // stopPropagation on their own drags). Everything else — floor/wall geometry,
  // door/symbol/label overlay, tool ghosts, background — is explicitly
  // non-interactive, so a pointerdown on rendered floor still resolves to the
  // stage (hitArea=screen) rather than a scene graphic. Otherwise the stage's
  // `e.target !== stage` tool guard would silently drop clicks that land on the
  // floor (e.g. placing a room label inside a carved region).
  layers.background.eventMode = 'none';
  layers.floor.eventMode = 'none';
  layers.overlay.eventMode = 'none';
  layers.fog.eventMode = 'none';
  layers.tools.eventMode = 'none';

  let gestureCb: ((active: boolean) => void) | null = null;
  let panToolActive = false;
  // The canvas cursor is two layered values: the *base*, owned by the active
  // map tool (`setCursor`), and a transient gesture *override* (space-drag).
  // Keeping them separate is what lets the override end without erasing the
  // tool's own cursor.
  let baseCursor = '';
  let overrideCursor: string | null = null;
  function applyCursor(): void {
    app.canvas.style.cursor = overrideCursor ?? baseCursor;
  }
  // ---- Bounded camera (SPEC-029 §4) ----
  // `null` for every ordinary map: the vector floor is unbounded, so the
  // camera is too. A battle map sets the captured rect here, and every path
  // that moves `world` — the gestures inside `pan-zoom.ts`, a host resize,
  // and `setCameraBounds` itself — runs the transform back through the clamp.
  let cameraBounds: CameraBounds | null = null;
  function clampCameraNow(): void {
    if (!cameraBounds) return;
    const next = clampCameraToBounds(
      { x: world.x, y: world.y, scale: world.scale.x },
      { width: app.screen.width, height: app.screen.height },
      cameraBounds,
    );
    if (next.scale !== world.scale.x) world.scale.set(next.scale);
    world.x = next.x;
    world.y = next.y;
  }

  const teardownPanZoom = setupPanZoom(
    app,
    world,
    (active) => {
      // Grid-redraw ticker (defined below) is only attached while a drag-pan/
      // touch-pinch gesture is in progress — see that block's comment for why
      // a continuous per-frame poll would otherwise run forever, unconditionally,
      // for the lifetime of every mounted map (real cost on CI's software-rendered
      // WebGL, doubled by any two-context test).
      if (active) app.ticker.add(maybeRedrawViewport);
      else {
        app.ticker.remove(maybeRedrawViewport);
        maybeRedrawViewport(); // settle grid + fog at the gesture's resting position
      }
      gestureCb?.(active);
    },
    () => panToolActive,
    (css) => {
      overrideCursor = css;
      applyCursor();
    },
    clampCameraNow,
  );

  // A hex map's terrain (SPEC-030 §2) is that map's *floor*: the first
  // per-region fill this renderer has had, where a square map paints one themed
  // colour across the whole carved union. It goes in at the bottom of the floor
  // layer — under the wall graphics, under the grid lines, under everything —
  // because a hex map has no carved floor of its own and terrain is the ground
  // itself, not something standing on it. Fill and overlay art are two nodes so
  // the whole terrain plane can be one `Graphics` (one path, one fill per
  // colour) with the sprites above it.
  const hexTerrainGraphics = new PIXI.Graphics();
  layers.floor.addChild(hexTerrainGraphics);
  const hexTerrainSprites = new PIXI.Container();
  hexTerrainSprites.eventMode = 'none';
  layers.floor.addChild(hexTerrainSprites);

  const floorGraphics = new PIXI.Graphics();
  layers.floor.addChild(floorGraphics);
  const wallGraphics = new PIXI.Graphics();
  layers.floor.addChild(wallGraphics);

  // A hex's contents icon (SPEC-030 §3) is an overlay object in exactly the
  // sense a symbol is — something placed on the ground rather than the ground —
  // so it rides `overlay`, above the grid lines its terrain sits below.
  const hexContentsSprites = new PIXI.Container();
  hexContentsSprites.eventMode = 'none';
  layers.overlay.addChild(hexContentsSprites);

  const doorSpritesLayer = new PIXI.Container();
  layers.overlay.addChild(doorSpritesLayer);
  const symbolsAndLabels = new PIXI.Container();
  layers.overlay.addChild(symbolsAndLabels);
  // Annotations (freehand strokes + text) share the overlay layer with
  // doors/symbols/labels (DECISIONS.md D4 — "same layer of the canvas").
  const annotationGraphics = new PIXI.Graphics();
  layers.overlay.addChild(annotationGraphics);
  const annotationLabels = new PIXI.Container();
  layers.overlay.addChild(annotationLabels);

  const fogGraphics = new PIXI.Graphics();
  layers.fog.addChild(fogGraphics);

  // Live collaboration markers ride their own containers above every model
  // layer (including `tools`), so a peer cursor/ping is never occluded by the
  // floor, tokens, or an in-progress tool ghost.
  const cursorsContainer = new PIXI.Container();
  world.addChild(cursorsContainer);
  const pingsContainer = new PIXI.Container();
  world.addChild(pingsContainer);

  // The selected background's alignment overlay (SPEC-038 §4). Its own
  // Graphics on the tools layer: it is never persisted, never exported, and
  // its lifetime is the selection's, not any tool's.
  const bgAlignGraphics = new PIXI.Graphics();
  layers.tools.addChild(bgAlignGraphics);
  const previewGraphics = new PIXI.Graphics();
  layers.tools.addChild(previewGraphics);
  const handleGraphics = new PIXI.Graphics();
  layers.tools.addChild(handleGraphics);
  const visibilityGraphics = new PIXI.Graphics();
  layers.tools.addChild(visibilityGraphics);
  const draftGraphics = new PIXI.Graphics();
  layers.tools.addChild(draftGraphics);
  // The in-progress stroke's dimension chip. Kept as one reused container
  // (rebuilt per frame like the room labels, which is cheap for text) rather
  // than created/destroyed on every pointer move.
  const measureChip = new PIXI.Container();
  measureChip.visible = false;
  layers.tools.addChild(measureChip);

  function toWorld(global: { x: number; y: number }): { x: number; y: number } {
    return world.toLocal(global as PIXI.PointData);
  }
  function toScreen(worldPoint: { x: number; y: number }): { x: number; y: number } {
    return world.toGlobal(worldPoint as PIXI.PointData);
  }

  function px(p: vectorMap.Point, cellSize: number): { x: number; y: number } {
    return { x: p.x * cellSize, y: p.y * cellSize };
  }

  // ---- Grid (render-only; SPEC §3.4's `RoomGridSettings.subdivide`) ----
  // A vector floor has no bounded cell grid to draw once — the visible extent
  // depends on how far the viewer has panned/zoomed, so this redraws the
  // lattice lines to cover whatever's on screen (plus a one-cell margin)
  // rather than pre-drawing a fixed plane. Since `gridGraphics` is a child of
  // `world` (the pan/zoomed container), the *lines drawn* still pan/zoom for
  // free like every other layer — only the redraw *trigger* needs wiring:
  // `app.ticker` runs `maybeRedrawViewport` while a drag-pan/touch-pinch gesture
  // is active (added/removed by the `setupPanZoom` callback below, not run
  // continuously — a per-frame poll for the lifetime of every mounted map has
  // a real cost on CI's software-rendered WebGL); a wheel listener and a
  // `ResizeObserver` cover the two view-changing events a gesture doesn't
  // (instantaneous wheel-zoom, and a host-element resize).
  let gridConfig: { cellSize: number; subdivide: boolean } | null = null;
  /** The hex grid's counterpart (SPEC-030 §1). Exactly one of the two is ever
   * non-null: a map has one coordinate space, so it has one grid. */
  let hexGridConfig: { size: number } | null = null;
  let lastGridKey = '';

  /** Paints lattice lines covering `bounds` (already-expanded world-space
   * min/max, from `gridLineBounds`) into `g`. Shared by the live on-screen
   * grid (bounds = the current viewport) and PNG export (bounds = the export
   * frame) — the only difference between them is which bounds/line width they
   * pass in, not how the lines are drawn. */
  function paintGrid(
    g: PIXI.Graphics,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    cellSize: number,
    subdivide: boolean,
    lineWidth: number,
  ): void {
    const { minX, maxX, minY, maxY } = bounds;
    for (let x = minX; x <= maxX; x += cellSize) {
      g.moveTo(x, minY).lineTo(x, maxY).stroke({ width: lineWidth, color: theme.grid, alpha: 0.5 });
    }
    for (let y = minY; y <= maxY; y += cellSize) {
      g.moveTo(minX, y).lineTo(maxX, y).stroke({ width: lineWidth, color: theme.grid, alpha: 0.5 });
    }
    if (subdivide) {
      const half = cellSize / 2;
      for (let x = minX + half; x <= maxX; x += cellSize) {
        g.moveTo(x, minY)
          .lineTo(x, maxY)
          .stroke({ width: lineWidth, color: theme.grid, alpha: 0.25 });
      }
      for (let y = minY + half; y <= maxY; y += cellSize) {
        g.moveTo(minX, y)
          .lineTo(maxX, y)
          .stroke({ width: lineWidth, color: theme.grid, alpha: 0.25 });
      }
    }
  }

  /** The world-space rectangle currently on screen. Shared by the grid and the
   * fog, which both cover "whatever the viewer can see" rather than a fixed
   * plane, and both redraw off the same pan/zoom/wheel/resize triggers. */
  function viewportRect(): { x: number; y: number; width: number; height: number } {
    const screenW = app.screen.width || 0;
    const screenH = app.screen.height || 0;
    const topLeft = world.toLocal({ x: 0, y: 0 } as PIXI.PointData);
    const bottomRight = world.toLocal({ x: screenW, y: screenH } as PIXI.PointData);
    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  }

  function drawGrid(): void {
    gridGraphics.clear();
    if (hexGridConfig) {
      drawHexGrid();
      return;
    }
    // Switching a map view from a hex map to a square one has to take the
    // pills with it — they belong to the grid, not to the container.
    drawHexPills(null);
    if (!gridConfig || gridConfig.cellSize <= 0) return;
    const { cellSize, subdivide } = gridConfig;
    const scale = world.scale.x || 1;
    const bounds = gridLineBounds(viewportRect(), cellSize);
    paintGrid(gridGraphics, bounds, cellSize, subdivide, 1 / scale);
  }

  // ---- The hex grid (SPEC-030 §1) ----
  // Same shape of problem as the square grid — an unbounded plane drawn across
  // whatever is on screen, redrawn on the same pan/zoom/wheel/resize triggers —
  // but a different coordinate space (RULE-006): `hexMap` culls the viewport to
  // hexes, and the hex `size` is the multiplier where `cellSize` was.

  /** Paints the hex lattice covering `rect` (world pixels) into `g`. Each hex
   * contributes only the three edges it owns (`hexOwnedEdgePath`), so every
   * edge of the plane is stroked exactly once; the whole lattice is one path
   * and one `stroke()`, which is what keeps a few thousand hexes affordable.
   * Shared by the live grid (rect = the viewport) and PNG export (rect = the
   * export frame), exactly as `paintGrid` is. */
  function paintHexGrid(
    g: PIXI.Graphics,
    rect: { x: number; y: number; width: number; height: number },
    size: number,
    lineWidth: number,
  ): void {
    if (hexMap.hexCountInRect(rect, size) > MAX_HEXES_DRAWN) return;
    for (const hex of hexMap.hexesInRect(rect, size)) {
      const path = hexMap.hexOwnedEdgePath(hex, size);
      g.moveTo(path[0]!.x, path[0]!.y);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    }
    g.stroke({ width: lineWidth, color: theme.grid, alpha: 0.5 });
  }

  /** One coordinate pill: `axialKey`'s `"q,r"` — the same string that is the
   * document id for anything stored on this hex — on a translucent chip, hung
   * off the midpoint of the hex's bottom edge (SPEC-030 §1). Sized in world
   * units like a room label, so it scales with the map. */
  function makeHexPill(hex: hexMap.Axial, size: number): PIXI.Container {
    const node = new PIXI.Container();
    const fontSize = hexPillFontPx(size);
    const text = new PIXI.Text({
      text: hexMap.axialKey(hex),
      style: { fill: theme.wall, fontSize, align: 'center' },
    });
    text.anchor.set(0.5, 1);
    const pad = Math.max(1, fontSize * 0.25);
    const chip = new PIXI.Graphics()
      .roundRect(
        -text.width / 2 - pad,
        -text.height - pad,
        text.width + pad * 2,
        text.height + pad * 2,
        Math.max(2, pad),
      )
      .fill({ color: theme.rock, alpha: 0.35 });
    node.addChild(chip);
    node.addChild(text);
    const anchor = hexMap.hexPillAnchor(hex, size);
    // Lifted by the chip's own padding so it sits just inside the bottom edge
    // rather than straddling the line it names.
    node.position.set(anchor.x, anchor.y - pad);
    return node;
  }

  /** The live pills, keyed by `axialKey`. Cached across redraws: a pan only
   * changes which hexes are on screen at the edges, and rebuilding several
   * hundred `Text` objects (a texture each) every frame of a drag would not
   * hold a frame rate. */
  const hexPillNodes = new Map<string, PIXI.Container>();

  /** `rect: null` retires every pill — a square-grid map, or a zoom too far out
   * to read them. */
  function drawHexPills(
    rect: { x: number; y: number; width: number; height: number } | null,
  ): void {
    const size = hexGridConfig?.size ?? 0;
    const scale = world.scale.x || 1;
    const wanted = new Set<string>();
    if (
      rect &&
      size > 0 &&
      hexPillsReadable(size, scale) &&
      hexMap.hexCountInRect(rect, size) <= MAX_HEX_PILLS
    ) {
      for (const hex of hexMap.hexesInRect(rect, size)) {
        const key = hexMap.axialKey(hex);
        wanted.add(key);
        if (hexPillNodes.has(key)) continue;
        const node = makeHexPill(hex, size);
        hexPills.addChild(node);
        hexPillNodes.set(key, node);
      }
    }
    for (const [key, node] of hexPillNodes) {
      if (wanted.has(key)) continue;
      node.destroy({ children: true });
      hexPillNodes.delete(key);
    }
  }

  function drawHexGrid(): void {
    if (!hexGridConfig || hexGridConfig.size <= 0) {
      drawHexPills(null);
      return;
    }
    const scale = world.scale.x || 1;
    const rect = viewportRect();
    paintHexGrid(gridGraphics, rect, hexGridConfig.size, 1 / scale);
    drawHexPills(rect);
  }

  function renderHexGrid(size: number): void {
    // One map, one coordinate space, one grid (RULE-006): adopting the hex
    // grid retires the square one rather than layering over it.
    gridConfig = null;
    hexGridConfig = { size };
    lastGridKey = '';
    drawGrid();
  }

  // ---- Painted hexes (SPEC-030 §§2–3) ----

  /** One art node per painted hex, keyed by the tile's id (its `axialKey`) and
   * cached across redraws for the same reason the door and symbol sprites are:
   * painting one hex must not rebuild every sprite on the map. Terrain and
   * contents are separate maps because a hex may carry either alone. */
  const hexTerrainNodes = new Map<string, PIXI.Sprite>();
  const hexContentsNodes = new Map<string, PIXI.Sprite>();

  /** One art placement: which file, tinted what, centred where. */
  interface HexArtPlacement {
    id: string;
    ref: string;
    tint: number;
    x: number;
    y: number;
  }

  /** Brings one keyed sprite layer in line with `wanted` — add, retint, resize,
   * move, and destroy whatever is no longer painted. Shared by the terrain
   * overlays and the contents icons, which differ only in box, tint and alpha.
   *
   * A fresh sprite starts non-renderable rather than showing the 1x1 white
   * placeholder the door/symbol layers show: tinted and stretched to a whole
   * hex, that placeholder would flash as a solid coloured slab over the
   * terrain fill, which is a much louder artifact than a symbol's brief
   * one-cell square. */
  function syncHexArt(
    nodes: Map<string, PIXI.Sprite>,
    parent: PIXI.Container,
    wanted: readonly HexArtPlacement[],
    box: number,
    alpha: number,
  ): void {
    const seen = new Set<string>();
    for (const item of wanted) {
      seen.add(item.id);
      let sprite = nodes.get(item.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.renderable = false;
        parent.addChild(sprite);
        nodes.set(item.id, sprite);
      }
      if (sprite.label !== item.ref) {
        sprite.label = item.ref;
        const forSprite = sprite;
        void loadCachedTexture(item.ref).then((tex) => {
          if (nodes.get(item.id) !== forSprite) return;
          // Re-apply size after the texture swap — see `renderDoors`.
          forSprite.texture = tex;
          forSprite.width = box;
          forSprite.height = box;
          forSprite.renderable = true;
        });
      }
      sprite.width = box;
      sprite.height = box;
      sprite.tint = item.tint;
      sprite.alpha = alpha;
      sprite.position.set(item.x, item.y);
    }
    for (const [id, sprite] of nodes) {
      if (seen.has(id)) continue;
      sprite.destroy();
      nodes.delete(id);
    }
  }

  function renderHexTiles(tiles: readonly HexTile[], size: number): void {
    hexTerrainGraphics.clear();
    // A non-positive size is a square-grid map (or a half-built hex one):
    // nothing here has a multiplier to be drawn at, so the layer empties.
    const painted = size > 0 ? tiles : [];
    const terrainArt: HexArtPlacement[] = [];
    const contentsArt: HexArtPlacement[] = [];

    for (const tile of painted) {
      const centre = hexMap.axialToPixel(tile.hex, size);
      if (tile.terrain) {
        // The per-region fill (SPEC-030 §2): this hex's own colour, under this
        // hex only. Each tile contributes one closed path to a single
        // `Graphics`, so the whole terrain plane is one geometry however many
        // colours are on it.
        const entry = hexMap.hexTerrainEntry(tile.terrain);
        hexTerrainGraphics
          .poly(hexMap.hexCorners(tile.hex, size))
          .fill({ color: hexToNumber(entry.color) });
        terrainArt.push({
          id: tile.id,
          ref: entry.ref,
          // Contrast is derived from the colour it is drawn on, never stored
          // beside it — see `hexOverlayTone`.
          tint: hexToNumber(hexMap.hexOverlayTone(entry.color)),
          x: centre.x,
          y: centre.y,
        });
      }
      if (tile.contents) {
        contentsArt.push({
          id: tile.id,
          ref: hexMap.hexContentsEntry(tile.contents).ref,
          tint: hexToNumber(hexMap.HEX_CONTENTS_TONE),
          x: centre.x,
          y: centre.y,
        });
      }
    }

    syncHexArt(
      hexTerrainNodes,
      hexTerrainSprites,
      terrainArt,
      hexTerrainArtPx(size),
      HEX_TERRAIN_OVERLAY_ALPHA,
    );
    syncHexArt(hexContentsNodes, hexContentsSprites, contentsArt, hexContentsArtPx(size), 1);
  }

  // ---- Fog of war (SPEC §4) ----
  // Like the grid, fog has no bounded plane to draw once: it covers whatever
  // is on screen minus the revealed geometry, so it redraws off the same
  // pan/zoom/wheel/resize triggers. The covering rect is built in world space
  // and rides `world`, so the *drawn* fog pans/zooms for free — only the
  // redraw trigger is wired.

  /** How much of the map the referee still sees through their own fog. Light
   * enough to read the map underneath, heavy enough that "still fogged" is
   * unmistakable at a glance. */
  const GM_FOG_ALPHA = 0.4;

  let fogConfig: {
    enabled: boolean;
    revealed: vectorMap.MultiPoly;
    cellSize: number;
    mode: 'player' | 'gm';
  } | null = null;

  function drawFog(): void {
    fogGraphics.clear();
    if (!fogConfig || !fogConfig.enabled || fogConfig.cellSize <= 0) return;
    const { revealed, cellSize, mode } = fogConfig;
    // The covering rect is the viewport (one cell of slack past it, so a fast
    // pan can't flash an uncovered edge between redraws) *unioned with every
    // revealed region's own extent*.
    //
    // The union is what makes fog viewport-independent. Each revealed ring is
    // punched out with `Graphics.cut()`, and a cut path only triangulates
    // correctly while it lies inside the shape it is cutting. Zooming in until
    // part of a revealed area sat off screen left that ring straddling the
    // covering rect's edge, and the punched hole came back deformed — reading
    // exactly like vertices being dropped as the viewport moved. Covering the
    // revealed geometry too keeps every hole strictly interior; the extra fill
    // beyond the viewport is off screen and costs nothing visually.
    const rect = fogCoverRect(viewportRect(), revealed, cellSize);
    fogGraphics.rect(rect.x, rect.y, rect.width, rect.height);
    fogGraphics.fill({ color: theme.fog, alpha: mode === 'gm' ? GM_FOG_ALPHA : 1 });

    // Revealed outer rings punch through. Rounded/cleaned the same way the
    // floor is, since reveal strokes come off the same carve tools — an
    // un-rounded fog edge next to a rounded floor edge reads as a mistake.
    for (const poly of revealed) {
      const outer = poly[0] ? vectorMap.cleanRing(poly[0]) : undefined;
      if (!outer || outer.length < 3) continue;
      roundedPolyPath(
        fogGraphics,
        outer.map((p) => px(p, cellSize)),
      );
      fogGraphics.cut();
    }
    // A hole in a revealed region is an island the party hasn't found inside
    // an area they have — re-fog it, on top of the cut above.
    for (const poly of revealed) {
      for (let i = 1; i < poly.length; i++) {
        const hole = vectorMap.cleanRing(poly[i]!);
        if (hole.length < 3) continue;
        roundedPolyPath(
          fogGraphics,
          hole.map((p) => px(p, cellSize)),
        );
        fogGraphics.fill({ color: theme.fog, alpha: mode === 'gm' ? GM_FOG_ALPHA : 1 });
      }
    }
  }

  function renderFog(input: {
    enabled: boolean;
    revealed: vectorMap.MultiPoly;
    cellSize: number;
    mode: 'player' | 'gm';
  }): void {
    fogConfig = input;
    drawFog();
  }

  /** Called once per app tick; skips the redraw unless the visible window,
   * cell size, or subdivide setting actually changed since the last draw.
   * Covers the grid and the fog together — both are viewport-shaped, and
   * splitting them would mean two keys tracking the identical transform. */
  function maybeRedrawViewport(): void {
    const key = `${Math.round(world.x)}:${Math.round(world.y)}:${world.scale.x.toFixed(4)}:${gridConfig?.cellSize ?? 0}:${gridConfig?.subdivide ?? false}:${hexGridConfig?.size ?? 0}:${app.screen.width}:${app.screen.height}`;
    if (key === lastGridKey) return;
    lastGridKey = key;
    drawGrid();
    drawFog();
    // The alignment overlay covers a fixed world rect, so a pan leaves it
    // where it was — but its line weight and handle size are in screen
    // pixels, so a zoom still has to redraw it.
    drawBackgroundAlignment();
  }
  // Mouse-wheel zoom (`pan-zoom.ts`'s wheel handler) isn't bracketed by the
  // gesture-active callback above — it's one instantaneous scale change per
  // event, not a sustained drag — so it needs its own one-shot redraw. This
  // listener only reads the already-updated `world` transform; it doesn't
  // touch pan/zoom behavior itself.
  app.canvas.addEventListener('wheel', () => maybeRedrawViewport(), { passive: true });
  // A host-element resize (e.g. a quick sheet docking/undocking) changes
  // `app.screen.width/height` without any pan/zoom/wheel event to hang a
  // redraw off of — Pixi's own `resizeTo` ResizeObserver updates the canvas
  // size, but doesn't know about the grid or fog, so watch for it independently.
  // A resize also changes what "inside the camera bounds" means — a taller
  // canvas can expose ground below a battle map's rect that was legally off
  // screen a moment ago — so re-impose the bound before redrawing.
  const gridResizeObserver = new ResizeObserver(() => {
    clampCameraNow();
    maybeRedrawViewport();
  });
  gridResizeObserver.observe(hostEl);

  function renderGrid(cellSize: number, subdivide: boolean): void {
    gridConfig = { cellSize, subdivide };
    // See `renderHexGrid`: the two grids are mutually exclusive.
    hexGridConfig = null;
    lastGridKey = '';
    drawGrid();
  }

  // ---- background alignment overlay (SPEC-038 §4) ----
  // Like the grid it draws at a fixed *screen* line weight, so it redraws off
  // the same viewport triggers; unlike the grid it covers a fixed world rect
  // rather than the viewport, so panning alone changes nothing but the width.

  /** How far the yellow reads through the art underneath. Light enough to see
   * the image's own lines, strong enough to trace a cell edge across them. */
  const BG_ALIGN_ALPHA = 0.55;
  const BG_ALIGN_SUBDIVIDE_ALPHA = 0.3;
  /** The resize handle's half-size, in screen pixels (divided by the live
   * scale when drawn, so it stays the same size at every zoom). */
  const BG_HANDLE_PX = 7;

  let bgAlignConfig: {
    rect: { x: number; y: number; w: number; h: number };
    cellSize: number;
    gridStep: number;
    subdivide: boolean;
  } | null = null;

  function drawBackgroundAlignment(): void {
    bgAlignGraphics.clear();
    if (!bgAlignConfig || bgAlignConfig.cellSize <= 0) return;
    const { rect, cellSize, gridStep, subdivide } = bgAlignConfig;
    const lineWidth = 1 / (world.scale.x || 1);
    const left = rect.x * cellSize;
    const right = (rect.x + rect.w) * cellSize;
    const top = rect.y * cellSize;
    const bottom = (rect.y + rect.h) * cellSize;

    // Same geometry as the map's own grid — cell lines, plus the half-grid
    // subdivision when the map shows one — only clipped to the image and in
    // the selection hue rather than the (near-black) grid colour, which over
    // dark map art would be invisible exactly where it is needed.
    const paintStep = (step: number, alpha: number): void => {
      const { xs, ys } = alignmentGridLines(rect, step);
      for (const lx of xs) {
        bgAlignGraphics
          .moveTo(lx * cellSize, top)
          .lineTo(lx * cellSize, bottom)
          .stroke({ width: lineWidth, color: theme.selection, alpha });
      }
      for (const ly of ys) {
        bgAlignGraphics
          .moveTo(left, ly * cellSize)
          .lineTo(right, ly * cellSize)
          .stroke({ width: lineWidth, color: theme.selection, alpha });
      }
    };
    paintStep(gridStep, BG_ALIGN_ALPHA);
    if (subdivide) paintStep(gridStep / 2, BG_ALIGN_SUBDIVIDE_ALPHA);

    // The image's own edge, heavier than the grid lines so "what is selected"
    // is unambiguous when the rect happens to sit on cell boundaries.
    bgAlignGraphics
      .rect(left, top, right - left, bottom - top)
      .stroke({ width: lineWidth * 2, color: theme.selection, alpha: 1 });

    // The one resize handle (SPEC-038 §3), on the bottom-right corner.
    const half = BG_HANDLE_PX / (world.scale.x || 1);
    bgAlignGraphics
      .rect(right - half, bottom - half, half * 2, half * 2)
      .fill({ color: theme.selection, alpha: 1 })
      .stroke({ width: lineWidth, color: theme.rock, alpha: 1 });
  }

  function renderBackgroundAlignment(
    rect: { x: number; y: number; w: number; h: number } | null,
    cellSize: number,
    gridStep: number,
    subdivide: boolean,
  ): void {
    bgAlignConfig = rect ? { rect, cellSize, gridStep, subdivide } : null;
    drawBackgroundAlignment();
  }

  let lastScene: { scene: VectorScene; cellSize: number } | null = null;
  function renderScene(scene: VectorScene, cellSize: number): void {
    lastScene = { scene, cellSize };
    floorGraphics.clear();
    for (const poly of scene.floor) {
      // Rings are cleaned (in lattice space) before the corner pass: a boolean
      // op leaves near-duplicate vertices behind, and the adaptive fillet
      // scales with the shorter adjacent edge, so those micro-edges would
      // flatten the radius to nothing and facet an otherwise smooth curve.
      const outer = poly[0] ? vectorMap.cleanRing(poly[0]) : undefined;
      if (!outer || outer.length < 3) continue;
      roundedPolyPath(
        floorGraphics,
        outer.map((p) => px(p, cellSize)),
      );
      floorGraphics.fill({ color: theme.floor, alpha: 1 });
      for (let i = 1; i < poly.length; i++) {
        const hole = vectorMap.cleanRing(poly[i]!);
        if (hole.length < 3) continue;
        roundedPolyPath(
          floorGraphics,
          hole.map((p) => px(p, cellSize)),
        );
        floorGraphics.cut();
      }
    }
    wallGraphics.clear();
    // Sight segments already carry the SPEC §3.3 build-time door reconciliation
    // (an open door is clipped into a real gap; a closed one is its own
    // blocker), so drawing them directly is correct without re-deriving it here.
    for (const seg of scene.sight) {
      const a = px(seg.a, cellSize);
      const b = px(seg.b, cellSize);
      wallGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: theme.wall });
    }
  }

  // Shared texture cache for symbol/door art (kept alongside PIXI.Assets'
  // own cache so repeated placements of the same kind never re-request the
  // same SVG). Keyed by resolved ref, not kind, in case two kinds ever
  // shared an underlying file.
  const artTextureCache = new Map<string, Promise<PIXI.Texture>>();
  function loadCachedTexture(ref: string): Promise<PIXI.Texture> {
    let pending = artTextureCache.get(ref);
    if (!pending) {
      pending = PIXI.Assets.load(resolveAsset(ref)) as Promise<PIXI.Texture>;
      artTextureCache.set(ref, pending);
    }
    return pending;
  }

  const doorSprites = new Map<string, PIXI.Sprite>();
  function renderDoors(doors: readonly VectorDoor[], cellSize: number): void {
    const seen = new Set<string>();
    for (const door of doors) {
      seen.add(door.id);
      let sprite = doorSprites.get(door.id);
      if (!sprite) {
        // A 1x1 placeholder (not `Texture.EMPTY`, which is 0x0) so the
        // width/height setters below have a non-zero texture to scale
        // against before the real art finishes loading.
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        doorSpritesLayer.addChild(sprite);
        doorSprites.set(door.id, sprite);
      }
      const a = px(door.a, cellSize);
      const b = px(door.b, cellSize);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      // Asymmetric art (e.g. a one-way revolving door) mirrors along the
      // wall normal when the door faces its `b` endpoint.
      const height = door.facing === 'b' ? -cellSize : cellSize;

      const artKind = door.art ?? vectorMap.DEFAULT_DOOR_ART_BY_TYPE[door.type];
      const entry =
        vectorMap.doorArtCatalogEntry(artKind) ??
        vectorMap.doorArtCatalogEntry(vectorMap.DEFAULT_DOOR_ART_BY_TYPE[door.type]);
      if (entry && sprite.label !== entry.ref) {
        sprite.label = entry.ref;
        const forSprite = sprite;
        void loadCachedTexture(entry.ref).then((tex) => {
          if (doorSprites.get(door.id) !== forSprite) return;
          // Pixi's width/height setters bake in scale relative to the
          // *current* texture — swapping the texture alone would leave the
          // sprite sized against the old (placeholder) texture's
          // dimensions, so size must be reapplied right after the swap.
          forSprite.texture = tex;
          forSprite.width = len;
          forSprite.height = height;
        });
      }
      sprite.position.set(mid.x, mid.y);
      sprite.rotation = angle;
      sprite.width = len;
      sprite.height = height;
      // Open/closed is display-only (no art variant per state in the pack).
      sprite.alpha = door.state === 'open' ? 0.4 : 1;
    }
    for (const [id, sprite] of doorSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        doorSprites.delete(id);
      }
    }
  }

  const symbolSprites = new Map<string, PIXI.Sprite>();
  const mapRoomLabels = new Map<string, PIXI.Container>();

  function renderOverlayObjects(
    symbols: readonly MapSymbol[],
    mapRooms: readonly MapRoom[],
    cellSize: number,
    hiddenLabelId?: string | null,
    noteDotRoomIds?: ReadonlySet<string>,
  ): void {
    const seenSymbols = new Set<string>();
    for (const symbol of symbols) {
      seenSymbols.add(symbol.id);
      const entry = vectorMap.symbolCatalogEntry(symbol.kind);
      const span = symbol.cellSpan ?? entry.cellSpan;
      const wantW = span.w * cellSize;
      const wantH = span.h * cellSize;
      let sprite = symbolSprites.get(symbol.id);
      if (!sprite) {
        // 1x1 placeholder, not `Texture.EMPTY` (0x0) — see renderDoors.
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        symbolsAndLabels.addChild(sprite);
        symbolSprites.set(symbol.id, sprite);
      }
      if (sprite.label !== entry.ref) {
        sprite.label = entry.ref;
        const forSprite = sprite;
        void loadCachedTexture(entry.ref).then((tex) => {
          if (symbolSprites.get(symbol.id) !== forSprite) return;
          // Re-apply size after the texture swap — see renderDoors' comment.
          forSprite.texture = tex;
          forSprite.width = wantW;
          forSprite.height = wantH;
        });
      }
      sprite.width = wantW;
      sprite.height = wantH;
      const center = {
        x: (symbol.cell.x + span.w / 2) * cellSize,
        y: (symbol.cell.y + span.h / 2) * cellSize,
      };
      sprite.position.set(center.x, center.y);
      sprite.rotation = (symbol.rotation * Math.PI) / 180;
    }
    for (const [id, sprite] of symbolSprites) {
      if (!seenSymbols.has(id)) {
        sprite.destroy();
        symbolSprites.delete(id);
      }
    }

    const seenRooms = new Set<string>();
    for (const room of mapRooms) {
      // The DOM label editor draws this one; rendering it here too would show
      // the old text through the textarea.
      if (hiddenLabelId && room.id === hiddenLabelId) continue;
      seenRooms.add(room.id);
      let node = mapRoomLabels.get(room.id);
      if (!node) {
        node = new PIXI.Container();
        symbolsAndLabels.addChild(node);
        mapRoomLabels.set(room.id, node);
      }
      // Cheap to rebuild (no texture load involved), unlike the sprite paths
      // above — text/key can change every commit.
      node.removeChildren();
      const label = room.name ? `${room.key}. ${room.name}` : room.key;
      // Half a grid cell tall, so a label scales with the map instead of
      // staying a fixed 13px that shrinks into nothing as you zoom out. The
      // floor keeps it readable at very small cell sizes.
      const fontSize = Math.max(MIN_LABEL_FONT_PX, cellSize / 2);
      const text = new PIXI.Text({
        text: label,
        style: {
          fill: theme.wall,
          fontSize,
          fontWeight: 'bold',
          align: 'center',
          wordWrap: true,
          wordWrapWidth: cellSize * 4,
        },
      });
      text.anchor.set(0.5);
      const pad = Math.max(2, fontSize * 0.3);
      const chip = new PIXI.Graphics()
        .roundRect(
          -text.width / 2 - pad,
          -text.height / 2 - pad,
          text.width + pad * 2,
          text.height + pad * 2,
          Math.max(3, pad),
        )
        .fill({ color: theme.rock, alpha: 0.22 });
      node.addChild(chip);
      node.addChild(text);
      // The note dot (SPEC-033 §4) rides the label's own container, on the
      // label cell's top edge — the chip is centred on the cell and roughly
      // 0.7 cells tall, so the dot clears the text instead of covering it.
      // `vector-tools`' `noteDotCenter` is the lattice-space statement of this
      // same position, and is what the tap hit-tests against.
      if (noteDotRoomIds?.has(room.id)) {
        node.addChild(
          new PIXI.Graphics()
            .circle(0, -cellSize / 2, noteDotRadiusPx(cellSize))
            .fill({ color: theme.selection }),
        );
      }
      const center = {
        x: (room.labelAnchor.x + 0.5) * cellSize,
        y: (room.labelAnchor.y + 0.5) * cellSize,
      };
      node.position.set(center.x, center.y);
    }
    for (const [id, node] of mapRoomLabels) {
      if (!seenRooms.has(id)) {
        node.destroy({ children: true });
        mapRoomLabels.delete(id);
      }
    }
  }

  function renderAnnotations(drawings: readonly Drawing[]): void {
    annotationGraphics.clear();
    annotationLabels.removeChildren();
    for (const drawing of drawings) {
      const first = drawing.points[0];
      if (drawing.kind === 'freehand' && first && drawing.points.length > 1) {
        annotationGraphics.moveTo(first.x, first.y);
        for (const point of drawing.points.slice(1)) annotationGraphics.lineTo(point.x, point.y);
        annotationGraphics.stroke({ width: 2, color: theme.selection, alpha: 0.9 });
      } else if (drawing.kind === 'text' && first) {
        const text = new PIXI.Text({
          text: String(drawing.style['text'] ?? ''),
          style: { fill: theme.selection, fontSize: 13 },
        });
        text.position.set(first.x, first.y);
        annotationLabels.addChild(text);
      }
    }
  }

  const cursorSprites = new Map<string, PIXI.Container>();
  function renderCursors(cursors: readonly CursorPos[], myUid: string | null): void {
    const seen = new Set<string>();
    for (const cursor of cursors) {
      if (cursor.uid === myUid) continue;
      seen.add(cursor.uid);
      let node = cursorSprites.get(cursor.uid);
      if (!node) {
        node = new PIXI.Container();
        node.addChild(new PIXI.Graphics().circle(0, 0, 5).fill(theme.selection));
        cursorsContainer.addChild(node);
        cursorSprites.set(cursor.uid, node);
      }
      node.position.set(cursor.x, cursor.y);
    }
    for (const [uid, node] of cursorSprites) {
      if (!seen.has(uid)) {
        node.destroy({ children: true });
        cursorSprites.delete(uid);
      }
    }
  }

  const pingSprites = new Map<string, PIXI.Graphics>();
  function renderPings(pings: readonly PingPos[]): void {
    const seen = new Set<string>();
    for (const ping of pings) {
      seen.add(ping.id);
      let node = pingSprites.get(ping.id);
      if (!node) {
        node = new PIXI.Graphics().circle(0, 0, 14).stroke({ width: 3, color: theme.ping });
        pingsContainer.addChild(node);
        pingSprites.set(ping.id, node);
      }
      node.position.set(ping.x, ping.y);
    }
    for (const [id, node] of pingSprites) {
      if (!seen.has(id)) {
        node.destroy();
        pingSprites.delete(id);
      }
    }
  }

  function renderToolPreview(input: ToolPreviewInput, cellSize: number): void {
    previewGraphics.clear();
    handleGraphics.clear();
    visibilityGraphics.clear();

    if (input.strokePolys) {
      const color = input.strokeSubtract ? theme.fog : theme.selection;
      for (const poly of input.strokePolys) {
        const outer = poly[0];
        if (!outer || outer.length < 3) continue;
        previewGraphics.poly(outer.map((p) => px(p, cellSize))).fill({ color, alpha: 0.35 });
      }
    }
    if (input.captureRect) {
      const a = px({ x: input.captureRect.minX, y: input.captureRect.minY }, cellSize);
      const b = px({ x: input.captureRect.maxX, y: input.captureRect.maxY }, cellSize);
      previewGraphics
        .rect(a.x, a.y, b.x - a.x, b.y - a.y)
        .fill({ color: theme.battleCapture, alpha: 0.35 })
        .rect(a.x, a.y, b.x - a.x, b.y - a.y)
        .stroke({ width: 2, color: theme.battleCapture, alpha: 0.9 });
    }
    for (const seg of input.previewSegs) {
      const a = px(seg.a, cellSize);
      const b = px(seg.b, cellSize);
      previewGraphics
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 3, color: theme.selection, alpha: 0.85 });
    }
    for (const p of input.collecting) {
      const s = px(p, cellSize);
      previewGraphics.circle(s.x, s.y, 3).fill({ color: theme.selection });
    }

    for (const h of input.vertexHandles) {
      const s = px(h.point, cellSize);
      const picked =
        (input.hoveredHandle !== null && sameHandle(input.hoveredHandle, h)) ||
        input.selectedHandles.some((sel) => sameHandle(sel, h));
      handleGraphics
        .circle(s.x, s.y, picked || input.coarsePointer ? HANDLE_R_LARGE : HANDLE_R)
        .fill({ color: theme.selection, alpha: picked ? 1 : 0.7 });
    }

    // The lasso itself: an outlined region, faintly filled so a sweep over
    // empty rock still reads as an area rather than four thin lines.
    if (input.lasso) {
      const a = px({ x: input.lasso.minX, y: input.lasso.minY }, cellSize);
      const b = px({ x: input.lasso.maxX, y: input.lasso.maxY }, cellSize);
      handleGraphics
        .rect(a.x, a.y, b.x - a.x, b.y - a.y)
        .fill({ color: theme.selection, alpha: 0.1 })
        .rect(a.x, a.y, b.x - a.x, b.y - a.y)
        .stroke({ width: 1, color: theme.selection, alpha: 0.9 });
    }

    for (const highlight of input.objectHighlights) {
      const a = px(highlight.a, cellSize);
      const b = px(highlight.b, cellSize);
      handleGraphics
        .rect(
          Math.min(a.x, b.x) - 4,
          Math.min(a.y, b.y) - 4,
          Math.abs(b.x - a.x) + 8,
          Math.abs(b.y - a.y) + 8,
        )
        .stroke({ width: 2, color: theme.selection, alpha: 0.9 });
    }

    if (input.visibility && input.visibility.length >= 3) {
      const pts = input.visibility.map((p) => px(p, cellSize));
      visibilityGraphics.poly(pts).fill({ color: theme.selection, alpha: 0.12 });
    }
    if (input.eye) {
      const s = px(input.eye, cellSize);
      visibilityGraphics.circle(s.x, s.y, 5).fill({ color: theme.ping });
    }

    // The Measure tool's span: a plain line with a tick at each end, on the
    // handle layer so it reads over floor, walls and overlay alike. Purely a
    // preview — nothing about it is ever committed.
    if (input.ruler) {
      const a = px(input.ruler.a, cellSize);
      const b = px(input.ruler.b, cellSize);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // Normal to the span, so the end caps sit across it rather than along it.
      const nx = (-(b.y - a.y) / len) * 6;
      const ny = ((b.x - a.x) / len) * 6;
      handleGraphics
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 2, color: theme.selection, alpha: 0.95 })
        .moveTo(a.x - nx, a.y - ny)
        .lineTo(a.x + nx, a.y + ny)
        .moveTo(b.x - nx, b.y - ny)
        .lineTo(b.x + nx, b.y + ny)
        .stroke({ width: 2, color: theme.selection, alpha: 0.95 });
    }

    renderMeasureChip(input.measure, cellSize);

    // Targeted-cell highlight, under the dot: which cell a Room or Corridor
    // will fill. Filled faintly rather than outlined — an outline at one cell
    // is hard to tell from the grid line it sits on, which is exactly the
    // confusion the indicator exists to remove.
    if (input.cursorCell) {
      const { fill, stroke } = snapCursorColors(
        theme,
        input.cursorSnapKind,
        backgroundColorOverride,
      );
      const o = px({ x: input.cursorCell.x, y: input.cursorCell.y }, cellSize);
      const size = input.cursorCell.size * cellSize;
      handleGraphics
        .rect(o.x, o.y, size, size)
        .fill({ color: fill, alpha: 0.3 })
        .rect(o.x, o.y, size, size)
        .stroke({ width: 1, color: stroke, alpha: 0.9 });
    }

    // Corridor/Path's band indicator (WI-052): narrower than a whole tile
    // whenever the chosen width is below the snap step, so it is drawn as its
    // own shape rather than reusing `cursorCell`'s tile square.
    if (input.cursorBand) {
      const { fill, stroke } = snapCursorColors(
        theme,
        input.cursorSnapKind,
        backgroundColorOverride,
      );
      if (input.cursorBand.kind === 'rect') {
        const o = px({ x: input.cursorBand.x, y: input.cursorBand.y }, cellSize);
        const size = input.cursorBand.size * cellSize;
        handleGraphics
          .rect(o.x, o.y, size, size)
          .fill({ color: fill, alpha: 0.3 })
          .rect(o.x, o.y, size, size)
          .stroke({ width: 1, color: stroke, alpha: 0.9 });
      } else {
        const c = px(input.cursorBand.at, cellSize);
        const r = input.cursorBand.radius * cellSize;
        handleGraphics
          .circle(c.x, c.y, r)
          .fill({ color: fill, alpha: 0.3 })
          .circle(c.x, c.y, r)
          .stroke({ width: 1, color: stroke, alpha: 0.9 });
      }
    }

    // Live snap-target dot: where a snap-mode tool's next click will land.
    // Drawn last so it always reads on top of everything else in this layer.
    // Not drawn where a tile or shape indicator (cursorCell/cursorBand)
    // supersedes it.
    if (input.cursorSnap && !input.cursorCell && !input.cursorBand) {
      const s = px(input.cursorSnap, cellSize);
      const { fill, stroke } = snapCursorColors(
        theme,
        input.cursorSnapKind,
        backgroundColorOverride,
      );
      handleGraphics
        .circle(s.x, s.y, 4)
        .fill({ color: fill })
        .circle(s.x, s.y, 4)
        .stroke({ width: 1, color: stroke, alpha: 0.9 });
    }
  }

  /**
   * The dimension chip for the stroke being dragged. Counter-scaled against
   * the world transform so it stays the same physical size on screen at any
   * zoom — unlike a room label (which is map furniture and should scale), this
   * is transient UI attached to the pointer, and a readout that shrinks out of
   * legibility exactly when you zoom out to draw something big is useless.
   */
  function renderMeasureChip(
    measure: { text: string; at: vectorMap.Point } | null,
    cellSize: number,
  ): void {
    measureChip.removeChildren();
    if (!measure) {
      measureChip.visible = false;
      return;
    }
    measureChip.visible = true;
    const text = new PIXI.Text({
      text: measure.text,
      style: { fill: theme.selection, fontSize: MEASURE_FONT_PX, fontWeight: 'bold' },
    });
    text.anchor.set(0.5);
    const pad = 4;
    const chip = new PIXI.Graphics()
      .roundRect(
        -text.width / 2 - pad,
        -text.height / 2 - pad,
        text.width + pad * 2,
        text.height + pad * 2,
        4,
      )
      .fill({ color: theme.rock, alpha: 0.78 });
    measureChip.addChild(chip);
    measureChip.addChild(text);

    const scale = world.scale.x || 1;
    measureChip.scale.set(1 / scale);
    const anchor = px(measure.at, cellSize);
    // Lifted clear of the shape's centre so the chip never sits under the
    // pointer, in screen pixels (hence the counter-scale) not lattice units.
    measureChip.position.set(anchor.x, anchor.y - MEASURE_LIFT_PX / scale);
  }

  function renderPeerDrafts(drafts: readonly VectorMapDraft[], cellSize: number): void {
    draftGraphics.clear();
    for (const draft of drafts) {
      if (draft.points.length < 2) continue;
      const pts = draft.points.map((p) => px(p, cellSize));
      draftGraphics.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts.slice(1)) draftGraphics.lineTo(p.x, p.y);
      draftGraphics.stroke({
        width: 2,
        color: draft.mode === 'subtract' ? theme.fog : theme.selection,
        alpha: 0.6,
      });
    }
  }

  function setTheme(next: MapTheme): void {
    theme = next;
    app.renderer.background.color = backgroundColorOverride ?? theme.rock;
    if (lastScene) renderScene(lastScene.scene, lastScene.cellSize);
    // The coordinate pills bake `theme.wall`/`theme.rock` into cached `Text`
    // and chip nodes, so unlike the grid lines they can't be repainted in
    // place — retire them and let `drawGrid` rebuild them in the new theme.
    drawHexPills(null);
    drawGrid();
    drawFog(); // fog is painted in `theme.fog`
    drawBackgroundAlignment(); // painted in `theme.selection`
  }

  function setBackgroundColor(color: number | null): void {
    backgroundColorOverride = color;
    app.renderer.background.color = color ?? theme.rock;
  }

  async function exportPng(input: {
    regions: readonly VectorFloorRegion[];
    cellSize: number;
    marginCells: number;
    maxLayer?: MapExportLayer;
    frame?: { x: number; y: number; width: number; height: number };
    hideGrid?: boolean;
    backgroundColor?: number | null;
  }): Promise<Blob> {
    const bbox = input.frame ? null : vectorMap.unionBBox(input.regions.map((r) => r.bbox));
    const margin = input.marginCells * input.cellSize;
    const frame = input.frame
      ? new PIXI.Rectangle(input.frame.x, input.frame.y, input.frame.width, input.frame.height)
      : bbox
        ? new PIXI.Rectangle(
            bbox.minX * input.cellSize - margin,
            bbox.minY * input.cellSize - margin,
            (bbox.maxX - bbox.minX) * input.cellSize + margin * 2,
            (bbox.maxY - bbox.minY) * input.cellSize + margin * 2,
          )
        : new PIXI.Rectangle(0, 0, input.cellSize * 10, input.cellSize * 10);

    // The live `gridGraphics` only has lines drawn across the current
    // on-screen viewport (`drawGrid` above) — extracting straight from it
    // would show grid only where the viewport happened to be when the export
    // was clicked. Swap in a one-shot grid painted across the full export
    // `frame` instead, at the same z-order slot, then restore afterward.
    // Cut the stack off above the requested layer, restoring every touched
    // container afterwards. `tools`/cursors/pings are transient overlays that
    // never belong in a handed-out map, so they go regardless.
    const maxLayer: MapExportLayer = input.maxLayer ?? 'tokens';
    const cutoff = MAP_EXPORT_LAYERS.indexOf(maxLayer);
    const hidden: PIXI.Container[] = [layers.tools, cursorsContainer, pingsContainer];
    for (const [name, container] of [
      ['floor', layers.floor],
      ['overlay', layers.overlay],
      ['fog', layers.fog],
      ['tokens', layers.tokens],
    ] as const) {
      if (MAP_EXPORT_LAYERS.indexOf(name) > cutoff) hidden.push(container);
    }
    const gridHidden = input.hideGrid || cutoff < MAP_EXPORT_LAYERS.indexOf('floor');
    const restore = hidden.filter((c) => c.visible);
    for (const c of restore) c.visible = false;

    // The live pills, like the live grid, only exist where the viewport is;
    // unlike the grid they are rebuilt per hex, so the export gets a one-shot
    // container painted across the frame rather than a repaint in place.
    const pillsWereVisible = hexPills.visible;
    hexPills.visible = false;
    let exportPills: PIXI.Container | null = null;
    let exportGrid: PIXI.Graphics | null = null;
    const frameRect = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    if (hexGridConfig && hexGridConfig.size > 0 && !gridHidden) {
      // A hex map's grid, over the export frame — same substitution as the
      // square grid below, and for the same reason (SPEC-030 §1).
      exportGrid = new PIXI.Graphics();
      exportGrid.eventMode = 'none';
      paintHexGrid(exportGrid, frameRect, hexGridConfig.size, 1);
      world.addChildAt(exportGrid, world.getChildIndex(gridGraphics));
      gridGraphics.visible = false;
      exportPills = new PIXI.Container();
      exportPills.eventMode = 'none';
      if (hexMap.hexCountInRect(frameRect, hexGridConfig.size) <= MAX_HEX_PILLS) {
        for (const hex of hexMap.hexesInRect(frameRect, hexGridConfig.size)) {
          exportPills.addChild(makeHexPill(hex, hexGridConfig.size));
        }
      }
      world.addChildAt(exportPills, world.getChildIndex(hexPills));
    } else if (gridConfig && gridConfig.cellSize > 0 && !gridHidden) {
      exportGrid = new PIXI.Graphics();
      exportGrid.eventMode = 'none';
      const bounds = gridLineBounds(frameRect, gridConfig.cellSize);
      // `extract` renders `world` in its own untransformed (native) space —
      // line width 1 here is the export's "native scale" equivalent of the
      // live grid's `1 / world.scale.x` (so export line weight doesn't
      // depend on whatever zoom level was on screen when exporting).
      paintGrid(exportGrid, bounds, gridConfig.cellSize, gridConfig.subdivide, 1);
      world.addChildAt(exportGrid, world.getChildIndex(gridGraphics));
      gridGraphics.visible = false;
    }
    try {
      const canvas = app.renderer.extract.canvas({ target: world, frame }) as HTMLCanvasElement;
      const composed = compositeBackgroundColor(canvas, input.backgroundColor ?? null);
      return await new Promise<Blob>((resolve, reject) => {
        composed.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG export failed'));
        }, 'image/png');
      });
    } finally {
      if (exportGrid) {
        gridGraphics.visible = true;
        world.removeChild(exportGrid);
        exportGrid.destroy();
      }
      if (exportPills) {
        world.removeChild(exportPills);
        exportPills.destroy({ children: true });
      }
      hexPills.visible = pillsWereVisible;
      for (const c of restore) c.visible = true;
    }
  }

  return {
    app,
    world,
    layers,
    toWorld,
    toScreen,
    renderGrid,
    renderHexGrid,
    renderHexTiles,
    renderScene,
    renderDoors,
    renderOverlayObjects,
    renderAnnotations,
    renderCursors,
    renderPings,
    renderToolPreview,
    renderPeerDrafts,
    renderFog,
    renderBackgroundAlignment,
    setTheme,
    setBackgroundColor,
    exportPng,
    setCameraBounds(bounds) {
      cameraBounds = bounds;
      clampCameraNow();
      maybeRedrawViewport();
    },
    fitCamera() {
      if (!cameraBounds) return;
      const next = fitCameraToBounds(
        { width: app.screen.width, height: app.screen.height },
        cameraBounds,
      );
      world.scale.set(next.scale);
      world.position.set(next.x, next.y);
      maybeRedrawViewport();
    },
    setGestureListener(cb) {
      gestureCb = cb;
    },
    setPanToolActive(active) {
      panToolActive = active;
    },
    setCursor(css) {
      baseCursor = css;
      applyCursor();
    },
    destroy() {
      app.ticker.remove(maybeRedrawViewport);
      gridResizeObserver.disconnect();
      teardownPanZoom();
      app.destroy(true, { children: true });
    },
  };
}
