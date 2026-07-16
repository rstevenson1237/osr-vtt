import * as PIXI from 'pixi.js';
import {
  angleInAnyGap,
  type Cell,
  type CircleWall,
  type CursorPos,
  type Drawing,
  derivePerimeterEdges,
  type FloorGrid,
  type FogGrid,
  type FogMode,
  type MapDoor,
  type MapDraft,
  type MapRoom,
  type MapSymbol,
  type MapWall,
  type PingPos,
  type SightWall,
  type WallStyle,
  cellCenterPixel,
  cellToPixel,
  chainWallEdges,
  type Edge,
  edgeId as canonicalEdgeId,
  hashSeed,
  isCellRevealed,
  naturalizePolyline,
  neighborAcross,
  pixelToCell,
  resolveWallStyle,
} from '@osr-vtt/shared';
import type { MapTheme } from '../theme/map-theme';

/**
 * The Pixi rendering engine (Plan §7 Phase 1: Background → Player Mapping →
 * GM/Hidden → Tokens → FoW). Framework-agnostic — Svelte only calls the
 * methods below; no component ever touches PIXI directly outside this file
 * and `MapView.svelte`'s pointer wiring.
 */

export interface MapEngine {
  app: PIXI.Application;
  world: PIXI.Container;
  layers: {
    background: PIXI.Container;
    mapping: PIXI.Container;
    gm: PIXI.Container;
    tokens: PIXI.Container;
    fow: PIXI.Container;
    overlay: PIXI.Container;
  };
  toWorld(global: { x: number; y: number }): { x: number; y: number };
  /** Inverse of `toWorld` — a world-space point (e.g. a label's anchor
   * center) to screen space, so callers can position an HTML overlay (the
   * inline label editor, R13.1) directly over its Pixi counterpart. */
  toScreen(world: { x: number; y: number }): { x: number; y: number };
  /** Pans the world so `worldPoint` sits at the center of the viewport,
   * preserving the current zoom (Master Plan v2, R17.2 / WI-20 "jump-to"). */
  centerOn(worldPoint: { x: number; y: number }): void;
  renderMap(input: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    circleWalls?: CircleWall[];
    isGM: boolean;
    /** Half-grid subdivision (Master Plan v2, R9.6) — draws lighter interlines
     * between the full grid lines. Render-only; omitted/false = full grid. */
    subdivide?: boolean;
    /** Room labels are draggable (Master Plan v2, R9.5 "drag a label to
     * re-anchor") — called with the map room id and the dropped cell. */
    onLabelReanchor?: (mapRoomId: string, cell: Cell) => void;
    /** A double-click/double-tap (no drag) on an existing label opens the
     * inline overlay editor for its text (R13.1 — replaces the modal
     * prompt in the edit path). */
    onLabelEdit?: (mapRoomId: string) => void;
  }): void;
  /** The Wall tool's drag-run ghost preview (Master Plan v2, R9.2) — a set of
   * pixel-space line segments (grid-run edges or a single diagonal), or
   * `null` to clear it. */
  renderWallPreview(segments: { x1: number; y1: number; x2: number; y2: number }[] | null): void;
  /** The `wallCircle` tool's live ghost (Master Plan v2, R10.5): a preview ring
   * at `center`/`radius` (pixel space) with a radius readout, or `null` to
   * clear it. */
  renderCirclePreview(
    preview: { cx: number; cy: number; r: number; label: string } | null,
  ): void;
  renderFog(input: {
    mode: FogMode;
    floor: FloorGrid;
    fog: FogGrid;
    isGM: boolean;
    cellSize: number;
    /** Dynamic-mode (Phase 4 LoS): cells to mask because no viewpoint can see
     * them. Computed in the view from `visibleCells()`; ignored otherwise. */
    dynamicHidden?: Cell[];
  }): void;
  renderAnnotations(drawings: Drawing[]): void;
  renderDraftPreview(drafts: MapDraft[], cellSize: number): void;
  renderCursors(cursors: CursorPos[], myUid: string | null): void;
  renderPings(pings: PingPos[]): void;
  renderRuler(from: { x: number; y: number } | null, to: { x: number; y: number } | null, label: string | null): void;
  /** Carve/fill/ellipse drag dimension readout (Master Plan v2, R12): a
   * centered `W × H` label at the preview rectangle's centroid, or `null` to
   * clear it. Purely local — no draft/persistence writes. */
  renderDimHud(center: { x: number; y: number } | null, label: string | null): void;
  /** Re-resolves every themed color from `theme` (R2/WI-1) and replays the
   * most recent render of each layer so the canvas updates immediately —
   * callers don't need to re-supply their map/fog/etc. data. */
  setTheme(theme: MapTheme): void;
  /** Notified when a multi-touch pan/zoom gesture starts (`true`) and ends
   * (`false`) so the view can cancel any in-progress single-finger tool stroke
   * (Master Plan v2, R1.8 touch input). */
  setGestureListener(cb: (active: boolean) => void): void;
  /** "Download map as PNG" (Master Plan v2, R9.8): extracts `world` over
   * `frame` (the carved bbox + margin, in world pixel space) as a PNG blob.
   * `includeHiddenLayer` toggles the GM-only layer (secret doors etc.) for the
   * duration of the capture — players always call this with `false`, so the
   * hidden layer is never in their export regardless of what it currently
   * holds. The fog layer needs no special handling: it already renders (or
   * doesn't) per the viewer's role via `renderFog`, so a player's capture
   * naturally includes the fog mask over hidden cells and a GM's doesn't. */
  exportPng(input: {
    frame: { x: number; y: number; width: number; height: number };
    includeHiddenLayer: boolean;
  }): Promise<Blob>;
  destroy(): void;
}

export interface MapEngineOptions {
  cellSize: number;
  /** Initial theme snapshot (Master Plan v2, R2) — callers resolve this via
   * `readMapTheme()` once `data-theme` is set on the document. */
  theme: MapTheme;
}

export async function createMapEngine(hostEl: HTMLElement, options: MapEngineOptions): Promise<MapEngine> {
  let theme = options.theme;

  const app = new PIXI.Application();
  await app.init({
    backgroundColor: theme.rock,
    resizeTo: hostEl,
    antialias: true,
  });
  hostEl.appendChild(app.canvas);

  const world = new PIXI.Container();
  app.stage.addChild(world);

  const layers = {
    background: new PIXI.Container(),
    mapping: new PIXI.Container(),
    gm: new PIXI.Container(),
    tokens: new PIXI.Container(),
    fow: new PIXI.Container(),
    overlay: new PIXI.Container(),
  };
  world.addChild(layers.background);
  world.addChild(layers.mapping);
  world.addChild(layers.gm);
  world.addChild(layers.tokens);
  world.addChild(layers.fow);
  world.addChild(layers.overlay);

  let gestureCb: ((active: boolean) => void) | null = null;
  const teardownPanZoom = setupPanZoom(app, world, (active) => gestureCb?.(active));

  const mapGraphics = new PIXI.Graphics();
  layers.mapping.addChild(mapGraphics);
  const symbolsAndLabels = new PIXI.Container();
  layers.mapping.addChild(symbolsAndLabels);
  const annotationGraphics = new PIXI.Graphics();
  layers.mapping.addChild(annotationGraphics);
  const gmGraphics = new PIXI.Graphics();
  layers.gm.addChild(gmGraphics);
  // GM-only door text glyphs (secret "S", trapped "!") — Master Plan v2, R11.3.
  // Lives on the GM layer so the export "include hidden layer" toggle and the
  // player render both gate it exactly like the rest of the GM content.
  const doorGmText = new PIXI.Container();
  layers.gm.addChild(doorGmText);
  const fowGraphics = new PIXI.Graphics();
  layers.fow.addChild(fowGraphics);
  const draftGraphics = new PIXI.Graphics();
  layers.overlay.addChild(draftGraphics);
  const wallPreviewGraphics = new PIXI.Graphics();
  layers.overlay.addChild(wallPreviewGraphics);
  const circlePreviewGraphics = new PIXI.Graphics();
  layers.overlay.addChild(circlePreviewGraphics);
  const circlePreviewLabel = new PIXI.Text({ text: '', style: { fill: theme.rulerText, fontSize: 14 } });
  circlePreviewLabel.anchor.set(0.5);
  layers.overlay.addChild(circlePreviewLabel);
  const cursorsContainer = new PIXI.Container();
  layers.overlay.addChild(cursorsContainer);
  const pingsContainer = new PIXI.Container();
  layers.overlay.addChild(pingsContainer);
  const rulerGraphics = new PIXI.Graphics();
  layers.overlay.addChild(rulerGraphics);
  const rulerLabel = new PIXI.Text({ text: '', style: { fill: theme.rulerText, fontSize: 14 } });
  layers.overlay.addChild(rulerLabel);
  const dimHudLabel = new PIXI.Text({
    text: '',
    style: { fill: theme.rulerText, fontSize: 14, fontWeight: 'bold' },
  });
  dimHudLabel.anchor.set(0.5);
  layers.overlay.addChild(dimHudLabel);

  function toWorld(global: { x: number; y: number }): { x: number; y: number } {
    return world.toLocal(global as PIXI.PointData);
  }

  function toScreen(worldPoint: { x: number; y: number }): { x: number; y: number } {
    return world.toGlobal(worldPoint as PIXI.PointData);
  }

  function centerOn(worldPoint: { x: number; y: number }): void {
    // The world has only translation + uniform scale, so placing a world point
    // at the screen center is a direct solve (same algebra as `zoomWorldAt`).
    const scale = world.scale.x;
    world.x = app.screen.width / 2 - worldPoint.x * scale;
    world.y = app.screen.height / 2 - worldPoint.y * scale;
  }

  // Double-tap timing for label editing (R13.1) lives here — at the engine's
  // level, not inside `attachLabelHandlers` — because `renderMap` rebuilds
  // every label node (and re-runs `attachLabelHandlers`) on every floor/wall/
  // symbol/mapRoom/sightWall/circleWall change. In a live room those fire
  // constantly from other clients, so per-node closure state for the tap
  // timer would reset between a user's two clicks almost every time.
  let lastLabelTapAt = 0;
  let lastLabelTapRoomId: string | null = null;

  let lastMapInput: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    circleWalls?: CircleWall[];
    isGM: boolean;
    subdivide?: boolean;
    onLabelReanchor?: (mapRoomId: string, cell: Cell) => void;
    onLabelEdit?: (mapRoomId: string) => void;
  } | null = null;

  function renderMap(input: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    circleWalls?: CircleWall[];
    isGM: boolean;
    subdivide?: boolean;
    onLabelReanchor?: (mapRoomId: string, cell: Cell) => void;
    onLabelEdit?: (mapRoomId: string) => void;
  }): void {
    lastMapInput = input;
    const {
      floor,
      walls,
      symbols,
      mapRooms,
      sightWalls,
      circleWalls,
      isGM,
      subdivide,
      onLabelReanchor,
      onLabelEdit,
    } = input;
    const cellSize = options.cellSize;
    mapGraphics.clear();
    gmGraphics.clear();
    doorGmText.removeChildren();

    // Doors are stamped as centered icons in a dedicated overlay pass *after*
    // the wall strokes are laid down (Master Plan v2, R11.3), so each icon sits
    // on top of its segment. `drawEdge` collects them here as it walks edges.
    const doorGlyphs: { x1: number; y1: number; x2: number; y2: number; door: MapDoor }[] = [];

    const floorCells = floor.listFloorCells();
    for (const cell of floorCells) {
      const { x, y } = cellToPixel(cell, cellSize);
      mapGraphics.rect(x, y, cellSize, cellSize).fill(theme.floor);
      mapGraphics
        .rect(x, y, cellSize, cellSize)
        .stroke({ width: 1, color: theme.grid, alpha: 0.08 });
      // Half-grid subdivision (Master Plan v2, R9.6): lighter interlines at the
      // cell's mid-lines, drawn *under* the perimeter/wall strokes below. The
      // 10′/5′ dual-mark look — reduced weight and alpha vs. the full grid.
      if (subdivide) {
        const mid = cellSize / 2;
        mapGraphics
          .moveTo(x + mid, y)
          .lineTo(x + mid, y + cellSize)
          .moveTo(x, y + mid)
          .lineTo(x + cellSize, y + mid)
          .stroke({ width: 1, color: theme.grid, alpha: 0.04 });
      }
    }

    const hostingRoom = (cell: Cell): MapRoom | undefined =>
      mapRooms.find(
        (r) =>
          cell.x >= r.bbox.x &&
          cell.x < r.bbox.x + r.bbox.w &&
          cell.y >= r.bbox.y &&
          cell.y < r.bbox.y + r.bbox.h,
      );
    const explicitByEdge = new Map(walls.map((w) => [canonicalEdgeId(w), w]));
    const isFloor = (c: Cell): boolean => floor.isFloor(c);
    const perimeter = derivePerimeterEdges(isFloor, floorCells);

    // Natural-style non-door edges aren't stroked individually; they're chained
    // into polylines and drawn as organic curves after both edge passes
    // (Master Plan v2, R9.4). Grouped by hosting room so each run's noise seed
    // is `hash(roomId + runKey)` and doors (drawn separately) break the chain.
    const naturalByRoom = new Map<string, Edge[]>();

    const drawnEdges = new Set<string>();
    const drawEdge = (cell: Cell, side: 'N' | 'E' | 'S' | 'W', wall?: MapWall): void => {
      const door = wall?.door;
      const id = canonicalEdgeId({ x: cell.x, y: cell.y, side });
      if (drawnEdges.has(id)) return;
      drawnEdges.add(id);
      const a = cellToPixel(cell, cellSize);
      const neighbor = neighborAcross(cell, side);
      const b = cellToPixel(neighbor, cellSize);
      let x1 = a.x;
      let y1 = a.y;
      let x2: number;
      let y2: number;
      if (side === 'N' || side === 'S') {
        x1 = Math.max(a.x, b.x);
        x2 = x1 + cellSize;
        y1 = side === 'N' ? a.y : a.y + cellSize;
        y2 = y1;
      } else {
        y1 = Math.max(a.y, b.y);
        y2 = y1 + cellSize;
        x1 = side === 'W' ? a.x : a.x + cellSize;
        x2 = x1;
      }

      if (door) {
        // A door draws its wall stroke as normal, then a centered type icon is
        // stamped in the door-overlay pass (Master Plan v2, R11.3). A secret
        // door is a GM-only hidden passage: invisible to players until revealed
        // (Spec §8), and drawn as a dashed run on the GM layer for the GM.
        const isSecret = door.type === 'secret';
        if (isSecret && !isGM) return; // invisible to non-GM until revealed
        if (isSecret) {
          strokeDashed(gmGraphics, x1, y1, x2, y2, 4, 3, theme.secretDoor);
        } else {
          mapGraphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 3, color: theme.wall });
        }
        doorGlyphs.push({ x1, y1, x2, y2, door });
        return;
      }

      // A wall's effective render style (Master Plan v2, R10.3): the wall's
      // own `style` wins, then the hosting room's, then `'masonry'` — so
      // pre-R10 walls (no `style`) keep deriving from the room (R10.1/R10.2).
      const room = hostingRoom(cell);
      const style = resolveWallStyle(wall?.style, room?.wallStyle);
      if (style === 'natural') {
        // Defer to the chained organic-curve pass below (R9.4/R10.3), keyed off
        // the wall's *own* style so a single natural wall reads irregular even
        // in a masonry room. Bucket by hosting room (or a fallback) so the noise
        // seed stays `hash(roomId + runKey)` and is identical on every client.
        const bucketId = room?.id ?? '__noroom__';
        const bucket = naturalByRoom.get(bucketId) ?? [];
        bucket.push({ x: cell.x, y: cell.y, side });
        naturalByRoom.set(bucketId, bucket);
      } else if (style === 'dashed') {
        strokeDashed(mapGraphics, x1, y1, x2, y2, 5, 3, theme.wall);
      } else {
        // `solid` and `masonry` both render as a single solid stroke (masonry's
        // treatment is the unchanged historic look — R10.3).
        mapGraphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 3, color: theme.wall });
      }
    };

    for (const edge of perimeter) {
      const wall = explicitByEdge.get(canonicalEdgeId(edge));
      drawEdge({ x: edge.x, y: edge.y }, edge.side, wall);
    }
    for (const wall of walls) {
      drawEdge({ x: wall.x, y: wall.y }, wall.side, wall);
    }

    // Organic "natural" wall curves (Master Plan v2, R9.4): chain each room's
    // deferred natural edges into polylines, displace with seeded value noise
    // (identical on every client — seed = hash(roomId + run's first point)),
    // and draw as a smoothed quadratic curve with rounded joins.
    for (const [mapRoomId, edges] of naturalByRoom) {
      for (const chain of chainWallEdges(edges)) {
        const first = chain[0]!;
        const seed = hashSeed(`${mapRoomId}:${first.x},${first.y}`);
        const pixels = chain.map((p) => ({ x: p.x * cellSize, y: p.y * cellSize }));
        const points = naturalizePolyline(pixels, { seed, cellSize });
        drawSmoothCurve(mapGraphics, points, theme.wall);
      }
    }

    // Vector vision-walls — already in pixel space, not on the grid. Only
    // `visible` ones draw (Master Plan v2, R9.2): a diagonal wall placed by
    // the Wall tool sets `visible: true` and renders like a grid wall in its
    // chosen style; a legacy/imported `.uvtt` wall has no `visible` field and
    // stays invisible (it overlays pre-rendered art) — it still blocks LoS
    // either way, since `sightSegments()` never filters on this flag.
    for (const sw of sightWalls ?? []) {
      if (!sw.visible) continue;
      // Angled/diagonal walls default to `solid` (Master Plan v2, R10.4) — dashed
      // is now only produced by an explicit `dashed` style, and a `natural`
      // diagonal routes through the organic pass instead of the old dashed hack
      // (R10.3, fixing the "angled natural walls display dashed" report).
      const style: WallStyle = sw.style ?? 'solid';
      if (style === 'natural') {
        const seed = hashSeed(`sw:${sw.id}`);
        const pts = naturalizePolyline(
          [
            { x: sw.ax, y: sw.ay },
            { x: sw.bx, y: sw.by },
          ],
          { seed, cellSize },
        );
        drawSmoothCurve(mapGraphics, pts, theme.wall);
      } else if (style === 'dashed') {
        strokeDashed(mapGraphics, sw.ax, sw.ay, sw.bx, sw.by, 5, 3, theme.wall);
      } else {
        mapGraphics.moveTo(sw.ax, sw.ay).lineTo(sw.bx, sw.by).stroke({ width: 3, color: theme.wall });
      }
    }

    // Circular walls (Master Plan v2, R10.5): stroke each ring in its style
    // with cut `gaps` left as breaks (so a gap reads as — and, in LoS, is — a
    // real opening). Drawn after the grid walls, on the same mapping graphics.
    for (const circle of circleWalls ?? []) {
      drawCircleWall(mapGraphics, circle, theme.wall);
    }

    // Door-type overlay pass (Master Plan v2, R11.3): a centered icon per door,
    // over its already-drawn wall stroke. Public shapes go on `mapGraphics`;
    // GM-only detail (secret glyph, trapped hazard, one-way arrow) on the GM
    // layer so players and hidden-layer-off exports never see it.
    for (const g of doorGlyphs) {
      drawDoorGlyph(g.x1, g.y1, g.x2, g.y2, g.door, cellSize, isGM);
    }

    symbolsAndLabels.removeChildren();
    for (const symbol of symbols) {
      const center = cellCenterPixel(symbol.cell, cellSize);
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
      const text = room.name ? `${room.key}. ${room.name}` : room.key;
      // Labels v2 (Master Plan v2, R9.5): centered on the anchor cell (both
      // axes), explicit `\n` newlines honored, auto-wrap at 4 cells, may
      // overflow the anchor cell while staying anchored to it.
      const label = new PIXI.Text({
        text,
        style: {
          fill: theme.wall,
          fontSize: 13,
          fontWeight: 'bold',
          align: 'center',
          wordWrap: true,
          wordWrapWidth: cellSize * 4,
        },
      });
      label.anchor.set(0.5);

      const node = new PIXI.Container();
      const pad = 4;
      const chip = new PIXI.Graphics()
        .roundRect(-label.width / 2 - pad, -label.height / 2 - pad, label.width + pad * 2, label.height + pad * 2, 4)
        .fill({ color: theme.rock, alpha: 0.22 });
      node.addChild(chip);
      node.addChild(label);

      const center = cellCenterPixel(room.labelAnchor, cellSize);
      node.position.set(center.x, center.y);
      node.eventMode = 'static';
      node.cursor = 'grab';
      attachLabelHandlers(node, room.id, onLabelReanchor, onLabelEdit);
      symbolsAndLabels.addChild(node);
    }
  }

  /**
   * Stamp a centered door-type icon on a wall segment (Master Plan v2, R11.3).
   * The local frame uses `u` along the segment and `v` across it, so one code
   * path lays a door out on a horizontal (N/S) or vertical (E/W) edge alike,
   * always centered on the midpoint. Public marks draw on `mapGraphics`;
   * GM-only detail (secret glyph, trapped hazard, one-way arrow) on the GM
   * layer, gated by `isGM` so players and hidden-layer-off exports never see it.
   */
  function drawDoorGlyph(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    door: MapDoor,
    cellSize: number,
    isGM: boolean,
  ): void {
    const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || cellSize;
    const ux = dx / len;
    const uy = dy / len; // unit vector along the wall
    const vx = -uy;
    const vy = ux; // unit vector across the wall
    const P = (a: number, b: number): { x: number; y: number } => ({
      x: mid.x + ux * a + vx * b,
      y: mid.y + uy * a + vy * b,
    });
    const ha = cellSize * 0.16; // frame half-extent along the wall
    const hb = cellSize * 0.19; // frame half-extent across the wall

    const frame = (centerAlong: number, halfAlong: number, color: number): void => {
      const c0 = P(centerAlong - halfAlong, -hb);
      const c1 = P(centerAlong + halfAlong, -hb);
      const c2 = P(centerAlong + halfAlong, hb);
      const c3 = P(centerAlong - halfAlong, hb);
      mapGraphics
        .poly([c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y])
        .fill({ color: theme.rock, alpha: 0.85 })
        .stroke({ width: 2, color });
    };

    const stroke = (
      g: PIXI.Graphics,
      a0: number,
      b0: number,
      a1: number,
      b1: number,
      color: number,
    ): void => {
      const p = P(a0, b0);
      const q = P(a1, b1);
      g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: 2, color });
    };

    const glyph = (text: string, color: number): void => {
      const t = new PIXI.Text({
        text,
        style: { fill: color, fontSize: cellSize * 0.28, fontWeight: '700' },
      });
      t.anchor.set(0.5);
      t.position.set(mid.x, mid.y);
      doorGmText.addChild(t);
    };

    switch (door.type) {
      case 'single':
        frame(0, ha, theme.door);
        // The leaf edge — a short line across the frame near one jamb.
        stroke(mapGraphics, ha * 0.5, -hb * 0.7, ha * 0.5, hb * 0.7, theme.door);
        break;
      case 'double':
        // Two leaves meeting at the segment midpoint.
        frame(-ha * 0.55, ha * 0.5, theme.door);
        frame(ha * 0.55, ha * 0.5, theme.door);
        break;
      case 'secret': {
        if (!isGM) break; // GM-only until revealed — players see nothing here
        const c = P(0, 0);
        gmGraphics
          .circle(c.x, c.y, hb)
          .fill({ color: theme.rock, alpha: 0.85 })
          .stroke({ width: 2, color: theme.secretDoor });
        glyph('S', theme.secretDoor);
        break;
      }
      case 'trapped':
        frame(0, ha, theme.door); // the door itself reads normally to players
        if (isGM) {
          // GM-only hazard triangle + "!" mark.
          const apex = P(0, -hb * 0.95);
          const bl = P(-ha * 0.75, hb * 0.7);
          const br = P(ha * 0.75, hb * 0.7);
          gmGraphics
            .poly([apex.x, apex.y, br.x, br.y, bl.x, bl.y])
            .fill({ color: theme.rock, alpha: 0.85 })
            .stroke({ width: 2, color: theme.doorHazard });
          glyph('!', theme.doorHazard);
        }
        break;
      case 'oneWay':
        frame(0, ha, theme.door);
        if (isGM) {
          // GM annotation only (R11.4): an arrow along the segment in `facing`.
          const dir = door.facing === 'ba' ? -1 : 1; // 'ab' points a→b (+u)
          stroke(gmGraphics, -ha * 0.7 * dir, 0, ha * 0.7 * dir, 0, theme.doorOneWay);
          const tip = P(ha * 0.7 * dir, 0);
          const w1 = P(ha * 0.35 * dir, -hb * 0.5);
          const w2 = P(ha * 0.35 * dir, hb * 0.5);
          gmGraphics
            .moveTo(w1.x, w1.y)
            .lineTo(tip.x, tip.y)
            .lineTo(w2.x, w2.y)
            .stroke({ width: 2, color: theme.doorOneWay });
        }
        break;
      case 'barred':
        frame(0, ha, theme.door);
        // Two bars parallel to the wall across the frame.
        stroke(mapGraphics, -ha * 0.8, -hb * 0.4, ha * 0.8, -hb * 0.4, theme.door);
        stroke(mapGraphics, -ha * 0.8, hb * 0.4, ha * 0.8, hb * 0.4, theme.door);
        break;
      case 'none':
        break;
    }
  }

  const DOUBLE_TAP_MS = 400;

  /** Select-tool drag re-anchors a label; a double tap/click (no movement)
   * opens the inline overlay editor for its text (Master Plan v2, R13.1 —
   * a single tap no longer opens anything, matching the "double-click to
   * edit" mockup). Mirrors the token drag pattern in `MapView.svelte`'s
   * `attachDragHandlers`. Double-tap is detected by hand (rather than a
   * native `dblclick`) so it also works for touch; the timing itself lives
   * in the engine-level `lastLabelTapAt`/`lastLabelTapRoomId` (not a local
   * here) so it survives this function re-running on every `renderMap`. */
  function attachLabelHandlers(
    node: PIXI.Container,
    mapRoomId: string,
    onLabelReanchor?: (mapRoomId: string, cell: Cell) => void,
    onLabelEdit?: (mapRoomId: string) => void,
  ): void {
    let down = false;
    let dragging = false;
    let startGlobal = { x: 0, y: 0 };
    node.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      down = true;
      dragging = false;
      startGlobal = { x: e.global.x, y: e.global.y };
      e.stopPropagation();
    });
    node.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!down) return;
      const dx = e.global.x - startGlobal.x;
      const dy = e.global.y - startGlobal.y;
      if (!dragging && Math.hypot(dx, dy) > 4) dragging = true;
      if (dragging) node.position.copyFrom(world.toLocal(e.global));
    });
    const stop = (e: PIXI.FederatedPointerEvent): void => {
      if (!down) return;
      down = false;
      if (dragging) {
        const local = world.toLocal(e.global);
        onLabelReanchor?.(mapRoomId, pixelToCell(local, options.cellSize));
        dragging = false;
        lastLabelTapAt = 0;
        lastLabelTapRoomId = null;
        return;
      }
      dragging = false;
      const now = performance.now();
      if (lastLabelTapRoomId === mapRoomId && now - lastLabelTapAt < DOUBLE_TAP_MS) {
        lastLabelTapAt = 0;
        lastLabelTapRoomId = null;
        onLabelEdit?.(mapRoomId);
      } else {
        lastLabelTapAt = now;
        lastLabelTapRoomId = mapRoomId;
      }
    };
    node.on('pointerup', stop);
    node.on('pointerupoutside', stop);
  }

  let lastFogInput: {
    mode: FogMode;
    floor: FloorGrid;
    fog: FogGrid;
    isGM: boolean;
    cellSize: number;
    dynamicHidden?: Cell[];
  } | null = null;

  function renderFog(input: {
    mode: FogMode;
    floor: FloorGrid;
    fog: FogGrid;
    isGM: boolean;
    cellSize: number;
    dynamicHidden?: Cell[];
  }): void {
    lastFogInput = input;
    const { mode, floor, fog, isGM, cellSize, dynamicHidden } = input;
    fowGraphics.clear();
    if (isGM) return; // the GM always sees everything they've prepped
    if (mode === 'emergent') return; // rock IS the hidden state; nothing extra to mask

    if (mode === 'dynamic') {
      // Phase 4 LoS: the view computed which cells no viewpoint can see.
      for (const cell of dynamicHidden ?? []) {
        const { x, y } = cellToPixel(cell, cellSize);
        fowGraphics.rect(x, y, cellSize, cellSize).fill(theme.fog);
      }
      return;
    }

    for (const cell of floor.listFloorCells()) {
      const revealed = isCellRevealed(mode, (c) => floor.isFloor(c), (c) => fog.isRevealed(c), cell);
      if (revealed) continue;
      const { x, y } = cellToPixel(cell, cellSize);
      fowGraphics.rect(x, y, cellSize, cellSize).fill(theme.fog);
    }
  }

  const annotationLabels = new PIXI.Container();
  layers.mapping.addChild(annotationLabels);

  let lastDrawings: Drawing[] = [];
  function renderAnnotations(drawings: Drawing[]): void {
    lastDrawings = drawings;
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

  let lastDraftPreview: { drafts: MapDraft[]; cellSize: number } | null = null;
  function renderDraftPreview(drafts: MapDraft[], cellSize: number): void {
    lastDraftPreview = { drafts, cellSize };
    draftGraphics.clear();
    for (const draft of drafts) {
      for (const cell of draft.cells) {
        const { x, y } = cellToPixel(cell, cellSize);
        draftGraphics.rect(x, y, cellSize, cellSize).fill({ color: theme.selection, alpha: 0.35 });
      }
    }
  }

  const cursorSprites = new Map<string, PIXI.Container>();
  let lastCursors: { cursors: CursorPos[]; myUid: string | null } = { cursors: [], myUid: null };
  function renderCursors(cursors: CursorPos[], myUid: string | null): void {
    lastCursors = { cursors, myUid };
    const seen = new Set<string>();
    for (const cursor of cursors) {
      if (cursor.uid === myUid) continue;
      seen.add(cursor.uid);
      let node = cursorSprites.get(cursor.uid);
      if (!node) {
        node = new PIXI.Container();
        const dot = new PIXI.Graphics().circle(0, 0, 5).fill(theme.selection);
        node.addChild(dot);
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
  let lastPings: PingPos[] = [];
  function renderPings(pings: PingPos[]): void {
    lastPings = pings;
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

  let lastWallPreview: { x1: number; y1: number; x2: number; y2: number }[] | null = null;
  function renderWallPreview(segments: { x1: number; y1: number; x2: number; y2: number }[] | null): void {
    lastWallPreview = segments;
    wallPreviewGraphics.clear();
    if (!segments) return;
    for (const s of segments) {
      wallPreviewGraphics
        .moveTo(s.x1, s.y1)
        .lineTo(s.x2, s.y2)
        .stroke({ width: 4, color: theme.selection, alpha: 0.85 });
    }
  }

  let lastCirclePreview: { cx: number; cy: number; r: number; label: string } | null = null;
  function renderCirclePreview(
    preview: { cx: number; cy: number; r: number; label: string } | null,
  ): void {
    lastCirclePreview = preview;
    circlePreviewGraphics.clear();
    if (!preview) {
      circlePreviewLabel.text = '';
      return;
    }
    circlePreviewGraphics
      .circle(preview.cx, preview.cy, preview.r)
      .stroke({ width: 3, color: theme.selection, alpha: 0.85 });
    circlePreviewGraphics.circle(preview.cx, preview.cy, 2).fill(theme.selection);
    circlePreviewLabel.text = preview.label;
    circlePreviewLabel.position.set(preview.cx, preview.cy - preview.r - 12);
  }

  let lastRuler: {
    from: { x: number; y: number } | null;
    to: { x: number; y: number } | null;
    label: string | null;
  } = { from: null, to: null, label: null };
  function renderRuler(
    from: { x: number; y: number } | null,
    to: { x: number; y: number } | null,
    label: string | null,
  ): void {
    lastRuler = { from, to, label };
    rulerGraphics.clear();
    if (!from || !to) {
      rulerLabel.text = '';
      return;
    }
    rulerGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 2, color: theme.selection });
    rulerLabel.text = label ?? '';
    rulerLabel.position.set(to.x + 8, to.y - 8);
  }

  let lastDimHud: { center: { x: number; y: number } | null; label: string | null } = {
    center: null,
    label: null,
  };
  function renderDimHud(center: { x: number; y: number } | null, label: string | null): void {
    lastDimHud = { center, label };
    if (!center || !label) {
      dimHudLabel.text = '';
      return;
    }
    dimHudLabel.text = label;
    dimHudLabel.position.set(center.x, center.y);
  }

  function setTheme(next: MapTheme): void {
    theme = next;
    app.renderer.background.color = theme.rock;
    rulerLabel.style.fill = theme.rulerText;
    circlePreviewLabel.style.fill = theme.rulerText;
    dimHudLabel.style.fill = theme.rulerText;

    if (lastMapInput) renderMap(lastMapInput);
    if (lastFogInput) renderFog(lastFogInput);
    renderAnnotations(lastDrawings);
    if (lastDraftPreview) renderDraftPreview(lastDraftPreview.drafts, lastDraftPreview.cellSize);

    // Cursor/ping dots are cached sprites (not redrawn per-call) — recreate
    // them so the retheme takes effect instead of leaving stale colors.
    for (const node of cursorSprites.values()) node.destroy({ children: true });
    cursorSprites.clear();
    renderCursors(lastCursors.cursors, lastCursors.myUid);
    for (const node of pingSprites.values()) node.destroy();
    pingSprites.clear();
    renderPings(lastPings);

    renderRuler(lastRuler.from, lastRuler.to, lastRuler.label);
    renderWallPreview(lastWallPreview);
    renderCirclePreview(lastCirclePreview);
    renderDimHud(lastDimHud.center, lastDimHud.label);
  }

  async function exportPng(input: {
    frame: { x: number; y: number; width: number; height: number };
    includeHiddenLayer: boolean;
  }): Promise<Blob> {
    const priorGmVisible = layers.gm.visible;
    layers.gm.visible = input.includeHiddenLayer;
    try {
      const canvas = app.renderer.extract.canvas({
        target: world,
        frame: new PIXI.Rectangle(input.frame.x, input.frame.y, input.frame.width, input.frame.height),
      }) as HTMLCanvasElement;
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PNG export failed'));
        }, 'image/png');
      });
    } finally {
      layers.gm.visible = priorGmVisible;
    }
  }

  return {
    app,
    world,
    layers,
    toWorld,
    toScreen,
    centerOn,
    renderMap,
    renderFog,
    renderAnnotations,
    renderDraftPreview,
    renderCursors,
    renderPings,
    renderRuler,
    renderWallPreview,
    renderCirclePreview,
    renderDimHud,
    setTheme,
    exportPng,
    setGestureListener(cb) {
      gestureCb = cb;
    },
    destroy() {
      teardownPanZoom();
      app.destroy(true, { children: true });
    },
  };
}

/** Draw a point list as a smoothed quadratic curve with rounded caps/joins and
 * a slightly heavier stroke — the organic "natural" wall look (Master Plan v2,
 * R9.4). Each interior point is a quadratic control point, with the curve
 * passing through the midpoints between successive control points, which rounds
 * the corners without pulling the curve off the true geometry. */
function drawSmoothCurve(g: PIXI.Graphics, pts: { x: number; y: number }[], color: number): void {
  const n = pts.length;
  if (n < 2) return;
  g.moveTo(pts[0]!.x, pts[0]!.y);
  if (n === 2) {
    g.lineTo(pts[1]!.x, pts[1]!.y);
  } else {
    for (let i = 1; i < n - 1; i++) {
      const c = pts[i]!;
      const mx = (pts[i]!.x + pts[i + 1]!.x) / 2;
      const my = (pts[i]!.y + pts[i + 1]!.y) / 2;
      g.quadraticCurveTo(c.x, c.y, mx, my);
    }
    const last = pts[n - 1]!;
    g.quadraticCurveTo(last.x, last.y, last.x, last.y);
  }
  g.stroke({ width: 4, color, cap: 'round', join: 'round' });
}

/**
 * Draw a circular wall's ring (Master Plan v2, R10.5). The ring is sampled into
 * a fine polygon; any short arc segment whose midpoint angle falls inside a cut
 * `gaps` arc is skipped, leaving a real break in the stroke (matching the LoS
 * `circleWallSegments` gap treatment). Contiguous non-gap runs are stroked as a
 * single smooth path so the ring reads as a curve, not facets. `dashed` style
 * draws every other run-segment; every other style renders as a solid ring
 * (masonry/natural have no distinct ring treatment in v1).
 */
function drawCircleWall(g: PIXI.Graphics, circle: CircleWall, color: number): void {
  if (circle.r <= 0) return;
  const N = 128;
  const dashed = circle.style === 'dashed';
  const TWO_PI = Math.PI * 2;
  const pt = (a: number): { x: number; y: number } => ({
    x: circle.cx + Math.cos(a) * circle.r,
    y: circle.cy + Math.sin(a) * circle.r,
  });
  let run: { x: number; y: number }[] = [];
  const flush = (): void => {
    if (run.length >= 2) {
      g.moveTo(run[0]!.x, run[0]!.y);
      for (let i = 1; i < run.length; i++) g.lineTo(run[i]!.x, run[i]!.y);
      g.stroke({ width: 3, color, cap: 'round', join: 'round' });
    }
    run = [];
  };
  for (let k = 0; k < N; k++) {
    const mid = ((k + 0.5) / N) * TWO_PI;
    // A gap arc, or a dash off-beat, both break the stroke here.
    if (angleInAnyGap(mid, circle.gaps) || (dashed && k % 2 === 1)) {
      flush();
      continue;
    }
    const a0 = (k / N) * TWO_PI;
    const a1 = ((k + 1) / N) * TWO_PI;
    if (run.length === 0) run.push(pt(a0));
    run.push(pt(a1));
  }
  flush();
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

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 6;

/** Scale `world` by `factor` while keeping the world point currently under the
 * screen coordinate `(sx, sy)` fixed (cursor/pinch-anchored zoom). The world
 * has only translation + uniform scale, so `globalX = world.x + localX*scale`
 * inverts cleanly without touching the transform matrix. */
function zoomWorldAt(world: PIXI.Container, factor: number, sx: number, sy: number): void {
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, world.scale.x * factor));
  if (clamped === world.scale.x) return;
  const local = world.toLocal({ x: sx, y: sy } as PIXI.PointData);
  world.scale.set(clamped);
  world.x = sx - local.x * clamped;
  world.y = sy - local.y * clamped;
}

/** True when the currently-focused element would consume a literal space
 * keystroke (typing) rather than meaning "hold to pan" (Master Plan v2, R1.8
 * space-drag pan / U12). */
function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

function setupPanZoom(
  application: PIXI.Application,
  worldContainer: PIXI.Container,
  onGesture: (active: boolean) => void,
): () => void {
  application.stage.eventMode = 'static';
  application.stage.hitArea = application.screen;

  let panning = false;
  let lastX = 0;
  let lastY = 0;
  // Space-drag pan (Master Plan v2, R1.8 / U12): holding Space turns a plain
  // left-drag into a pan, same as the existing right-click/Alt path.
  let spacePressed = false;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !isEditableElement(document.activeElement)) {
      spacePressed = true;
      application.canvas.style.cursor = 'grab';
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      spacePressed = false;
      application.canvas.style.cursor = '';
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  application.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    if (e.target !== application.stage) return;
    if (e.pointerType === 'touch') return; // touch pan/zoom handled below
    if (e.button === 2 || e.altKey || (e.button === 0 && spacePressed)) {
      panning = true;
      lastX = e.global.x;
      lastY = e.global.y;
      // Same "a gesture superseded the active tool" signal touch pinch/pan
      // already sends (MapView cancels/blocks tool strokes while active).
      onGesture(true);
    }
  });
  application.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
    if (!panning) return;
    worldContainer.x += e.global.x - lastX;
    worldContainer.y += e.global.y - lastY;
    lastX = e.global.x;
    lastY = e.global.y;
  });
  const stopPan = () => {
    if (!panning) return;
    panning = false;
    onGesture(false);
  };
  application.stage.on('pointerup', stopPan);
  application.stage.on('pointerupoutside', stopPan);

  application.canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      // Cursor-anchored bounded zoom (Master Plan v2, R1.8 / U17) — reuses
      // the same `zoomWorldAt` the touch-pinch path already relies on.
      const rect = application.canvas.getBoundingClientRect();
      zoomWorldAt(worldContainer, factor, e.clientX - rect.left, e.clientY - rect.top);
    },
    { passive: false },
  );
  application.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Touch (Master Plan v2, R1.8): one finger = the active tool (handled by
  // MapView's federated pointer wiring); two fingers = pan; pinch = zoom. Track
  // raw touch pointers on the canvas so we can distinguish 1- vs 2-finger and
  // anchor the pinch at the gesture centroid. `touch-action: none` stops the
  // browser from stealing the gesture for page scroll/zoom. ----
  const canvas = application.canvas;
  canvas.style.touchAction = 'none';
  const touches = new Map<number, { x: number; y: number }>();
  let prev: { cx: number; cy: number; dist: number } | null = null;

  function canvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function centroid(): { cx: number; cy: number; dist: number } {
    const pts = [...touches.values()];
    const cx = (pts[0]!.x + pts[1]!.x) / 2;
    const cy = (pts[0]!.y + pts[1]!.y) / 2;
    const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
    return { cx, cy, dist };
  }

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, canvasPoint(e));
    if (touches.size === 2) {
      onGesture(true); // cancel any single-finger tool stroke already begun
      prev = centroid();
    }
  });
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, canvasPoint(e));
    if (touches.size === 2 && prev) {
      const cur = centroid();
      worldContainer.x += cur.cx - prev.cx; // two-finger drag = pan
      worldContainer.y += cur.cy - prev.cy;
      if (prev.dist > 0) zoomWorldAt(worldContainer, cur.dist / prev.dist, cur.cx, cur.cy);
      prev = cur;
    }
  });
  const releaseTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.delete(e.pointerId)) return;
    prev = null;
    if (touches.size === 0) onGesture(false);
  };
  canvas.addEventListener('pointerup', releaseTouch);
  canvas.addEventListener('pointercancel', releaseTouch);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
