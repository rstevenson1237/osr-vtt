import * as PIXI from 'pixi.js';
import {
  type Cell,
  type CursorPos,
  type Drawing,
  derivePerimeterEdges,
  type FloorGrid,
  type FogGrid,
  type FogMode,
  type MapDraft,
  type MapRoom,
  type MapSymbol,
  type MapWall,
  type PingPos,
  type SightWall,
  cellCenterPixel,
  cellToPixel,
  edgeId as canonicalEdgeId,
  isCellRevealed,
  neighborAcross,
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
  renderMap(input: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    isGM: boolean;
  }): void;
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
  /** Re-resolves every themed color from `theme` (R2/WI-1) and replays the
   * most recent render of each layer so the canvas updates immediately —
   * callers don't need to re-supply their map/fog/etc. data. */
  setTheme(theme: MapTheme): void;
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

  setupPanZoom(app, world);

  const mapGraphics = new PIXI.Graphics();
  layers.mapping.addChild(mapGraphics);
  const symbolsAndLabels = new PIXI.Container();
  layers.mapping.addChild(symbolsAndLabels);
  const annotationGraphics = new PIXI.Graphics();
  layers.mapping.addChild(annotationGraphics);
  const gmGraphics = new PIXI.Graphics();
  layers.gm.addChild(gmGraphics);
  const fowGraphics = new PIXI.Graphics();
  layers.fow.addChild(fowGraphics);
  const draftGraphics = new PIXI.Graphics();
  layers.overlay.addChild(draftGraphics);
  const cursorsContainer = new PIXI.Container();
  layers.overlay.addChild(cursorsContainer);
  const pingsContainer = new PIXI.Container();
  layers.overlay.addChild(pingsContainer);
  const rulerGraphics = new PIXI.Graphics();
  layers.overlay.addChild(rulerGraphics);
  const rulerLabel = new PIXI.Text({ text: '', style: { fill: theme.rulerText, fontSize: 14 } });
  layers.overlay.addChild(rulerLabel);

  function toWorld(global: { x: number; y: number }): { x: number; y: number } {
    return world.toLocal(global as PIXI.PointData);
  }

  let lastMapInput: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    isGM: boolean;
  } | null = null;

  function renderMap(input: {
    floor: FloorGrid;
    walls: MapWall[];
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    sightWalls?: SightWall[];
    isGM: boolean;
  }): void {
    lastMapInput = input;
    const { floor, walls, symbols, mapRooms, sightWalls, isGM } = input;
    const cellSize = options.cellSize;
    mapGraphics.clear();
    gmGraphics.clear();

    const floorCells = floor.listFloorCells();
    for (const cell of floorCells) {
      const { x, y } = cellToPixel(cell, cellSize);
      mapGraphics.rect(x, y, cellSize, cellSize).fill(theme.floor);
      mapGraphics
        .rect(x, y, cellSize, cellSize)
        .stroke({ width: 1, color: theme.grid, alpha: 0.08 });
    }

    const wallStyleForCell = (cell: Cell): 'masonry' | 'natural' => {
      const hosting = mapRooms.find(
        (r) =>
          cell.x >= r.bbox.x &&
          cell.x < r.bbox.x + r.bbox.w &&
          cell.y >= r.bbox.y &&
          cell.y < r.bbox.y + r.bbox.h,
      );
      return hosting?.wallStyle ?? 'masonry';
    };

    const explicitByEdge = new Map(walls.map((w) => [canonicalEdgeId(w), w]));
    const isFloor = (c: Cell): boolean => floor.isFloor(c);
    const perimeter = derivePerimeterEdges(isFloor, floorCells);

    const drawnEdges = new Set<string>();
    const drawEdge = (cell: Cell, side: 'N' | 'E' | 'S' | 'W', door?: MapWall['door']): void => {
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
        const secretHidden = door.secret && !isGM;
        if (secretHidden) return; // invisible to non-GM until revealed (Spec §8)
        const target = door.secret ? gmGraphics : mapGraphics;
        const color = door.secret ? theme.secretDoor : theme.door;
        if (door.secret) {
          strokeDashed(target, x1, y1, x2, y2, 4, 3, color);
        } else {
          target.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 3, color });
        }
        if (door.state === 'closed') {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          target.rect(midX - 4, midY - 4, 8, 8).fill(color);
        }
        return;
      }

      const style = wallStyleForCell(cell);
      if (style === 'natural') {
        strokeDashed(mapGraphics, x1, y1, x2, y2, 5, 3, theme.wall);
      } else {
        mapGraphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 3, color: theme.wall });
      }
    };

    for (const edge of perimeter) {
      const wall = explicitByEdge.get(canonicalEdgeId(edge));
      drawEdge({ x: edge.x, y: edge.y }, edge.side, wall?.door);
    }
    for (const wall of walls) {
      drawEdge({ x: wall.x, y: wall.y }, wall.side, wall.door);
    }

    // Imported vector vision-walls (`.uvtt`) — already in pixel space, not on
    // the grid. Open portals draw in the door color; everything else blocks.
    for (const sw of sightWalls ?? []) {
      const open = sw.door?.state === 'open';
      mapGraphics
        .moveTo(sw.ax, sw.ay)
        .lineTo(sw.bx, sw.by)
        .stroke({ width: 3, color: open ? theme.door : theme.wall, alpha: open ? 0.7 : 1 });
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
      const label = new PIXI.Text({
        text: room.name ? `${room.key}. ${room.name}` : room.key,
        style: { fill: theme.wall, fontSize: 13, fontWeight: 'bold' },
      });
      const anchorPx = cellToPixel(room.labelAnchor, cellSize);
      label.position.set(anchorPx.x + 4, anchorPx.y + 2);
      symbolsAndLabels.addChild(label);
    }
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

  function setTheme(next: MapTheme): void {
    theme = next;
    app.renderer.background.color = theme.rock;
    rulerLabel.style.fill = theme.rulerText;

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
  }

  return {
    app,
    world,
    layers,
    toWorld,
    renderMap,
    renderFog,
    renderAnnotations,
    renderDraftPreview,
    renderCursors,
    renderPings,
    renderRuler,
    setTheme,
    destroy() {
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

function setupPanZoom(application: PIXI.Application, worldContainer: PIXI.Container): void {
  application.stage.eventMode = 'static';
  application.stage.hitArea = application.screen;

  let panning = false;
  let lastX = 0;
  let lastY = 0;

  application.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    if (e.target !== application.stage) return;
    if (e.button === 2 || e.altKey) {
      panning = true;
      lastX = e.global.x;
      lastY = e.global.y;
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
    panning = false;
  };
  application.stage.on('pointerup', stopPan);
  application.stage.on('pointerupoutside', stopPan);

  application.canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      worldContainer.scale.set(worldContainer.scale.x * factor);
    },
    { passive: false },
  );
  application.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
