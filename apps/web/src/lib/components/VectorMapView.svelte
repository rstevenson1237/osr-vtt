<script lang="ts">
  import { getContext, onDestroy, onMount, tick } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    vectorMap,
    buildVectorScene,
    collapsedDragUpdates,
    currentActorTokenIds,
    groupAnchorId,
    snapModeFromModifiers,
    snapTokenPosition,
    visibleTokenIds,
    type AssetStore,
    type CampaignStore,
    type Drawing,
    type Encounter,
    type GameMap,
    type Group,
    type MapRoom,
    type MapSymbol,
    type Room,
    type StoredVectorWall,
    type Token,
    type VectorDoor,
    type VectorFloorRegion,
  } from '@osr-vtt/shared';
  import { defaultCreatureRefs, nextCreatureTypeLetter, tokenRingColor } from '../tokens/labels';
  import type { DialogService } from '../shell/dialogs.svelte';
  import TurnStrip from './TurnStrip.svelte';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY } from '../context';
  import { STARTER_MAP_REF } from '../assets';
  import { createVectorMapEngine, type VectorMapEngine } from '../map/vector-engine';
  import { applyTheme, hexToNumber, readMapTheme, resolveThemeName } from '../theme';
  import {
    carveKind,
    MapToolController,
    type MapToolId,
  } from '../shell/map-tool-controller.svelte';
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
    pickObject,
    pickVertexHandle,
    recomputeRegionBBox,
    strokeBBoxOf,
    vertexHandles,
    type FloorPrimitiveTool,
    type Handle,
    type HandleOwner,
    type ObjectSelection,
    type Point,
    type VectorEditorOp,
  } from '../map/vector-tools';

  /**
   * The Vector Map production editor (WI-D — docs/VectorMapSystem_Spec.md §9
   * step 6). Ports the proven POC interactions (originally
   * `poc/vector-floor/sandbox/src/app.ts`, since deleted) onto the real
   * `CampaignStore` via `vector-tools.ts`'s op model and `vector-engine.ts`'s
   * Pixi renderer, instead of the sandbox's in-memory `MapState`.
   *
   * The ONLY map view (WI-D pure-rollout cutover, `docs/VectorMapSystem_Decisions.md`
   * D1/D2) — `RoomShell.svelte` mounts this unconditionally; the old cellular
   * `MapView`/`VITE_VECTOR_MAP_EDITOR` flag are gone.
   *
   * Scope notes (flagged as follow-ups, not silently decided):
   *  - **Tool panel unification (post-WI-D cleanup).** Every tool — Select,
   *    the floor/wall/door tools, Eye, Annotate, Ping, Label, and the reused
   *    cellular Symbol tool (DECISIONS.md WI-D D4) — is now one catalog on
   *    the shared `MapToolController`, rendered by one `MapToolbar` in the
   *    Tools rail. There used to be two: this component's own canvas-top
   *    `.vf-bar` for draw tools, and a separate `MapToolbar` for `symbol`/
   *    `label` only. `onPointerDown` reads `mapCtrl.activeTool` (aliased here
   *    as `tool`) directly — `symbol` places a `MapSymbol` (`placeSymbolAt`),
   *    `label` places/edits a `MapRoom` (`placeLabelAt`), everything else
   *    drives this editor's own drag/click stroke-collection. Symbols,
   *    labels, doors, and the shared annotation/drawing layer all render on
   *    the same `overlay` container in `vector-engine.ts` (SPEC §3.4).
   *    Freehand `Drawing` annotations render on that shared overlay too
   *    (`renderAnnotations`) and are authored via this editor's own inline
   *    `annotate` tool (freehand; text-annotation authoring not yet exposed).
   *  - Tokens/encounter are rendered on the engine's `tokens` layer (ported
   *    from the former cellular `MapView` in the post-cutover review pass):
   *    sprites, status rings, collapsed-group badges, and drag→snap→move.
   *    Dynamic-LoS token hiding (old fog `dynamic` mode) is deliberately not
   *    ported — fog/LoS rendering was removed (SPEC §4). Live peer cursors and
   *    pings render on dedicated top containers (`renderCursors`/`renderPings`,
   *    fed by `subscribeCursors`/`subscribePings` + a throttled `publishCursor`
   *    and the `ping` tool).
   *  - Secret/trapped door GM-only glyph hiding is intentionally a no-op
   *    (DECISIONS.md WI-D D5, ratified): every door renders identically to
   *    every viewer, same as the old cellular model's behavior.
   */

  let {
    roomId,
    mapId,
    map,
    room,
    tokens,
    groups,
    encounter,
    isGM,
  }: {
    roomId: string;
    mapId: string;
    map: GameMap;
    room: Room;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
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
  const dialogs = getContext<DialogService>(DIALOG_KEY);

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
  let drawings = $state<Drawing[]>([]);

  // In-progress freehand annotation, pixel-space (not lattice-snapped — a note
  // stroke should follow the pointer smoothly). Non-reactive per-frame buffer,
  // like the floor-stroke state above; rendered via `renderAll`.
  let annotatePoints: { x: number; y: number }[] = [];
  let lastCursorPublish = 0;

  const cellSize = $derived(map.grid.cellSize);
  // `{ ref }` renders that image; `{ color }` (added post-cutover) fills the
  // stage with a solid color instead; explicit `null` was cleared (bare
  // rock); absent (pre-migration) falls back to the starter map.
  const backgroundState = $derived<
    { kind: 'image'; ref: string } | { kind: 'color'; color: string } | { kind: 'none' }
  >(
    map.background === null
      ? { kind: 'none' }
      : map.background === undefined
        ? { kind: 'image', ref: STARTER_MAP_REF }
        : 'color' in map.background
          ? { kind: 'color', color: map.background.color }
          : { kind: 'image', ref: map.background.ref },
  );
  const scene = $derived(buildVectorScene(regions, walls, doors));

  // ---- tool state ----
  // Every tool (`select`…`ping`, plus the reused `symbol`/`label` authoring
  // tools) is one catalog now, held on the shared `MapToolController` so the
  // Tools-rail `MapToolbar` and this canvas's own keyboard shortcuts read and
  // write the same state — a click in the rail and a shortcut here can never
  // disagree, because there is only one value. `tool`/`carveMode`/`snapMode`/
  // `width`/`sides`/`tolerance`/`selectedDoorArt`/`selectMode` below are
  // read-only aliases into `mapCtrl`; `MapToolbar` is what mutates them (via
  // its `$bindable` props).
  type ToolId = MapToolId;
  const FLOOR_TOOLS: ToolId[] = ['room', 'corridor', 'path', 'polygon', 'ngon'];
  // Tools whose next click snaps to a lattice vertex — matches MapToolbar's
  // `SNAP_TOOLS` (the tools that show the Snap mode selector). `symbol` is
  // deliberately excluded: it places by cell-floor, not vertex-snap (Phase B).
  const SNAP_CURSOR_TOOLS: ToolId[] = [
    'room',
    'corridor',
    'path',
    'polygon',
    'ngon',
    'wall',
    'door',
  ];

  const tool = $derived(mapCtrl.activeTool);
  const carveMode = $derived(mapCtrl.carveMode);
  const snapMode = $derived(mapCtrl.snapMode);
  const width = $derived(mapCtrl.width);
  const sides = $derived(mapCtrl.sides);
  const tolerance = $derived(mapCtrl.tolerance);
  const selectedDoorArt = $derived(mapCtrl.selectedDoorArt);
  const selectMode = $derived(mapCtrl.selectMode);
  let eye = $state<Point | null>(null);
  // Undo/redo/export state lives on the shared `mapCtrl` (single source of
  // truth), so the rail's `MapToolbar` and this editor never disagree
  // (action-plan item 4). The toolbar's `onUndo`/`onRedo`/`onExportPng`
  // handlers are wired to this editor's functions in `onMount`.
  // D3 (docs/VectorMapSystem_Decisions.md) — soft bounded-extent guard: a commit
  // that would push the floor union's bbox past MAX_FLOOR_EXTENT is blocked
  // with a visible error rather than silently applied/truncated.
  let floorExtentError = $state('');

  const HINTS: Record<ToolId, string> = {
    select:
      'Select — Vertex: drag a single point. Edge: drag both endpoints (push a wall out, or move a whole door/wall). Object: click a symbol/label/door/annotation to move it or press Backspace to delete it.',
    pan: 'Pan — drag to move the view (also available on any tool via right-click drag, Alt+drag, or Space+drag).',
    room: 'Room — drag two corners, or click to start and click again to finish. Hold Alt for freeform corners.',
    corridor: 'Corridor — drag start→end for an L-shaped run of fixed Width.',
    path: 'Path — click to add points, double-click (or Enter) to finish. Rock mode carves an interior divider.',
    polygon: 'Polygon — click each vertex, double-click (or Enter) to close.',
    ngon: 'Regular n-gon — drag center→radius. Sides=1 ⇒ circle.',
    wall: 'Wall — click points, double-click (or Enter) to finish. Explicit sight+movement blocker.',
    door: 'Door — click two endpoints on/near a wall. Click an existing door to toggle open/closed.',
    eye: 'Eye — click to preview line of sight from a point.',
    annotate: 'Annotate — drag to draw a freehand note on the overlay layer.',
    ping: 'Ping — click to drop a transient marker all players see.',
    label: 'Label — click to place a keyed room label, then type its name.',
    symbol: 'Symbol — click to place the selected symbol.',
  };

  // ---- interaction state (not reactive — mirrors MapView.svelte's stroke
  // state, which is per-frame and doesn't need Svelte's dependency tracking) ----
  let dragging = false;
  let dragStart: Point | null = null;
  let dragCur: Point | null = null;
  let collecting: Point[] = [];
  let gestureActive = false;
  let altKey = false;
  // Room/Corridor/N-gon support click-to-start/click-to-end as well as
  // click-and-drag: the first pointerdown always opens a tentative drag
  // (`dragging = true`); if pointerup finds no real movement, this flips on
  // instead of committing, and `dragStart`/`dragCur` are kept alive as the
  // pending first point so the second click finishes the shape.
  let awaitingSecondClick = false;
  const CLICK_MOVE_THRESHOLD_PX = 4;

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

  // ---- Select tool "Object" mode: select/move/delete a whole symbol, label,
  // door, or annotation, distinct from the vertex/edge geometric-edit drag
  // above. Doors are select-only here (no free move) — their endpoints
  // already move via the existing vertex/edge handles. ----
  type ObjectRecord = MapSymbol | MapRoom | Drawing;
  interface ObjectDrag {
    selection: ObjectSelection;
    working: ObjectRecord;
    /** Offset from the drag anchor to the object's own position field, in
     * that field's native space (lattice for symbol/mapRoom, pixel for
     * drawing — `Drawing.points` are pixel-space, see `pickObject`). */
    offset: { x: number; y: number };
  }
  // $state so the `selected-object` e2e readout below reflects it reactively.
  let selectedObject = $state<ObjectSelection | null>(null);
  let objectDrag: ObjectDrag | null = null;

  const undoStack = new UndoStack<VectorEditorOp>();
  function syncUndoFlags(): void {
    mapCtrl.canUndo = undoStack.canUndo();
    mapCtrl.canRedo = undoStack.canRedo();
  }

  /** Token size slider on the shared `MapToolbar` (1×1–3×3). Drives the
   * currently-selected token, mirroring the old cellular view's wiring. */
  async function handleResizeToken(size: number): Promise<void> {
    const id = mapCtrl.selectedToken?.id;
    if (!id) return;
    await store.resizeToken(roomId, id, size);
  }

  let unsubs: Array<() => void> = [];

  onMount(() => {
    let disposed = false;
    void (async () => {
      const created = await createVectorMapEngine(hostEl, {
        theme: readMapTheme(),
        resolveAsset: (ref) => assets.resolve(ref),
      });
      if (disposed) {
        created.destroy();
        return;
      }
      engine = created;
      void applyBackground(backgroundState);
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
    unsubs.push(
      store.subscribeDrawings(roomId, mapId, (d) => {
        drawings = d;
        renderAll();
      }),
    );
    // Live collaboration overlays — rendered straight from the subscription
    // (their own sprite lifecycle in the engine), no `renderAll` needed.
    unsubs.push(store.subscribeCursors(roomId, (c) => engine?.renderCursors(c, myUid)));
    unsubs.push(store.subscribePings(roomId, (p) => engine?.renderPings(p)));

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Let the shared `MapToolbar`'s undo/redo/export/token-resize controls
    // drive this editor (action-plan item 4). `mapCtrl.release()` NOOPs these
    // again on unmount.
    mapCtrl.onUndo = () => void undo();
    mapCtrl.onRedo = () => void redo();
    mapCtrl.onExportPng = () => void exportPng();
    mapCtrl.onResizeToken = (size) => void handleResizeToken(size);
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
    // Token-layer bookkeeping — engine.destroy() tears down the Pixi nodes
    // themselves ({ children: true }); clear our lookup maps so no stale
    // references survive the unmount.
    spritesByToken.clear();
    backgroundsByToken.clear();
    ringsByToken.clear();
    badgesByGroup.clear();
    draggingIds.clear();
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
    // Keep the shared toolbar's GM-only controls in sync with this viewer's
    // role (action-plan item 4).
    mapCtrl.isGM = isGM;
  });

  $effect(() => {
    const bg = backgroundState;
    if (ready) void applyBackground(bg);
  });

  $effect(() => {
    // Re-render when the map's cell size or grid-subdivide display setting
    // changes (a live grid resize, or the R9.6 half-grid toggle).
    void cellSize;
    void map.gridSettings.subdivide;
    if (ready) renderAll();
  });

  // Cancel any in-progress stroke/drag whenever the active tool changes,
  // regardless of where that change came from (the shared `MapToolbar` in the
  // rail, or a keyboard shortcut here) — previously only the inline rail's own
  // click handler did this; now that tool-switching can originate from either
  // side, this effect is what guarantees it always happens.
  let lastTool = mapCtrl.activeTool;
  $effect(() => {
    if (tool !== lastTool) {
      lastTool = tool;
      cancelStroke();
    }
    engine?.setPanToolActive(tool === 'pan');
  });

  $effect(() => {
    // Re-sync the token layer whenever the roster or its derived visibility
    // changes. Touching the deps registers them for Svelte's tracking.
    void mapVisibleIds;
    void currentTurnIds;
    void hiddenCollapsedIds;
    void collapsedGroups;
    void selectedTokenId;
    if (ready) syncSprites(renderableTokens);
  });

  async function applyBackground(
    bg: { kind: 'image'; ref: string } | { kind: 'color'; color: string } | { kind: 'none' },
  ): Promise<void> {
    if (!engine) return;
    const seq = ++bgLoadSeq;
    if (bg.kind === 'color') {
      bgSprite?.destroy();
      bgSprite = null;
      engine.setBackgroundColor(hexToNumber(bg.color));
      return;
    }
    // Image or bare-rock: no per-map color override active, so the renderer
    // falls back to the room's theme color underneath (or behind) the sprite.
    engine.setBackgroundColor(null);
    if (bg.kind === 'none') {
      bgSprite?.destroy();
      bgSprite = null;
      return;
    }
    const texture = (await PIXI.Assets.load(assets.resolve(bg.ref))) as PIXI.Texture;
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

  // ---- token / encounter layer (ported from the former cellular MapView.svelte
  // onto the vector engine's `tokens` layer; SPEC §2.2 — tokens are unchanged
  // by the vector floor system). Sprite lifecycle + drag/snap/move live here
  // exactly as they did before the cutover; only the host layer changed.
  // Dynamic-LoS token hiding (old fog `dynamic` mode) is intentionally dropped
  // — fog/LoS rendering was removed in the cutover (SPEC §4), so no viewer
  // consumes it. See docs/VectorMapSystem_Decisions.md action-plan item 5. ----

  const TOKEN_PX = 48;
  const spritesByToken = new Map<string, PIXI.Sprite>();
  /** Background disc behind a token's sprite (quick-sheet token/color split)
   * — shows `Token.color` through a transparent uploaded image and behind a
   * letter token's own disc alike. Kept one z-order slot below its sprite
   * (added to the layer first); a separate concern from `ringsByToken`'s
   * selection/group indicator stroke, which stays on top of everything. */
  const backgroundsByToken = new Map<string, PIXI.Graphics>();
  const ringsByToken = new Map<string, PIXI.Graphics>();
  const badgesByGroup = new Map<string, PIXI.Container>();
  const draggingIds = new Set<string>();
  let selectedTokenId = $state<string | null>(null);
  // Number of token docs the last drop wrote (1 for a lone token, N for a
  // collapsed group's batched move) — surfaced for e2e introspection.
  let lastBatchMoveCount = $state(1);

  // A player only sees tokens flagged [Map]-visible; the GM sees all, with the
  // not-yet-visible ones dimmed (same rule as the cellular MapView).
  const mapVisibleIds = $derived(visibleTokenIds(tokens, groups, 'map'));
  const renderableTokens = $derived(isGM ? tokens : tokens.filter((t) => mapVisibleIds.has(t.id)));
  const currentTurnIds = $derived(
    encounter ? currentActorTokenIds(encounter, groups) : new Set<string>(),
  );
  const collapsedGroups = $derived(
    groups.filter((g) => g.collapsed && g.memberTokenIds.length > 0),
  );
  const hiddenCollapsedIds = $derived.by(() => {
    const hidden = new Set<string>();
    for (const g of collapsedGroups) {
      const anchorId = groupAnchorId(g);
      for (const id of g.memberTokenIds) if (id !== anchorId) hidden.add(id);
    }
    return hidden;
  });

  function collapsedGroupAnchoredBy(tokenId: string): Group | null {
    return collapsedGroups.find((g) => groupAnchorId(g) === tokenId) ?? null;
  }

  // ---- add creature (GM-only, ported from the cellular MapView) — the only
  // way to place tokens on the map; opens the token picker, then drops `count`
  // tokens stepping one cell right from a deterministic start point. ----
  const STARTER_DROP_POS = { x: 160, y: 160 };
  let addingCreature = $state(false);

  async function addCreature(): Promise<void> {
    if (addingCreature) return;
    const typeLetter = nextCreatureTypeLetter(tokens);
    const picked = await dialogs.pickToken({
      title: 'Add creature',
      roomId,
      mode: 'creature',
      confirmLabel: 'Add',
      genDefaultLabel: `${typeLetter}1`,
      genDefaultColorSeed: typeLetter,
    });
    if (!picked) return;
    addingCreature = true;
    try {
      const refs = picked.ref
        ? Array.from({ length: picked.count }, () => picked.ref as string)
        : defaultCreatureRefs(picked.count, tokens);
      const newTokenIds: string[] = [];
      for (let i = 0; i < refs.length; i++) {
        const step = tokens.length + newTokenIds.length;
        const id = await store.createToken(roomId, {
          pos: { x: STARTER_DROP_POS.x + step * cellSize, y: STARTER_DROP_POS.y },
          size: 1,
          layer: 'tokens',
          imageRef: refs[i]!,
        });
        newTokenIds.push(id);
      }
      if (newTokenIds.length > 1) {
        await store.createGroup(roomId, {
          name: picked.groupName || 'Creatures',
          memberTokenIds: newTokenIds,
          showMap: false,
          showBoard: false,
          active: false,
        });
      }
    } finally {
      addingCreature = false;
    }
  }

  function syncSprites(list: Token[]): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      // Created (and added to the layer) before the sprite below so it
      // always renders one z-order slot behind its token's art — shows
      // through a transparent uploaded image and behind a letter token's own
      // disc alike (quick-sheet token/color split).
      let background = backgroundsByToken.get(token.id);
      if (!background) {
        background = new PIXI.Graphics();
        background.eventMode = 'none';
        layer.addChild(background);
        backgroundsByToken.set(token.id, background);
      }
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
      if (!draggingIds.has(token.id)) sprite.position.set(token.pos.x, token.pos.y);
      sprite.width = TOKEN_PX * token.size;
      sprite.height = TOKEN_PX * token.size;
      // Translucent = GM-only view of a token not yet [Map]-visible to players;
      // tinted = it's this token's side/actor's turn.
      sprite.alpha = mapVisibleIds.has(token.id) ? 1 : 0.4;
      sprite.tint = currentTurnIds.has(token.id) ? 0xffd699 : 0xffffff;
      sprite.visible = !hiddenCollapsedIds.has(token.id);

      background.position.copyFrom(sprite.position);
      background.visible = sprite.visible;
      background.alpha = sprite.alpha;
      background.clear();
      if (token.color) {
        background.circle(0, 0, (TOKEN_PX * token.size) / 2).fill(hexToNumber(token.color));
      }
    }
    for (const [id, sprite] of spritesByToken) {
      if (!seen.has(id)) {
        sprite.destroy();
        spritesByToken.delete(id);
        backgroundsByToken.get(id)?.destroy();
        backgroundsByToken.delete(id);
      }
    }
    syncTokenRings(list);
    syncCollapsedBadges();
  }

  /** Status ring around each token: white when selected or owned by the
   * viewer, else the token's group color, else black. Stroke-only overlay
   * redrawn every sync — separate from a gen-disc's own baked art ring. */
  function syncTokenRings(list: Token[]): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      let ring = ringsByToken.get(token.id);
      if (!ring) {
        ring = new PIXI.Graphics();
        ring.eventMode = 'none';
        layer.addChild(ring);
        ringsByToken.set(token.id, ring);
      }
      ring.visible = !hiddenCollapsedIds.has(token.id);
      const sprite = spritesByToken.get(token.id);
      const rx = sprite ? sprite.position.x : token.pos.x;
      const ry = sprite ? sprite.position.y : token.pos.y;
      const r = (TOKEN_PX * token.size) / 2;
      ring.position.set(rx, ry);
      ring.clear();
      ring
        .circle(0, 0, r)
        .stroke({ width: 4, color: tokenRingColor(token, groups, selectedTokenId, myUid) });
    }
    for (const [id, ring] of ringsByToken) {
      if (!seen.has(id)) {
        ring.destroy();
        ringsByToken.delete(id);
      }
    }
  }

  /** Count bubble on each collapsed group's anchor token; follows the anchor
   * sprite's live position so it tracks a drag. */
  function syncCollapsedBadges(): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const group of collapsedGroups) {
      const anchorId = groupAnchorId(group);
      if (!anchorId) continue;
      const anchor = renderableTokens.find((t) => t.id === anchorId);
      if (!anchor) continue; // anchor not visible to this viewer
      seen.add(group.id);
      let badge = badgesByGroup.get(group.id);
      if (!badge) {
        badge = createCountBadge();
        layer.addChild(badge);
        badgesByGroup.set(group.id, badge);
      }
      const label = badge.getChildByLabel('count') as PIXI.Text | null;
      if (label) label.text = String(group.memberTokenIds.length);
      const sprite = spritesByToken.get(anchorId);
      const bx = sprite ? sprite.position.x : anchor.pos.x;
      const by = sprite ? sprite.position.y : anchor.pos.y;
      const r = (TOKEN_PX * anchor.size) / 2;
      badge.position.set(bx + r * 0.7, by - r * 0.7);
    }
    for (const [id, badge] of badgesByGroup) {
      if (!seen.has(id)) {
        badge.destroy({ children: true });
        badgesByGroup.delete(id);
      }
    }
  }

  function createCountBadge(): PIXI.Container {
    const badge = new PIXI.Container();
    badge.eventMode = 'none';
    const circle = new PIXI.Graphics();
    circle.circle(0, 0, 13).fill(0x2a2118).stroke({ width: 2, color: 0xffd699 });
    badge.addChild(circle);
    const text = new PIXI.Text({
      text: '',
      style: { fill: 0xffd699, fontSize: 16, fontWeight: 'bold' },
    });
    text.label = 'count';
    text.anchor.set(0.5);
    badge.addChild(text);
    return badge;
  }

  async function loadTokenTexture(sprite: PIXI.Sprite, imageRef: string): Promise<void> {
    const texture = await PIXI.Assets.load(assets.resolve(imageRef));
    sprite.texture = texture as PIXI.Texture;
  }

  function attachDragHandlers(sprite: PIXI.Sprite, tokenId: string): void {
    let tokenDragging = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      selectedTokenId = tokenId;
      mapCtrl.selectedToken = tokens.find((t) => t.id === tokenId) ?? null;
      tokenDragging = true;
      draggingIds.add(tokenId);
      sprite.cursor = 'grabbing';
      e.stopPropagation();
    });
    sprite.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!tokenDragging || !engine) return;
      const local = engine.world.toLocal(e.global);
      sprite.position.set(local.x, local.y);
      // RTDB drag frames for the anchor only — a collapsed group publishes one
      // stream, not one per member.
      store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
      if (collapsedGroupAnchoredBy(tokenId)) syncCollapsedBadges();
    });
    const stop = (e: PIXI.FederatedPointerEvent) => {
      if (!tokenDragging) return;
      tokenDragging = false;
      draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      // Snap on drop: cell grid by default, half-grid with Alt, free with
      // Alt+Shift; the rail's snap toggle is the base mode. Honors token size.
      const size = tokens.find((t) => t.id === tokenId)?.size ?? 1;
      const mode = snapModeFromModifiers(e.altKey, e.shiftKey, mapCtrl.tokenSnap);
      const snapped = snapTokenPosition(
        { x: sprite.position.x, y: sprite.position.y },
        cellSize,
        size,
        mode,
      );
      sprite.position.set(snapped.x, snapped.y);
      const collapsedGroup = collapsedGroupAnchoredBy(tokenId);
      if (collapsedGroup) {
        // One batched write of every member's new position, offsets preserved.
        const updates = collapsedDragUpdates(collapsedGroup, snapped);
        lastBatchMoveCount = updates.length;
        void store.moveTokens(roomId, updates);
      } else {
        lastBatchMoveCount = 1;
        void store.moveToken(roomId, tokenId, snapped);
      }
      store.clearDrag(roomId, tokenId);
    };
    sprite.on('pointerup', stop);
    sprite.on('pointerupoutside', stop);
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
      vectorMap.toolTolerance(carveKind(tool), tolerance),
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
      const door: VectorDoor = {
        id,
        a: collecting[0]!,
        b: collecting[1]!,
        // Art is the door tool's only selection now (SPEC §3.2); `type` is
        // derived from it so LoS ("barred" always blocks, via `doorPasses`)
        // still works without a separate type control.
        type: vectorMap.doorTypeForArt(selectedDoorArt),
        state: 'closed',
        art: selectedDoorArt,
      };
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
    const after =
      drag.owner.kind === 'region'
        ? recomputeRegionBBox(drag.working as VectorFloorRegion)
        : drag.working;
    await applyOp(buildDragOp(drag.owner, drag.before, after));
  }

  // ---- Select tool "Object" mode ----

  function beginObjectDrag(point: Point): void {
    const threshold = latticeThreshold(9);
    selectedObject = pickObject(point, cellSize, { symbols, mapRooms, doors, drawings }, threshold);
    objectDrag = null;
    if (!selectedObject || selectedObject.kind === 'door') return; // doors: select-only here
    if (selectedObject.kind === 'symbol') {
      const orig = symbols.find((s) => s.id === selectedObject!.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      objectDrag = {
        selection: selectedObject,
        working,
        offset: { x: working.cell.x - point.x, y: working.cell.y - point.y },
      };
    } else if (selectedObject.kind === 'mapRoom') {
      const orig = mapRooms.find((r) => r.id === selectedObject!.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      objectDrag = {
        selection: selectedObject,
        working,
        offset: { x: working.labelAnchor.x - point.x, y: working.labelAnchor.y - point.y },
      };
    } else {
      const orig = drawings.find((d) => d.id === selectedObject!.id);
      if (!orig || !orig.points.length) return;
      const working = structuredClone($state.snapshot(orig));
      const anchorPx = { x: point.x * cellSize, y: point.y * cellSize };
      objectDrag = {
        selection: selectedObject,
        working,
        offset: { x: working.points[0]!.x - anchorPx.x, y: working.points[0]!.y - anchorPx.y },
      };
    }
  }

  function updateObjectDrag(point: Point): void {
    if (!objectDrag) return;
    if (objectDrag.selection.kind === 'symbol') {
      const s = objectDrag.working as MapSymbol;
      s.cell = vectorMap.anchorCellFor({
        x: point.x + objectDrag.offset.x,
        y: point.y + objectDrag.offset.y,
      });
    } else if (objectDrag.selection.kind === 'mapRoom') {
      // No rounding — labels are placed at whatever precision the current
      // snap mode gives (see `placeLabelAt`), not forced to whole cells.
      const r = objectDrag.working as MapRoom;
      r.labelAnchor = { x: point.x + objectDrag.offset.x, y: point.y + objectDrag.offset.y };
    } else {
      const d = objectDrag.working as Drawing;
      const anchorPx = { x: point.x * cellSize, y: point.y * cellSize };
      const target = { x: anchorPx.x + objectDrag.offset.x, y: anchorPx.y + objectDrag.offset.y };
      const dx = target.x - d.points[0]!.x;
      const dy = target.y - d.points[0]!.y;
      d.points = d.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  async function endObjectDrag(): Promise<void> {
    const drag = objectDrag;
    objectDrag = null;
    if (!drag) return;
    if (drag.selection.kind === 'symbol') {
      await store.placeSymbol(roomId, mapId, drag.working as MapSymbol);
    } else if (drag.selection.kind === 'mapRoom') {
      await store.upsertMapRoom(roomId, mapId, drag.working as MapRoom);
    } else {
      await store.writeDrawing(roomId, mapId, drag.working as Drawing);
    }
  }

  async function deleteSelectedObject(): Promise<void> {
    const sel = selectedObject;
    if (!sel) return;
    selectedObject = null;
    objectDrag = null;
    if (sel.kind === 'symbol') await store.removeSymbol(roomId, mapId, sel.id);
    else if (sel.kind === 'mapRoom') await store.removeMapRoom(roomId, mapId, sel.id);
    else if (sel.kind === 'door') await store.removeDoor(roomId, mapId, sel.id);
    else await store.deleteDrawing(roomId, mapId, sel.id);
    renderAll();
  }

  /** Substitutes the in-progress Object-mode drag's working copy for its live
   * counterpart — mirrors `displayState()` above, for symbols/labels/drawings
   * instead of floor/wall/door geometry. */
  function displayOverlayState(): {
    symbols: MapSymbol[];
    mapRooms: MapRoom[];
    drawings: Drawing[];
  } {
    const drag = objectDrag;
    if (!drag) return { symbols, mapRooms, drawings };
    if (drag.selection.kind === 'symbol') {
      const id = drag.selection.id;
      return {
        symbols: symbols.map((s) => (s.id === id ? (drag.working as MapSymbol) : s)),
        mapRooms,
        drawings,
      };
    }
    if (drag.selection.kind === 'mapRoom') {
      const id = drag.selection.id;
      return {
        symbols,
        mapRooms: mapRooms.map((r) => (r.id === id ? (drag.working as MapRoom) : r)),
        drawings,
      };
    }
    const id = drag.selection.id;
    return {
      symbols,
      mapRooms,
      drawings: drawings.map((d) => (d.id === id ? (drag.working as Drawing) : d)),
    };
  }

  /** Substitutes the in-progress Select-tool drag's working copy for its live
   * counterpart, so a drag previews without mutating the subscribed arrays. */
  function displayState(): {
    regions: VectorFloorRegion[];
    walls: StoredVectorWall[];
    doors: VectorDoor[];
  } {
    const drag = activeDrag;
    if (!drag) return { regions, walls, doors };
    if (drag.owner.kind === 'region') {
      const id = drag.owner.id;
      return {
        regions: regions.map((r) => (r.id === id ? (drag.working as VectorFloorRegion) : r)),
        walls,
        doors,
      };
    }
    if (drag.owner.kind === 'wall') {
      const id = drag.owner.id;
      return {
        regions,
        walls: walls.map((w) => (w.id === id ? (drag.working as StoredVectorWall) : w)),
        doors,
      };
    }
    const id = drag.owner.id;
    return {
      regions,
      walls,
      doors: doors.map((d) => (d.id === id ? (drag.working as VectorDoor) : d)),
    };
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
    store.publishVectorMapDraft(roomId, mapId, {
      uid: myUid,
      tool,
      mode: carveMode,
      points,
      ts: Date.now(),
    });
  }

  function clearDraft(): void {
    if (myUid) store.clearVectorMapDraft(roomId, mapId, myUid);
  }

  // ---- pointer dispatch ----

  function toLatticeRaw(world: { x: number; y: number }): Point {
    return { x: world.x / cellSize, y: world.y / cellSize };
  }

  function toLatticeSnapped(world: { x: number; y: number }): Point {
    return vectorMap.snapPoint(toLatticeRaw(world), effectiveSnap());
  }

  function wireStagePointerEvents(mapEngine: VectorMapEngine): void {
    const stage = mapEngine.app.stage;
    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      // No `e.target !== stage` guard: the scene layers are non-interactive
      // (see `createVectorMapEngine`), so a click on rendered floor still
      // targets the stage; token sprites `stopPropagation`, so their drags
      // never reach this handler. Guarding on target dropped floor clicks
      // (e.g. placing a label inside a carved region).
      if (gestureActive) return;
      if (e.button !== 0 || e.altKey) return;
      const worldPx = mapEngine.toWorld(e.global);
      if (handleCollabPointerDown(worldPx)) return;
      if (tool === 'symbol') {
        // Cell-floor semantics, not vertex-round: a symbol's footprint must
        // contain the clicked point. `toLatticeSnapped` rounds to the
        // nearest grid VERTEX, which — since Math.round picks whichever
        // corner is numerically closer — lands the symbol in the adjacent
        // cell roughly half the time a click falls past a cell's midpoint.
        void placeSymbolAt(toLatticeRaw(worldPx));
        return;
      }
      onPointerDown(toLatticeSnapped(worldPx));
    });
    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      publishCursorThrottled(worldPx);
      if (handleCollabPointerMove(worldPx)) return;
      onPointerMove(toLatticeSnapped(worldPx));
    });
    const end = (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      void (async () => {
        if (await handleCollabPointerUp()) return;
        await onPointerUp(toLatticeSnapped(worldPx));
      })();
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
    mapEngine.app.canvas.addEventListener('dblclick', () => void finishMultiClick());
  }

  /** Symbol authoring (DECISIONS.md WI-D D4) — a click while the shared
   * `symbol` tool is active places a `MapSymbol` at the click point. */
  /** `p` is the raw (unsnapped) lattice point — see the `symbol` short-circuit
   * in `wireStagePointerEvents` for why this must not be vertex-snapped. */
  async function placeSymbolAt(p: Point): Promise<void> {
    const entry = vectorMap.symbolCatalogEntry(mapCtrl.selectedSymbolKind);
    await store.placeSymbol(roomId, mapId, {
      cell: vectorMap.anchorCellFor(p),
      kind: mapCtrl.selectedSymbolKind,
      rotation: 0,
      cellSpan: entry.cellSpan,
    });
  }

  /** Opens the in-canvas name editor for a new label at `p` (no blocking
   * `window.prompt`, no network round-trip first): the keyed MapRoom is created
   * once, with the typed name, on commit — so the editor appears instantly and
   * there's no empty-name intermediate doc / subscription-latency race. Shared
   * by the shared-rail `label` tool and this editor's own inline `label` tool. */
  function placeLabelAt(p: Point): void {
    pendingLabel = { id: nextVectorId('room'), key: String(mapRooms.length + 1), anchor: p };
    openLabelEditor(pendingLabel.id, p);
  }

  // ---- inline label name editor (replaces window.prompt) ----
  let editingLabelId = $state<string | null>(null);
  let editingLabelText = $state('');
  let editingLabelPos = $state({ x: 0, y: 0 });
  let labelEditInputEl = $state<HTMLTextAreaElement | undefined>();
  // A not-yet-created label being named for the first time (created on commit).
  let pendingLabel: { id: string; key: string; anchor: Point } | null = null;

  function openLabelEditor(id: string, latticePoint: Point): void {
    const room = mapRooms.find((r) => r.id === id);
    editingLabelId = id;
    editingLabelText = room?.name ?? '';
    if (engine) {
      // `toScreen` returns canvas-relative pixels; the editor is absolutely
      // positioned inside `.vf-canvas-wrap` (which the canvas fills), so these
      // coords are used directly — no bounding-rect offset.
      editingLabelPos = engine.toScreen({
        x: latticePoint.x * cellSize,
        y: latticePoint.y * cellSize,
      });
    }
    void tick().then(() => labelEditInputEl?.focus());
  }

  async function commitLabelEdit(): Promise<void> {
    const id = editingLabelId;
    const pending = pendingLabel;
    editingLabelId = null;
    pendingLabel = null;
    if (!id) return;
    const name = editingLabelText.trim();
    const existing = mapRooms.find((r) => r.id === id);
    if (existing) {
      await store.upsertMapRoom(roomId, mapId, { ...existing, name });
    } else if (pending && pending.id === id && name) {
      // First commit for a brand-new label — create the MapRoom with its name.
      // An empty name is treated as a cancel (no stray unnamed room).
      await store.upsertMapRoom(roomId, mapId, {
        id,
        key: pending.key,
        name,
        bbox: { x: pending.anchor.x - 1, y: pending.anchor.y - 1, w: 2, h: 2 },
        labelAnchor: { x: pending.anchor.x, y: pending.anchor.y },
        wallStyle: 'masonry',
      });
    }
  }

  // Commit on Enter or Tab (not on blur): right after placement the Pixi canvas
  // steals focus back, so an `onblur` commit would close the editor before the
  // user could type. Escape cancels.
  function handleLabelEditKeydown(e: KeyboardEvent): void {
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault();
      void commitLabelEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editingLabelId = null;
      pendingLabel = null;
    }
  }

  // ---- collaboration tools: annotate (freehand), ping, live cursor ----
  // These operate on the *pixel-space* world point (drawings, cursors, and
  // pings store pixel-space coords, like tokens — unlike the lattice-snapped
  // points the floor/wall/door tools consume). The `handle*` helpers return
  // true when they consume the event, so the default lattice pointer flow is
  // skipped for those tools.

  function annotationsWithLiveStroke(source: Drawing[] = drawings): Drawing[] {
    if (tool !== 'annotate' || annotatePoints.length < 2) return source;
    const live: Drawing = {
      id: '__live__',
      layer: 'mapping',
      kind: 'freehand',
      points: annotatePoints,
      style: {},
    };
    return [...source, live];
  }

  /** Bbox corners (lattice space) for the Object mode selection highlight —
   * null when nothing's selected or the selected object no longer exists
   * (e.g. deleted by a peer). */
  function objectHighlightBBox(): { a: Point; b: Point } | null {
    if (!selectedObject) return null;
    if (selectedObject.kind === 'symbol') {
      const s =
        objectDrag?.selection.id === selectedObject.id
          ? (objectDrag.working as MapSymbol)
          : symbols.find((x) => x.id === selectedObject!.id);
      if (!s) return null;
      const span = s.cellSpan ?? { w: 1, h: 1 };
      return { a: { x: s.cell.x, y: s.cell.y }, b: { x: s.cell.x + span.w, y: s.cell.y + span.h } };
    }
    if (selectedObject.kind === 'mapRoom') {
      const r =
        objectDrag?.selection.id === selectedObject.id
          ? (objectDrag.working as MapRoom)
          : mapRooms.find((x) => x.id === selectedObject!.id);
      if (!r) return null;
      const a = r.labelAnchor;
      return { a: { x: a.x - 0.5, y: a.y - 0.5 }, b: { x: a.x + 0.5, y: a.y + 0.5 } };
    }
    if (selectedObject.kind === 'door') {
      const d = doors.find((x) => x.id === selectedObject!.id);
      return d ? { a: d.a, b: d.b } : null;
    }
    const dr =
      objectDrag?.selection.id === selectedObject.id
        ? (objectDrag.working as Drawing)
        : drawings.find((x) => x.id === selectedObject!.id);
    if (!dr || !dr.points.length) return null;
    const xs = dr.points.map((p) => p.x / cellSize);
    const ys = dr.points.map((p) => p.y / cellSize);
    return {
      a: { x: Math.min(...xs), y: Math.min(...ys) },
      b: { x: Math.max(...xs), y: Math.max(...ys) },
    };
  }

  function publishCursorThrottled(worldPx: { x: number; y: number }): void {
    const now = Date.now();
    if (now - lastCursorPublish < 80) return;
    lastCursorPublish = now;
    store.publishCursor(roomId, worldPx);
  }

  function handleCollabPointerDown(worldPx: { x: number; y: number }): boolean {
    if (tool === 'ping') {
      store.publishPing(roomId, worldPx);
      return true;
    }
    if (tool === 'annotate') {
      annotatePoints = [worldPx];
      return true;
    }
    return false;
  }

  function handleCollabPointerMove(worldPx: { x: number; y: number }): boolean {
    if (tool === 'ping') return true; // click-only, nothing to drag
    if (tool === 'annotate') {
      if (annotatePoints.length) {
        annotatePoints = [...annotatePoints, worldPx];
        renderAll();
      }
      return true;
    }
    return false;
  }

  async function handleCollabPointerUp(): Promise<boolean> {
    if (tool === 'ping') return true;
    if (tool === 'annotate') {
      if (annotatePoints.length > 1) {
        await store.writeDrawing(roomId, mapId, {
          layer: 'mapping',
          kind: 'freehand',
          points: annotatePoints,
          style: {},
        });
      }
      annotatePoints = [];
      renderAll();
      return true;
    }
    return false;
  }

  function onPointerDown(p: Point): void {
    if (tool === 'label') {
      placeLabelAt(p);
      return;
    }
    if (tool === 'select') {
      if (selectMode === 'object') {
        beginObjectDrag(p);
      } else {
        beginSelectDrag(p);
      }
      renderAll();
      return;
    }
    if (tool === 'room' || tool === 'corridor' || tool === 'ngon') {
      if (awaitingSecondClick) {
        // Second click of a click-to-start/click-to-end shape — commit using
        // the pending first point (`dragStart`) and this click as the end.
        dragCur = p;
        void finishFloorStroke();
        return;
      }
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

  /** Commits the in-progress Room/Corridor/N-gon stroke (drag or
   * click-to-start/click-to-end) and resets the shared 2-point state. */
  async function finishFloorStroke(): Promise<void> {
    const stroke = currentStroke();
    dragging = false;
    awaitingSecondClick = false;
    dragStart = null;
    dragCur = null;
    clearDraft();
    await commitFloorStroke(stroke);
    renderAll();
  }

  function onPointerMove(p: Point): void {
    if (tool === 'select') {
      if (selectMode === 'object') {
        if (objectDrag) updateObjectDrag(p);
      } else if (activeDrag) {
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
      if (selectMode === 'object') {
        if (objectDrag) await endObjectDrag();
      } else if (activeDrag) {
        await endSelectDrag();
      }
      renderAll();
      return;
    }
    if (dragging) {
      dragCur = p;
      const movedFar =
        dragStart &&
        Math.hypot(p.x - dragStart.x, p.y - dragStart.y) >
          latticeThreshold(CLICK_MOVE_THRESHOLD_PX);
      if (!movedFar && (tool === 'room' || tool === 'corridor' || tool === 'ngon')) {
        // A plain click, not a drag — wait for the second click instead of
        // committing a degenerate (zero-size) shape. `dragStart`/`dragCur`
        // stay set so the live preview keeps tracking the cursor.
        dragging = false;
        awaitingSecondClick = true;
        renderAll();
        return;
      }
      await finishFloorStroke();
      return;
    }
    if (tool === 'door' && collecting.length === 1) {
      // Click-and-drag alternative to Door's click-to-start/click-to-end:
      // a real drag before release commits immediately using the release
      // point as the second endpoint, via the same two-click commit path.
      const started = collecting[0]!;
      const movedFar =
        Math.hypot(p.x - started.x, p.y - started.y) > latticeThreshold(CLICK_MOVE_THRESHOLD_PX);
      if (movedFar) {
        await handleDoorClick(p);
        renderAll();
      }
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
    awaitingSecondClick = false;
    dragStart = null;
    dragCur = null;
    activeDrag = null;
    objectDrag = null;
    selectedObject = null;
    annotatePoints = [];
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
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (tool === 'select' && selectMode === 'object' && selectedObject) {
        e.preventDefault();
        void deleteSelectedObject();
      }
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') altKey = false;
  }

  // ---- render ----

  function renderAll(): void {
    if (!engine) return;
    engine.renderGrid(cellSize, map.gridSettings.subdivide);
    const disp = displayState();
    const liveScene = activeDrag ? buildVectorScene(disp.regions, disp.walls, disp.doors) : scene;
    engine.renderScene(liveScene, cellSize);
    engine.renderDoors(disp.doors, cellSize);
    const dispOverlay = displayOverlayState();
    engine.renderOverlayObjects(dispOverlay.symbols, dispOverlay.mapRooms, cellSize);
    engine.renderAnnotations(annotationsWithLiveStroke(dispOverlay.drawings));

    const strokePolys = FLOOR_TOOLS.includes(tool) ? currentStroke() : null;
    const previewSegs =
      tool === 'wall'
        ? buildWallPreviewSegs(collecting, dragCur)
        : tool === 'door' && collecting.length === 1
          ? [buildDoorPreviewSeg(collecting[0]!, dragCur)].filter(
              (s): s is vectorMap.Segment => s !== null,
            )
          : [];
    const maxDistLattice =
      engine.app.screen.width && engine.app.screen.height
        ? (engine.app.screen.width + engine.app.screen.height) / (engine.world.scale.x * cellSize)
        : 200;
    const visibility =
      tool === 'eye' && eye
        ? vectorMap.visibilityPolygon(eye, liveScene.sight, maxDistLattice)
        : null;

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
        cursorSnap: SNAP_CURSOR_TOOLS.includes(tool) ? dragCur : null,
        objectHighlight:
          tool === 'select' && selectMode === 'object' ? objectHighlightBBox() : null,
      },
      cellSize,
    );
  }

  // ---- "Download map as PNG" (M4 — bbox repointed to the union of
  // FloorRegion.bbox instead of the cellular carvedBoundingBox) ----

  const EXPORT_MARGIN_CELLS = 1;

  async function exportPng(): Promise<void> {
    if (!engine || mapCtrl.exportingPng) return;
    mapCtrl.exportingPng = true;
    try {
      const blob = await engine.exportPng({ regions, cellSize, marginCells: EXPORT_MARGIN_CELLS });
      downloadBlob(blob, `${roomId}-map.png`);
    } finally {
      mapCtrl.exportingPng = false;
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
  {#if floorExtentError}
    <div class="vf-error" data-testid="vector-floor-extent-error">{floorExtentError}</div>
  {/if}

  <div class="vf-stage-row">
    {#if isGM}
      <button
        type="button"
        class="vf-btn vf-add-creature"
        data-testid="add-creature"
        disabled={addingCreature}
        title="Pick a token/portrait, a count, and (optionally) a group name"
        onclick={() => void addCreature()}
      >
        + Add creature
      </button>
    {/if}
    <TurnStrip {encounter} {groups} {tokens} />
  </div>

  <div class="vf-canvas-wrap" bind:this={hostEl} data-testid="vector-map-canvas">
    {#if editingLabelId}
      <textarea
        bind:this={labelEditInputEl}
        bind:value={editingLabelText}
        data-testid="label-edit-input"
        class="vf-label-editor"
        style={`left:${editingLabelPos.x}px; top:${editingLabelPos.y}px;`}
        rows="1"
        placeholder="Room name…"
        onkeydown={handleLabelEditKeydown}
      ></textarea>
    {/if}
  </div>

  <div class="vf-hint">{HINTS[tool]}</div>

  <!-- Hidden state readouts for e2e/introspection (mirrors the Pixi canvas
  state as queryable DOM, since Pixi renders to a bitmap). Vector-appropriate
  counts replace the old cellular `floor-cell-count`/`sight-wall-count`/etc. -->
  <div class="vf-readouts" aria-hidden="true">
    {#each renderableTokens as token (token.id)}
      <span data-testid={`token-pos-${token.id}`}
        >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
      >
      <span data-testid={`token-size-${token.id}`}>{token.size}</span>
      <span data-testid={`token-current-${token.id}`}>{currentTurnIds.has(token.id)}</span>
      <span data-testid={`token-ring-${token.id}`}
        >{tokenRingColor(token, groups, selectedTokenId, myUid)}</span
      >
    {/each}
    {#each collapsedGroups as g (g.id)}
      <span data-testid={`collapsed-group-${g.id}`}>{g.memberTokenIds.length}</span>
    {/each}
    {#each mapRooms as r (r.id)}
      <span data-testid={`maproom-name-${r.id}`}>{r.name}</span>
      <span data-testid={`maproom-key-${r.id}`}>{r.key}</span>
    {/each}
    <span data-testid="floor-region-count">{regions.length}</span>
    <span data-testid="wall-count">{walls.length}</span>
    <span data-testid="door-count">{doors.length}</span>
    <span data-testid="drawing-count">{drawings.length}</span>
    <span data-testid="selected-object"
      >{selectedObject ? `${selectedObject.kind}:${selectedObject.id}` : ''}</span
    >
    <span data-testid="last-batch-move-count">{lastBatchMoveCount}</span>
    <span data-testid="measure-summary">{map.measure.perSquare}/{map.measure.unit}</span>
    <span data-testid="grid-subdivide">{map.gridSettings.subdivide}</span>
  </div>
</div>

<style>
  .vector-map-root {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    font:
      13px/1.4 system-ui,
      sans-serif;
    color: var(--text, #dbe4f5);
    background: var(--map-rock-css, #0f1420);
  }
  .vf-btn {
    border: 1px solid rgba(127, 178, 255, 0.3);
    color: inherit;
    padding: 5px 9px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
  }
  .vf-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .vf-stage-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
  }
  .vf-add-creature {
    white-space: nowrap;
  }
  .vf-canvas-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  /* Styled to read as the room label itself while typing — same weight/size/
     alignment and the same low-alpha rock-tinted chip backdrop as the
     rendered label (`renderOverlayObjects`'s `chip`/`text` in
     `vector-engine.ts`) — rather than a bordered form field floating over
     the map. No border, transparent until focused (a thin outline is the
     only "you're editing" affordance, shown on `:focus` since the textarea
     autofocuses on placement). */
  .vf-label-editor {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, -50%);
    min-width: 60px;
    max-width: 240px;
    resize: none;
    overflow: hidden;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    background: color-mix(in srgb, var(--map-rock-css, #0f1420) 22%, transparent);
    color: var(--text, #dbe4f5);
    font:
      bold 13px/1.3 system-ui,
      sans-serif;
    text-align: center;
  }
  .vf-label-editor:focus {
    outline: 1px solid rgba(127, 178, 255, 0.6);
    outline-offset: 2px;
  }
  /* Visually hidden, still in the DOM + accessibility tree off — pure e2e
     introspection of the Pixi canvas state. */
  .vf-readouts {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
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
