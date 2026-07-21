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
   * between the `background` and `floor` layers. Re-renders itself on
   * pan/zoom via the app ticker — call this again only when `cellSize` or
   * `subdivide` changes. */
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
  selectMode: 'vertex' | 'edge';
  /** The Eye tool's live LoS visibility polygon, or null when no eye is placed. */
  visibility: vectorMap.Point[] | null;
  eye: vectorMap.Point | null;
}

export interface VectorMapEngineOptions {
  theme: MapTheme;
}

export async function createVectorMapEngine(
  hostEl: HTMLElement,
  options: VectorMapEngineOptions,
): Promise<VectorMapEngine> {
  let theme = options.theme;
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
  // The grid sits between `background` and `floor` — render-only, not part
  // of the public five-layer contract (SPEC §3.4), so it isn't exposed on
  // `layers`. Previously nothing drew it at all (the cellular engine that
  // used to was deleted in the cutover); see `renderGrid` below.
  const gridGraphics = new PIXI.Graphics();
  gridGraphics.eventMode = 'none';
  world.addChild(gridGraphics);
  world.addChild(layers.floor);
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
  const teardownPanZoom = setupPanZoom(app, world, (active) => gestureCb?.(active));

  const floorGraphics = new PIXI.Graphics();
  layers.floor.addChild(floorGraphics);
  const wallGraphics = new PIXI.Graphics();
  layers.floor.addChild(wallGraphics);

  const doorGraphics = new PIXI.Graphics();
  layers.overlay.addChild(doorGraphics);
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
  // free like every other layer — this only needs to re-run when the visible
  // window actually changes, which `maybeRedrawGrid`'s cheap per-tick check
  // guards against doing needlessly.
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
  app.ticker.add(maybeRedrawGrid);

  function renderGrid(cellSize: number, subdivide: boolean): void {
    gridConfig = { cellSize, subdivide };
    lastGridKey = '';
    drawGrid();
  }

  // ---- floor-ring corner rounding (render-only) ----
  // Model A stores floor as a baked union of straight-line rings — a "circle"
  // is just a 64-gon (SPEC §2.1/§2.5; see `vectorMap.regularPoly`) and there
  // is no circle/ellipse primitive to smooth in the data itself, nor any
  // retained shape identity to round *after the fact* in the store. What was
  // agreed instead: round the corners at render time only. A small fixed
  // pixel radius, clamped to a fraction of each adjacent edge, is self-tuning
  // — a 64-gon circle's edges are tiny at any normal cell size, so its
  // corners round into a visibly smooth curve, while a room's long straight
  // walls clamp the fillet down to nearly nothing and stay crisp 90° corners.
  const CORNER_RADIUS_PX = 4;
  const CORNER_RADIUS_EDGE_FRACTION = 0.4;

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
      const radius = Math.min(
        CORNER_RADIUS_PX,
        lenPrev * CORNER_RADIUS_EDGE_FRACTION,
        lenNext * CORNER_RADIUS_EDGE_FRACTION,
      );
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

  function renderDoors(doors: readonly VectorDoor[], cellSize: number): void {
    doorGraphics.clear();
    for (const door of doors) {
      const a = px(door.a, cellSize);
      const b = px(door.b, cellSize);
      const color =
        door.type === 'secret'
          ? theme.secretDoor
          : door.type === 'trapped'
            ? theme.doorHazard
            : door.type === 'oneWay'
              ? theme.doorOneWay
              : theme.door;
      if (door.state === 'open') {
        strokeDashed(doorGraphics, a.x, a.y, b.x, b.y, 5, 4, color);
      } else {
        doorGraphics.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 4, color });
      }
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      doorGraphics.circle(mid.x, mid.y, 4).fill({ color, alpha: 0.9 });
    }
  }

  function renderOverlayObjects(
    symbols: readonly MapSymbol[],
    mapRooms: readonly MapRoom[],
    cellSize: number,
  ): void {
    symbolsAndLabels.removeChildren();
    for (const symbol of symbols) {
      const center = { x: (symbol.cell.x + 0.5) * cellSize, y: (symbol.cell.y + 0.5) * cellSize };
      const text = new PIXI.Text({
        text: symbolGlyph(symbol.kind),
        style: { fill: theme.wall, fontSize: cellSize * 0.5 },
      });
      text.anchor.set(0.5);
      text.position.set(center.x, center.y);
      text.rotation = (symbol.rotation * Math.PI) / 180;
      symbolsAndLabels.addChild(text);
    }
    for (const room of mapRooms) {
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
      const node = new PIXI.Container();
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
      symbolsAndLabels.addChild(node);
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

    if (input.visibility && input.visibility.length >= 3) {
      const pts = input.visibility.map((p) => px(p, cellSize));
      visibilityGraphics.poly(pts).fill({ color: theme.selection, alpha: 0.12 });
    }
    if (input.eye) {
      const s = px(input.eye, cellSize);
      visibilityGraphics.circle(s.x, s.y, 5).fill({ color: theme.ping });
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
    destroy() {
      app.ticker.remove(maybeRedrawGrid);
      teardownPanZoom();
      app.destroy(true, { children: true });
    },
  };
}

function strokeDashed(
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
  color: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  const ux = dx / length;
  const uy = dy / length;
  let travelled = 0;
  let draw = true;
  while (travelled < length) {
    const step = Math.min(draw ? dash : gap, length - travelled);
    const sx = x1 + ux * travelled;
    const sy = y1 + uy * travelled;
    const ex = x1 + ux * (travelled + step);
    const ey = y1 + uy * (travelled + step);
    if (draw) g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 3, color });
    travelled += step;
    draw = !draw;
  }
}

function symbolGlyph(kind: string): string {
  const glyphs: Record<string, string> = {
    'stairs-down': '▤',
    'spiral-stair': '◎',
    column: '●',
    'secret-door': 'S',
    'compass-star': '✦',
    water: '≈',
    rubble: '░',
    altar: '▲',
    statue: '♟',
    chest: '▣',
    trap: '✕',
    pit: '○',
    portcullis: '≡',
    lever: '↕',
    campfire: '▲',
    'note-pin': '✎',
  };
  return glyphs[kind] ?? '?';
}
