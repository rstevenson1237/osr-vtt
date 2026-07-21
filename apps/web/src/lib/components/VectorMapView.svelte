<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
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
  const backgroundRef = $derived(
    map.background === null ? null : (map.background?.ref ?? STARTER_MAP_REF),
  );
  const scene = $derived(buildVectorScene(regions, walls, doors));

  // ---- tool state ----
  // `annotate` (freehand notes on the shared overlay layer, SPEC §3.4) and
  // `ping` (transient collaboration marker) are this editor's own inline
  // tools — per the standing "optimize for the new workflow" direction they
  // live on the vector rail alongside the other drag tools, while annotations
  // still render on the overlay layer shared with doors/symbols/labels (D4).
  type ToolId =
    | 'select'
    | 'room'
    | 'corridor'
    | 'path'
    | 'polygon'
    | 'ngon'
    | 'wall'
    | 'door'
    | 'eye'
    | 'annotate'
    | 'ping';
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
  // Undo/redo/export state lives on the shared `mapCtrl` (single source of
  // truth), so the inline vector rail and the shared `MapToolbar` never
  // disagree (action-plan item 4). This editor's buttons read `mapCtrl.*`
  // directly; the toolbar's `onUndo`/`onRedo`/`onExportPng` handlers are wired
  // to this editor's functions in `onMount`.
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
    annotate: 'Annotate — drag to draw a freehand note on the overlay layer.',
    ping: 'Ping — click to drop a transient marker all players see.',
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
    const ref = backgroundRef;
    if (ready) void applyBackground(ref);
  });

  $effect(() => {
    // Re-render when the map's cell size changes (a live grid resize).
    void cellSize;
    if (ready) renderAll();
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

  // ---- token / encounter layer (ported from the former cellular MapView.svelte
  // onto the vector engine's `tokens` layer; SPEC §2.2 — tokens are unchanged
  // by the vector floor system). Sprite lifecycle + drag/snap/move live here
  // exactly as they did before the cutover; only the host layer changed.
  // Dynamic-LoS token hiding (old fog `dynamic` mode) is intentionally dropped
  // — fog/LoS rendering was removed in the cutover (SPEC §4), so no viewer
  // consumes it. See poc/vector-floor/DECISIONS.md action-plan item 5. ----

  const TOKEN_PX = 48;
  const spritesByToken = new Map<string, PIXI.Sprite>();
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
  const collapsedGroups = $derived(groups.filter((g) => g.collapsed && g.memberTokenIds.length > 0));
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
    }
    for (const [id, sprite] of spritesByToken) {
      if (!seen.has(id)) {
        sprite.destroy();
        spritesByToken.delete(id);
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
      ring.circle(0, 0, r).stroke({ width: 4, color: tokenRingColor(token, groups, selectedTokenId, myUid) });
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
    const text = new PIXI.Text({ text: '', style: { fill: 0xffd699, fontSize: 16, fontWeight: 'bold' } });
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
      const snapped = snapTokenPosition({ x: sprite.position.x, y: sprite.position.y }, cellSize, size, mode);
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
      const worldPx = mapEngine.toWorld(e.global);
      if (handleCollabPointerDown(worldPx)) return;
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

  // ---- collaboration tools: annotate (freehand), ping, live cursor ----
  // These operate on the *pixel-space* world point (drawings, cursors, and
  // pings store pixel-space coords, like tokens — unlike the lattice-snapped
  // points the floor/wall/door tools consume). The `handle*` helpers return
  // true when they consume the event, so the default lattice pointer flow is
  // skipped for those tools.

  function annotationsWithLiveStroke(): Drawing[] {
    if (tool !== 'annotate' || annotatePoints.length < 2) return drawings;
    const live: Drawing = {
      id: '__live__',
      layer: 'mapping',
      kind: 'freehand',
      points: annotatePoints,
      style: {},
    };
    return [...drawings, live];
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
    engine.renderAnnotations(annotationsWithLiveStroke());

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
  <div class="vf-bar" data-testid="vector-map-toolbar">
    {#each [['select', 'Select'], ['room', 'Room'], ['corridor', 'Corridor'], ['path', 'Path'], ['polygon', 'Polygon'], ['ngon', 'N-gon'], ['wall', 'Wall'], ['door', 'Door'], ['eye', 'Eye'], ['annotate', 'Annotate'], ['ping', 'Ping']] as [id, label] (id)}
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
    <button type="button" class="vf-btn" disabled={!mapCtrl.canUndo} onclick={() => void undo()} data-testid="vector-undo">Undo</button>
    <button type="button" class="vf-btn" disabled={!mapCtrl.canRedo} onclick={() => void redo()} data-testid="vector-redo">Redo</button>
    <button type="button" class="vf-btn" disabled={mapCtrl.exportingPng} onclick={() => void exportPng()}>
      {mapCtrl.exportingPng ? 'Exporting…' : 'Export PNG'}
    </button>
  </div>

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

  <div class="vf-canvas-wrap" bind:this={hostEl} data-testid="vector-map-canvas"></div>

  <div class="vf-hint">{HINTS[tool]}</div>

  <!-- Hidden state readouts for e2e/introspection (mirrors the Pixi canvas
  state as queryable DOM, since Pixi renders to a bitmap). Vector-appropriate
  counts replace the old cellular `floor-cell-count`/`sight-wall-count`/etc. -->
  <div class="vf-readouts" aria-hidden="true">
    {#each renderableTokens as token (token.id)}
      <span data-testid={`token-pos-${token.id}`}>{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span>
      <span data-testid={`token-size-${token.id}`}>{token.size}</span>
      <span data-testid={`token-current-${token.id}`}>{currentTurnIds.has(token.id)}</span>
      <span data-testid={`token-ring-${token.id}`}>{tokenRingColor(token, groups, selectedTokenId, myUid)}</span>
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
    <span data-testid="last-batch-move-count">{lastBatchMoveCount}</span>
  </div>
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
