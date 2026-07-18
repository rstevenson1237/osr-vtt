<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    type Arc,
    type AssetStore,
    type CampaignStore,
    type CircleWall,
    type CursorPos,
    type Drawing,
    type Encounter,
    type FloorChunk,
    type FogChunk,
    type GameMap,
    type Group,
    type MapDoor,
    type MapDraft,
    type MapLight,
    type MapRoom,
    type MapSymbol,
    type MapWall,
    type PingPos,
    type Room,
    type SightWall,
    type Token,
    type WallStyle,
    type IntersectionSnapMode,
    FloorGrid,
    FogGrid,
    allGridCells,
    angleAt,
    canonicalizeEdge,
    carvedBoundingBox,
    cellCenterPixel,
    collapsedDragUpdates,
    corridorCells,
    currentActorTokenIds,
    groupAnchorId,
    edgeId as canonicalEdgeId,
    edgeSegmentPixels,
    ellipseToCells,
    intersectionToPixel,
    isAxisAlignedRun,
    mapExportFrame,
    measureRuler,
    normalizeAngle,
    parseChunkId,
    parseUvtt,
    pixelToCell,
    polygonToCells,
    rectToCells,
    sightSegments,
    snapModeFromModifiers,
    snapRadius,
    snapToIntersection,
    snapTokenPosition,
    visibleCells,
    visibleTokenIds,
    wallRunEdges,
    type Intersection,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY } from '../context';
  import type { MapToolController } from '../shell/map-tool-controller.svelte';
  import type { DialogService } from '../shell/dialogs.svelte';
  import { SAMPLE_UVTT_REF, STARTER_MAP_REF } from '../assets';
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
  import { defaultCreatureRefs, nextCreatureTypeLetter, tokenRingColor } from '../tokens/labels';

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
  let addingCreature = $state(false);
  const myUid = store.currentUid();

  const spritesByToken = new Map<string, PIXI.Sprite>();
  const draggingIds = new Set<string>();

  // Managed background sprite (R15/WI-19). Held so the background can be
  // swapped or cleared live from the room doc rather than loaded once. A
  // monotonic sequence guards against out-of-order async texture loads (a fast
  // change → change could otherwise land the older texture last).
  let bgSprite: PIXI.Sprite | null = null;
  let bgLoadSeq = 0;

  // ---- subscribed map state (Map Tooling Spec §7) ----
  let floorChunks = $state<FloorChunk[]>([]);
  let fogChunks = $state<FogChunk[]>([]);
  let walls = $state<MapWall[]>([]);
  let symbols = $state<MapSymbol[]>([]);
  let mapRooms = $state<MapRoom[]>([]);
  let sightWalls = $state<SightWall[]>([]);
  let circleWalls = $state<CircleWall[]>([]);
  let lights = $state<MapLight[]>([]);
  let drawings = $state<Drawing[]>([]);
  let cursors = $state<CursorPos[]>([]);
  let pings = $state<PingPos[]>([]);
  let mapDrafts = $state<MapDraft[]>([]);

  const cellSize = $derived(map.grid.cellSize);

  // R15.1: `{ref}` renders that image; explicit `null` was cleared (bare rock);
  // absent (a pre-migration room) falls back to the starter ref.
  const backgroundRef = $derived(
    map.background === null ? null : (map.background?.ref ?? STARTER_MAP_REF),
  );
  const floorGrid = $derived(FloorGrid.fromChunks(floorChunks.map((c) => [c.id, c.bits])));
  const fogGrid = $derived(FogGrid.fromChunks(fogChunks.map((c) => [c.id, c.bits])));

  // ---- groups/combat visibility (Encounter Screen Spec §9) ----
  const mapVisibleIds = $derived(visibleTokenIds(tokens, groups, 'map'));
  // GM sees every token (hidden groups included, rendered translucent);
  // players only ever see [Map]-visible tokens.
  const renderableTokens = $derived(isGM ? tokens : tokens.filter((t) => mapVisibleIds.has(t.id)));
  const currentTurnIds = $derived(encounter ? currentActorTokenIds(encounter, groups) : new Set<string>());

  // ---- collapse-to-one-token (Master Plan v2, R8.4) ----
  // A collapsed group renders as a single stacked token at its anchor member
  // (a count bubble); its other members' sprites are hidden. Dragging the
  // anchor moves the whole formation and lands every member's new position in
  // one batched `moveTokens` write on release.
  const collapsedGroups = $derived(groups.filter((g) => g.collapsed && g.memberTokenIds.length > 0));
  const hiddenCollapsedIds = $derived.by(() => {
    const hidden = new Set<string>();
    for (const g of collapsedGroups) {
      const anchorId = groupAnchorId(g);
      for (const id of g.memberTokenIds) if (id !== anchorId) hidden.add(id);
    }
    return hidden;
  });
  /** The collapsed group this token is the anchor of, if any — read at drag
   * time so a plain (non-anchor) token still drags on its own. */
  function collapsedGroupAnchoredBy(tokenId: string): Group | null {
    return collapsedGroups.find((g) => groupAnchorId(g) === tokenId) ?? null;
  }
  let lastBatchMoveCount = $state(0);
  const badgesByGroup = new Map<string, PIXI.Container>();
  const ringsByToken = new Map<string, PIXI.Graphics>();

  // ---- dynamic line-of-sight (Plan §7 Phase 4; Map Tooling Spec §6) ----
  // Viewpoints are the tokens the viewer can see; sight is blocked by grid
  // walls (open doors excepted) + imported vector walls. Cells no viewpoint
  // can reach get fogged (players only — the GM sees the whole prepped map).
  const losViewpoints = $derived(
    renderableTokens.filter((t) => t.layer === 'tokens').map((t) => ({ x: t.pos.x, y: t.pos.y })),
  );
  const losSegments = $derived(
    map.fog.mode === 'dynamic'
      ? sightSegments({
          floorCells: floorGrid.listFloorCells(),
          isFloor: (c) => floorGrid.isFloor(c),
          walls,
          sightWalls,
          circleWalls,
          cellSize,
        })
      : [],
  );
  const dynamicHidden = $derived.by(() => {
    if (map.fog.mode !== 'dynamic') return [];
    const cells = allGridCells(map.grid.w, map.grid.h);
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
  const wallStyle = $derived<WallStyle>(ctrl.wallStyle);
  const wallErase = $derived<boolean>(ctrl.wallErase);
  const selectedSymbolKind = $derived(ctrl.selectedSymbolKind);
  const doorType = $derived(ctrl.doorType);
  const doorState = $derived(ctrl.doorState);
  const gridSnap = $derived<IntersectionSnapMode>(ctrl.gridSnap);
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

      void applyBackground(backgroundRef);

      wireStagePointerEvents(created);
      // A second finger landing mid-stroke (or space/alt/right-click pan
      // starting) means the user is panning/pinching, not drawing — drop the
      // in-progress tool stroke and block new ones until the gesture ends
      // (R1.8 touch input; U12 extends this to space-drag pan).
      created.setGestureListener((active) => {
        gestureActive = active;
        if (active) cancelActiveStroke();
      });
      ready = true;
      syncSprites(renderableTokens);
      renderAll();
    })();

    unsubs.push(store.subscribeFloorChunks(roomId, mapId, (c) => (floorChunks = c)));
    unsubs.push(store.subscribeFogChunks(roomId, mapId, (c) => (fogChunks = c)));
    unsubs.push(store.subscribeWalls(roomId, mapId, (w) => (walls = w)));
    unsubs.push(store.subscribeSymbols(roomId, mapId, (s) => (symbols = s)));
    unsubs.push(store.subscribeMapRooms(roomId, mapId, (r) => (mapRooms = r)));
    unsubs.push(store.subscribeSightWalls(roomId, mapId, (w) => (sightWalls = w)));
    unsubs.push(store.subscribeCircleWalls(roomId, mapId, (w) => (circleWalls = w)));
    unsubs.push(store.subscribeLights(roomId, mapId, (l) => (lights = l)));
    unsubs.push(store.subscribeDrawings(roomId, mapId, (d) => (drawings = d)));
    unsubs.push(store.subscribeCursors(roomId, (c) => (cursors = c)));
    unsubs.push(store.subscribePings(roomId, (p) => (pings = p)));
    unsubs.push(store.subscribeMapDraft(roomId, mapId, (d) => (mapDrafts = d)));

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
    ctrl.onExportPng = () => void exportPng();
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
    ctrl.fogMode = map.fog.mode;
  });
  $effect(() => {
    ctrl.isGM = isGM;
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeyDown);
    for (const unsub of unsubs) unsub();
    unsubs = [];
    for (const badge of badgesByGroup.values()) badge.destroy({ children: true });
    badgesByGroup.clear();
    for (const ring of ringsByToken.values()) ring.destroy();
    ringsByToken.clear();
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
    // Re-run when the token list, the collapse state, group membership, or
    // selection changes, so folding a group hides its members and draws the
    // count badge without a token edit, and the status ring (R21/WI-24)
    // updates live as group/selection/ownership change.
    void hiddenCollapsedIds;
    void collapsedGroups;
    void groups;
    void selectedTokenId;
    if (ready) syncSprites(renderableTokens);
  });

  $effect(() => {
    // Track every input this render depends on so Svelte re-runs it.
    void floorChunks;
    void walls;
    void symbols;
    void mapRooms;
    void sightWalls;
    void circleWalls;
    void map.gridSettings.subdivide;
    if (ready) renderAll();
  });

  $effect(() => {
    // Swap/clear the managed background whenever the room doc changes it
    // (R15/WI-19) — a GM Change/Remove syncs to every client through here.
    const ref = backgroundRef;
    if (ready) void applyBackground(ref);
  });

  $effect(() => {
    if (ready && engine) engine.renderAnnotations(drawings);
  });

  // "Jump to" from the Rooms manager (Master Plan v2, R17.2 / WI-20). The
  // manager sets `ctrl.jumpToMapRoomId` and switches to the Map activity; this
  // runs once the engine is ready *and* the target room is in the subscription
  // (both can land after the request), then centers the viewport and clears
  // the request so it fires exactly once.
  $effect(() => {
    const id = ctrl.jumpToMapRoomId;
    if (!id || !ready || !engine) return;
    const room = mapRooms.find((r) => r.id === id);
    if (!room) return; // wait for the mapRooms subscription to deliver it
    engine.centerOn({
      x: (room.bbox.x + room.bbox.w / 2) * cellSize,
      y: (room.bbox.y + room.bbox.h / 2) * cellSize,
    });
    ctrl.jumpToMapRoomId = null;
  });

  $effect(() => {
    void fogChunks;
    void map.fog.mode;
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

  async function applyBackground(ref: string | null): Promise<void> {
    if (!engine) return;
    const seq = ++bgLoadSeq;
    if (ref === null) {
      // Explicitly cleared → bare rock. Drop the sprite; the layer stays empty.
      bgSprite?.destroy();
      bgSprite = null;
      return;
    }
    const texture = (await PIXI.Assets.load(assets.resolve(ref))) as PIXI.Texture;
    // A newer change (or teardown) superseded this load — discard the result.
    if (seq !== bgLoadSeq || !engine) return;
    if (bgSprite) {
      bgSprite.texture = texture;
    } else {
      bgSprite = new PIXI.Sprite(texture);
      engine.layers.background.addChild(bgSprite);
    }
  }

  function renderAll(): void {
    if (!engine) return;
    engine.renderMap({
      floor: floorGrid,
      walls,
      symbols,
      mapRooms,
      sightWalls,
      circleWalls,
      isGM,
      subdivide: map.gridSettings.subdivide,
      onLabelReanchor: (id, cell) => void handleLabelReanchor(id, cell),
      onLabelEdit: (id) => startLabelEdit(id),
    });
    renderFogLayer();
  }

  /** Select-tool drag re-anchors a label (Master Plan v2, R9.5). */
  async function handleLabelReanchor(mapRoomId: string, cell: { x: number; y: number }): Promise<void> {
    const existing = mapRooms.find((r) => r.id === mapRoomId);
    if (!existing) return;
    await applyOp({
      kind: 'mapRoom',
      id: mapRoomId,
      from: existing,
      to: { ...existing, labelAnchor: cell },
    });
  }

  /** A double-click on a label opens an inline, in-place editor positioned
   * over it — no modal (Master Plan v2, R13.1). A `<textarea>` (not
   * `<input>`) so a name with embedded `\n` line breaks (still produced by
   * the multiline creation flow below) survives a round trip through the
   * editor instead of being silently stripped by `<input>`'s value
   * sanitization; Enter still commits, Shift+Enter inserts a line break. */
  let editingLabelId = $state<string | null>(null);
  let editingLabelText = $state('');
  let editingLabelPos = $state({ x: 0, y: 0 });
  let editingLabelScale = $state(1);
  let labelEditInputEl: HTMLTextAreaElement | undefined = $state();
  let labelPosLoopActive = false;

  function startLabelEdit(mapRoomId: string): void {
    const existing = mapRooms.find((r) => r.id === mapRoomId);
    if (!existing) return;
    openLabelEditor(existing);
  }

  /** Opens the in-place editor for a given room — used both for the
   * double-click-to-edit path (looked up from `mapRooms`) and immediately
   * after creating a new label, where the freshly-written room is passed
   * directly rather than re-read from the (possibly not-yet-synced)
   * `mapRooms` subscription. */
  function openLabelEditor(room: MapRoom): void {
    if (!engine) return;
    editingLabelId = room.id;
    editingLabelText = room.name;
    syncLabelEditPos(room.labelAnchor);
    if (!labelPosLoopActive) {
      labelPosLoopActive = true;
      tickLabelEditPos();
    }
  }

  function syncLabelEditPos(labelAnchor: { x: number; y: number }): void {
    if (!engine) return;
    editingLabelPos = engine.toScreen(cellCenterPixel(labelAnchor, cellSize));
    editingLabelScale = engine.world.scale.x;
  }

  // Keeps the overlay input glued to its Pixi label while pan/zoom is live,
  // since the editor is a real DOM element outside the canvas' own transform.
  // Only one chain of this ever runs at a time (`labelPosLoopActive` guards
  // re-entry from a fast edit -> commit -> edit sequence within one frame).
  function tickLabelEditPos(): void {
    const id = editingLabelId;
    if (!id || !engine) {
      labelPosLoopActive = false;
      return;
    }
    const room = mapRooms.find((r) => r.id === id);
    if (room) syncLabelEditPos(room.labelAnchor);
    requestAnimationFrame(tickLabelEditPos);
  }

  /** Commits the in-place editor. An empty (or whitespace-only) name means
   * "no label" — this deletes the room's label rather than leaving a blank
   * one behind, which also covers a just-created label left untouched. */
  async function commitLabelEdit(): Promise<void> {
    const id = editingLabelId;
    if (!id) return;
    const existing = mapRooms.find((r) => r.id === id);
    editingLabelId = null;
    if (!existing) return;
    const name = editingLabelText;
    if (name === existing.name) return;
    if (name.trim() === '') {
      await applyOp({ kind: 'mapRoom', id, from: existing, to: null });
      return;
    }
    await applyOp({ kind: 'mapRoom', id, from: existing, to: { ...existing, name } });
  }

  /** Escape cancels without saving typed text — but a label just created by
   * the label tool starts out with an empty name, so canceling it (rather
   * than blurring/committing) must remove the room instead of leaving an
   * empty, orphaned label behind. */
  function cancelLabelEdit(): void {
    const id = editingLabelId;
    editingLabelId = null;
    if (!id) return;
    const existing = mapRooms.find((r) => r.id === id);
    if (existing && existing.name === '') {
      void applyOp({ kind: 'mapRoom', id, from: existing, to: null });
    }
  }

  async function deleteLabel(): Promise<void> {
    const id = editingLabelId;
    if (!id) return;
    const existing = mapRooms.find((r) => r.id === id);
    editingLabelId = null;
    if (!existing) return;
    await applyOp({ kind: 'mapRoom', id, from: existing, to: null });
  }

  function handleLabelEditKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      labelEditInputEl?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelLabelEdit();
    }
  }

  $effect(() => {
    if (editingLabelId && labelEditInputEl) {
      labelEditInputEl.focus();
      labelEditInputEl.select();
    }
  });

  function renderFogLayer(): void {
    if (!engine) return;
    engine.renderFog({
      mode: map.fog.mode,
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
      // A collapsed group's non-anchor members fold into the anchor's stacked
      // badge, so hide their individual sprites (R8.4).
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

  /** Render-time status ring around each token (Master Plan v2, R21/WI-24):
   * white when selected or owned by the viewer, else the token's group
   * color, else black. A stroke-only overlay redrawn every sync pass —
   * separate from a gen-disc's own baked art ring (R7.1), which lives in
   * the token's texture and is never touched here. */
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
      // A collapsed group's non-anchor members hide their sprite (R8.4);
      // hide the ring alongside it rather than tearing it down.
      ring.visible = !hiddenCollapsedIds.has(token.id);
      const sprite = spritesByToken.get(token.id);
      const px = sprite ? sprite.position.x : token.pos.x;
      const py = sprite ? sprite.position.y : token.pos.y;
      const r = (TOKEN_PX * token.size) / 2;
      ring.position.set(px, py);
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

  /** Draw/refresh the count bubble sitting on each collapsed group's anchor
   * token (R8.4). Badges live in the tokens layer, keyed by group id, and
   * follow the anchor sprite's live position (so they track a drag). */
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
      const px = sprite ? sprite.position.x : anchor.pos.x;
      const py = sprite ? sprite.position.y : anchor.pos.y;
      const r = (TOKEN_PX * anchor.size) / 2;
      badge.position.set(px + r * 0.7, py - r * 0.7);
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
      // RTDB drag frames for the anchor only — a collapsed group publishes one
      // stream, not one per member (R8.4).
      store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
      // Keep the collapsed count bubble riding along with its anchor.
      if (collapsedGroupAnchoredBy(tokenId)) syncCollapsedBadges();
    });
    const stop = (e: PIXI.FederatedPointerEvent) => {
      if (!dragging) return;
      dragging = false;
      draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      // Token snapping on drop (Master Plan v2, R9.7): snap to the cell grid by
      // default, half-grid with Alt, free with Alt+Shift; the Tools rail's snap
      // toggle (`ctrl.tokenSnap`) is the base mode when no modifier is held.
      // Snapping honors the token's size so a 2×2 covers whole cells.
      const size = tokens.find((t) => t.id === tokenId)?.size ?? 1;
      const mode = snapModeFromModifiers(e.altKey, e.shiftKey, ctrl.tokenSnap);
      const snapped = snapTokenPosition(
        { x: sprite.position.x, y: sprite.position.y },
        cellSize,
        size,
        mode,
      );
      sprite.position.set(snapped.x, snapped.y);
      const collapsedGroup = collapsedGroupAnchoredBy(tokenId);
      if (collapsedGroup) {
        // One batched write of every member's new position, offsets preserved
        // (R8.4 — "batch move = one logical write burst"). The anchor lands at
        // the snapped point; each member follows at anchor + stored offset.
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

  /** Add-creature (Master Plan v2, R7.3) — replaces the old debug "drop
   * starter token" button. Opens the token picker, then places `count`
   * tokens stepping one cell to the right from `STARTER_DROP_POS` (the
   * closest approximation of "view center" that stays deterministic across
   * pan/zoom state, and keeps the first token's landing spot stable for
   * anything anchored to it), grouping them when there's more than one.
   */
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
        ? Array.from({ length: picked.count }, () => picked.ref)
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

  // ---- fog mode + .uvtt import (Plan §7 Phase 4) ----

  let importError = $state('');

  async function setFogMode(mode: GameMap['fog']['mode']): Promise<void> {
    await store.setMapFogMode(roomId, mapId, mode);
  }

  async function importUvttText(text: string): Promise<void> {
    ctrl.importing = true;
    importError = '';
    try {
      const parsed = parseUvtt(text, { cellSize });
      await store.importUvtt(roomId, mapId, { walls: parsed.walls, lights: parsed.lights });
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

  // ---- "Download map as PNG" export (Master Plan v2, R9.8) ----

  const EXPORT_MARGIN_CELLS = 1;

  /** All users get this button; only the GM's own "include hidden layer"
   * toggle can ever ask for the GM layer — a player's `includeHiddenLayer` is
   * hardcoded `false` here regardless of controller state, so nothing can
   * leak a hidden/secret-door render into a player's export (R9.8 Gate 11). */
  async function exportPng(): Promise<void> {
    if (!engine || ctrl.exportingPng) return;
    ctrl.exportingPng = true;
    try {
      const bbox = carvedBoundingBox(floorChunks);
      const frame = mapExportFrame(bbox, cellSize, EXPORT_MARGIN_CELLS);
      const blob = await engine.exportPng({
        frame,
        includeHiddenLayer: isGM && ctrl.includeHiddenLayer,
      });
      downloadBlob(blob, `${roomId}-map.png`);
    } finally {
      ctrl.exportingPng = false;
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
        if (op.to) await store.setWall(roomId, mapId, op.to);
        else await store.removeWall(roomId, mapId, op.edgeId);
        break;
      case 'wallBatch': {
        // One batch write per gesture (Master Plan v2, R9.2) — the changes
        // in a single applied op are always homogeneous (a run either adds
        // every edge or erases every edge), so this is exactly one store call.
        const toSet = op.changes.filter((c) => c.to).map((c) => c.to!);
        const toRemove = op.changes.filter((c) => !c.to).map((c) => c.edgeId);
        if (toSet.length) await store.setWalls(roomId, mapId, toSet);
        if (toRemove.length) await store.removeWalls(roomId, mapId, toRemove);
        break;
      }
      case 'sightWall':
        if (op.to) await store.addSightWall(roomId, mapId, op.to);
        else await store.removeSightWall(roomId, mapId, op.id);
        break;
      case 'circleWall':
        // Upsert by id so a "cut a gap" replace and undo/redo all replay
        // through one call (Master Plan v2, R10.5).
        if (op.to) await store.setCircleWall(roomId, mapId, op.to);
        else await store.removeCircleWall(roomId, mapId, op.id);
        break;
      case 'symbol':
        if (op.to) await store.placeSymbol(roomId, mapId, op.to);
        else await store.removeSymbol(roomId, mapId, op.id);
        break;
      case 'mapRoom':
        if (op.to) await store.upsertMapRoom(roomId, mapId, op.to);
        else await store.removeMapRoom(roomId, mapId, op.id);
        break;
      case 'mapRoomBatch':
        // A renumber/reorder (Master Plan v2, R13.3 / WI-20): every change is
        // an upsert. Transient duplicate keys mid-batch are harmless — the doc
        // id is the primary key; `key` is a display field.
        for (const c of op.changes) await store.upsertMapRoom(roomId, mapId, c.to);
        break;
      case 'tokenSize':
        await store.resizeToken(roomId, op.tokenId, op.to);
        break;
      case 'drawing':
        if (op.to) await store.writeDrawing(roomId, mapId, op.to);
        else await store.deleteDrawing(roomId, mapId, op.id);
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
    await store.commitFloorChunks(roomId, mapId, chunks);
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
    await store.commitFogChunks(roomId, mapId, chunks);
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
  // Master Plan v2, R9.2 — the Wall tool's drag-run: pointer-down snaps to
  // the nearest grid intersection, the drag world point is tracked for the
  // ghost preview, and release snaps the end intersection.
  let wallDragStart: Intersection | null = null;
  let wallDragStartWorld: { x: number; y: number } | null = null;
  // Master Plan v2, R10.5 — the Circle Wall tool: pointer-down snaps the center
  // to the nearest grid intersection, the drag sets the radius (live ghost +
  // readout), release commits. In "cut gap" (erase) mode the raw start world
  // point is a point on an existing ring and the drag sweeps the arc to erase.
  let circleDragStart: Intersection | null = null;
  let circleDragStartWorld: { x: number; y: number } | null = null;
  // Polygon carve tool (Master Plan v2, WI-5b): each click adds a lattice-
  // intersection vertex; clicking the first vertex again (≥3 vertices) closes
  // the loop and rasterizes it to floor cells via `polygonToCells`.
  let polygonPoints = $state<Intersection[]>([]);
  // A gesture (space/alt/right-click pan, touch pinch) is in progress — new
  // tool strokes are blocked until it ends (R1.8 touch input, extended here
  // to space-drag pan/U12).
  let gestureActive = false;

  /** Snaps a raw world point to the shared `gridSnap` resolution (full- or
   * half-grid) — used by the tools that aren't tied to the whole-cell wall/
   * floor model: the ruler, freehand annotation, and circle walls. */
  function snapDrawPoint(world: { x: number; y: number }): { x: number; y: number } {
    return intersectionToPixel(snapToIntersection(world, cellSize, gridSnap), cellSize);
  }

  /** Builds the `MapDoor` for the currently-selected door type/state (Master
   * Plan v2, R11.2). `oneWay` carries a `facing` (arrow direction); the other
   * types don't. Returns `null` when the type is the `none` removal sentinel. */
  function buildDoor(): MapDoor | null {
    if (doorType === 'none') return null;
    return doorType === 'oneWay'
      ? { type: doorType, state: doorState, facing: 'ab' }
      : { type: doorType, state: doorState };
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

  // ---- wall drag-run + diagonal vector walls (Master Plan v2, R9.2) ----

  function renderWallDragPreview(start: Intersection, current: Intersection): void {
    if (!engine) return;
    if (start.x === current.x && start.y === current.y) {
      engine.renderWallPreview(null);
      return;
    }
    if (isAxisAlignedRun(start, current)) {
      const segments = wallRunEdges(start, current).map((edge) => edgeSegmentPixels(edge, cellSize));
      engine.renderWallPreview(segments);
      return;
    }
    const a = intersectionToPixel(start, cellSize);
    const b = intersectionToPixel(current, cellSize);
    engine.renderWallPreview([{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }]);
  }

  /** Toggles (or, in erase mode, only removes) the single nearest edge to a
   * plain click with no drag — the pre-R9.2 behavior, kept for a quick
   * single-wall placement alongside the new drag-run interaction. */
  function toggleSingleWallEdge(world: { x: number; y: number }): void {
    const edge = nearestEdgeAt(world);
    const id = canonicalEdgeId(edge);
    const canonical = canonicalizeEdge(edge);
    const existing = walls.find((w) => w.id === id) ?? null;
    if (wallErase) {
      if (!existing) return;
      void applyOp({ kind: 'wall', edgeId: id, from: existing, to: null });
      return;
    }
    const to = existing
      ? null
      : { id, x: canonical.x, y: canonical.y, side: canonical.side, style: wallStyle };
    void applyOp({ kind: 'wall', edgeId: id, from: existing, to });
  }

  /** Axis-aligned drag: decomposes into the run's edges and commits every
   * change as one batch op (Master Plan v2, R9.2 — "wall run = one gesture,
   * one batch write"). Normal mode only adds edges that don't already exist;
   * erase mode only removes edges that do. */
  async function applyWallRun(edges: { x: number; y: number; side: 'N' | 'E' | 'S' | 'W' }[]): Promise<void> {
    type WallChange = { edgeId: string; from: MapWall | null; to: MapWall | null };
    const changes: WallChange[] = [];
    for (const edge of edges) {
      const id = canonicalEdgeId(edge);
      const canonical = canonicalizeEdge(edge);
      const existing = walls.find((w) => w.id === id) ?? null;
      if (wallErase) {
        if (existing) changes.push({ edgeId: id, from: existing, to: null });
      } else if (!existing) {
        changes.push({
          edgeId: id,
          from: null,
          to: { id, x: canonical.x, y: canonical.y, side: canonical.side, style: wallStyle },
        });
      }
    }
    if (changes.length === 0) return;
    await applyOp({ kind: 'wallBatch', changes });
  }

  const DIAGONAL_MATCH_EPS = 0.5;

  function matchesDiagonal(sw: SightWall, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    const close = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.abs(p.x - q.x) < DIAGONAL_MATCH_EPS && Math.abs(p.y - q.y) < DIAGONAL_MATCH_EPS;
    const swA = { x: sw.ax, y: sw.ay };
    const swB = { x: sw.bx, y: sw.by };
    return (close(swA, a) && close(swB, b)) || (close(swA, b) && close(swB, a));
  }

  /** Diagonal (non-axis-aligned) drag: a vector wall, stored as a `SightWall`
   * with `visible: true` and the active wall style (Master Plan v2, R9.2). It
   * already blocks LoS (`sightSegments` doesn't filter on `visible`). */
  async function applyDiagonalWall(start: Intersection, end: Intersection): Promise<void> {
    const a = intersectionToPixel(start, cellSize);
    const b = intersectionToPixel(end, cellSize);
    if (wallErase) {
      const match = sightWalls.find((sw) => sw.visible && matchesDiagonal(sw, a, b));
      if (!match) return;
      await applyOp({ kind: 'sightWall', id: match.id, from: match, to: null });
      return;
    }
    const id = `sw-${Date.now()}`;
    const wall: SightWall = { id, ax: a.x, ay: a.y, bx: b.x, by: b.y, visible: true, style: wallStyle };
    await applyOp({ kind: 'sightWall', id, from: null, to: wall });
  }

  // ---- circular walls (Master Plan v2, R10.5) ----

  /** A ring smaller than this fraction of a cell is treated as an accidental
   * click, not a wall — nothing is committed. */
  const MIN_CIRCLE_RADIUS_FRAC = 0.3;

  /** Commit a new circular wall from a center intersection + a release point
   * that sets the radius. Placed with the currently-selected wall style. The
   * radius snaps to the same full/half-grid resolution as the center, so the
   * ring lands on a predictable size instead of the raw drag distance. */
  async function commitCircleWall(centerIx: Intersection, endWorld: { x: number; y: number }): Promise<void> {
    const center = intersectionToPixel(centerIx, cellSize);
    const rawR = Math.hypot(endWorld.x - center.x, endWorld.y - center.y);
    if (rawR < cellSize * MIN_CIRCLE_RADIUS_FRAC) return;
    const r = snapRadius(rawR, cellSize, gridSnap);
    const id = `cw-${Date.now()}`;
    const circle: CircleWall = { id, cx: center.x, cy: center.y, r, style: wallStyle };
    await applyOp({ kind: 'circleWall', id, from: null, to: circle });
  }

  /** The existing ring whose circumference passes nearest a world point, or
   * `null` if the point isn't close to any ring — used by the cut-gap erase. */
  function nearestCircleWall(p: { x: number; y: number }): CircleWall | null {
    let best: CircleWall | null = null;
    let bestErr = Infinity;
    for (const c of circleWalls) {
      const err = Math.abs(Math.hypot(p.x - c.cx, p.y - c.cy) - c.r);
      if (err < bestErr) {
        bestErr = err;
        best = c;
      }
    }
    return best && bestErr <= cellSize * 0.5 ? best : null;
  }

  /** Cut a gap into the nearest ring (Master Plan v2, R10.5b): a drag along the
   * ring erases the swept arc, mirroring the line-wall erase. The gap is the
   * shorter arc between the drag's start and end angles, stored CCW as an open
   * span; a cut gap passes LoS and movement. Undoable as one op. The target
   * ring is found from the raw drag points (a snapped point could land too far
   * from the ring to hit-test), but the angle that defines the gap's edges is
   * computed from the grid-snapped points, so the cut lands on a predictable
   * boundary instead of the exact raw pixel under the cursor. */
  async function cutCircleGap(
    startWorld: { x: number; y: number },
    endWorld: { x: number; y: number },
  ): Promise<void> {
    const target = nearestCircleWall(startWorld);
    if (!target) return;
    const a1 = angleAt(target, snapDrawPoint(startWorld));
    const a2 = angleAt(target, snapDrawPoint(endWorld));
    if (a1 === a2) return;
    // Pick whichever direction the drag actually swept (the shorter arc).
    const span12 = normalizeAngle(a2 - a1);
    const span21 = normalizeAngle(a1 - a2);
    const gap: Arc = span12 <= span21 ? { start: a1, end: a2 } : { start: a2, end: a1 };
    const to: CircleWall = { ...target, gaps: [...(target.gaps ?? []), gap] };
    await applyOp({ kind: 'circleWall', id: target.id, from: target, to });
  }

  function finalizeWallDrag(start: Intersection, end: Intersection, downWorld: { x: number; y: number }): void {
    if (start.x === end.x && start.y === end.y) {
      toggleSingleWallEdge(downWorld);
      return;
    }
    if (isAxisAlignedRun(start, end)) {
      void applyWallRun(wallRunEdges(start, end));
      return;
    }
    void applyDiagonalWall(start, end);
  }

  function wireStagePointerEvents(mapEngine: MapEngine): void {
    const stage = mapEngine.app.stage;

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (e.target !== stage) return; // token sprites handle their own events
      if (gestureActive) return; // a pan/pinch gesture owns this pointer
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
    if (activeTool === 'corridor') return corridorCells(a, b);
    if (activeTool === 'ellipse') return ellipseToCells(a, b);
    return rectToCells(a, b);
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
      // Master Plan v2, R9.2: pointer-down snaps to the nearest grid
      // intersection and starts a drag-run; the raw world point is kept too
      // so a plain click (no drag) can still fall back to the pre-R9.2
      // single-edge toggle via `nearestEdgeAt`.
      wallDragStart = snapToIntersection(world, cellSize);
      wallDragStartWorld = world;
      strokeActive = true;
      renderWallDragPreview(wallDragStart, wallDragStart);
      return;
    }
    if (activeTool === 'wallCircle') {
      // Master Plan v2, R10.5: pointer-down sets the center (snapped to the
      // nearest intersection); the drag sizes the radius. The raw world point
      // is also kept so cut-gap (erase) mode can read the ring point directly.
      circleDragStart = snapToIntersection(world, cellSize, gridSnap);
      circleDragStartWorld = world;
      strokeActive = true;
      engine?.renderCirclePreview(null);
      return;
    }
    if (activeTool === 'door') {
      // Master Plan v2, R11.2: the Door tool no longer cycles — it stamps the
      // palette's selected type on the nearest segment (`none` removes it).
      const edge = nearestEdgeAt(world);
      const id = canonicalEdgeId(edge);
      const canonical = canonicalizeEdge(edge);
      const existing = walls.find((w) => w.id === id) ?? null;
      const door = buildDoor();
      // Preserve any own wall style so adding/removing a door never wipes it.
      const base = { id, x: canonical.x, y: canonical.y, side: canonical.side };
      const styled = existing?.style ? { ...base, style: existing.style } : base;
      let to: MapWall | null;
      if (door) {
        to = { ...styled, door };
      } else {
        // `none`: drop the door. Keep the wall only if it carries its own
        // style; otherwise the segment existed just for the door, so remove it.
        if (!existing?.door) return; // nothing to remove
        to = existing.style ? styled : null;
      }
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
    if (activeTool === 'polygon') {
      // Each click snaps to the nearest grid intersection and adds a vertex;
      // clicking the first vertex again closes and rasterizes the polygon.
      const vertex = snapToIntersection(world, cellSize);
      const first = polygonPoints[0];
      if (first && polygonPoints.length >= 3 && vertex.x === first.x && vertex.y === first.y) {
        finalizePolygon();
        return;
      }
      // Ignore an immediate duplicate click on the current last vertex.
      const last = polygonPoints[polygonPoints.length - 1];
      if (last && last.x === vertex.x && last.y === vertex.y) return;
      polygonPoints = [...polygonPoints, vertex];
      if (polygonPoints.length >= 3) publishDraft(polygonToCells(polygonPoints));
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
      // Creation opens the same in-place editor used for edits (no modal
      // dialog) — the room is written with an empty name, then the overlay
      // textarea opens on top of it immediately for the name to be typed in.
      const style = wallStyle;
      const newRoom: MapRoom = { id, key, name: '', bbox, labelAnchor: cell, wallStyle: style };
      void (async () => {
        await applyOp({ kind: 'mapRoom', id, from: null, to: newRoom });
        openLabelEditor(newRoom);
      })();
      return;
    }

    if (activeTool === 'ruler') {
      rulerFrom = snapDrawPoint(world);
      rulerText = '';
      strokeActive = true;
      return;
    }
    if (activeTool === 'annotate') {
      // Freehand — deliberately unsnapped, unlike the ruler/circle-wall tools
      // below: forcing every sampled point onto the grid would turn a smooth
      // sketch into a jagged staircase.
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
      const to = snapDrawPoint(world);
      const measure = map.measure;
      const measurement = measureRuler(rulerFrom, to, cellSize, measure.perSquare);
      rulerText = `${measurement.squares} sq / ${measurement.distance} ${measure.unit}`;
      engine.renderRuler(rulerFrom, to, rulerText);
      return;
    }
    if (activeTool === 'annotate') {
      annotatePoints = [...annotatePoints, world];
      return;
    }
    if (activeTool === 'wall') {
      if (!wallDragStart) return;
      const current = snapToIntersection(world, cellSize);
      renderWallDragPreview(wallDragStart, current);
      return;
    }
    if (activeTool === 'wallCircle') {
      if (!circleDragStartWorld || !circleDragStart || !engine) return;
      if (wallErase) {
        // A hint line across the ring shows the arc span being cut — snapped
        // to match the angle `cutCircleGap` will actually commit.
        const a = snapDrawPoint(circleDragStartWorld);
        const b = snapDrawPoint(world);
        engine.renderWallPreview([{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }]);
        return;
      }
      const center = intersectionToPixel(circleDragStart, cellSize);
      const rawR = Math.hypot(world.x - center.x, world.y - center.y);
      const r = snapRadius(rawR, cellSize, gridSnap);
      engine.renderCirclePreview({ cx: center.x, cy: center.y, r, label: `r ${(r / cellSize).toFixed(1)} sq` });
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
    if (
      activeTool === 'carve' ||
      activeTool === 'fill' ||
      activeTool === 'corridor' ||
      activeTool === 'ellipse'
    ) {
      publishDraft(previewCellsFor(cellStartWorld(), world));
      if (activeTool === 'carve' || activeTool === 'fill' || activeTool === 'ellipse') {
        updateDimHud(cellStartWorld(), world);
      }
    }
  }

  /** Master Plan v2, R12: live `W × H` (cells) readout centered on the
   * carve/fill/ellipse drag rectangle. Purely local — no draft/persistence
   * writes; cleared on `handleToolEnd`. */
  function updateDimHud(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!engine) return;
    const a = pixelToCell(start, cellSize);
    const b = pixelToCell(end, cellSize);
    const w = Math.abs(b.x - a.x) + 1;
    const h = Math.abs(b.y - a.y) + 1;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    engine.renderDimHud(center, `${w} × ${h}`);
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
    if (activeTool === 'wall') {
      if (wallDragStart) {
        const end = snapToIntersection(world, cellSize);
        finalizeWallDrag(wallDragStart, end, wallDragStartWorld ?? world);
      }
      wallDragStart = null;
      wallDragStartWorld = null;
      engine?.renderWallPreview(null);
      strokeActive = false;
      return;
    }
    if (activeTool === 'wallCircle') {
      if (circleDragStart && circleDragStartWorld) {
        if (wallErase) void cutCircleGap(circleDragStartWorld, world);
        else void commitCircleWall(circleDragStart, world);
      }
      circleDragStart = null;
      circleDragStartWorld = null;
      engine?.renderCirclePreview(null);
      engine?.renderWallPreview(null);
      strokeActive = false;
      return;
    }
    if (activeTool === 'carve' || activeTool === 'fill' || activeTool === 'ellipse') {
      const cells = previewCellsFor(cellStartWorld(), world);
      // carve + ellipse carve floor; fill clears it.
      void applyOp(buildFloorOp(floorGrid, cells, activeTool !== 'fill').op);
      clearDraft();
      engine?.renderDimHud(null, null);
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
    wallDragStart = null;
    wallDragStartWorld = null;
    circleDragStart = null;
    circleDragStartWorld = null;
    engine?.renderWallPreview(null);
    engine?.renderCirclePreview(null);
    engine?.renderDimHud(null, null);
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
    store.publishMapDraft(roomId, mapId, { uid: myUid, tool: activeTool, cells, ts: Date.now() });
  }

  function clearDraft(): void {
    if (!myUid) return;
    store.clearMapDraft(roomId, mapId, myUid);
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

  /** Close the in-progress polygon: rasterize its lattice-vertex loop to floor
   * cells and carve them as one undoable op (Master Plan v2, WI-5b). */
  function finalizePolygon(): void {
    if (polygonPoints.length >= 3) {
      const cells = polygonToCells(polygonPoints);
      if (cells.length) void applyOp(buildFloorOp(floorGrid, cells, true).op);
    }
    polygonPoints = [];
    clearDraft();
  }

  // Abandon any half-drawn polygon when the user switches away from the tool.
  $effect(() => {
    if (activeTool !== 'polygon' && polygonPoints.length) {
      polygonPoints = [];
      clearDraft();
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
    {#if isGM}
      <button
        class="add-creature"
        data-testid="add-creature"
        onclick={() => void addCreature()}
        disabled={addingCreature}
        title="Pick a token/portrait, a count, and (optionally) a group name"
      >
        + Add creature
      </button>
    {/if}
    <TurnStrip {encounter} {groups} {tokens} />

    {#if editingLabelId}
      <div
        class="label-editor"
        style={`left:${editingLabelPos.x}px; top:${editingLabelPos.y}px; --label-editor-scale:${editingLabelScale};`}
      >
        <textarea
          bind:this={labelEditInputEl}
          bind:value={editingLabelText}
          data-testid="label-edit-input"
          rows={editingLabelText.split('\n').length}
          onblur={() => void commitLabelEdit()}
          onkeydown={handleLabelEditKeydown}
        ></textarea>
        <button
          type="button"
          class="label-delete"
          data-testid="label-delete"
          title="Delete label"
          onmousedown={(e) => e.preventDefault()}
          onclick={() => void deleteLabel()}
        >
          ×
        </button>
      </div>
    {/if}
  </div>

  <div class="readouts" aria-hidden="true">
    {#each renderableTokens as token (token.id)}
      <span data-testid={`token-pos-${token.id}`}
        >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
      >
      <span data-testid={`token-size-${token.id}`}>{token.size}</span>
      <span data-testid={`token-current-${token.id}`}>{currentTurnIds.has(token.id)}</span>
      <span data-testid={`token-ring-${token.id}`}>{tokenRingColor(token, groups, selectedTokenId, myUid)}</span>
    {/each}
    <span data-testid="floor-cell-count">{floorCellCount}</span>
    <span data-testid="wall-count">{wallCount}</span>
    <span data-testid="dashed-wall-count">{walls.filter((w) => w.style === 'dashed').length}</span>
    <span data-testid="revealed-count">{revealedCount}</span>
    <span data-testid="ping-count">{pingCount}</span>
    <span data-testid="peer-cursor-count">{cursors.filter((c) => c.uid !== myUid).length}</span>
    <span data-testid="ruler-distance">{rulerText}</span>
    <span data-testid="visible-door-count"
      >{walls.filter((w) => w.door && !(w.door.type === 'secret' && !isGM)).length}</span
    >
    <span data-testid="sight-wall-count">{sightWallCount}</span>
    <span data-testid="circle-wall-count">{circleWalls.length}</span>
    <span data-testid="light-count">{lights.length}</span>
    <span data-testid="los-hidden-count">{losHiddenCount}</span>
    <span data-testid="fog-mode">{map.fog.mode}</span>
    <span data-testid="measure-summary">{map.measure.perSquare}/{map.measure.unit}</span>
    <span data-testid="grid-subdivide">{map.gridSettings.subdivide}</span>
    <span data-testid="last-batch-move-count">{lastBatchMoveCount}</span>
    {#each collapsedGroups as g (g.id)}
      <span data-testid={`collapsed-group-${g.id}`}>{g.memberTokenIds.length}</span>
    {/each}
    {#each mapRooms as r (r.id)}
      <span data-testid={`maproom-name-${r.id}`}>{r.name}</span>
      <span data-testid={`maproom-label-x-${r.id}`}>{cellCenterPixel(r.labelAnchor, cellSize).x}</span>
      <span data-testid={`maproom-label-y-${r.id}`}>{cellCenterPixel(r.labelAnchor, cellSize).y}</span>
    {/each}
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
  .add-creature {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
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
  .label-editor {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    /* Scales with the map's current zoom so the editor stays sized like the
       Pixi label it's covering (Master Plan v2, R13.1) — --label-editor-scale
       is set from the world container's live scale in MapView's script. */
    transform: translate(-50%, -50%) scale(var(--label-editor-scale, 1));
    transform-origin: center;
  }
  .label-editor textarea {
    box-sizing: border-box;
    min-width: 8rem;
    max-width: 16rem;
    resize: none;
    overflow: hidden;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 2px solid var(--accent);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
    font-size: 0.8rem;
    line-height: 1.3;
    text-align: center;
  }
  .label-delete {
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--failure);
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
  }
</style>
