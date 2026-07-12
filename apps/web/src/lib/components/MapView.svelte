<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    type AssetStore,
    type CampaignStore,
    type CursorPos,
    type Drawing,
    type Encounter,
    type FloorChunk,
    type FogChunk,
    type Group,
    type MapDraft,
    type MapLight,
    type MapRoom,
    type MapSymbol,
    type MapWall,
    type PingPos,
    type Room,
    type SightWall,
    type Token,
    FloorGrid,
    FogGrid,
    allGridCells,
    canonicalizeEdge,
    corridorCells,
    currentActorTokenIds,
    edgeId as canonicalEdgeId,
    measureRuler,
    parseChunkId,
    parseUvtt,
    pixelToCell,
    rectToCells,
    sightSegments,
    visibleCells,
    visibleTokenIds,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY } from '../context';
  import type { MapToolController } from '../shell/map-tool-controller.svelte';
  import type { DialogService } from '../shell/dialogs.svelte';
  import { SAMPLE_UVTT_REF, STARTER_MAP_REF, STARTER_TOKEN_REFS } from '../assets';
  import { createMapEngine, type MapEngine } from '../map/engine';
  import { applyTheme, readMapTheme, resolveThemeName } from '../theme';
  import { UndoStack } from '../map/undo';
  import {
    buildFloorOp,
    buildFogOp,
    invertOp,
    isNoopOp,
    nextMapRoomKey,
    type CellPatch,
    type EditorOp,
    type ToolId,
  } from '../map/tools';
  import TurnStrip from './TurnStrip.svelte';

  let {
    roomId,
    room,
    tokens,
    groups,
    encounter,
    isGM,
  }: {
    roomId: string;
    room: Room;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  // The Tools rail (Master Plan v2, R1) drives these through the shared
  // controller; MapView reads tool selections from it and publishes back the
  // contextual state (selected token, undo/redo, fog mode, import progress).
  const ctrl = getContext<MapToolController>(MAP_TOOL_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);

  const TOKEN_PX = 48;
  const STARTER_DROP_POS = { x: 160, y: 160 };

  let hostEl: HTMLDivElement;
  let engine: MapEngine | null = null;
  let ready = $state(false);
  let dropping = $state(false);
  const myUid = store.currentUid();

  const spritesByToken = new Map<string, PIXI.Sprite>();
  const draggingIds = new Set<string>();

  // ---- subscribed map state (Map Tooling Spec §7) ----
  let floorChunks = $state<FloorChunk[]>([]);
  let fogChunks = $state<FogChunk[]>([]);
  let walls = $state<MapWall[]>([]);
  let symbols = $state<MapSymbol[]>([]);
  let mapRooms = $state<MapRoom[]>([]);
  let sightWalls = $state<SightWall[]>([]);
  let lights = $state<MapLight[]>([]);
  let drawings = $state<Drawing[]>([]);
  let cursors = $state<CursorPos[]>([]);
  let pings = $state<PingPos[]>([]);
  let mapDrafts = $state<MapDraft[]>([]);

  const cellSize = $derived(room.grid.cellSize);
  const floorGrid = $derived(FloorGrid.fromChunks(floorChunks.map((c) => [c.id, c.bits])));
  const fogGrid = $derived(FogGrid.fromChunks(fogChunks.map((c) => [c.id, c.bits])));

  // ---- groups/combat visibility (Encounter Screen Spec §9) ----
  const mapVisibleIds = $derived(visibleTokenIds(tokens, groups, 'map'));
  // GM sees every token (hidden groups included, rendered translucent);
  // players only ever see [Map]-visible tokens.
  const renderableTokens = $derived(isGM ? tokens : tokens.filter((t) => mapVisibleIds.has(t.id)));
  const currentTurnIds = $derived(encounter ? currentActorTokenIds(encounter, groups) : new Set<string>());

  // ---- dynamic line-of-sight (Plan §7 Phase 4; Map Tooling Spec §6) ----
  // Viewpoints are the tokens the viewer can see; sight is blocked by grid
  // walls (open doors excepted) + imported vector walls. Cells no viewpoint
  // can reach get fogged (players only — the GM sees the whole prepped map).
  const losViewpoints = $derived(
    renderableTokens.filter((t) => t.layer === 'tokens').map((t) => ({ x: t.pos.x, y: t.pos.y })),
  );
  const losSegments = $derived(
    room.fog.mode === 'dynamic'
      ? sightSegments({
          floorCells: floorGrid.listFloorCells(),
          isFloor: (c) => floorGrid.isFloor(c),
          walls,
          sightWalls,
          cellSize,
        })
      : [],
  );
  const dynamicHidden = $derived.by(() => {
    if (room.fog.mode !== 'dynamic') return [];
    const cells = allGridCells(room.grid.w, room.grid.h);
    const visible = visibleCells(losViewpoints, cells, losSegments, cellSize);
    return cells.filter((c) => !visible.has(`${c.x},${c.y}`));
  });
  let sightWallCount = $state(0);
  let losHiddenCount = $state(0);

  // ---- tool state ----
  // Tool *selection* lives in the shared controller (written by the Tools rail,
  // read here). MapView only reads these, so a derived alias keeps every
  // downstream reference working unchanged (Master Plan v2, R1).
  const activeTool = $derived<ToolId>(ctrl.activeTool);
  const wallStyle = $derived<'masonry' | 'natural'>(ctrl.wallStyle);
  const selectedSymbolKind = $derived(ctrl.selectedSymbolKind);
  let selectedTokenId = $state<string | null>(null);
  const selectedToken = $derived(tokens.find((t) => t.id === selectedTokenId) ?? null);

  let floorCellCount = $state(0);
  let wallCount = $state(0);
  let revealedCount = $state(0);
  let rulerText = $state('');
  let pingCount = $state(0);

  const undoStack = new UndoStack<EditorOp>();
  function syncUndoFlags(): void {
    ctrl.canUndo = undoStack.canUndo();
    ctrl.canRedo = undoStack.canRedo();
  }

  let unsubs: Array<() => void> = [];

  onMount(() => {
    let disposed = false;
    void (async () => {
      const created = await createMapEngine(hostEl, { cellSize, theme: readMapTheme() });
      if (disposed) {
        created.destroy();
        return;
      }
      engine = created;

      const bgTexture = await PIXI.Assets.load(assets.resolve(STARTER_MAP_REF));
      const bg = new PIXI.Sprite(bgTexture as PIXI.Texture);
      engine.layers.background.addChild(bg);

      wireStagePointerEvents(created);
      // A second finger landing mid-stroke means the user is panning/pinching,
      // not drawing — drop the in-progress tool stroke (R1.8 touch input).
      created.setGestureListener((active) => {
        if (active) cancelActiveStroke();
      });
      ready = true;
      syncSprites(renderableTokens);
      renderAll();
    })();

    unsubs.push(store.subscribeFloorChunks(roomId, (c) => (floorChunks = c)));
    unsubs.push(store.subscribeFogChunks(roomId, (c) => (fogChunks = c)));
    unsubs.push(store.subscribeWalls(roomId, (w) => (walls = w)));
    unsubs.push(store.subscribeSymbols(roomId, (s) => (symbols = s)));
    unsubs.push(store.subscribeMapRooms(roomId, (r) => (mapRooms = r)));
    unsubs.push(store.subscribeSightWalls(roomId, (w) => (sightWalls = w)));
    unsubs.push(store.subscribeLights(roomId, (l) => (lights = l)));
    unsubs.push(store.subscribeDrawings(roomId, (d) => (drawings = d)));
    unsubs.push(store.subscribeCursors(roomId, (c) => (cursors = c)));
    unsubs.push(store.subscribePings(roomId, (p) => (pings = p)));
    unsubs.push(store.subscribeMapDraft(roomId, (d) => (mapDrafts = d)));

    window.addEventListener('keydown', onKeyDown);

    // Publish the map tool palette to the shared controller so the Tools rail
    // renders it (the migrated MapToolbar). Selections persist in the
    // controller across activity switches; handlers close over this instance.
    ctrl.onUndo = () => void undo();
    ctrl.onRedo = () => void redo();
    ctrl.onResizeToken = (size) => void handleResizeToken(size);
    ctrl.onSetFogMode = (mode) => void setFogMode(mode);
    ctrl.onImportSampleUvtt = () => void importSampleUvtt();
    ctrl.onImportUvttFile = (file) => void handleUvttFile(file);
    syncUndoFlags();
    ctrl.mounted = true;

    return () => {
      disposed = true;
    };
  });

  // Mirror MapView-owned contextual state into the shared controller so the
  // Tools rail's MapToolbar reflects it (Master Plan v2, R1).
  $effect(() => {
    ctrl.selectedToken = selectedToken;
  });
  $effect(() => {
    ctrl.fogMode = room.fog.mode;
  });
  $effect(() => {
    ctrl.isGM = isGM;
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    for (const unsub of unsubs) unsub();
    unsubs = [];
    engine?.destroy();
    engine = null;
    ctrl.release();
  });

  function onKeyDown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      void undo();
    } else if (e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      void redo();
    }
  }

  $effect(() => {
    // Self-sufficient rather than relying on RoomShell having already
    // applied the theme this tick — both resolve/apply the same value, so
    // the redundancy is harmless (Master Plan v2, R2).
    applyTheme(resolveThemeName(room.settings.theme));
    if (ready && engine) engine.setTheme(readMapTheme());
  });

  $effect(() => {
    if (ready) syncSprites(renderableTokens);
  });

  $effect(() => {
    // Track every input this render depends on so Svelte re-runs it.
    void floorChunks;
    void walls;
    void symbols;
    void mapRooms;
    void sightWalls;
    if (ready) renderAll();
  });

  $effect(() => {
    if (ready && engine) engine.renderAnnotations(drawings);
  });

  $effect(() => {
    void fogChunks;
    void room.fog.mode;
    // Referencing dynamicHidden tracks tokens/walls/sightWalls too, so the LoS
    // fog re-renders whenever a viewpoint moves or the walls change.
    sightWallCount = sightWalls.length;
    losHiddenCount = dynamicHidden.length;
    if (ready) renderFogLayer();
  });

  $effect(() => {
    if (ready && engine) engine.renderDraftPreview(mapDrafts, cellSize);
  });

  $effect(() => {
    if (ready && engine) engine.renderCursors(cursors, myUid);
  });

  $effect(() => {
    pingCount = pings.length;
    if (ready && engine) engine.renderPings(pings);
  });

  $effect(() => {
    floorCellCount = floorGrid.listFloorCells().length;
    wallCount = walls.length;
  });

  $effect(() => {
    revealedCount = fogGrid.listRevealedCells().length;
  });

  function renderAll(): void {
    if (!engine) return;
    engine.renderMap({ floor: floorGrid, walls, symbols, mapRooms, sightWalls, isGM });
    renderFogLayer();
  }

  function renderFogLayer(): void {
    if (!engine) return;
    engine.renderFog({
      mode: room.fog.mode,
      floor: floorGrid,
      fog: fogGrid,
      isGM,
      cellSize,
      dynamicHidden,
    });
  }

  function syncSprites(list: Token[]): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      let sprite = spritesByToken.get(token.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.eventMode = 'static';
        sprite.cursor = 'grab';
        attachDragHandlers(sprite, token.id);
        layer.addChild(sprite);
        spritesByToken.set(token.id, sprite);
        void loadTokenTexture(sprite, token.imageRef);
      }
      if (!draggingIds.has(token.id)) {
        sprite.position.set(token.pos.x, token.pos.y);
      }
      sprite.width = TOKEN_PX * token.size;
      sprite.height = TOKEN_PX * token.size;
      // Translucent = GM-only view of a token not yet [Map]-visible to
      // players; tinted = it's this token's side/actor's turn (Spec §9).
      sprite.alpha = mapVisibleIds.has(token.id) ? 1 : 0.4;
      sprite.tint = currentTurnIds.has(token.id) ? 0xffd699 : 0xffffff;
    }
    for (const [id, sprite] of spritesByToken) {
      if (!seen.has(id)) {
        sprite.destroy();
        spritesByToken.delete(id);
      }
    }
  }

  async function loadTokenTexture(sprite: PIXI.Sprite, imageRef: string): Promise<void> {
    const texture = await PIXI.Assets.load(assets.resolve(imageRef));
    sprite.texture = texture as PIXI.Texture;
  }

  function attachDragHandlers(sprite: PIXI.Sprite, tokenId: string): void {
    let dragging = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      selectedTokenId = tokenId;
      dragging = true;
      draggingIds.add(tokenId);
      sprite.cursor = 'grabbing';
      e.stopPropagation();
    });
    sprite.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragging || !engine) return;
      const local = engine.world.toLocal(e.global);
      sprite.position.set(local.x, local.y);
      store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
    });
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      void store.moveToken(roomId, tokenId, { x: sprite.position.x, y: sprite.position.y });
      store.clearDrag(roomId, tokenId);
    };
    sprite.on('pointerup', stop);
    sprite.on('pointerupoutside', stop);
  }

  async function dropStarterToken(): Promise<void> {
    if (dropping) return;
    dropping = true;
    try {
      await store.createToken(roomId, {
        pos: { ...STARTER_DROP_POS },
        size: 1,
        layer: 'tokens',
        imageRef: STARTER_TOKEN_REFS[0],
      });
    } finally {
      dropping = false;
    }
  }

  // ---- fog mode + .uvtt import (Plan §7 Phase 4) ----

  let importError = $state('');

  async function setFogMode(mode: Room['fog']['mode']): Promise<void> {
    await store.setFogMode(roomId, mode);
  }

  async function importUvttText(text: string): Promise<void> {
    ctrl.importing = true;
    importError = '';
    try {
      const parsed = parseUvtt(text, { cellSize });
      await store.importUvtt(roomId, { walls: parsed.walls, lights: parsed.lights });
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Import failed';
    } finally {
      ctrl.importing = false;
    }
  }

  async function importSampleUvtt(): Promise<void> {
    const res = await fetch(assets.resolve(SAMPLE_UVTT_REF));
    await importUvttText(await res.text());
  }

  async function handleUvttFile(file: File): Promise<void> {
    await importUvttText(await file.text());
  }

  async function handleResizeToken(size: number): Promise<void> {
    if (!selectedToken) return;
    await applyOp({
      kind: 'tokenSize',
      tokenId: selectedToken.id,
      from: selectedToken.size,
      to: size,
    });
  }

  // ---- op application (undo/redo re-commit through the same path — Gate 1
  // "draw -> undo -> redo syncs") ----

  async function commitOpForward(op: EditorOp): Promise<void> {
    switch (op.kind) {
      case 'floor':
        await commitFloorPatches(op.patches);
        break;
      case 'fog':
        await commitFogPatches(op.patches);
        break;
      case 'wall':
        if (op.to) await store.setWall(roomId, op.to);
        else await store.removeWall(roomId, op.edgeId);
        break;
      case 'symbol':
        if (op.to) await store.placeSymbol(roomId, op.to);
        else await store.removeSymbol(roomId, op.id);
        break;
      case 'mapRoom':
        if (op.to) await store.upsertMapRoom(roomId, op.to);
        else await store.removeMapRoom(roomId, op.id);
        break;
      case 'tokenSize':
        await store.resizeToken(roomId, op.tokenId, op.to);
        break;
      case 'drawing':
        if (op.to) await store.writeDrawing(roomId, op.to);
        else await store.deleteDrawing(roomId, op.id);
        break;
    }
  }

  async function commitFloorPatches(patches: CellPatch[]): Promise<void> {
    if (patches.length === 0) return;
    const carve = patches.filter((p) => p.to).map((p) => p.cell);
    const fill = patches.filter((p) => !p.to).map((p) => p.cell);
    let grid = floorGrid;
    const touched = new Set<string>();
    if (carve.length) {
      const r = grid.setCells(carve, true);
      grid = r.grid;
      r.touchedChunks.forEach((id) => touched.add(id));
    }
    if (fill.length) {
      const r = grid.setCells(fill, false);
      grid = r.grid;
      r.touchedChunks.forEach((id) => touched.add(id));
    }
    const chunks: FloorChunk[] = [...touched].map((id) => {
      const { cx, cy } = parseChunkId(id);
      return { id, bits: [...grid.getChunkBits(cx, cy)] };
    });
    await store.commitFloorChunks(roomId, chunks);
  }

  async function commitFogPatches(patches: CellPatch[]): Promise<void> {
    if (patches.length === 0) return;
    const reveal = patches.filter((p) => p.to).map((p) => p.cell);
    const hide = patches.filter((p) => !p.to).map((p) => p.cell);
    let grid = fogGrid;
    const touched = new Set<string>();
    if (reveal.length) {
      const r = grid.reveal(reveal, true);
      grid = r.grid;
      r.touchedChunks.forEach((id) => touched.add(id));
    }
    if (hide.length) {
      const r = grid.reveal(hide, false);
      grid = r.grid;
      r.touchedChunks.forEach((id) => touched.add(id));
    }
    const chunks: FogChunk[] = [...touched].map((id) => {
      const { cx, cy } = parseChunkId(id);
      return { id, bits: [...grid.getChunkBits(cx, cy)] };
    });
    await store.commitFogChunks(roomId, chunks);
  }

  async function applyOp(op: EditorOp): Promise<void> {
    if (isNoopOp(op)) return;
    await commitOpForward(op);
    undoStack.push(op);
    syncUndoFlags();
  }

  async function undo(): Promise<void> {
    const op = undoStack.undo();
    if (!op) return;
    await commitOpForward(invertOp(op));
    syncUndoFlags();
  }

  async function redo(): Promise<void> {
    const op = undoStack.redo();
    if (!op) return;
    await commitOpForward(op);
    syncUndoFlags();
  }

  // ---- pointer -> tool dispatch ----

  let strokeActive = false;
  let strokeStartCell: { x: number; y: number } | null = null;
  let strokeCellKeys = new Set<string>();
  let lastCursorPublish = 0;
  let rulerFrom: { x: number; y: number } | null = null;
  let annotatePoints: { x: number; y: number }[] = [];

  function doorCycle(current: MapWall['door']): MapWall['door'] {
    if (!current) return { state: 'closed', secret: false };
    if (current.state === 'closed' && !current.secret) return { state: 'open', secret: false };
    if (current.state === 'open' && !current.secret) return { state: 'closed', secret: true };
    return undefined;
  }

  function nearestEdgeAt(world: { x: number; y: number }): { x: number; y: number; side: 'N' | 'E' | 'S' | 'W' } {
    const cell = pixelToCell(world, cellSize);
    const fx = world.x / cellSize - cell.x;
    const fy = world.y / cellSize - cell.y;
    const candidates: { side: 'N' | 'E' | 'S' | 'W'; dist: number }[] = [
      { side: 'W', dist: fx },
      { side: 'E', dist: 1 - fx },
      { side: 'N', dist: fy },
      { side: 'S', dist: 1 - fy },
    ];
    const nearest = candidates.reduce((best, c) => (c.dist < best.dist ? c : best));
    return { x: cell.x, y: cell.y, side: nearest.side };
  }

  function wireStagePointerEvents(mapEngine: MapEngine): void {
    const stage = mapEngine.app.stage;

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (e.target !== stage) return; // token sprites handle their own events
      if (e.button !== 0 || e.altKey) return; // right-click/alt reserved for pan
      const world = mapEngine.toWorld(e.global);
      handleToolStart(world);
    });

    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const world = mapEngine.toWorld(e.global);
      publishCursorThrottled(world);
      if (strokeActive) handleToolMove(world);
    });

    const end = (e: PIXI.FederatedPointerEvent) => {
      if (!strokeActive) return;
      const world = mapEngine.toWorld(e.global);
      handleToolEnd(world);
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
  }

  function publishCursorThrottled(world: { x: number; y: number }): void {
    const now = Date.now();
    if (now - lastCursorPublish < 80) return;
    lastCursorPublish = now;
    store.publishCursor(roomId, world);
  }

  function parseCellKey(key: string): { x: number; y: number } {
    const [x, y] = key.split(',');
    return { x: Number(x), y: Number(y) };
  }

  function previewCellsFor(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] {
    const a = pixelToCell(start, cellSize);
    const b = pixelToCell(end, cellSize);
    return activeTool === 'corridor' ? corridorCells(a, b) : rectToCells(a, b);
  }

  function handleToolStart(world: { x: number; y: number }): void {
    if (activeTool === 'select') {
      selectedTokenId = null;
      return;
    }
    if (activeTool === 'ping') {
      store.publishPing(roomId, world);
      return;
    }
    if (activeTool === 'wall') {
      const edge = nearestEdgeAt(world);
      const id = canonicalEdgeId(edge);
      const canonical = canonicalizeEdge(edge);
      const existing = walls.find((w) => w.id === id) ?? null;
      const to = existing ? null : { id, x: canonical.x, y: canonical.y, side: canonical.side };
      void applyOp({ kind: 'wall', edgeId: id, from: existing, to });
      return;
    }
    if (activeTool === 'door') {
      const edge = nearestEdgeAt(world);
      const id = canonicalEdgeId(edge);
      const canonical = canonicalizeEdge(edge);
      const existing = walls.find((w) => w.id === id) ?? null;
      const nextDoor = doorCycle(existing?.door);
      const to = nextDoor
        ? { id, x: canonical.x, y: canonical.y, side: canonical.side, door: nextDoor }
        : null;
      void applyOp({ kind: 'wall', edgeId: id, from: existing, to });
      return;
    }
    if (activeTool === 'symbol') {
      const cell = pixelToCell(world, cellSize);
      const id = `${cell.x}_${cell.y}`;
      const existing = symbols.find((s) => s.id === id) ?? null;
      const to = existing ? null : { id, cell, kind: selectedSymbolKind, rotation: 0 };
      void applyOp({ kind: 'symbol', id, from: existing, to });
      return;
    }
    if (activeTool === 'label') {
      const cell = pixelToCell(world, cellSize);
      if (!floorGrid.isFloor(cell)) return;
      const region = floodFillRoom(floorGrid, cell);
      const xs = region.map((c) => c.x);
      const ys = region.map((c) => c.y);
      const bbox = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs) + 1,
        h: Math.max(...ys) - Math.min(...ys) + 1,
      };
      const key = nextMapRoomKey(mapRooms.map((r) => r.key));
      const id = `mr-${key}-${Date.now()}`;
      // Shell dialog replaces window.prompt (Master Plan v2, R1.6 / U10).
      const style = wallStyle;
      void (async () => {
        const name =
          (await dialogs.promptText({
            title: 'Room name',
            label: 'Room name (optional)',
            confirmLabel: 'Add label',
          })) ?? '';
        await applyOp({
          kind: 'mapRoom',
          id,
          from: null,
          to: { id, key, name, bbox, labelAnchor: cell, wallStyle: style },
        });
      })();
      return;
    }

    if (activeTool === 'ruler') {
      rulerFrom = world;
      rulerText = '';
      strokeActive = true;
      return;
    }
    if (activeTool === 'annotate') {
      annotatePoints = [world];
      strokeActive = true;
      return;
    }

    // carve / fill / corridor / fogEraser are drag strokes over the grid
    strokeActive = true;
    strokeStartCell = pixelToCell(world, cellSize);
    strokeCellKeys = new Set();
    if (activeTool === 'fogEraser') {
      strokeCellKeys.add(`${strokeStartCell.x},${strokeStartCell.y}`);
      publishDraft([{ ...strokeStartCell }]);
    } else {
      publishDraft(previewCellsFor(world, world));
    }
  }

  function handleToolMove(world: { x: number; y: number }): void {
    if (activeTool === 'ruler') {
      if (!rulerFrom || !engine) return;
      const measurement = measureRuler(rulerFrom, world, cellSize);
      rulerText = `${measurement.squares} sq / ${measurement.feet} ft`;
      engine.renderRuler(rulerFrom, world, rulerText);
      return;
    }
    if (activeTool === 'annotate') {
      annotatePoints = [...annotatePoints, world];
      return;
    }
    if (!strokeStartCell) return;
    if (activeTool === 'fogEraser') {
      const cell = pixelToCell(world, cellSize);
      strokeCellKeys.add(`${cell.x},${cell.y}`);
      const cells = [...strokeCellKeys].map(parseCellKey);
      publishDraft(cells);
      return;
    }
    if (activeTool === 'carve' || activeTool === 'fill' || activeTool === 'corridor') {
      publishDraft(previewCellsFor(cellStartWorld(), world));
    }
  }

  function handleToolEnd(world: { x: number; y: number }): void {
    if (activeTool === 'ruler') {
      // Leave the last measurement displayed until the next drag starts.
      strokeActive = false;
      return;
    }
    if (activeTool === 'annotate') {
      if (annotatePoints.length > 1) {
        const id = `dr-${Date.now()}`;
        void applyOp({
          kind: 'drawing',
          id,
          from: null,
          to: { id, layer: 'mapping', kind: 'freehand', points: annotatePoints, style: {} },
        });
      }
      annotatePoints = [];
      strokeActive = false;
      return;
    }
    if (activeTool === 'carve' || activeTool === 'fill') {
      const cells = previewCellsFor(cellStartWorld(), world);
      void applyOp(buildFloorOp(floorGrid, cells, activeTool === 'carve').op);
      clearDraft();
    } else if (activeTool === 'corridor') {
      const cells = previewCellsFor(cellStartWorld(), world);
      void applyOp(buildFloorOp(floorGrid, cells, true).op);
      clearDraft();
    } else if (activeTool === 'fogEraser') {
      const cells = [...strokeCellKeys].map(parseCellKey);
      void applyOp(buildFogOp(fogGrid, cells, true).op);
      clearDraft();
    }
    strokeActive = false;
    strokeStartCell = null;
    strokeCellKeys = new Set();
  }

  /** Abandon any in-progress tool stroke without committing it — used when a
   * two-finger pan/pinch gesture supersedes a single-finger draw (R1.8). */
  function cancelActiveStroke(): void {
    if (!strokeActive) return;
    strokeActive = false;
    strokeStartCell = null;
    strokeCellKeys = new Set();
    annotatePoints = [];
    rulerFrom = null;
    rulerText = '';
    engine?.renderRuler(null, null, null);
    clearDraft();
  }

  function cellStartWorld(): { x: number; y: number } {
    // strokeStartCell is in cell coords — convert back to a representative
    // world point inside that cell for previewCellsFor's pixelToCell calls.
    const c = strokeStartCell!;
    return { x: (c.x + 0.5) * cellSize, y: (c.y + 0.5) * cellSize };
  }

  function publishDraft(cells: { x: number; y: number }[]): void {
    if (!myUid) return;
    store.publishMapDraft(roomId, { uid: myUid, tool: activeTool, cells, ts: Date.now() });
  }

  function clearDraft(): void {
    if (!myUid) return;
    store.clearMapDraft(roomId, myUid);
  }

  // ---- ruler (separate from the stroke system — measures, never mutates) ----

  $effect(() => {
    if (!engine) return;
    if (activeTool !== 'ruler') {
      engine.renderRuler(null, null, null);
      rulerFrom = null;
      rulerText = '';
    }
  });

  function floodFillRoom(grid: FloorGrid, start: { x: number; y: number }, maxCells = 4096): { x: number; y: number }[] {
    const visited = new Set<string>([`${start.x},${start.y}`]);
    const queue = [start];
    const region: { x: number; y: number }[] = [start];
    while (queue.length && region.length < maxCells) {
      const cur = queue.shift()!;
      const neighbors = [
        { x: cur.x + 1, y: cur.y },
        { x: cur.x - 1, y: cur.y },
        { x: cur.x, y: cur.y + 1 },
        { x: cur.x, y: cur.y - 1 },
      ];
      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (visited.has(key) || !grid.isFloor(n)) continue;
        visited.add(key);
        queue.push(n);
        region.push(n);
      }
    }
    return region;
  }
</script>

<div class="map-view" data-testid="map-canvas">
  <div class="canvas-host" bind:this={hostEl}>
    {#if isGM && tokens.length === 0}
      <button
        class="drop-token"
        data-testid="drop-token"
        onclick={dropStarterToken}
        disabled={dropping}
      >
        Drop starter token
      </button>
    {/if}
    <TurnStrip {encounter} {groups} {tokens} />
  </div>

  <div class="readouts" aria-hidden="true">
    {#each renderableTokens as token (token.id)}
      <span data-testid={`token-pos-${token.id}`}
        >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
      >
      <span data-testid={`token-size-${token.id}`}>{token.size}</span>
      <span data-testid={`token-current-${token.id}`}>{currentTurnIds.has(token.id)}</span>
    {/each}
    <span data-testid="floor-cell-count">{floorCellCount}</span>
    <span data-testid="wall-count">{wallCount}</span>
    <span data-testid="revealed-count">{revealedCount}</span>
    <span data-testid="ping-count">{pingCount}</span>
    <span data-testid="peer-cursor-count">{cursors.filter((c) => c.uid !== myUid).length}</span>
    <span data-testid="ruler-distance">{rulerText}</span>
    <span data-testid="visible-door-count"
      >{walls.filter((w) => w.door && !(w.door.secret && !isGM)).length}</span
    >
    <span data-testid="sight-wall-count">{sightWallCount}</span>
    <span data-testid="light-count">{lights.length}</span>
    <span data-testid="los-hidden-count">{losHiddenCount}</span>
    <span data-testid="fog-mode">{room.fog.mode}</span>
    {#if importError}
      <span data-testid="uvtt-import-error">{importError}</span>
    {/if}
    {#if selectedToken}
      <span data-testid="selected-token-size">{selectedToken.size}</span>
    {/if}
  </div>
</div>

<style>
  .map-view {
    position: absolute;
    inset: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .canvas-host {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .drop-token {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 2;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  .readouts {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
</style>
