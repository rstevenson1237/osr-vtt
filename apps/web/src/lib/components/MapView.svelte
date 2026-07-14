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
    measureRuler,
    parseChunkId,
    parseUvtt,
    pixelToCell,
    polygonToCells,
    rectToCells,
    sightSegments,
    snapModeFromModifiers,
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
  import { defaultCreatureRefs } from '../tokens/labels';

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
  let addingCreature = $state(false);
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
  const wallErase = $derived<boolean>(ctrl.wallErase);
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
    for (const badge of badgesByGroup.values()) badge.destroy({ children: true });
    badgesByGroup.clear();
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
    // Re-run when the token list *or* the collapse state changes, so folding a
    // group hides its members and draws the count badge without a token edit.
    void hiddenCollapsedIds;
    void collapsedGroups;
    if (ready) syncSprites(renderableTokens);
  });

  $effect(() => {
    // Track every input this render depends on so Svelte re-runs it.
    void floorChunks;
    void walls;
    void symbols;
    void mapRooms;
    void sightWalls;
    void room.settings.grid.subdivide;
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
    engine.renderMap({
      floor: floorGrid,
      walls,
      symbols,
      mapRooms,
      sightWalls,
      isGM,
      subdivide: room.settings.grid.subdivide,
      onLabelReanchor: (id, cell) => void handleLabelReanchor(id, cell),
      onLabelEdit: (id) => void handleLabelEdit(id),
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

  /** A tap (no drag) on a label opens the shell dialog to edit its text
   * (Master Plan v2, R9.5 — replaces `window.prompt`, U10). */
  async function handleLabelEdit(mapRoomId: string): Promise<void> {
    const existing = mapRooms.find((r) => r.id === mapRoomId);
    if (!existing) return;
    const name = await dialogs.promptText({
      title: 'Room name',
      label: 'Room name (use a new line for a line break)',
      initial: existing.name,
      confirmLabel: 'Save',
      multiline: true,
    });
    if (name === null) return;
    await applyOp({ kind: 'mapRoom', id: mapRoomId, from: existing, to: { ...existing, name } });
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
    syncCollapsedBadges();
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
    const picked = await dialogs.pickToken({
      title: 'Add creature',
      roomId,
      mode: 'creature',
      confirmLabel: 'Add',
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
      case 'wallBatch': {
        // One batch write per gesture (Master Plan v2, R9.2) — the changes
        // in a single applied op are always homogeneous (a run either adds
        // every edge or erases every edge), so this is exactly one store call.
        const toSet = op.changes.filter((c) => c.to).map((c) => c.to!);
        const toRemove = op.changes.filter((c) => !c.to).map((c) => c.edgeId);
        if (toSet.length) await store.setWalls(roomId, toSet);
        if (toRemove.length) await store.removeWalls(roomId, toRemove);
        break;
      }
      case 'sightWall':
        if (op.to) await store.addSightWall(roomId, op.to);
        else await store.removeSightWall(roomId, op.id);
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
  // Master Plan v2, R9.2 — the Wall tool's drag-run: pointer-down snaps to
  // the nearest grid intersection, the drag world point is tracked for the
  // ghost preview, and release snaps the end intersection.
  let wallDragStart: Intersection | null = null;
  let wallDragStartWorld: { x: number; y: number } | null = null;
  // Polygon carve tool (Master Plan v2, WI-5b): each click adds a lattice-
  // intersection vertex; clicking the first vertex again (≥3 vertices) closes
  // the loop and rasterizes it to floor cells via `polygonToCells`.
  let polygonPoints = $state<Intersection[]>([]);
  // A gesture (space/alt/right-click pan, touch pinch) is in progress — new
  // tool strokes are blocked until it ends (R1.8 touch input, extended here
  // to space-drag pan/U12).
  let gestureActive = false;

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
    const to = existing ? null : { id, x: canonical.x, y: canonical.y, side: canonical.side };
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
          to: { id, x: canonical.x, y: canonical.y, side: canonical.side },
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
      // Shell dialog replaces window.prompt (Master Plan v2, R1.6 / U10);
      // multiline so an explicit `\n` produces a real line break (R9.5).
      const style = wallStyle;
      void (async () => {
        const name =
          (await dialogs.promptText({
            title: 'Room name',
            label: 'Room name (optional — use a new line for a line break)',
            confirmLabel: 'Add label',
            multiline: true,
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
      const measure = room.settings.measure;
      const measurement = measureRuler(rulerFrom, world, cellSize, measure.perSquare);
      rulerText = `${measurement.squares} sq / ${measurement.distance} ${measure.unit}`;
      engine.renderRuler(rulerFrom, world, rulerText);
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
    if (activeTool === 'carve' || activeTool === 'fill' || activeTool === 'ellipse') {
      const cells = previewCellsFor(cellStartWorld(), world);
      // carve + ellipse carve floor; fill clears it.
      void applyOp(buildFloorOp(floorGrid, cells, activeTool !== 'fill').op);
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
    wallDragStart = null;
    wallDragStartWorld = null;
    engine?.renderWallPreview(null);
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
    <span data-testid="measure-summary">{room.settings.measure.perSquare}/{room.settings.measure.unit}</span>
    <span data-testid="grid-subdivide">{room.settings.grid.subdivide}</span>
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
</style>
