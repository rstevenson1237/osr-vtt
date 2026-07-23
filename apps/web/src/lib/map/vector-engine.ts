import * as PIXI from 'pixi.js';
import {
  vectorMap,
  type CursorPos,
  type Drawing,
  type MapRoom,
  type MapSymbol,
  type PingPos,
  type VectorDoor,
  type VectorFloorRegion,
  type VectorMapDraft,
  type VectorScene,
} from '@osr-vtt/shared';
import type { MapTheme } from '../theme/map-theme';
import { setupPanZoom } from './pan-zoom';
import type { Handle } from './vector-tools';

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
    /** Token/encounter sprites, rings, and collapsed-group badges. Sits above
     * the overlay (symbols/labels/doors) and below the tool ghosts, so tokens
     * read on top of the map but a live carve/handle preview reads on top of
     * tokens. `VectorMapView` owns the sprite lifecycle here (mirroring the
     * former cellular `MapView`), the same way it owns pointer wiring. */
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
  renderScene(scene: VectorScene, cellSize: number): void;
  renderDoors(doors: readonly VectorDoor[], cellSize: number): void;
  /** Read-only pass-through for the coexisting overlay objects (SPEC §2.2 —
   * symbols/mapRooms are unaffected by the vector floor system). Authoring
   * tools for these stay on the cellular MapToolbar for now (WI-D follow-up:
   * see docs/VectorMapSystem_Decisions.md). */
  renderOverlayObjects(
    symbols: readonly MapSymbol[],
    mapRooms: readonly MapRoom[],
    cellSize: number,
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
  setGestureListener(cb: (active: boolean) => void): void;
  /** Whether the dedicated Pan tool is the active map tool — lets a plain
   * left-drag pan without a modifier key (see `pan-zoom.ts`'s `isPanTool`). */
  setPanToolActive(active: boolean): void;
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
  /** Select-tool handles (vertex dots or edge highlight). */
  vertexHandles: readonly Handle[];
  hoveredHandle: Handle | null;
  selectMode: 'vertex' | 'edge' | 'object';
  /** The Eye tool's live LoS visibility polygon, or null when no eye is placed. */
  visibility: vectorMap.Point[] | null;
  eye: vectorMap.Point | null;
  /** The point a snap-mode draw tool's next click will land on — a live
   * "you are about to place a vertex here" indicator, distinct from
   * `collecting` (points already placed). Null for tools that don't snap. */
  cursorSnap: vectorMap.Point | null;
  /** Select-tool Object mode's current selection (a symbol/label/drawing's
   * bbox corners, or a door's own endpoints) — a highlight box/line, not a
   * `Handle` (those are for vertex/edge geometric edits, a different model). */
  objectHighlight: { a: vectorMap.Point; b: vectorMap.Point } | null;
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
    tokens: new PIXI.Container(),
    tools: new PIXI.Container(),
  };
  world.addChild(layers.background);
  world.addChild(layers.floor);
  // The grid sits between `floor` and `overlay` (i.e. immediately below the
  // symbol/door/label layer) — render-only, not part of the public
  // five-layer contract (SPEC §3.4), so it isn't exposed on `layers`. Placed
  // above `floor` so lattice lines aren't washed out by the floor fill, and
  // below `overlay` so placed symbols/doors read clearly on top of the grid
  // instead of the grid cutting across their art. See `renderGrid` below.
  const gridGraphics = new PIXI.Graphics();
  gridGraphics.eventMode = 'none';
  world.addChild(gridGraphics);
  world.addChild(layers.overlay);
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
  layers.tools.eventMode = 'none';

  let gestureCb: ((active: boolean) => void) | null = null;
  let panToolActive = false;
  const teardownPanZoom = setupPanZoom(
    app,
    world,
    (active) => {
      // Grid-redraw ticker (defined below) is only attached while a drag-pan/
      // touch-pinch gesture is in progress — see that block's comment for why
      // a continuous per-frame poll would otherwise run forever, unconditionally,
      // for the lifetime of every mounted map (real cost on CI's software-rendered
      // WebGL, doubled by any two-context test).
      if (active) app.ticker.add(maybeRedrawGrid);
      else {
        app.ticker.remove(maybeRedrawGrid);
        maybeRedrawGrid(); // settle the grid at the gesture's resting position
      }
      gestureCb?.(active);
    },
    () => panToolActive,
  );

  const floorGraphics = new PIXI.Graphics();
  layers.floor.addChild(floorGraphics);
  const wallGraphics = new PIXI.Graphics();
  layers.floor.addChild(wallGraphics);

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

  // Live collaboration markers ride their own containers above every model
  // layer (including `tools`), so a peer cursor/ping is never occluded by the
  // floor, tokens, or an in-progress tool ghost.
  const cursorsContainer = new PIXI.Container();
  world.addChild(cursorsContainer);
  const pingsContainer = new PIXI.Container();
  world.addChild(pingsContainer);

  const previewGraphics = new PIXI.Graphics();
  layers.tools.addChild(previewGraphics);
  const handleGraphics = new PIXI.Graphics();
  layers.tools.addChild(handleGraphics);
  const visibilityGraphics = new PIXI.Graphics();
  layers.tools.addChild(visibilityGraphics);
  const draftGraphics = new PIXI.Graphics();
  layers.tools.addChild(draftGraphics);

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
  // `app.ticker` runs `maybeRedrawGrid` while a drag-pan/touch-pinch gesture
  // is active (added/removed by the `setupPanZoom` callback below, not run
  // continuously — a per-frame poll for the lifetime of every mounted map has
  // a real cost on CI's software-rendered WebGL); a wheel listener and a
  // `ResizeObserver` cover the two view-changing events a gesture doesn't
  // (instantaneous wheel-zoom, and a host-element resize).
  let gridConfig: { cellSize: number; subdivide: boolean } | null = null;
  let lastGridKey = '';

  function drawGrid(): void {
    gridGraphics.clear();
    if (!gridConfig || gridConfig.cellSize <= 0) return;
    const { cellSize, subdivide } = gridConfig;
    const scale = world.scale.x || 1;
    const screenW = app.screen.width || 0;
    const screenH = app.screen.height || 0;
    const topLeft = world.toLocal({ x: 0, y: 0 } as PIXI.PointData);
    const bottomRight = world.toLocal({ x: screenW, y: screenH } as PIXI.PointData);
    const margin = cellSize;
    const minX = Math.floor((Math.min(topLeft.x, bottomRight.x) - margin) / cellSize) * cellSize;
    const maxX = Math.ceil((Math.max(topLeft.x, bottomRight.x) + margin) / cellSize) * cellSize;
    const minY = Math.floor((Math.min(topLeft.y, bottomRight.y) - margin) / cellSize) * cellSize;
    const maxY = Math.ceil((Math.max(topLeft.y, bottomRight.y) + margin) / cellSize) * cellSize;
    const lineWidth = 1 / scale;

    for (let x = minX; x <= maxX; x += cellSize) {
      gridGraphics
        .moveTo(x, minY)
        .lineTo(x, maxY)
        .stroke({ width: lineWidth, color: theme.grid, alpha: 0.5 });
    }
    for (let y = minY; y <= maxY; y += cellSize) {
      gridGraphics
        .moveTo(minX, y)
        .lineTo(maxX, y)
        .stroke({ width: lineWidth, color: theme.grid, alpha: 0.5 });
    }
    if (subdivide) {
      const half = cellSize / 2;
      for (let x = minX + half; x <= maxX; x += cellSize) {
        gridGraphics
          .moveTo(x, minY)
          .lineTo(x, maxY)
          .stroke({ width: lineWidth, color: theme.grid, alpha: 0.25 });
      }
      for (let y = minY + half; y <= maxY; y += cellSize) {
        gridGraphics
          .moveTo(minX, y)
          .lineTo(maxX, y)
          .stroke({ width: lineWidth, color: theme.grid, alpha: 0.25 });
      }
    }
  }

  /** Called once per app tick; skips the redraw unless the visible window,
   * cell size, or subdivide setting actually changed since the last draw. */
  function maybeRedrawGrid(): void {
    if (!gridConfig) return;
    const key = `${Math.round(world.x)}:${Math.round(world.y)}:${world.scale.x.toFixed(4)}:${gridConfig.cellSize}:${gridConfig.subdivide}:${app.screen.width}:${app.screen.height}`;
    if (key === lastGridKey) return;
    lastGridKey = key;
    drawGrid();
  }
  // Mouse-wheel zoom (`pan-zoom.ts`'s wheel handler) isn't bracketed by the
  // gesture-active callback above — it's one instantaneous scale change per
  // event, not a sustained drag — so it needs its own one-shot redraw. This
  // listener only reads the already-updated `world` transform; it doesn't
  // touch pan/zoom behavior itself.
  app.canvas.addEventListener('wheel', () => maybeRedrawGrid(), { passive: true });
  // A host-element resize (e.g. the Tools rail collapsing/expanding) changes
  // `app.screen.width/height` without any pan/zoom/wheel event to hang a
  // redraw off of — Pixi's own `resizeTo` ResizeObserver updates the canvas
  // size, but doesn't know about the grid, so watch for it independently.
  const gridResizeObserver = new ResizeObserver(() => maybeRedrawGrid());
  gridResizeObserver.observe(hostEl);

  function renderGrid(cellSize: number, subdivide: boolean): void {
    gridConfig = { cellSize, subdivide };
    lastGridKey = '';
    drawGrid();
  }

  // ---- floor-ring corner rounding (render-only) ----
  // The radius math (curve-like vs. sharp-corner blend) is the pure,
  // unit-tested `adaptiveCornerRadius` above; this just replays it as Pixi
  // path commands.

  /** Traces a closed polygon into `g`'s current path with every corner
   * rounded — a quadratic-Bezier fillet per vertex, using the original
   * vertex as the curve's control point. Caller still calls `.fill()`/
   * `.cut()`/`.stroke()` afterward, same as a plain `g.poly(points)` would. */
  function roundedPolyPath(g: PIXI.Graphics, points: readonly { x: number; y: number }[]): void {
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
      if (lenPrev === 0 || lenNext === 0) continue;
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

  let lastScene: { scene: VectorScene; cellSize: number } | null = null;
  function renderScene(scene: VectorScene, cellSize: number): void {
    lastScene = { scene, cellSize };
    floorGraphics.clear();
    for (const poly of scene.floor) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      roundedPolyPath(
        floorGraphics,
        outer.map((p) => px(p, cellSize)),
      );
      floorGraphics.fill({ color: theme.floor, alpha: 1 });
      for (let i = 1; i < poly.length; i++) {
        const hole = poly[i]!;
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
      const text = new PIXI.Text({
        text: label,
        style: {
          fill: theme.wall,
          fontSize: 13,
          fontWeight: 'bold',
          align: 'center',
          wordWrap: true,
          wordWrapWidth: cellSize * 4,
        },
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
        .fill({ color: theme.rock, alpha: 0.22 });
      node.addChild(chip);
      node.addChild(text);
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

    if (input.selectMode === 'vertex') {
      for (const h of input.vertexHandles) {
        const s = px(h.a, cellSize);
        const hovered = input.hoveredHandle === h;
        handleGraphics
          .circle(s.x, s.y, hovered ? 6 : 4)
          .fill({ color: theme.selection, alpha: hovered ? 1 : 0.7 });
      }
    } else if (input.hoveredHandle) {
      const a = px(input.hoveredHandle.a, cellSize);
      const b = px(input.hoveredHandle.b, cellSize);
      handleGraphics
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 5, color: theme.selection, alpha: 0.85 });
    }

    if (input.objectHighlight) {
      const a = px(input.objectHighlight.a, cellSize);
      const b = px(input.objectHighlight.b, cellSize);
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

    // Live snap-target dot: where a snap-mode tool's next click will land.
    // Drawn last so it always reads on top of everything else in this layer.
    if (input.cursorSnap) {
      const s = px(input.cursorSnap, cellSize);
      handleGraphics
        .circle(s.x, s.y, 4)
        .fill({ color: 0xffffff })
        .circle(s.x, s.y, 4)
        .stroke({ width: 1, color: 0x000000, alpha: 0.5 });
    }
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
    drawGrid();
  }

  function setBackgroundColor(color: number | null): void {
    backgroundColorOverride = color;
    app.renderer.background.color = color ?? theme.rock;
  }

  async function exportPng(input: {
    regions: readonly VectorFloorRegion[];
    cellSize: number;
    marginCells: number;
  }): Promise<Blob> {
    const boxes = input.regions.map((r) => r.bbox);
    const bbox = vectorMap.unionBBox(boxes);
    const margin = input.marginCells * input.cellSize;
    const frame = bbox
      ? new PIXI.Rectangle(
          bbox.minX * input.cellSize - margin,
          bbox.minY * input.cellSize - margin,
          (bbox.maxX - bbox.minX) * input.cellSize + margin * 2,
          (bbox.maxY - bbox.minY) * input.cellSize + margin * 2,
        )
      : new PIXI.Rectangle(0, 0, input.cellSize * 10, input.cellSize * 10);
    const canvas = app.renderer.extract.canvas({ target: world, frame }) as HTMLCanvasElement;
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG export failed'));
      }, 'image/png');
    });
  }

  return {
    app,
    world,
    layers,
    toWorld,
    toScreen,
    renderGrid,
    renderScene,
    renderDoors,
    renderOverlayObjects,
    renderAnnotations,
    renderCursors,
    renderPings,
    renderToolPreview,
    renderPeerDrafts,
    setTheme,
    setBackgroundColor,
    exportPng,
    setGestureListener(cb) {
      gestureCb = cb;
    },
    setPanToolActive(active) {
      panToolActive = active;
      app.canvas.style.cursor = active ? 'grab' : '';
    },
    destroy() {
      app.ticker.remove(maybeRedrawGrid);
      gridResizeObserver.disconnect();
      teardownPanZoom();
      app.destroy(true, { children: true });
    },
  };
}
