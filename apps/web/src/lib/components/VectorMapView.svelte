<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    vectorMap,
    buildVectorScene,
    type AssetStore,
    type CampaignStore,
    type GameMap,
    type MapRoom,
    type MapSymbol,
    type Room,
    type StoredVectorWall,
    type VectorDoor,
    type VectorFloorRegion,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, MAP_TOOL_KEY } from '../context';
  import { STARTER_MAP_REF } from '../assets';
  import { createVectorMapEngine, type VectorMapEngine } from '../map/vector-engine';
  import { applyTheme, readMapTheme, resolveThemeName } from '../theme';
  import { MapToolController } from '../shell/map-tool-controller.svelte';
  import { UndoStack } from '../map/undo';
  import {
    buildCarveOp,
    buildDoorPreviewSeg,
    buildDragOp,
    buildFloorStroke,
    buildWallPreviewSegs,
    buildWallRunOp,
    commitVectorOpForward,
    distToSeg,
    edgeHandles,
    exceedsMaxFloorExtent,
    findOwnerRecord,
    invertVectorOp,
    isNoopVectorOp,
    MAX_FLOOR_EXTENT,
    nextVectorId,
    pickEdgeHandle,
    pickVertexHandle,
    recomputeRegionBBox,
    strokeBBoxOf,
    vertexHandles,
    type FloorPrimitiveTool,
    type Handle,
    type HandleOwner,
    type Point,
    type VectorEditorOp,
  } from '../map/vector-tools';

  /**
   * The Vector Map production editor (WI-D — poc/vector-floor/SPEC.md §9 step
   * 6). Ports the proven POC interactions (`poc/vector-floor/sandbox/src/app.ts`)
   * onto the real `CampaignStore` via `vector-tools.ts`'s op model and
   * `vector-engine.ts`'s Pixi renderer, instead of the sandbox's in-memory
   * `MapState`.
   *
   * The ONLY map view (WI-D pure-rollout cutover, `poc/vector-floor/DECISIONS.md`
   * D1/D2) — `RoomShell.svelte` mounts this unconditionally; the old cellular
   * `MapView`/`VITE_VECTOR_MAP_EDITOR` flag are gone.
   *
   * Scope notes (flagged as follow-ups, not silently decided):
   *  - Symbol/mapRoom-label AUTHORING (DECISIONS.md WI-D D4) reuses the
   *    existing `MapToolbar`/`ToolsRail`/`MapToolController` rail rather than
   *    a reimplementation: a click here while the shared controller's tool is
   *    `symbol`/`label` places/edits the doc directly (`handleMapToolClick`);
   *    the tool buttons themselves live in the standalone `MapToolbar`. Doors
   *    stay authored via this editor's own vector-native door tool. Symbols,
   *    labels, doors, and the shared annotation/drawing layer all render on
   *    the same `overlay` container in `vector-engine.ts` (SPEC §3.4) — note
   *    freehand `Drawing` annotations themselves are not yet rendered in this
   *    editor at all (a real gap, flagged in the cutover report, not a D4
   *    scope decision).
   *  - Tokens/encounter overlay are not rendered here yet — out of SPEC.md
   *    scope for the floor/wall/door + overlay-layer work, and a real gap
   *    now that this is the only map view (flagged in the cutover report).
   *  - Secret/trapped door GM-only glyph hiding is intentionally a no-op
   *    (DECISIONS.md WI-D D5, ratified): every door renders identically to
   *    every viewer, same as the old cellular model's behavior.
   */

  let {
    roomId,
    mapId,
    map,
    room,
  }: {
    roomId: string;
    mapId: string;
    map: GameMap;
    room: Room;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const myUid = store.currentUid();
  /** Shared with `ToolsRail`'s `MapToolPalette` (DECISIONS.md WI-D D4): the
   * existing symbol/label authoring tools are reused as-is rather than
   * reimplemented inline here. A click on the canvas while `symbol`/`label`
   * is active places/edits a `MapSymbol`/`MapRoom` directly against the
   * unchanged store collections (SPEC §2.2). */
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);

  let hostEl: HTMLDivElement;
  let engine: VectorMapEngine | null = null;
  let ready = $state(false);

  let bgSprite: PIXI.Sprite | null = null;
  let bgLoadSeq = 0;

  // ---- subscribed state ----
  let regions = $state<VectorFloorRegion[]>([]);
  let walls = $state<StoredVectorWall[]>([]);
  let doors = $state<VectorDoor[]>([]);
  let symbols = $state<MapSymbol[]>([]);
  let mapRooms = $state<MapRoom[]>([]);

  const cellSize = $derived(map.grid.cellSize);
  const backgroundRef = $derived(
    map.background === null ? null : (map.background?.ref ?? STARTER_MAP_REF),
  );
  const scene = $derived(buildVectorScene(regions, walls, doors));

  // ---- tool state ----
  type ToolId = 'select' | 'room' | 'corridor' | 'path' | 'polygon' | 'ngon' | 'wall' | 'door' | 'eye';
  const FLOOR_TOOLS: ToolId[] = ['room', 'corridor', 'path', 'polygon', 'ngon'];
  const DOOR_TYPES: vectorMap.DoorType[] = ['single', 'double', 'secret', 'trapped', 'oneWay', 'barred'];

  let tool = $state<ToolId>('room');
  let carveMode = $state<'add' | 'subtract'>('add');
  let snapMode = $state<vectorMap.VectorSnapMode>('full');
  let width = $state(2);
  let sides = $state(6);
  let tolerance = $state(0.15);
  let doorType = $state<vectorMap.DoorType>('single');
  let selectMode = $state<'vertex' | 'edge'>('edge');
  let eye = $state<Point | null>(null);
  let canUndo = $state(false);
  let canRedo = $state(false);
  // D3 (poc/vector-floor/DECISIONS.md) — soft bounded-extent guard: a commit
  // that would push the floor union's bbox past MAX_FLOOR_EXTENT is blocked
  // with a visible error rather than silently applied/truncated.
  let floorExtentError = $state('');

  const HINTS: Record<ToolId, string> = {
    select:
      'Select — Vertex: drag a single point. Edge: drag both endpoints (push a wall out, or move a whole door/wall).',
    room: 'Room — drag two corners. Hold Alt for freeform corners.',
    corridor: 'Corridor — drag start→end for an L-shaped run of fixed Width.',
    path: 'Path — click to add points, double-click (or Enter) to finish. Rock mode carves an interior divider.',
    polygon: 'Polygon — click each vertex, double-click (or Enter) to close.',
    ngon: 'Regular n-gon — drag center→radius. Sides=1 ⇒ circle.',
    wall: 'Wall — click points, double-click (or Enter) to finish. Explicit sight+movement blocker.',
    door: 'Door — click two endpoints on/near a wall. Click an existing door to toggle open/closed.',
    eye: 'Eye — click to preview line of sight from a point.',
  };

  // ---- interaction state (not reactive — mirrors MapView.svelte's stroke
  // state, which is per-frame and doesn't need Svelte's dependency tracking) ----
  let dragging = false;
  let dragStart: Point | null = null;
  let dragCur: Point | null = null;
  let collecting: Point[] = [];
  let gestureActive = false;
  let altKey = false;

  interface ActiveDrag {
    owner: HandleOwner;
    before: VectorFloorRegion | StoredVectorWall | VectorDoor;
    working: VectorFloorRegion | StoredVectorWall | VectorDoor;
    refs: Point[];
    offsets: { x: number; y: number }[];
    vertex: boolean;
  }
  let activeDrag: ActiveDrag | null = null;
  let hoverHandle: Handle | null = null;

  const undoStack = new UndoStack<VectorEditorOp>();
  function syncUndoFlags(): void {
    canUndo = undoStack.canUndo();
    canRedo = undoStack.canRedo();
  }

  let unsubs: Array<() => void> = [];

  onMount(() => {
    let disposed = false;
    void (async () => {
      const created = await createVectorMapEngine(hostEl, { theme: readMapTheme() });
      if (disposed) {
        created.destroy();
        return;
      }
      engine = created;
      void applyBackground(backgroundRef);
      wireStagePointerEvents(created);
      created.setGestureListener((active) => {
        gestureActive = active;
        if (active) cancelStroke();
      });
      ready = true;
      renderAll();
    })();

    unsubs.push(
      store.subscribeFloorRegions(roomId, mapId, (r) => {
        regions = r;
        if (!activeDrag) renderAll();
      }),
    );
    unsubs.push(
      store.subscribeWalls(roomId, mapId, (w) => {
        walls = w;
        if (!activeDrag) renderAll();
      }),
    );
    unsubs.push(
      store.subscribeDoors(roomId, mapId, (d) => {
        doors = d;
        if (!activeDrag) renderAll();
      }),
    );
    unsubs.push(
      store.subscribeSymbols(roomId, mapId, (s) => {
        symbols = s;
        renderAll();
      }),
    );
    unsubs.push(
      store.subscribeMapRooms(roomId, mapId, (r) => {
        mapRooms = r;
        renderAll();
      }),
    );
    unsubs.push(
      store.subscribeVectorMapDraft(roomId, mapId, (drafts) => {
        const peers = drafts.filter((d) => d.uid !== myUid);
        engine?.renderPeerDrafts(peers, cellSize);
      }),
    );

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    mapCtrl.mounted = true;

    return () => {
      disposed = true;
    };
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    for (const unsub of unsubs) unsub();
    unsubs = [];
    if (myUid) store.clearVectorMapDraft(roomId, mapId, myUid);
    mapCtrl.release();
    engine?.destroy();
    engine = null;
  });

  $effect(() => {
    applyTheme(resolveThemeName(room.settings.theme));
    if (ready && engine) engine.setTheme(readMapTheme());
  });

  $effect(() => {
    const ref = backgroundRef;
    if (ready) void applyBackground(ref);
  });

  $effect(() => {
    // Re-render when the map's cell size changes (a live grid resize).
    void cellSize;
    if (ready) renderAll();
  });

  async function applyBackground(ref: string | null): Promise<void> {
    if (!engine) return;
    const seq = ++bgLoadSeq;
    if (ref === null) {
      bgSprite?.destroy();
      bgSprite = null;
      return;
    }
    const texture = (await PIXI.Assets.load(assets.resolve(ref))) as PIXI.Texture;
    if (seq !== bgLoadSeq || !engine) return;
    if (bgSprite) {
      bgSprite.texture = texture;
    } else {
      bgSprite = new PIXI.Sprite(texture);
      engine.layers.background.addChild(bgSprite);
    }
  }

  // ---- undo/redo (op-forward re-commit, same pattern as MapView.svelte) ----

  async function applyOp(op: VectorEditorOp): Promise<void> {
    if (isNoopVectorOp(op)) return;
    await commitVectorOpForward(store, roomId, mapId, op);
    undoStack.push(op);
    syncUndoFlags();
  }
  async function undo(): Promise<void> {
    const op = undoStack.undo();
    if (!op) return;
    await commitVectorOpForward(store, roomId, mapId, invertVectorOp(op));
    syncUndoFlags();
  }
  async function redo(): Promise<void> {
    const op = undoStack.redo();
    if (!op) return;
    await commitVectorOpForward(store, roomId, mapId, op);
    syncUndoFlags();
  }

  // ---- floor primitive commit ----

  function currentFloorMultiPoly(): vectorMap.MultiPoly {
    return regions.map((r) => r.rings);
  }

  function effectiveSnap(): vectorMap.VectorSnapMode {
    return altKey ? 'free' : snapMode;
  }

  function currentStroke(): vectorMap.MultiPoly | null {
    if (!FLOOR_TOOLS.includes(tool)) return null;
    return buildFloorStroke(
      tool as FloorPrimitiveTool,
      { snap: effectiveSnap(), width, sides },
      dragStart,
      dragCur,
      collecting,
      vectorMap.polygonClippingBackend,
    );
  }

  async function commitFloorStroke(stroke: vectorMap.MultiPoly | null): Promise<void> {
    if (!stroke || !stroke.length) return;
    const strokeBBox = strokeBBoxOf(stroke);
    const before = regions;
    const result = vectorMap.commitCarve(
      currentFloorMultiPoly(),
      stroke,
      carveMode,
      tolerance,
      vectorMap.polygonClippingBackend,
    );
    const resultBoxes = result.floor
      .map((poly) => vectorMap.polyBBox(poly))
      .filter((b): b is vectorMap.BBox => !!b);
    const resultBBox = vectorMap.unionBBox(resultBoxes);
    if (exceedsMaxFloorExtent(resultBBox)) {
      floorExtentError = `Carve blocked — the floor would exceed the ${MAX_FLOOR_EXTENT}-unit max extent. Undo or carve a smaller area.`;
      return;
    }
    floorExtentError = '';
    await applyOp(buildCarveOp(before, result.floor, strokeBBox));
  }

  // ---- door tool ----

  function latticeThreshold(screenPx: number): number {
    if (!engine) return screenPx / cellSize;
    return screenPx / (engine.world.scale.x * cellSize);
  }

  async function handleDoorClick(point: Point): Promise<void> {
    const hit = doors.find((d) => distToSeg(point, d.a, d.b) < latticeThreshold(9));
    if (hit) {
      await applyOp({
        kind: 'door',
        id: hit.id,
        from: hit,
        to: { ...hit, state: hit.state === 'open' ? 'closed' : 'open' },
      });
      return;
    }
    collecting.push(point);
    if (collecting.length === 2) {
      const id = nextVectorId('door');
      const door: VectorDoor = { id, a: collecting[0]!, b: collecting[1]!, type: doorType, state: 'closed' };
      collecting = [];
      await applyOp({ kind: 'door', id, from: null, to: door });
    }
  }

  // ---- select tool ----

  function beginSelectDrag(point: Point): void {
    const threshold = latticeThreshold(9);
    const handle =
      selectMode === 'vertex'
        ? pickVertexHandle(point, vertexHandles(regions, walls, doors), threshold)
        : pickEdgeHandle(point, edgeHandles(regions, walls, doors), threshold);
    if (!handle) return;
    const before = findOwnerRecord(handle.owner, regions, walls, doors);
    if (!before) return;
    // `regions`/`walls`/`doors` are `$state` arrays, so their entries are
    // Svelte 5 reactive proxies — the native `structuredClone` can't clone
    // those directly (throws "could not be cloned"). `$state.snapshot()` is
    // the documented escape hatch: it unwraps to a plain, clonable object.
    const working = structuredClone($state.snapshot(before));
    const refs = handle.locate(working);
    activeDrag = {
      owner: handle.owner,
      before,
      working,
      refs,
      offsets: refs.map((r) => ({ x: r.x - point.x, y: r.y - point.y })),
      vertex: selectMode === 'vertex',
    };
  }

  function updateSelectDrag(point: Point): void {
    if (!activeDrag) return;
    if (activeDrag.vertex) {
      const r = activeDrag.refs[0]!;
      r.x = point.x;
      r.y = point.y;
    } else {
      for (let i = 0; i < activeDrag.refs.length; i++) {
        const r = activeDrag.refs[i]!;
        const off = activeDrag.offsets[i]!;
        r.x = point.x + off.x;
        r.y = point.y + off.y;
      }
    }
  }

  async function endSelectDrag(): Promise<void> {
    const drag = activeDrag;
    if (!drag) return;
    activeDrag = null;
    const after = drag.owner.kind === 'region' ? recomputeRegionBBox(drag.working as VectorFloorRegion) : drag.working;
    await applyOp(buildDragOp(drag.owner, drag.before, after));
  }

  /** Substitutes the in-progress Select-tool drag's working copy for its live
   * counterpart, so a drag previews without mutating the subscribed arrays. */
  function displayState(): { regions: VectorFloorRegion[]; walls: StoredVectorWall[]; doors: VectorDoor[] } {
    const drag = activeDrag;
    if (!drag) return { regions, walls, doors };
    if (drag.owner.kind === 'region') {
      const id = drag.owner.id;
      return { regions: regions.map((r) => (r.id === id ? (drag.working as VectorFloorRegion) : r)), walls, doors };
    }
    if (drag.owner.kind === 'wall') {
      const id = drag.owner.id;
      return { regions, walls: walls.map((w) => (w.id === id ? (drag.working as StoredVectorWall) : w)), doors };
    }
    const id = drag.owner.id;
    return { regions, walls, doors: doors.map((d) => (d.id === id ? (drag.working as VectorDoor) : d)) };
  }

  // ---- RTDB live-drag preview (SPEC §5.5/M7) ----

  function isFloorStrokeTool(t: ToolId): boolean {
    return FLOOR_TOOLS.includes(t);
  }

  function publishDraft(): void {
    if (!isFloorStrokeTool(tool) || !myUid) return;
    const points =
      tool === 'path' || tool === 'polygon'
        ? dragCur
          ? [...collecting, dragCur]
          : collecting
        : dragStart && dragCur
          ? [dragStart, dragCur]
          : [];
    if (!points.length) return;
    store.publishVectorMapDraft(roomId, mapId, { uid: myUid, tool, mode: carveMode, points, ts: Date.now() });
  }

  function clearDraft(): void {
    if (myUid) store.clearVectorMapDraft(roomId, mapId, myUid);
  }

  // ---- pointer dispatch ----

  function toLatticeSnapped(world: { x: number; y: number }): Point {
    const lattice = { x: world.x / cellSize, y: world.y / cellSize };
    return vectorMap.snapPoint(lattice, effectiveSnap());
  }

  function wireStagePointerEvents(mapEngine: VectorMapEngine): void {
    const stage = mapEngine.app.stage;
    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (e.target !== stage) return;
      if (gestureActive) return;
      if (e.button !== 0 || e.altKey) return;
      onPointerDown(toLatticeSnapped(mapEngine.toWorld(e.global)));
    });
    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      onPointerMove(toLatticeSnapped(mapEngine.toWorld(e.global)));
    });
    const end = (e: PIXI.FederatedPointerEvent) => {
      void onPointerUp(toLatticeSnapped(mapEngine.toWorld(e.global)));
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
    mapEngine.app.canvas.addEventListener('dblclick', () => void finishMultiClick());
  }

  /** Symbol/label authoring (DECISIONS.md WI-D D4) — a click while the
   * shared `MapToolController`'s tool is `symbol`/`label` places a
   * `MapSymbol`/`MapRoom` at the click point instead of driving one of this
   * editor's own floor/wall/door tools. Takes priority over `tool` so the
   * two tool rails never fight over the same click. */
  async function handleMapToolClick(p: Point): Promise<boolean> {
    if (mapCtrl.activeTool === 'symbol') {
      await store.placeSymbol(roomId, mapId, {
        cell: { x: p.x, y: p.y },
        kind: mapCtrl.selectedSymbolKind,
        rotation: 0,
      });
      return true;
    }
    if (mapCtrl.activeTool === 'label') {
      const nextKey = String(mapRooms.length + 1);
      const name = window.prompt('Room name/key label:', nextKey) ?? nextKey;
      await store.upsertMapRoom(roomId, mapId, {
        id: nextVectorId('room'),
        key: nextKey,
        name,
        bbox: { x: p.x - 1, y: p.y - 1, w: 2, h: 2 },
        labelAnchor: { x: p.x, y: p.y },
        wallStyle: 'masonry',
      });
      return true;
    }
    return false;
  }

  function onPointerDown(p: Point): void {
    if (mapCtrl.activeTool !== 'none') {
      void handleMapToolClick(p);
      return;
    }
    if (tool === 'select') {
      beginSelectDrag(p);
      renderAll();
      return;
    }
    if (tool === 'room' || tool === 'corridor' || tool === 'ngon') {
      dragging = true;
      dragStart = p;
      dragCur = p;
    } else if (tool === 'path' || tool === 'polygon' || tool === 'wall') {
      collecting.push(p);
      dragCur = p;
    } else if (tool === 'door') {
      void handleDoorClick(p);
      dragCur = p;
    } else if (tool === 'eye') {
      eye = p;
    }
    publishDraft();
    renderAll();
  }

  function onPointerMove(p: Point): void {
    if (tool === 'select') {
      if (activeDrag) {
        updateSelectDrag(p);
      } else {
        const threshold = latticeThreshold(9);
        hoverHandle =
          selectMode === 'vertex'
            ? pickVertexHandle(p, vertexHandles(regions, walls, doors), threshold)
            : pickEdgeHandle(p, edgeHandles(regions, walls, doors), threshold);
      }
      renderAll();
      return;
    }
    dragCur = p;
    publishDraft();
    renderAll();
  }

  async function onPointerUp(p: Point): Promise<void> {
    if (tool === 'select') {
      if (activeDrag) await endSelectDrag();
      renderAll();
      return;
    }
    if (dragging) {
      dragging = false;
      dragCur = p;
      const stroke = currentStroke();
      dragStart = null;
      dragCur = null;
      clearDraft();
      await commitFloorStroke(stroke);
      renderAll();
    }
  }

  async function finishMultiClick(): Promise<void> {
    if (tool === 'path' || tool === 'polygon') {
      const stroke = currentStroke();
      collecting = [];
      dragCur = null;
      clearDraft();
      await commitFloorStroke(stroke);
    } else if (tool === 'wall' && collecting.length >= 2) {
      const op = buildWallRunOp(collecting);
      collecting = [];
      dragCur = null;
      clearDraft();
      await applyOp(op);
    }
    renderAll();
  }

  function cancelStroke(): void {
    collecting = [];
    dragging = false;
    dragStart = null;
    dragCur = null;
    activeDrag = null;
    clearDraft();
    renderAll();
  }

  function isTypingTarget(el: EventTarget | null): boolean {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Alt') altKey = true;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) void redo();
      else void undo();
    } else if (e.key === 'Enter') {
      void finishMultiClick();
    } else if (e.key === 'Escape') {
      cancelStroke();
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') altKey = false;
  }

  function selectTool(id: ToolId): void {
    tool = id;
    cancelStroke();
  }

  // ---- render ----

  function renderAll(): void {
    if (!engine) return;
    const disp = displayState();
    const liveScene = activeDrag ? buildVectorScene(disp.regions, disp.walls, disp.doors) : scene;
    engine.renderScene(liveScene, cellSize);
    engine.renderDoors(disp.doors, cellSize);
    engine.renderOverlayObjects(symbols, mapRooms, cellSize);

    const strokePolys = FLOOR_TOOLS.includes(tool) ? currentStroke() : null;
    const previewSegs =
      tool === 'wall'
        ? buildWallPreviewSegs(collecting, dragCur)
        : tool === 'door' && collecting.length === 1
          ? [buildDoorPreviewSeg(collecting[0]!, dragCur)].filter((s): s is vectorMap.Segment => s !== null)
          : [];
    const maxDistLattice = engine.app.screen.width && engine.app.screen.height
      ? (engine.app.screen.width + engine.app.screen.height) / (engine.world.scale.x * cellSize)
      : 200;
    const visibility = tool === 'eye' && eye ? vectorMap.visibilityPolygon(eye, liveScene.sight, maxDistLattice) : null;

    engine.renderToolPreview(
      {
        strokePolys,
        strokeSubtract: carveMode === 'subtract',
        previewSegs,
        collecting,
        vertexHandles: tool === 'select' ? vertexHandles(disp.regions, disp.walls, disp.doors) : [],
        hoveredHandle: hoverHandle,
        selectMode,
        visibility,
        eye,
      },
      cellSize,
    );
  }

  // ---- "Download map as PNG" (M4 — bbox repointed to the union of
  // FloorRegion.bbox instead of the cellular carvedBoundingBox) ----

  const EXPORT_MARGIN_CELLS = 1;
  let exportingPng = $state(false);

  async function exportPng(): Promise<void> {
    if (!engine || exportingPng) return;
    exportingPng = true;
    try {
      const blob = await engine.exportPng({ regions, cellSize, marginCells: EXPORT_MARGIN_CELLS });
      downloadBlob(blob, `${roomId}-map.png`);
    } finally {
      exportingPng = false;
    }
  }

  function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
</script>

<div class="vector-map-root">
  <div class="vf-bar" data-testid="vector-map-toolbar">
    {#each [['select', 'Select'], ['room', 'Room'], ['corridor', 'Corridor'], ['path', 'Path'], ['polygon', 'Polygon'], ['ngon', 'N-gon'], ['wall', 'Wall'], ['door', 'Door'], ['eye', 'Eye']] as [id, label] (id)}
      <button
        type="button"
        class="vf-btn"
        class:on={tool === id}
        data-testid={`vector-tool-${id}`}
        onclick={() => selectTool(id as ToolId)}
      >
        {label}
      </button>
    {/each}

    <span class="sep"></span>
    <button
      type="button"
      class="vf-btn"
      class:on={selectMode === 'vertex'}
      disabled={tool !== 'select'}
      onclick={() => (selectMode = 'vertex')}
    >
      ◆ Vertex
    </button>
    <button
      type="button"
      class="vf-btn"
      class:on={selectMode === 'edge'}
      disabled={tool !== 'select'}
      onclick={() => (selectMode = 'edge')}
    >
      ▬ Edge
    </button>

    <span class="sep"></span>
    <button type="button" class="vf-btn" class:on={carveMode === 'subtract'} onclick={() => (carveMode = carveMode === 'add' ? 'subtract' : 'add')}>
      {carveMode === 'add' ? 'Mode: Carve' : 'Mode: Rock'}
    </button>

    <label class="vf-lbl">Snap
      <select bind:value={snapMode}>
        <option value="full">full</option>
        <option value="half">half</option>
        <option value="free">free</option>
      </select>
    </label>
    <label class="vf-lbl">Width <input type="number" min="0.5" max="10" step="0.5" bind:value={width} /></label>
    <label class="vf-lbl">Sides <input type="number" min="1" max="24" step="1" bind:value={sides} /></label>
    <label class="vf-lbl">Door
      <select bind:value={doorType}>
        {#each DOOR_TYPES as dt (dt)}
          <option value={dt}>{dt}</option>
        {/each}
      </select>
    </label>

    <span class="sep"></span>
    <label class="vf-lbl">Simplify {tolerance.toFixed(2)}
      <input type="range" min="0" max="0.6" step="0.01" bind:value={tolerance} />
    </label>

    <span class="sep"></span>
    <button type="button" class="vf-btn" disabled={!canUndo} onclick={() => void undo()} data-testid="vector-undo">Undo</button>
    <button type="button" class="vf-btn" disabled={!canRedo} onclick={() => void redo()} data-testid="vector-redo">Redo</button>
    <button type="button" class="vf-btn" disabled={exportingPng} onclick={() => void exportPng()}>
      {exportingPng ? 'Exporting…' : 'Export PNG'}
    </button>
  </div>

  {#if floorExtentError}
    <div class="vf-error" data-testid="vector-floor-extent-error">{floorExtentError}</div>
  {/if}

  <div class="vf-canvas-wrap" bind:this={hostEl} data-testid="vector-map-canvas"></div>

  <div class="vf-hint">{HINTS[tool]}</div>
</div>

<style>
  .vector-map-root {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    font: 13px/1.4 system-ui, sans-serif;
    color: var(--text, #dbe4f5);
    background: var(--map-rock-css, #0f1420);
  }
  .vf-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(127, 178, 255, 0.2);
  }
  .vf-bar .sep {
    width: 1px;
    height: 22px;
    background: rgba(127, 178, 255, 0.2);
    margin: 0 4px;
  }
  .vf-btn {
    border: 1px solid rgba(127, 178, 255, 0.3);
    color: inherit;
    padding: 5px 9px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
  }
  .vf-btn.on {
    background: rgba(127, 178, 255, 0.35);
    border-color: rgba(127, 178, 255, 0.8);
  }
  .vf-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .vf-lbl {
    opacity: 0.85;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .vf-canvas-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  .vf-hint {
    padding: 6px 10px;
    border-top: 1px solid rgba(127, 178, 255, 0.2);
    opacity: 0.75;
    font-size: 12px;
  }
  .vf-error {
    padding: 6px 10px;
    background: rgba(220, 80, 80, 0.18);
    border-top: 1px solid rgba(220, 80, 80, 0.5);
    color: #ff8a8a;
    font-size: 12px;
  }
</style>
