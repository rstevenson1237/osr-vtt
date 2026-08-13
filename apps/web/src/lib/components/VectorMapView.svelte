<script lang="ts">
  import { getContext, onDestroy, onMount, tick } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    vectorMap,
    buildVectorScene,
    canActOnToken,
    collapsedDragUpdates,
    currentActorTokenIds,
    groupAnchorId,
    isHexMap,
    snapModeFromModifiers,
    snapTokenPosition,
    visibleTokenIds,
    type AssetStore,
    type CampaignStore,
    type Drawing,
    type Encounter,
    type GameMap,
    type Group,
    type MapBackground,
    type MapRoom,
    type MapSymbol,
    type Room,
    type StoredVectorWall,
    type Token,
    type VectorDoor,
    type VectorFloorRegion,
  } from '@osr-vtt/shared';
  import { defaultCreatureRefs, nextCreatureTypeLetter, tokenRingColor } from '../tokens/labels';
  import { hasTokenDrag, readTokenDrag } from '../tokens/drag';
  import { loadImageElement } from '../tokens/texture-load';
  import type { DialogService } from '../shell/dialogs.svelte';
  import {
    ASSET_STORE_KEY,
    CAMPAIGN_STORE_KEY,
    DIALOG_KEY,
    MAP_TOOL_KEY,
    ROOM_NOTES_KEY,
  } from '../context';
  import type { RoomNotesDoc } from '../collab/room-notes.svelte';
  import MarkdownView from './MarkdownView.svelte';
  import { createVectorMapEngine, type VectorMapEngine } from '../map/vector-engine';
  import { applyTheme, hexToNumber, readMapTheme, resolveThemeName } from '../theme';
  import {
    carveKind,
    isFogCarve,
    isSelectTool,
    MapToolController,
    type MapToolId,
  } from '../shell/map-tool-controller.svelte';
  import { cursorForTool } from '../map/tool-groups';
  import {
    backgroundHitTest,
    backgroundRectChanged,
    moveBackground,
    resizeBackground,
    type BgRect,
  } from '../map/background-transform';
  import { UndoStack } from '../map/undo';
  import {
    attractsToVertex,
    buildCarveOp,
    buildDoorPreviewSeg,
    buildDragOp,
    buildFloorStroke,
    buildFogCarveOp,
    buildHandleRemovalOp,
    buildWallPreviewSegs,
    buildWallRunOp,
    captureMeasureText,
    commitVectorOpForward,
    distToSeg,
    exceedsMaxFloorExtent,
    findOwnerRecord,
    invertVectorOp,
    isCellAnchoredTool,
    isNoopVectorOp,
    lassoBBox,
    lassoSelect,
    latchBendAxis,
    MAX_FLOOR_EXTENT,
    nextVectorId,
    objectBounds,
    ownerKey,
    pickMapRoomAt,
    pickNoteDotAt,
    pickObject,
    pickPx,
    pickVertexHandle,
    recomputeRegionBBox,
    sameHandle,
    strokeBBoxOf,
    targetedBandFor,
    targetedCellFor,
    measureSpanText,
    strokeMeasureText,
    vertexHandles,
    type FloorPrimitiveTool,
    type Handle,
    type HandleOwner,
    type ObjectCatalog,
    type ObjectSelection,
    type OwnerRecord,
    type Point,
    type StrokeMeasure,
    type VectorEditorOp,
  } from '../map/vector-tools';
  import {
    battleCameraBounds,
    displayPerSquare,
    gridStepPx,
    isBattleMap,
  } from '../map/battle-map';

  /**
   * The Vector Map production editor (WI-D — docs/VTT_Master_Plan.md Part IV
   * step 6). Ports the proven POC interactions (originally
   * `poc/vector-floor/sandbox/src/app.ts`, since deleted) onto the real
   * `CampaignStore` via `vector-tools.ts`'s op model and `vector-engine.ts`'s
   * Pixi renderer, instead of the sandbox's in-memory `MapState`.
   *
   * The ONLY map view (WI-D pure-rollout cutover, `docs/VTT_Master_Plan.md` Part V §2
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
   *    `pen` tool (freehand; text-annotation authoring not yet exposed).
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
    selectedActorId = null,
    presentSeatIds = new Set<string>(),
    isCoarsePointer = false,
    onSelectActor,
  }: {
    roomId: string;
    mapId: string;
    map: GameMap;
    room: Room;
    tokens: Token[];
    groups: Group[];
    encounter: Encounter | null;
    isGM: boolean;
    /** The actor currently raised in the Character sheet — a seat id for a
     * character, a token id for a creature (SPEC-032 §2). Surfaced as a readout
     * so the e2e suite can assert what a token click did. */
    selectedActorId?: string | null;
    /** Seats with live presence (R26.1). A token whose owning seat is absent
     * renders dimmed with an "away" badge — display only; it stays exactly
     * where it is and stays draggable by anyone who could already move it. */
    presentSeatIds?: ReadonlySet<string>;
    /**
     * Whether the primary pointer is coarse (SPEC-033 §§4/7) — `ShellMedia`'s
     * input signal, threaded from `RoomShell`, which owns the single
     * `createShellMedia()` instance. Distinct from `isNarrow`: this is "is this
     * a finger?", not "is this the mobile layout?" (DEC-052).
     *
     * The stage is a Pixi bitmap, so no CSS media query reaches it and every
     * touch accommodation on this canvas hangs off this one boolean: the note
     * dot renders, `PICK_PX` widens, and vertex handles draw at their enlarged
     * radius. False — the default, and what every non-`RoomShell` mount gets —
     * is pixel-identical to the behaviour before SPEC-033 §4.
     */
    isCoarsePointer?: boolean;
    /** Raise an actor's sheet, exactly as clicking their card on the Encounter
     * board does. Called when a token linked to a character is picked up. */
    onSelectActor: (actorId: string) => void;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const myUid = store.currentUid();
  /**
   * `mapId` captured once, for use in teardown.
   *
   * Props are lazy getters in Svelte 5, and the caller passes `mapId={map.id}`
   * from state it sets to `null` when re-subscribing. Reading the prop from
   * `onDestroy` therefore evaluates `null.id` and throws *during* teardown,
   * which destroys the stage subtree without rebuilding it — the map area then
   * stays blank until reload. This component is keyed on `roomId:map.id`, so
   * the id is constant for its lifetime and capturing it here is equivalent
   * for every non-teardown use, and safe for teardown.
   */
  // eslint-disable-next-line svelte/valid-compile
  const ownMapId = mapId;
  /** Shared with `ToolsRail`'s `MapToolPalette` (DECISIONS.md WI-D D4): the
   * existing symbol/label authoring tools are reused as-is rather than
   * reimplemented inline here. A click on the canvas while `symbol`/`label`
   * is active places/edits a `MapSymbol`/`MapRoom` directly against the
   * unchanged store collections (SPEC §2.2). */
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);
  /** The per-map-room players' notes (a Yjs doc, see `collab/room-notes`) — the
   * long-form description behind a label. Optional: `RoomShell` provides it, but
   * this component is also mounted in isolation by tests. */
  const roomNotes = getContext<RoomNotesDoc | undefined>(ROOM_NOTES_KEY);

  let hostEl: HTMLDivElement;
  let engine: VectorMapEngine | null = null;
  let ready = $state(false);

  /** One sprite per placed background image (SPEC-038 §2), keyed by document
   * id — the generalization of the single origin-anchored, native-size sprite
   * this used to hold. Not `$state`: these are Pixi display objects the render
   * pass owns, exactly like the token sprite cache. */
  let bgSprites = new Map<string, PIXI.Sprite>();
  let bgLoadSeq = 0;

  // ---- subscribed state ----
  let regions = $state<VectorFloorRegion[]>([]);
  /** Fog of war's *revealed* geometry (SPEC §4) — same doc shape as `regions`,
   * a separate collection. Everything outside this is fogged when the map has
   * fog enabled. */
  let fogRegions = $state<VectorFloorRegion[]>([]);
  let walls = $state<StoredVectorWall[]>([]);
  let doors = $state<VectorDoor[]>([]);
  let symbols = $state<MapSymbol[]>([]);
  /** Placed background images (SPEC-038 §1), lowest `order` painted first. */
  let backgrounds = $state<MapBackground[]>([]);
  let mapRooms = $state<MapRoom[]>([]);
  let drawings = $state<Drawing[]>([]);

  // In-progress freehand Pen stroke, pixel-space (not lattice-snapped — a note
  // stroke should follow the pointer smoothly). Non-reactive per-frame buffer,
  // like the floor-stroke state above; rendered via `renderAll`.
  let penPoints: { x: number; y: number }[] = [];
  /** The Measure tool's in-progress span, lattice space. A plain per-frame local
   * like the stroke state above, for the same reason (`renderAll` reads it every
   * frame and several `$effect`s call `renderAll`); the DOM readout goes through
   * the `strokeMeasureText_` string mirror. Nulled on pointer-up, which is what
   * makes both the ruler line and its chip disappear. */
  let measureDrag: { a: Point; b: Point } | null = null;
  let lastCursorPublish = 0;

  const cellSize = $derived(map.grid.cellSize);
  // The three render-time differences a battle map takes on (SPEC-029 §4), all
  // derived from `map.battle` rather than stored — see `map/battle-map.ts`.
  // The lattice space itself is untouched: only the grid the viewer sees, what
  // one of its squares is worth, and how far the camera may travel.
  const battleMap = $derived(isBattleMap(map));
  /** `GameMap.hex` when this map is a hex crawl, `null` when it is an ordinary
   * square-grid map (SPEC-030 §1). Its presence is the map's grid kind, and
   * `hex.size` — not `grid.cellSize` — is its render-time multiplier
   * (RULE-006), so it is read here through `isHexMap` and nowhere else in this
   * component reaches for `map.hex` directly. */
  const hexGrid = $derived(isHexMap(map) ? (map.hex ?? null) : null);
  const gridCellSize = $derived(gridStepPx(map, cellSize));
  const cameraBounds = $derived(battleCameraBounds(map, cellSize));
  // `GameMap.background` is the solid clear colour alone since v23 (SPEC-038
  // §1) — `{ color }` fills the stage with it, `null`/absent shows bare rock.
  // Background *images* are `backgrounds` documents and render as sprites
  // below; the colour shows through wherever none covers it.
  const backgroundState = $derived<{ kind: 'color'; color: string } | { kind: 'none' }>(
    map.background ? { kind: 'color', color: map.background.color } : { kind: 'none' },
  );
  /** Paint order: ascending `order`, ties broken by id so two images written
   * with the same `order` still stack the same way on every client. */
  const orderedBackgrounds = $derived(
    [...backgrounds].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  );
  /** The background the Assets activity has selected for transforming
   * (SPEC-038 §§3–4), if it is still on this map. GM-only (DEC-063): a player
   * never gets the overlay, and never gets the pointer interception either. */
  const selectedBackground = $derived(
    isGM ? (backgrounds.find((b) => b.id === mapCtrl.selectedBackgroundId) ?? null) : null,
  );
  const scene = $derived(buildVectorScene(regions, walls, doors));

  // ---- tool state ----
  // Every tool (`select`…`ping`, plus the reused `symbol`/`label` authoring
  // tools) is one catalog now, held on the shared `MapToolController` so the
  // Tools-rail `MapToolbar` and this canvas's own keyboard shortcuts read and
  // write the same state — a click in the rail and a shortcut here can never
  // disagree, because there is only one value. `tool`/`carveMode`/`snapMode`/
  // `width`/`sides`/`tolerance`/`selectedDoorArt` below are
  // read-only aliases into `mapCtrl`; `MapToolbar` is what mutates them (via
  // its `$bindable` props).
  type ToolId = MapToolId;
  const FLOOR_TOOLS: ToolId[] = ['room', 'corridor', 'path', 'polygon', 'ngon', 'carve'];
  // Tools whose next click snaps to a lattice vertex — matches MapToolbar's
  // `SNAP_TOOLS` (the tools that show the Snap mode selector). `symbol` is
  // deliberately excluded: it places by cell-floor, not vertex-snap (Phase B).
  const SNAP_CURSOR_TOOLS: ToolId[] = [
    'room',
    'corridor',
    'path',
    'polygon',
    'ngon',
    'carve',
    'wall',
    'door',
  ];

  const tool = $derived(mapCtrl.activeTool);
  const carveMode = $derived(mapCtrl.carveMode);
  const snapMode = $derived(mapCtrl.snapMode);
  const width = $derived(mapCtrl.width);
  const bandWidth = $derived(mapCtrl.bandWidth);
  const sides = $derived(mapCtrl.sides);
  const tolerance = $derived(mapCtrl.tolerance);
  const selectedDoorArt = $derived(mapCtrl.selectedDoorArt);
  const selecting = $derived(isSelectTool(tool));
  /** True while a carve tool is pointed at `fogRegions` rather than the floor
   * (SPEC §4) — the carve-mode replacement for the retired Reveal/Hide tools.
   * Referee-only, and only while the map actually has fog on: a stale `fog`
   * carve mode (fog switched off from Session settings, or a player who
   * somehow holds one) falls back to carving floor rather than writing fog
   * geometry it isn't allowed to. */
  const fogCarve = $derived(
    isFogCarve(carveMode) && isGM && (map.fog?.enabled ?? false) && FLOOR_TOOLS.includes(tool),
  );
  /** `subtract` for the two "take material away" modes (Rock, Fog: hide). */
  const carveSubtract = $derived(carveMode === 'subtract' || carveMode === 'unfog');
  /** Referee-only (SPEC-029 §1): the battle-map quick sheet's "Capture area"
   * button — `capture`'s only entry point since DEC-066 took it out of
   * `TOOL_GROUPS` — never renders for a non-GM seat (the sheet itself is
   * GM-gated), and this mirrors that gate at the gesture level too, the same
   * belt-and-braces `fogCarve` above already gets. */
  const captureAllowed = $derived(tool === 'capture' && isGM);
  let eye = $state<Point | null>(null);
  // Undo/redo/export state lives on the shared `mapCtrl` (single source of
  // truth), so the rail's `MapToolbar` and this editor never disagree
  // (action-plan item 4). The toolbar's `onUndo`/`onRedo`/`onExportPng`
  // handlers are wired to this editor's functions in `onMount`.
  // D3 (docs/VTT_Master_Plan.md Part V §2) — soft bounded-extent guard: a commit
  // that would push the floor union's bbox past MAX_FLOOR_EXTENT is blocked
  // with a visible error rather than silently applied/truncated.
  let floorExtentError = $state('');

  const HINTS: Record<ToolId, string> = {
    select:
      'Select — click a vertex to drag it, or an object to move it; drag over open canvas to lasso both. Backspace deletes everything selected.',
    pan: 'Pan — drag to move the view (also available on any tool via right-click drag, Alt+drag, or Space+drag).',
    measure: 'Measure — drag from one point to another to read the distance between them.',
    room: 'Room — drag two corners, or click to start and click again to finish. Hold Alt for freeform corners.',
    corridor: 'Corridor — drag start→end for an L-shaped run of fixed Width.',
    path: 'Path — click to add points, double-click (or Enter) to finish. Rock mode carves an interior divider.',
    polygon: 'Polygon — click each vertex, double-click (or Enter) to close.',
    ngon: 'Regular n-gon — drag center→radius. Sides=1 ⇒ circle.',
    carve:
      'Carve — drag to paint. Snap picks the shape: Cell/Half paint whole lattice cells, Free paints a smooth ribbon of the chosen Width.',
    wall: 'Wall — click points, double-click (or Enter) to finish. Explicit sight+movement blocker.',
    door: 'Door — click two endpoints on/near a wall. Click an existing door to toggle open/closed.',
    eye: 'Eye — click to preview line of sight from a point.',
    pen: 'Pen — drag to draw a freehand note on the overlay layer.',
    ping: 'Ping — click to drop a transient marker all players see.',
    label: 'Label — click to place a keyed room label, then type its name.',
    symbol: 'Symbol — click to place the selected symbol.',
    capture:
      'Capture — drag two corners, or click to start and click again to finish. Always whole cells, for the battle map you cut out.',
  };

  /** The hint the active tool shows, with the fog carve modes spelled out —
   * the same five shape tools mean something different while Carve is set to
   * one of them, and "click a carved area to reveal the whole room" is the
   * gesture a referee reaches for most. */
  const hint = $derived(
    fogCarve
      ? `${carveMode === 'fog' ? 'Reveal' : 'Hide'} fog — click a carved area to ${carveMode === 'fog' ? 'show that whole room to the players' : 'fog that whole room again'}, or draw a shape to ${carveMode === 'fog' ? 'reveal' : 're-fog'} just part of it.`
      : HINTS[tool],
  );

  // ---- interaction state (not reactive — mirrors MapView.svelte's stroke
  // state, which is per-frame and doesn't need Svelte's dependency tracking) ----
  let dragging = false;
  let dragStart: Point | null = null;
  let dragCur: Point | null = null;
  /**
   * The same two points, unsnapped. Room, Corridor and N-gon anchor to whole
   * cells, and "which cell is the pointer in" is not recoverable from a point
   * `snapPoint` has already rounded to the nearest lattice *vertex* — that
   * rounding crosses a cell boundary for three quadrants out of four. Rather
   * than change what `dragStart`/`dragCur` mean for the six tools that are
   * happy with vertex snapping, those three read these instead and do all of
   * their own snapping inside `buildFloorStroke`.
   */
  let dragStartRaw: Point | null = null;
  let dragCurRaw: Point | null = null;
  /**
   * The Corridor's latched bend axis (SPEC-028 §11, DEC-048) — which leg runs
   * first, decided once from the direction the drag first commits to and held
   * for the rest of the gesture. Per-gesture only: it lives here beside
   * `dragStartRaw`/`dragCurRaw`, is cleared everywhere those are, and is never
   * a tool setting and never persisted. `null` means the drag has not declared
   * an axis yet, which `corridorPoly` draws horizontal-first as it always did.
   *
   * It must be latched rather than derived, because the same two endpoints have
   * to be able to produce either L: derived from the current endpoints alone,
   * the corner flips across the diagonal as the pointer moves.
   */
  let bendAxis: vectorMap.BendAxis | null = null;
  /** Latest raw pointer position, drag or no drag — the targeted-cell
   * indicator follows the pointer before any button goes down. */
  let hoverRaw: Point | null = null;
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
  /** Minimum on-screen spacing between consecutive Carve brush samples. */
  const BRUSH_SAMPLE_PX = 4;
  /**
   * The live `w × h` / `radius:` readout for the stroke being dragged.
   *
   * Deliberately split in two. `strokeMeasure` is a plain per-frame local like
   * the rest of the stroke state — `renderAll` recomputes it and hands it
   * straight to the engine. `strokeMeasureText_` is the reactive mirror the
   * hidden DOM readout renders (the chip itself is on the Pixi canvas, so a
   * readout is the only way a test can see it).
   *
   * `renderAll` must NOT write reactive state: several `$effect`s call it, and
   * assigning a fresh object there re-invalidates them every frame —
   * `effect_update_depth_exceeded`. The mirror is a *string*, so the redundant
   * assignments those effects do make (`'' = ''`) don't invalidate anything,
   * and the value only actually changes on the pointer-event path.
   */
  let strokeMeasure: StrokeMeasure | null = null;
  let strokeMeasureText_ = $state('');
  /** DOM mirror of the targeted-cell indicator, which is drawn on the Pixi
   * canvas and so is otherwise invisible to a test. */
  let snapCellText_ = $state('');
  /** DOM mirror of the Corridor/Path band indicator (WI-052) — the narrower
   * shape those two tools draw instead of `snapCellText_`'s whole tile. */
  let snapBandText_ = $state('');

  interface ActiveDrag {
    owner: HandleOwner;
    before: VectorFloorRegion | StoredVectorWall | VectorDoor;
    working: VectorFloorRegion | StoredVectorWall | VectorDoor;
    ref: Point;
  }
  let activeDrag: ActiveDrag | null = null;
  let hoverHandle: Handle | null = null;
  /**
   * The current multi-selection's vertex handles (SPEC-037 §2). A plain local
   * rather than `$state`: a `Handle` carries a `locate` closure and is compared
   * by `sameHandle`, and wrapping it in a reactive proxy buys nothing the
   * pointer path doesn't already trigger a render for. `selectionCount_` below
   * is the reactive mirror the DOM readout needs.
   */
  let selectedHandles: Handle[] = [];
  /** The in-progress lasso's two corners, or null when the Select drag is a
   * single-pick/move rather than a sweep over open canvas. */
  let lasso: { a: Point; b: Point } | null = null;

  // ---- Select tool, whole objects: select/move/delete a symbol, label,
  // door, or annotation, distinct from the vertex geometric-edit drag above.
  // Doors are select-only here (no free move) — their endpoints already move
  // via the existing vertex handles. ----
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
  let selectedObjects = $state<ObjectSelection[]>([]);
  /** The one selected object, or null while nothing — or more than one thing
   * — is picked. Rotate, the Room quick sheet's published selection and the
   * `selected-object` readout are all single-target by nature. */
  const selectedObject = $derived(selectedObjects.length === 1 ? selectedObjects[0]! : null);
  /** How many things (handles + objects) the Select tool currently holds. The
   * handles are a plain local, so this mirror is what makes the count visible
   * to the DOM readout; written on the pointer path only, never in `renderAll`. */
  let selectionCount_ = $state(0);
  let objectDrag: ObjectDrag | null = null;

  // Mirror the rotatable part of the selection out to the toolbar, which shows
  // its Rotate/Flip button only while a single symbol or door is picked.
  $effect(() => {
    const kind = selectedObject?.kind;
    mapCtrl.rotatableSelection = kind === 'symbol' || kind === 'door' ? kind : null;
  });

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
      // Restore where this map was last being looked at (playtest feedback:
      // switching to the Encounter board and back reset the view). The camera
      // is per-map and lives on the shared controller, which outlives this
      // component's mount.
      const saved = mapCtrl.camera[ownMapId];
      if (saved) {
        created.world.position.set(saved.x, saved.y);
        created.world.scale.set(saved.scale);
      } else if (hexGrid) {
        // A hex crawl's `0,0` is the map's *centre* (SPEC-030 §1), not a
        // top-left origin to count from — so with no remembered camera it
        // opens on the origin hex rather than putting it in the corner and
        // half the visible grid at negative coordinates.
        created.world.position.set(created.app.screen.width / 2, created.app.screen.height / 2);
      }
      // Bounded camera (SPEC-029 §4). Setting the bound clamps a restored
      // camera back inside it; with no remembered camera there is nothing to
      // resume, so a battle map opens on the whole captured rect rather than
      // at the origin of a lattice space whose rect may be nowhere near it.
      created.setCameraBounds(cameraBounds);
      if (cameraBounds && !saved) created.fitCamera();
      applyBackgroundColor(backgroundState);
      void applyBackgrounds(orderedBackgrounds, cellSize);
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
      store.subscribeFogRegions(roomId, mapId, (r) => {
        fogRegions = r;
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
      store.subscribeBackgrounds(roomId, mapId, (b) => {
        backgrounds = b;
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
    mapCtrl.onExportBattlePreview = (rect) => exportBattlePreview(rect);
    mapCtrl.onResizeToken = (size) => void handleResizeToken(size);
    mapCtrl.onRotateSelection = () => void rotateSelectedObject();
    mapCtrl.onAddCreature = () => void addCreature();
    mapCtrl.onRevealAll = () => void revealAll();
    mapCtrl.onResetFog = () => void resetFog();
    mapCtrl.onRevealFromEye = () => void revealFromEye();
    mapCtrl.canAddCreature = isGM;
    mapCtrl.mounted = true;

    return () => {
      disposed = true;
    };
  });

  onDestroy(() => {
    // Remember the camera before the engine goes, so remounting this map
    // (an activity switch, a sheet toggle) resumes the same view.
    if (engine) {
      mapCtrl.camera[ownMapId] = {
        x: engine.world.position.x,
        y: engine.world.position.y,
        scale: engine.world.scale.x,
      };
    }
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    for (const unsub of unsubs) unsub();
    unsubs = [];
    // Token-layer bookkeeping — engine.destroy() tears down the Pixi nodes
    // themselves ({ children: true }); clear our lookup maps so no stale
    // references survive the unmount.
    spritesByToken.clear();
    refsByToken.clear();
    backgroundsByToken.clear();
    ringsByToken.clear();
    badgesByGroup.clear();
    draggingIds.clear();
    if (myUid) store.clearVectorMapDraft(roomId, ownMapId, myUid);
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
    // The palette shows the fog controls off this mirror rather than
    // subscribing to the map doc itself.
    mapCtrl.fogEnabled = map.fog?.enabled ?? false;
  });

  $effect(() => {
    // Same mirror, for the palette's tool subset (SPEC-029 §4) — and it
    // carries the "fall back to Pan" rule with it, so a carve tool can't stay
    // armed on a map whose palette no longer offers it.
    mapCtrl.setBattleMap(battleMap);
  });

  $effect(() => {
    // The same mirror for a hex map (SPEC-030 §5). Every carve tool is
    // meaningless on a hex crawl — it has no carved floor — and a square-
    // lattice one is worse than meaningless: it would write cell-space
    // geometry onto a map whose coordinates are axial (RULE-006). So a hex map
    // offers the View tools, exactly as a battle map does.
    mapCtrl.setHexMap(hexGrid !== null);
  });

  $effect(() => {
    // Keep the bound in step with the map on stage, so switching to or away
    // from a battle map without a remount still bounds (or frees) the camera.
    if (ready && engine) engine.setCameraBounds(cameraBounds);
  });

  $effect(() => {
    mapCtrl.canRevealFromEye = tool === 'eye' && eye !== null && (map.fog?.enabled ?? false);
  });

  $effect(() => {
    const bg = backgroundState;
    if (ready) applyBackgroundColor(bg);
  });

  $effect(() => {
    // The alignment overlay appears/disappears with the selection alone — no
    // tool change, no store write, nothing else `renderAll` already watches.
    void selectedBackground?.id;
    void selectedBackground?.x;
    void selectedBackground?.y;
    void selectedBackground?.w;
    void selectedBackground?.h;
    if (ready) renderAll();
  });

  $effect(() => {
    // Re-place every background sprite when the set, any one image's rect, or
    // the cell size changes — `cellSize` is the render-time multiplier that
    // turns the stored lattice rect into pixels (RULE-006), so a live grid
    // resize has to re-run this just as an edit does.
    const bgs = orderedBackgrounds;
    const px = cellSize;
    if (ready) void applyBackgrounds(bgs, px);
  });

  $effect(() => {
    // Re-render when the map's cell size or grid-subdivide display setting
    // changes (a live grid resize, or the R9.6 half-grid toggle) — or when the
    // grid step itself changes because the map on stage became a battle map.
    void cellSize;
    void gridCellSize;
    void map.gridSettings.subdivide;
    if (ready) renderAll();
  });

  $effect(() => {
    // Opening/closing the inline label editor swaps which label the canvas
    // draws (the one being edited is suppressed — see `renderOverlayObjects`).
    void editingLabelId;
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
    // One cursor per tool group (`map/tool-groups.ts`) — the pointer says what
    // the next click will do before you make it.
    engine?.setCursor(cursorForTool(tool));
  });

  $effect(() => {
    // Re-sync the token layer whenever the roster or its derived visibility
    // changes. Touching the deps registers them for Svelte's tracking.
    void mapVisibleIds;
    void currentTurnIds;
    void hiddenTokenIds;
    void collapsedGroups;
    void selectedTokenId;
    // Presence changes nothing about the roster, so the sprite layer has to be
    // told to re-sync when a seat connects or drops (R26.2).
    void presentSeatIds;
    // Also track the per-token fields the sprite layer actually paints from,
    // so an in-place edit (colour, art, size, position) re-syncs even when the
    // roster array itself is unchanged.
    for (const t of tokens) {
      void t.color;
      void t.imageRef;
      void t.size;
      void t.pos.x;
      void t.pos.y;
    }
    if (ready) syncSprites(renderableTokens);
  });

  /** The map's solid clear colour (`GameMap.background`) — the renderer's
   * background, never a `layers.background` sprite (SPEC-029 §2). `none`
   * hands the clear colour back to the room's theme rock, which is what shows
   * anywhere no background image covers. */
  function applyBackgroundColor(bg: { kind: 'color'; color: string } | { kind: 'none' }): void {
    engine?.setBackgroundColor(bg.kind === 'color' ? hexToNumber(bg.color) : null);
  }

  /**
   * Syncs `layers.background` against the map's placed background images
   * (SPEC-038 §2): one sprite each, positioned and scaled to its own stored
   * lattice rect, added in `order` so the lowest paints first.
   *
   * Textures load asynchronously, so `bgLoadSeq` guards the whole pass the way
   * it guarded the single sprite before — a pass superseded while a texture
   * was in flight drops its results rather than adding sprites for a map (or a
   * background set) that has since been replaced.
   */
  async function applyBackgrounds(bgs: MapBackground[], px: number): Promise<void> {
    if (!engine) return;
    const seq = ++bgLoadSeq;
    const textures = await Promise.all(
      bgs.map((bg) => PIXI.Assets.load(assets.resolve(bg.ref)) as Promise<PIXI.Texture>),
    );
    if (seq !== bgLoadSeq || !engine) return;

    const live = new Set(bgs.map((bg) => bg.id));
    for (const [id, sprite] of bgSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        bgSprites.delete(id);
      }
    }
    bgs.forEach((bg, i) => {
      let sprite = bgSprites.get(bg.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(textures[i]);
        bgSprites.set(bg.id, sprite);
      } else if (sprite.texture !== textures[i]) {
        sprite.texture = textures[i]!;
      }
      sprite.position.set(bg.x * px, bg.y * px);
      sprite.width = bg.w * px;
      sprite.height = bg.h * px;
      // Re-adding an existing child moves it to the top of the container, so
      // walking the sorted list end to end leaves the layer in `order`.
      engine!.layers.background.addChild(sprite);
    });
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
  // consumes it. See docs/VTT_Master_Plan.md Part V §2 action-plan item 5. ----

  const TOKEN_PX = 48;
  const spritesByToken = new Map<string, PIXI.Sprite>();
  /** Background disc behind a token's sprite (quick-sheet token/color split)
   * — shows `Token.color` through a transparent uploaded image and behind a
   * letter token's own disc alike. Kept one z-order slot below its sprite
   * (added to the layer first); a separate concern from `ringsByToken`'s
   * selection/group indicator stroke, which stays on top of everything. */
  const backgroundsByToken = new Map<string, PIXI.Graphics>();
  /** The `imageRef` each sprite's current texture was loaded from, so a ref
   * change (e.g. recolouring a letter token) reloads it. */
  const refsByToken = new Map<string, string>();
  const ringsByToken = new Map<string, PIXI.Graphics>();
  /** "Owner disconnected" badges (R26.2) — keyed by token, created lazily and
   * destroyed the moment the owner reconnects. */
  const awayBadgesByToken = new Map<string, PIXI.Graphics>();
  /** Tokens whose current `imageRef` failed to load (IN-008/WI-032) — either
   * an unrecognized URL shape or a CORS-blocked host. Keyed by token id;
   * cleared the moment `refsByToken` sees a different ref for that token, so
   * picking a different image retries. Drives `brokenImageTexture` and
   * `syncBrokenImageBadges`, the visible-failure half of the fix — a broken
   * host stays broken, but the referee sees why instead of a blank square. */
  const brokenImageIds = new Set<string>();
  const brokenImageBadgesByToken = new Map<string, PIXI.Graphics>();
  let brokenImageTextureCache: PIXI.Texture | null = null;
  // Reactive mirror of `brokenImageIds.size` — the badge itself is Pixi-drawn
  // (not queryable from the DOM), so this is how a test observes it, same
  // idiom as `stroke-dimensions`/`snap-cell-readout` below.
  let brokenTokenCount = $state(0);
  const badgesByGroup = new Map<string, PIXI.Container>();
  const draggingIds = new Set<string>();
  let selectedTokenId = $state<string | null>(null);
  // Number of token docs the last drop wrote (1 for a lone token, N for a
  // collapsed group's batched move) — surfaced for e2e introspection.
  let lastBatchMoveCount = $state(1);

  // A player only sees tokens flagged [Map]-visible; the GM sees all, with the
  // not-yet-visible ones dimmed (same rule as the cellular MapView).
  const mapVisibleIds = $derived(visibleTokenIds(tokens, groups, 'map'));
  /** Fog also hides tokens standing in it, or a player would watch monsters
   * slide around inside a black region. Uses the existing occupancy query at
   * render time over a token-count-sized list — not per-frame-per-cell (SPEC
   * §7). Token positions are pixel-space; fog geometry is lattice units. */
  function revealedAt(pos: { x: number; y: number }): boolean {
    if (!(map.fog?.enabled ?? false)) return true;
    return vectorMap.pointInFloorUnionRegions({ x: pos.x / cellSize, y: pos.y / cellSize }, [
      ...fogRegions,
    ]);
  }
  const renderableTokens = $derived(
    isGM ? tokens : tokens.filter((t) => mapVisibleIds.has(t.id) && revealedAt(t.pos)),
  );
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

  /**
   * Every token the sprite layer draws nothing for: a collapsed group's
   * non-anchor members, plus the one currently being dragged out of a quick
   * sheet. The sheet drag is a *pick up* — the translucent portrait on the
   * pointer is where the token is for the moment, so leaving a copy sitting on
   * the map would say it hadn't moved.
   */
  const hiddenTokenIds = $derived.by(() => {
    const hidden = new Set(hiddenCollapsedIds);
    if (mapCtrl.sheetDragTokenId) hidden.add(mapCtrl.sheetDragTokenId);
    return hidden;
  });

  // ---- token dropped in from a quick sheet ----
  //
  // Dragging a character's portrait out of the Character sheet and releasing it
  // here places that character's token at the drop point. The token is hidden
  // for the duration of the drag (`hiddenTokenIds`) so the gesture reads as
  // picking it up off the map and putting it down somewhere else.
  //
  // These are the only DOM drag handlers on the map. The map's own input is
  // Pixi federated pointer events, which a drag starting in ordinary DOM never
  // reaches — hence the `DataTransfer` payload (`tokens/drag.ts`).

  function onCanvasDragOver(e: DragEvent): void {
    if (!hasTokenDrag(e.dataTransfer)) return;
    // Without `preventDefault` on *dragover* the browser refuses the drop
    // outright — no `drop` event is ever delivered.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  async function onCanvasDrop(e: DragEvent): Promise<void> {
    const payload = readTokenDrag(e.dataTransfer);
    mapCtrl.sheetDragTokenId = null;
    if (!payload || !engine) return;
    e.preventDefault();

    // Client coordinates -> canvas-local -> world space. The canvas fills the
    // wrapper, so its own rect is the right origin under any layout.
    const rect = engine.app.canvas.getBoundingClientRect();
    const local = engine.world.toLocal(new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top));

    const existing = payload.tokenId ? tokens.find((t) => t.id === payload.tokenId) : undefined;
    const size = existing?.size ?? 1;
    // The same snap the on-map drop uses, modifiers and all, so a token thrown
    // from the sheet lands exactly where dragging it across the map would.
    const snapped = snapTokenPosition(
      { x: local.x, y: local.y },
      cellSize,
      size,
      snapModeFromModifiers(e.altKey, e.shiftKey, mapCtrl.tokenSnap),
    );

    if (existing) {
      lastBatchMoveCount = 1;
      await store.moveToken(roomId, existing.id, snapped);
      return;
    }
    // A character with no token yet gets one here rather than at "My token"'s
    // fixed spot — the drop already said where it goes.
    await store.createToken(roomId, {
      pos: snapped,
      size: 1,
      layer: 'tokens',
      imageRef: payload.imageRef,
      ownerSeatId: payload.seatId,
    });
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

  /** Alpha for a token whose owning seat has no live presence (R26.2). */
  const AWAY_ALPHA = 0.42;

  /** Whether this token's owner is disconnected. Unowned tokens (monsters,
   * scenery) never dim — there is no seat for them to be away from. */
  function isAway(token: Token): boolean {
    return token.ownerSeatId !== undefined && !presentSeatIds.has(token.ownerSeatId);
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
      }
      // The texture is (re)loaded whenever the ref changes, not only when the
      // sprite is created: a letter token bakes its colour into `imageRef`
      // (`gen:disc:{label}:{color}`), so the character sheet's colour picker
      // rewrites the ref — which used to show up on the map only after the
      // view was unmounted and remounted by an activity switch.
      if (refsByToken.get(token.id) !== token.imageRef) {
        refsByToken.set(token.id, token.imageRef);
        if (brokenImageIds.delete(token.id)) brokenTokenCount = brokenImageIds.size;
        void loadTokenTexture(sprite, token.id, token.imageRef);
      }
      if (!draggingIds.has(token.id)) {
        sprite.position.set(token.pos.x, token.pos.y);
        // The affordance matches the SPEC-032 §5 rule: every token is
        // selectable (§4), but the cursor tells you up front whether picking
        // it up will actually move it.
        sprite.cursor = canActOnToken(groups, tokens, myUid ?? '', token.id, isGM)
          ? 'grab'
          : 'pointer';
      }
      sprite.width = TOKEN_PX * token.size;
      sprite.height = TOKEN_PX * token.size;
      // Translucent = GM-only view of a token the players can't see — either
      // not yet [Map]-visible, or standing in fog they haven't revealed.
      // Tinted = it's this token's side/actor's turn.
      const baseAlpha = mapVisibleIds.has(token.id) && revealedAt(token.pos) ? 1 : 0.4;
      // Presence dim (R26.2, Board 2). `min` rather than a product: a
      // GM-only token owned by a disconnected player would otherwise compound
      // to near-invisible, and both states mean "recede", not "recede twice".
      sprite.alpha = isAway(token) ? Math.min(baseAlpha, AWAY_ALPHA) : baseAlpha;
      sprite.tint = currentTurnIds.has(token.id) ? 0xffd699 : 0xffffff;
      sprite.visible = !hiddenTokenIds.has(token.id);

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
        refsByToken.delete(id);
        backgroundsByToken.get(id)?.destroy();
        backgroundsByToken.delete(id);
        if (brokenImageIds.delete(id)) brokenTokenCount = brokenImageIds.size;
        brokenImageBadgesByToken.get(id)?.destroy();
        brokenImageBadgesByToken.delete(id);
      }
    }
    syncTokenRings(list);
    syncAwayBadges(list);
    syncBrokenImageBadges(list);
    syncCollapsedBadges();
  }

  /** Small hollow badge on a disconnected owner's token (R26.2, Board 2).
   *
   * Load-bearing rather than decorative: `alpha` is already overloaded — 0.4
   * means "GM-only view of something players cannot see" — so without a second
   * channel the referee could not tell a hidden token from an away one. The
   * status ring is deliberately left at full weight and colour, so "whose
   * token is this" and "is that player here" stay independent readings. */
  function syncAwayBadges(list: Token[]): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const token of list) {
      if (!isAway(token) || hiddenTokenIds.has(token.id)) continue;
      seen.add(token.id);
      let badge = awayBadgesByToken.get(token.id);
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        layer.addChild(badge);
        awayBadgesByToken.set(token.id, badge);
      }
      const sprite = spritesByToken.get(token.id);
      const bx = sprite ? sprite.position.x : token.pos.x;
      const by = sprite ? sprite.position.y : token.pos.y;
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(bx + r * 0.72, by + r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x1b1712).stroke({ width: 1.5, color: 0x9a8f7a });
    }
    for (const [id, badge] of awayBadgesByToken) {
      if (!seen.has(id)) {
        badge.destroy();
        awayBadgesByToken.delete(id);
      }
    }
  }

  /** Small warning badge on a token whose `imageRef` failed to load
   * (IN-008/WI-032) — same corner-badge idiom as `syncAwayBadges`, on the
   * opposite side so a token can show both at once (away *and* broken). */
  function syncBrokenImageBadges(list: Token[]): void {
    if (!engine) return;
    const layer = engine.layers.tokens;
    const seen = new Set<string>();
    for (const token of list) {
      if (!brokenImageIds.has(token.id) || hiddenTokenIds.has(token.id)) continue;
      seen.add(token.id);
      let badge = brokenImageBadgesByToken.get(token.id);
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        layer.addChild(badge);
        brokenImageBadgesByToken.set(token.id, badge);
      }
      const sprite = spritesByToken.get(token.id);
      const bx = sprite ? sprite.position.x : token.pos.x;
      const by = sprite ? sprite.position.y : token.pos.y;
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(bx - r * 0.72, by + r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x4a1414).stroke({ width: 1.5, color: 0xe3a23a });
      badge.moveTo(0, -3.5).lineTo(0, 1).stroke({ width: 1.5, color: 0xe3a23a });
      badge.circle(0, 3.5, 0.75).fill(0xe3a23a);
    }
    for (const [id, badge] of brokenImageBadgesByToken) {
      if (!seen.has(id)) {
        badge.destroy();
        brokenImageBadgesByToken.delete(id);
      }
    }
  }

  /** Lazily built, cached "broken image" placeholder — an X on a dark
   * square, distinct at a glance from `Texture.WHITE` (the pre-load
   * default) so a referee can tell "still loading" / "no image" apart from
   * "this URL failed" (IN-008/WI-032). */
  function brokenImageTexture(): PIXI.Texture {
    if (brokenImageTextureCache) return brokenImageTextureCache;
    const g = new PIXI.Graphics();
    const s = TOKEN_PX;
    g.rect(0, 0, s, s).fill(0x2a2320).stroke({ width: 2, color: 0xe3a23a });
    const pad = s * 0.28;
    g.moveTo(pad, pad)
      .lineTo(s - pad, s - pad)
      .stroke({ width: 3, color: 0xe3a23a });
    g.moveTo(s - pad, pad)
      .lineTo(pad, s - pad)
      .stroke({ width: 3, color: 0xe3a23a });
    brokenImageTextureCache = engine!.app.renderer.generateTexture(g);
    g.destroy();
    return brokenImageTextureCache;
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
      ring.visible = !hiddenTokenIds.has(token.id);
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

  /** Loads a token's art via `loadImageElement` rather than
   * `PIXI.Assets.load` (IN-008/WI-032) — Pixi 8's loader only claims URLs
   * whose extension it recognizes, which rejects a pasted CDN/blog URL with
   * no extension or a query string. A plain `HTMLImageElement` accepts
   * anything the browser can fetch, the same as the character sheet's own
   * `<img>`. A host without CORS headers still fails here — that failure
   * cannot be worked around client-side — but now visibly: a placeholder
   * texture and a badge, tracked by `brokenImageIds`, instead of a silent
   * `Texture.WHITE` square. `refsByToken`'s ref-change gate (in
   * `syncSprites`) is what retries a token whose image is later changed. */
  async function loadTokenTexture(
    sprite: PIXI.Sprite,
    tokenId: string,
    imageRef: string,
  ): Promise<void> {
    try {
      const img = await loadImageElement(assets.resolve(imageRef));
      sprite.texture = PIXI.Texture.from(img);
    } catch (err) {
      console.warn(`[VectorMapView] token image failed to load: ${imageRef}`, err);
      brokenImageIds.add(tokenId);
      brokenTokenCount = brokenImageIds.size;
      sprite.texture = brokenImageTexture();
      syncBrokenImageBadges(renderableTokens);
    }
  }

  function attachDragHandlers(sprite: PIXI.Sprite, tokenId: string): void {
    let tokenDragging = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      selectedTokenId = tokenId;
      const token = tokens.find((t) => t.id === tokenId) ?? null;
      mapCtrl.selectedToken = token;
      // Picking up a token raises its character's sheet, the same way clicking
      // that actor's card on the Encounter board does. `pointerdown` *is* the
      // selection moment here (it also starts the drag), so there is no
      // click-versus-drag discrimination to make.
      // Still gated on an owning seat: the callback is actor-keyed since
      // WI-055, but raising a *creature's* sheet is WI-056 (SPEC-032 §4).
      if (token?.ownerSeatId) onSelectActor(token.ownerSeatId);
      // Selection is unconditional; the drag itself is ownership-gated
      // (SPEC-032 §5) — a token this seat may not act on stays inspectable
      // but does not move.
      if (canActOnToken(groups, tokens, myUid ?? '', tokenId, isGM)) {
        tokenDragging = true;
        draggingIds.add(tokenId);
        sprite.cursor = 'grabbing';
      }
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

  /** The simplification tolerance the active stroke commits at (SPEC-028
   * §10): the tool's policy (default or slider-overridden), bounded by
   * whichever width actually governs this stroke — `bandWidth` for the
   * Corridor/Path band, `width` for Carve's free-form brush — and forced to 0
   * for a Path/Corridor band under Cell or Half snap, which has no redundant
   * vertices to prune. */
  function strokeTolerance(): number {
    const isBandTool = tool === 'corridor' || tool === 'path';
    const strokeWidth = isBandTool ? bandWidth : width;
    const exactBand = isBandTool && effectiveSnap() !== 'free';
    return vectorMap.boundedTolerance(
      vectorMap.toolTolerance(carveKind(tool), tolerance),
      strokeWidth,
      exactBand,
    );
  }

  function currentStroke(): vectorMap.MultiPoly | null {
    // Fog strokes are the same five primitives, only committed against
    // `fogRegions` (see `fogCarve`) — the shape is built identically.
    const primitive: FloorPrimitiveTool | null = FLOOR_TOOLS.includes(tool)
      ? (tool as FloorPrimitiveTool)
      : null;
    if (!primitive) return null;
    // Room, Corridor, N-gon, Carve and Path anchor to cells, so they take the
    // *raw* pointer and do their own snapping (SPEC-028); everything else keeps
    // taking the vertex-snapped points the pointer handlers produce.
    const cellAnchored = isCellAnchoredTool(primitive);
    return buildFloorStroke(
      primitive,
      { snap: effectiveSnap(), width, bandWidth, sides, bendAxis },
      cellAnchored ? dragStartRaw : dragStart,
      cellAnchored ? dragCurRaw : dragCur,
      collecting,
      vectorMap.polygonClippingBackend,
    );
  }

  /** Where the live snap dot goes: the cell-anchored tools' real anchor is the
   * centre of the targeted cell, everyone else's is the vertex-snapped point. */
  function snapCursorPoint(): Point | null {
    if (!SNAP_CURSOR_TOOLS.includes(tool)) return null;
    if (!isCellAnchoredTool(tool)) return dragCur;
    const at = dragCurRaw ?? hoverRaw;
    return at ? vectorMap.snapCellCenter(at, effectiveSnap()) : null;
  }

  /** Ray length for the Eye tool's sweep: enough to cross the visible window
   * at the current zoom, so the lit area always reaches the screen edge. */
  function eyeMaxDistLattice(): number {
    if (!engine || !engine.app.screen.width || !engine.app.screen.height) return 200;
    return (engine.app.screen.width + engine.app.screen.height) / (engine.world.scale.x * cellSize);
  }

  // ---- fog of war (SPEC §4) ----

  function currentFogMultiPoly(): vectorMap.MultiPoly {
    return fogRegions.map((r) => r.rings);
  }

  /** Commits a reveal/hide stroke through the same carve pipeline the floor
   * uses, against `fogRegions`. `Carve: Fog: reveal` unions, `Fog: hide`
   * differences. */
  async function commitFogStroke(stroke: vectorMap.MultiPoly | null): Promise<void> {
    if (!stroke || !stroke.length) return;
    const strokeBBox = strokeBBoxOf(stroke);
    const before = fogRegions;
    const result = vectorMap.commitCarve(
      currentFogMultiPoly(),
      stroke,
      carveMode === 'unfog' ? 'subtract' : 'add',
      strokeTolerance(),
      vectorMap.polygonClippingBackend,
    );
    // No max-extent guard here: fog geometry can only ever be reveals over
    // floor the referee already drew, and that floor is itself extent-capped.
    await applyOp(buildFogCarveOp(before, result.floor, strokeBBox));
  }

  /** Reveals (or hides) the entire floor region under `p` — the plain-click
   * gesture for the fog tools. Falls back to doing nothing when the click
   * lands on rock, rather than revealing a stray rectangle. */
  async function commitFogRegionAt(p: Point): Promise<void> {
    const hit = regions.find((r) => vectorMap.pointInFloorUnionRegions(p, [r]));
    if (!hit) return;
    await commitFogStroke([hit.rings]);
  }

  /** Commits the Eye tool's current LoS polygon as revealed area. This is what
   * makes the Eye tool's visibility preview useful rather than a debug
   * overlay: place the eye where a character is standing, see exactly what
   * they can see, then show the players precisely that. */
  async function revealFromEye(): Promise<void> {
    if (!eye || !engine) return;
    const maxDistLattice = eyeMaxDistLattice();
    const poly = vectorMap.visibilityPolygon(eye, scene.sight, maxDistLattice);
    if (poly.length < 3) return;
    await commitFogStroke([[poly]]);
    renderAll();
  }

  /** Reveals the entire carved floor — "the party has the map." Undoable like
   * any other reveal, since it goes through the same op. */
  async function revealAll(): Promise<void> {
    if (!regions.length) return;
    const changes = [
      ...fogRegions.map((r) => ({ id: r.id, from: r, to: null })),
      ...regions.map((r) => {
        const id = nextVectorId('fog');
        return { id, from: null, to: { id, rings: r.rings, bbox: r.bbox } };
      }),
    ];
    await applyOp({ kind: 'fogRegionBatch', changes });
    renderAll();
  }

  /** Drops every revealed region — back to a fully fogged map. */
  async function resetFog(): Promise<void> {
    if (!fogRegions.length) return;
    await applyOp({
      kind: 'fogRegionBatch',
      changes: fogRegions.map((r) => ({ id: r.id, from: r, to: null })),
    });
    renderAll();
  }

  /** Routes a finished stroke to the collection its carve mode targets. */
  async function commitStroke(stroke: vectorMap.MultiPoly | null): Promise<void> {
    if (fogCarve) return commitFogStroke(stroke);
    return commitFloorStroke(stroke);
  }

  async function commitFloorStroke(stroke: vectorMap.MultiPoly | null): Promise<void> {
    if (!stroke || !stroke.length) return;
    const strokeBBox = strokeBBoxOf(stroke);
    const before = regions;
    const result = vectorMap.commitCarve(
      currentFloorMultiPoly(),
      stroke,
      carveSubtract ? 'subtract' : 'add',
      strokeTolerance(),
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

  /** The one pick radius this canvas uses, in screen pixels (SPEC-033 §4) —
   * 9 on a fine pointer, 22 on a coarse one. Every pick on the stage reads it:
   * the two Select handle picks, the door click, and the two object picks. */
  const PICK_PX = $derived(pickPx(isCoarsePointer));

  async function handleDoorClick(point: Point): Promise<void> {
    const hit = doors.find((d) => distToSeg(point, d.a, d.b) < latticeThreshold(PICK_PX));
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

  // ---- select tool (SPEC-037) ----

  /** The Select tool's whole-object catalog, live rather than mid-drag: the
   * lasso sweeps what is committed, not a working copy. */
  function objectCatalog(): ObjectCatalog {
    return { symbols, mapRooms, doors, drawings };
  }

  function clearSelection(): void {
    selectedHandles = [];
    selectedObjects = [];
    lasso = null;
    objectDrag = null;
    syncSelectionCount();
  }

  function syncSelectionCount(): void {
    selectionCount_ = selectedHandles.length + selectedObjects.length;
  }

  /**
   * One click, one gesture (SPEC-037 §1). A vertex handle under the pointer
   * wins — the priority the old Vertex mode had — and starts a geometric drag;
   * failing that an object under the pointer is picked and, for the kinds that
   * move, dragged; failing both, the drag is a lasso over open canvas (§2).
   */
  function beginSelectGesture(point: Point): void {
    const threshold = latticeThreshold(PICK_PX);
    const handle = pickVertexHandle(point, vertexHandles(regions, walls, doors), threshold);
    if (handle) {
      selectedObjects = [];
      selectedHandles = [handle];
      syncSelectionCount();
      beginHandleDrag(handle);
      return;
    }
    const hit = pickObject(point, cellSize, objectCatalog(), threshold);
    if (hit) {
      selectedHandles = [];
      beginObjectDrag(hit, point);
      syncSelectionCount();
      return;
    }
    // Open canvas: start sweeping. Nothing is deselected yet — the release
    // decides, so a lasso that catches something replaces the selection and
    // one that catches nothing clears it, both in one place.
    lasso = { a: point, b: point };
  }

  function beginHandleDrag(handle: Handle): void {
    const before = findOwnerRecord(handle.owner, regions, walls, doors);
    if (!before) return;
    // `regions`/`walls`/`doors` are `$state` arrays, so their entries are
    // Svelte 5 reactive proxies — the native `structuredClone` can't clone
    // those directly (throws "could not be cloned"). `$state.snapshot()` is
    // the documented escape hatch: it unwraps to a plain, clonable object.
    const working = structuredClone($state.snapshot(before));
    activeDrag = { owner: handle.owner, before, working, ref: handle.locate(working) };
  }

  function updateSelectDrag(point: Point): void {
    if (!activeDrag) return;
    activeDrag.ref.x = point.x;
    activeDrag.ref.y = point.y;
  }

  /** Collects everything the released lasso caught (SPEC-037 §2) — vertex
   * handles and whole objects in one set. A sweep that caught nothing clears
   * the selection, matching a click on open canvas. */
  function finishLasso(): void {
    const rect = lassoBBox(lasso!.a, lasso!.b);
    lasso = null;
    const caught = lassoSelect(
      rect,
      vertexHandles(regions, walls, doors),
      objectCatalog(),
      cellSize,
    );
    selectedHandles = caught.handles;
    selectedObjects = caught.objects;
    syncSelectionCount();
    // Publish a lassoed room label the same way a click on one does, so the
    // Room quick sheet follows either gesture.
    const room = caught.objects.length === 1 ? caught.objects[0]! : null;
    if (room?.kind === 'mapRoom') mapCtrl.selectedMapRoomId = room.id;
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

  // ---- Select tool, whole objects ----

  function beginObjectDrag(hit: ObjectSelection, point: Point): void {
    selectedObjects = [hit];
    objectDrag = null;
    // Picking a room label is also what drives the Room quick sheet's
    // "currently selected room" (Shell UI Redesign) — publish it before the
    // drag bookkeeping below, which returns early for some kinds.
    if (hit.kind === 'mapRoom') mapCtrl.selectedMapRoomId = hit.id;
    if (hit.kind === 'door') return; // doors: select-only here
    if (hit.kind === 'symbol') {
      const orig = symbols.find((s) => s.id === hit.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      objectDrag = {
        selection: hit,
        working,
        offset: { x: working.cell.x - point.x, y: working.cell.y - point.y },
      };
    } else if (hit.kind === 'mapRoom') {
      const orig = mapRooms.find((r) => r.id === hit.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      objectDrag = {
        selection: hit,
        working,
        offset: { x: working.labelAnchor.x - point.x, y: working.labelAnchor.y - point.y },
      };
    } else {
      const orig = drawings.find((d) => d.id === hit.id);
      if (!orig || !orig.points.length) return;
      const working = structuredClone($state.snapshot(orig));
      const anchorPx = { x: point.x * cellSize, y: point.y * cellSize };
      objectDrag = {
        selection: hit,
        working,
        offset: { x: working.points[0]!.x - anchorPx.x, y: working.points[0]!.y - anchorPx.y },
      };
    }
  }

  function updateObjectDrag(point: Point): void {
    if (!objectDrag) return;
    if (objectDrag.selection.kind === 'symbol') {
      const s = objectDrag.working as MapSymbol;
      s.cell = vectorMap.anchorCellFor(
        {
          x: point.x + objectDrag.offset.x,
          y: point.y + objectDrag.offset.y,
        },
        effectiveSnap(),
      );
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

  /** Rotate whatever Object mode has picked. Symbols cycle through the four
   * cardinal orientations (`MapSymbol.rotation`, already stored and rendered);
   * a door has no rotation field — its angle is derived from `a`→`b` — so it
   * flips end-for-end, which is the 180° the art needs. Like the other overlay
   * edits (`endObjectDrag`) this writes straight to the store rather than
   * through the floor-geometry undo stack. */
  async function rotateSelectedObject(): Promise<void> {
    const sel = selectedObject;
    if (!sel) return;
    if (sel.kind === 'symbol') {
      const orig = symbols.find((s) => s.id === sel.id);
      if (!orig) return;
      await store.placeSymbol(roomId, mapId, {
        ...structuredClone($state.snapshot(orig)),
        rotation: (orig.rotation + 90) % 360,
      });
    } else if (sel.kind === 'door') {
      const orig = doors.find((d) => d.id === sel.id);
      if (!orig) return;
      const flipped = structuredClone($state.snapshot(orig));
      await store.setDoor(roomId, mapId, { ...flipped, a: flipped.b, b: flipped.a });
    }
    renderAll();
  }

  /**
   * Backspace/Delete over the whole current selection (SPEC-037 §3).
   *
   * Two halves, because the two kinds of member are removed two different
   * ways. Selected **vertices** are a geometric edit on committed floor
   * geometry, so they go through the undo stack as one op (`applyOp`) — a
   * floor vertex re-stitches its ring where it can (§4), a wall or door
   * endpoint takes its whole segment. Selected **objects** keep the direct
   * store writes single-target delete has always used; they were never on the
   * undo stack and this is not the work item that puts them there.
   */
  async function deleteSelection(): Promise<void> {
    const handles = selectedHandles;
    const objects = selectedObjects;
    if (!handles.length && !objects.length) return;
    clearSelection();

    // Snapshot only the records the handles actually name — `from` is what
    // undo writes back, and the live proxies are about to be deleted out from
    // under it.
    const records = new Map<string, OwnerRecord>();
    for (const h of handles) {
      const key = ownerKey(h.owner);
      if (records.has(key)) continue;
      const rec = findOwnerRecord(h.owner, regions, walls, doors);
      if (rec) records.set(key, structuredClone($state.snapshot(rec)));
    }
    const op = buildHandleRemovalOp(handles, records);
    if (op) await applyOp(op);

    // A door caught both as an object and by one of its endpoints is already
    // gone via the op above; removing it twice would be a wasted write.
    const removedDoors = new Set(
      handles.filter((h) => h.owner.kind === 'door').map((h) => h.owner.id),
    );
    for (const sel of objects) {
      if (sel.kind === 'symbol') await store.removeSymbol(roomId, mapId, sel.id);
      else if (sel.kind === 'mapRoom') await store.removeMapRoom(roomId, mapId, sel.id);
      else if (sel.kind === 'door') {
        if (!removedDoors.has(sel.id)) await store.removeDoor(roomId, mapId, sel.id);
      } else await store.deleteDrawing(roomId, mapId, sel.id);
    }
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
    // A fog stroke is the referee's private authoring, not a shared preview —
    // broadcasting its ghost would show players the shape of what they are
    // about to be shown (or hidden from).
    if (!isFloorStrokeTool(tool) || fogCarve || !myUid) return;
    // Raw endpoints for the cell-anchored tools. The draft channel carries the
    // centerline, never the resolved shape (B4), and since those tools stopped
    // using the vertex-snapped points the raw pointer is now the truer answer
    // to "where is their stroke" — the snapped pair can sit half a cell off the
    // shape it is supposed to be previewing.
    const a = isCellAnchoredTool(tool) ? dragStartRaw : dragStart;
    const b = isCellAnchoredTool(tool) ? dragCurRaw : dragCur;
    // Path's collected points are raw too, so its trailing live point must come
    // from the same space — `b`, not the vertex-snapped `dragCur`.
    const tip = tool === 'path' ? b : dragCur;
    const points =
      tool === 'path' || tool === 'polygon'
        ? tip
          ? [...collecting, tip]
          : collecting
        : a && b
          ? [a, b]
          : [];
    if (!points.length) return;
    store.publishVectorMapDraft(roomId, mapId, {
      uid: myUid,
      tool,
      mode: carveSubtract ? 'subtract' : 'add',
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

  /**
   * Free snap's vertex attraction (SPEC-028 §12, DEC-061), or `undefined` when
   * this gesture doesn't get one — which leaves `snapPoint` the pure identity
   * Free has always been.
   *
   * Three gates. The mode must be Free (Cell/Half already round to lattice
   * vertices). The tool must be one that places its points on vertices —
   * `attractsToVertex` for Wall/Door/Polygon, and for Select an in-progress
   * vertex-handle drag: at pointer-down `activeDrag` is still null, so the
   * pick that decides handle-vs-object-vs-lasso sees the untouched pointer,
   * and an object drag never attracts at all. The candidates are the same
   * `vertexHandles` catalog the Select tool picks from, at the same
   * `PICK_PX` radius, converted to lattice units by `latticeThreshold` — so
   * attraction and picking agree, and both scale with zoom and pointer
   * coarseness.
   *
   * The dragged handle's own vertex is not excluded: within the pick radius a
   * handle drag holds still, which is the same stickiness every other pick on
   * this canvas has, and zooming in shrinks the radius in lattice units when
   * finer placement is wanted.
   */
  function vertexAttraction(): vectorMap.VertexAttraction | undefined {
    if (effectiveSnap() !== 'free') return undefined;
    const on = selecting ? activeDrag !== null : attractsToVertex(tool);
    if (!on) return undefined;
    return {
      vertices: vertexHandles(regions, walls, doors).map((h) => h.point),
      radius: latticeThreshold(PICK_PX),
    };
  }

  function toLatticeSnapped(world: { x: number; y: number }): Point {
    return vectorMap.snapPoint(toLatticeRaw(world), effectiveSnap(), vertexAttraction());
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
      // Before every tool, including the ones `handleCollabPointerDown` owns:
      // the note dot is the coarse pointer's stand-in for a hover, not a tool,
      // and it is the only place on the stage where a tap means something the
      // active tool did not ask for (SPEC-033 §4).
      if (handleNoteDotPointerDown(toLatticeRaw(worldPx))) return;
      // Before every tool as well: while the referee has a background
      // selected in the Assets activity, a press on that image is a
      // move/resize (SPEC-038 §3), not whatever the palette is holding. A
      // press anywhere else falls straight through, so the rest of the map
      // keeps working normally with a selection live.
      if (handleBackgroundPointerDown(worldPx)) return;
      if (handleCollabPointerDown(worldPx)) return;
      if (tool === 'label') {
        // Same cell-floor reasoning as `symbol` below: a label lives *inside*
        // a cell, so the click must land in the cell it was made in rather
        // than at whichever lattice vertex happens to be closest.
        onLabelToolClick(toLatticeRaw(worldPx));
        return;
      }
      if (tool === 'symbol') {
        // Cell-floor semantics, not vertex-round: a symbol's footprint must
        // contain the clicked point. `toLatticeSnapped` rounds to the
        // nearest grid VERTEX, which — since Math.round picks whichever
        // corner is numerically closer — lands the symbol in the adjacent
        // cell roughly half the time a click falls past a cell's midpoint.
        void placeSymbolAt(toLatticeRaw(worldPx));
        return;
      }
      onPointerDown(toLatticeSnapped(worldPx), toLatticeRaw(worldPx));
      syncMeasureReadout();
    });
    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      publishCursorThrottled(worldPx);
      // Before the per-tool dispatch: the label tooltip is not a tool.
      updateHoverLabel(toLatticeRaw(worldPx));
      if (handleBackgroundPointerMove(worldPx)) return;
      if (handleCollabPointerMove(worldPx)) return;
      onPointerMove(toLatticeSnapped(worldPx), toLatticeRaw(worldPx));
      syncMeasureReadout();
    });
    const end = (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      void (async () => {
        if (await handleBackgroundPointerUp()) return;
        if (await handleCollabPointerUp()) return;
        await onPointerUp(toLatticeSnapped(worldPx), toLatticeRaw(worldPx));
        syncMeasureReadout();
      })();
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
    stage.on('pointerout', () => (hoverLabel = null));
    mapEngine.app.canvas.addEventListener('dblclick', () => void finishMultiClick());
  }

  /** Symbol authoring (DECISIONS.md WI-D D4) — a click while the shared
   * `symbol` tool is active places a `MapSymbol` at the click point. */
  /** `p` is the raw (unsnapped) lattice point — see the `symbol` short-circuit
   * in `wireStagePointerEvents` for why this must not be vertex-snapped. */
  async function placeSymbolAt(p: Point): Promise<void> {
    const entry = vectorMap.symbolCatalogEntry(mapCtrl.selectedSymbolKind);
    await store.placeSymbol(roomId, mapId, {
      cell: vectorMap.anchorCellFor(p, effectiveSnap()),
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
  function placeLabelAt(raw: Point): void {
    const anchor = vectorMap.snapCell(raw, effectiveSnap());
    pendingLabel = { id: nextVectorId('room'), key: String(mapRooms.length + 1), anchor };
    openLabelEditor(pendingLabel.id, anchor);
  }

  /** The Label tool's click: land on an existing label and rename it in place;
   * otherwise start a new one. Editing used to be reachable only from the
   * Rooms panel — `openLabelEditor` was wired to placement alone. */
  function onLabelToolClick(raw: Point): void {
    const hit = pickObject(
      raw,
      cellSize,
      { symbols: [], mapRooms, doors: [], drawings: [] },
      latticeThreshold(PICK_PX),
    );
    if (hit?.kind === 'mapRoom') {
      const room = mapRooms.find((r) => r.id === hit.id);
      if (room) {
        openLabelEditor(room.id, room.labelAnchor);
        return;
      }
    }
    placeLabelAt(raw);
  }

  // ---- inline label name editor (replaces window.prompt) ----
  let editingLabelId = $state<string | null>(null);
  let editingLabelText = $state('');
  let editingLabelPos = $state({ x: 0, y: 0 });
  let labelEditInputEl = $state<HTMLTextAreaElement | undefined>();
  /** Mirrors the renderer's label size (`vector-engine`'s `MIN_LABEL_FONT_PX`
   * / half-a-cell rule) so the editor reads as the label itself, in place. */
  const labelFontPx = $derived(Math.max(9, cellSize / 2));
  // A not-yet-created label being named for the first time (created on commit).
  let pendingLabel: { id: string; key: string; anchor: Point } | null = null;

  function openLabelEditor(id: string, latticePoint: Point): void {
    const room = mapRooms.find((r) => r.id === id);
    // A label entering its editor dismisses its pinned tooltip (SPEC-033 §4) —
    // the editor is a DOM textarea over the same spot.
    if (pinnedLabel?.id === id) pinnedLabel = null;
    editingLabelId = id;
    editingLabelText = room?.name ?? '';
    if (engine) {
      // `toScreen` returns canvas-relative pixels; the editor is absolutely
      // positioned inside `.vf-canvas-wrap` (which the canvas fills), so these
      // coords are used directly — no bounding-rect offset.
      // The renderer centres a label on its cell's interior
      // (`labelAnchor + half a cell`, see `renderOverlayObjects`), so the
      // editor must too — anchoring it on the lattice vertex put it half a
      // cell up-left of the text it was supposed to be replacing.
      const half = vectorMap.snapCellSize(effectiveSnap()) / 2;
      editingLabelPos = engine.toScreen({
        x: (latticePoint.x + half) * cellSize,
        y: (latticePoint.y + half) * cellSize,
      });
    }
    void tick().then(() => labelEditInputEl?.focus());
  }

  // ---- label hover tooltip ----
  // A label on the map shows its key and (short) name; its long-form
  // description is the per-room players' notes, which until now you had to open
  // the Room quick sheet to read. Hovering the label shows it in place.
  //
  // Read-only and tool-agnostic: this is information about the map, not an edit,
  // so it works whichever tool is in hand. It reuses `pickMapRoomAt` — the same
  // hit-test Select → Object clicks through — so a label you can click is
  // exactly a label you can hover.
  let hoverLabel = $state<{ id: string; x: number; y: number } | null>(null);
  /**
   * The coarse-pointer half (SPEC-033 §4, DEC-059): a tap on a room's note dot
   * *pins* its tooltip open, because a finger has no hover to hold it there.
   * Separate state from `hoverLabel` rather than a flag on it — touch still
   * emits `pointermove`/`pointerout` around a tap, and either would clear a
   * tooltip that lives in the hover slot the instant it opened.
   */
  let pinnedLabel = $state<{ id: string; x: number; y: number } | null>(null);
  /** Pinned wins: it was asked for explicitly, and on a coarse pointer the
   * hover slot is only ever filled by the incidental moves around a tap. */
  const activeLabel = $derived(pinnedLabel ?? hoverLabel);

  const activeLabelText = $derived(activeLabel ? (roomNotes?.get(activeLabel.id) ?? '') : '');
  /** Nothing to say, nothing to show — an empty popover next to every unnoted
   * label would be pure noise. Also suppressed while that label is being
   * renamed, so the tooltip never covers the editor. */
  const showLabelTooltip = $derived(
    !!activeLabel && activeLabelText.trim().length > 0 && editingLabelId !== activeLabel.id,
  );

  /**
   * The rooms drawing a note dot, and so the rooms whose dot a tap can hit
   * (SPEC-033 §4). Coarse pointers only, and only where the tooltip would have
   * something to say — the same non-empty-notes test that gates the tooltip
   * itself, so the dot advertises exactly the labels worth tapping.
   */
  const noteDotRooms = $derived(
    isCoarsePointer
      ? mapRooms.filter((r) => (roomNotes?.get(r.id) ?? '').trim().length > 0)
      : [],
  );
  const noteDotRoomIds = $derived(new Set(noteDotRooms.map((r) => r.id)));

  /** A tap inside a note dot pins that room's tooltip; a second tap on the same
   * dot closes it again. Returns whether the tap was consumed — the caller runs
   * this ahead of every tool, so a `false` here must leave the tool's tap
   * untouched. */
  function handleNoteDotPointerDown(latticeRaw: Point): boolean {
    if (!isCoarsePointer) return false;
    const room = pickNoteDotAt(latticeRaw, noteDotRooms, latticeThreshold(PICK_PX));
    if (!room) {
      // Anywhere else on the stage dismisses a pinned tooltip, but does not
      // consume the tap: the tool the user has in hand still gets it.
      pinnedLabel = null;
      return false;
    }
    if (pinnedLabel?.id === room.id) {
      pinnedLabel = null;
      return true;
    }
    pinnedLabel = { id: room.id, ...labelTooltipAnchor(room) };
    return true;
  }

  /** Canvas-relative pixels for a room's tooltip, anchored on the label's cell
   * centre — shared by the hover and the pinned paths so both popovers sit in
   * the same place, and matching `openLabelEditor`. */
  function labelTooltipAnchor(room: MapRoom): { x: number; y: number } {
    if (!engine) return { x: 0, y: 0 };
    return engine.toScreen({
      x: (room.labelAnchor.x + 0.5) * cellSize,
      y: (room.labelAnchor.y + 0.5) * cellSize,
    });
  }

  function updateHoverLabel(latticeRaw: Point): void {
    // Hover is a fine-pointer affordance, and on a coarse pointer the note dot
    // is the *only* way to the tooltip (SPEC-033 §4). A touch still emits
    // `pointermove` around a tap, and the dot sits on the label cell's top edge
    // — inside the cell `pickMapRoomAt` tests — so honouring those moves would
    // fill the hover slot for the very room being tapped. `activeLabel` would
    // then fall back to it the instant the pin cleared, leaving a tooltip that
    // will not close: exactly the latched-hover behaviour §4 exists to remove.
    // This also subsumes a pinned-label guard, since `pinnedLabel` is only ever
    // set on a coarse pointer.
    if (isCoarsePointer) {
      hoverLabel = null;
      return;
    }
    // A gesture in progress means the pointer is busy doing something else —
    // including a space/right-drag pan, which sweeps across labels wholesale.
    if (gestureActive || dragging || activeDrag || objectDrag || collecting.length > 0) {
      hoverLabel = null;
      return;
    }
    const room = pickMapRoomAt(latticeRaw, mapRooms);
    if (!room) {
      hoverLabel = null;
      return;
    }
    if (hoverLabel?.id === room.id) return; // already showing; don't jitter it
    if (!engine) return;
    hoverLabel = { id: room.id, ...labelTooltipAnchor(room) };
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

  // ---- collaboration tools: pen (freehand), ping, measure, live cursor ----
  // These operate on the *pixel-space* world point (drawings, cursors, and
  // pings store pixel-space coords, like tokens — unlike the lattice-snapped
  // points the floor/wall/door tools consume). The `handle*` helpers return
  // true when they consume the event, so the default lattice pointer flow is
  // skipped for those tools.

  function annotationsWithLiveStroke(source: Drawing[] = drawings): Drawing[] {
    if (tool !== 'pen' || penPoints.length < 2) return source;
    const live: Drawing = {
      id: '__live__',
      layer: 'mapping',
      kind: 'freehand',
      points: penPoints,
      style: {},
    };
    return [...source, live];
  }

  /** Bbox corners (lattice space) for the Object mode selection highlight —
   * null when nothing's selected or the selected object no longer exists
   * (e.g. deleted by a peer). */
  /** The highlight box for one selected object. `objectBounds` does the work
   * against the *displayed* records, so a mid-drag object's box tracks its
   * working copy; the label is the one departure — its box follows the snap
   * step rather than `pickMapRoomAt`'s whole cell, since that is the precision
   * `placeLabelAt` actually placed it at. */
  function objectHighlightBBox(sel: ObjectSelection): { a: Point; b: Point } | null {
    const disp = displayOverlayState();
    if (sel.kind === 'mapRoom') {
      const r = disp.mapRooms.find((x) => x.id === sel.id);
      if (!r) return null;
      const a = r.labelAnchor;
      const size = vectorMap.snapCellSize(effectiveSnap());
      return { a: { x: a.x, y: a.y }, b: { x: a.x + size, y: a.y + size } };
    }
    return objectBounds(sel, { ...disp, doors }, cellSize);
  }

  function publishCursorThrottled(worldPx: { x: number; y: number }): void {
    const now = Date.now();
    if (now - lastCursorPublish < 80) return;
    lastCursorPublish = now;
    store.publishCursor(roomId, worldPx);
  }

  // ---- placed background transform (SPEC-038 §§3–4) ----
  // The referee selects an image in the Assets activity's Backgrounds panel;
  // from then on a drag that starts inside its rect moves it, and a drag on
  // its bottom-right handle resizes it with the native aspect ratio locked.
  // The rect follows the pointer by moving the Pixi sprite directly — one
  // settled `setBackgroundTransform` lands on pointer-up (RULE-003), never a
  // write per frame.

  /** Screen-pixel grab radius for the resize handle, converted to lattice
   * units through the live zoom so it stays the same size on screen. Slightly
   * larger than the drawn handle, the way a hit target should be. */
  const BG_HANDLE_GRAB_PX = 10;

  /** The in-progress background gesture, or `null`. `rect` is the live rect
   * (lattice units) — a plain local, not `$state`: it changes per pointer
   * frame and drives the sprite directly, exactly like `penPoints`. */
  let bgDrag: {
    id: string;
    kind: 'body' | 'handle';
    /** Where the pointer went down, lattice units — a move is measured as a
     * delta from here so the image never jumps to centre on the cursor. */
    from: Point;
    start: BgRect;
    rect: BgRect;
    /** Native width ÷ height of the loaded texture, so a resize can restore
     * the true ratio even for a legacy rect that was folded to the whole
     * grid and is therefore stretched. */
    aspect: number;
  } | null = null;

  function backgroundRect(bg: MapBackground): BgRect {
    return { x: bg.x, y: bg.y, w: bg.w, h: bg.h };
  }

  /** The live rect of a selected background: the in-progress gesture's if one
   * is running, the stored one otherwise. What both the overlay and the
   * sprite are drawn from. */
  function liveBackgroundRect(bg: MapBackground): BgRect {
    return bgDrag && bgDrag.id === bg.id ? bgDrag.rect : backgroundRect(bg);
  }

  function nativeAspect(id: string, fallback: BgRect): number {
    const texture = bgSprites.get(id)?.texture;
    const w = texture?.width ?? 0;
    const h = texture?.height ?? 0;
    return w > 0 && h > 0 ? w / h : fallback.w / fallback.h || 1;
  }

  /** Repositions the selected image's sprite mid-gesture without waiting for
   * the store round-trip — the same "draw the drag, commit on release"
   * pattern the floor tools and token drags already use. */
  function applyLiveBackgroundRect(id: string, rect: BgRect): void {
    const sprite = bgSprites.get(id);
    if (!sprite) return;
    sprite.position.set(rect.x * cellSize, rect.y * cellSize);
    sprite.width = rect.w * cellSize;
    sprite.height = rect.h * cellSize;
  }

  function handleBackgroundPointerDown(worldPx: { x: number; y: number }): boolean {
    const bg = selectedBackground;
    if (!bg) return false;
    const p = toLatticeRaw(worldPx);
    const rect = backgroundRect(bg);
    const grab = latticeThreshold(BG_HANDLE_GRAB_PX);
    const hit = backgroundHitTest(rect, p, grab);
    if (!hit) return false; // outside the image: the active tool keeps the press
    bgDrag = { id: bg.id, kind: hit, from: p, start: rect, rect, aspect: nativeAspect(bg.id, rect) };
    return true;
  }

  function handleBackgroundPointerMove(worldPx: { x: number; y: number }): boolean {
    if (!bgDrag) return false;
    const p = toLatticeRaw(worldPx);
    bgDrag.rect =
      bgDrag.kind === 'body'
        ? moveBackground(bgDrag.start, p.x - bgDrag.from.x, p.y - bgDrag.from.y)
        : resizeBackground(bgDrag.start, p, bgDrag.aspect);
    applyLiveBackgroundRect(bgDrag.id, bgDrag.rect);
    renderAll();
    return true;
  }

  async function handleBackgroundPointerUp(): Promise<boolean> {
    const drag = bgDrag;
    if (!drag) return false;
    bgDrag = null;
    // A click that never moved is not a transform — and writing one would
    // spend a Firestore write per stray press on the image.
    if (backgroundRectChanged(drag.start, drag.rect)) {
      await store.setBackgroundTransform(roomId, mapId, drag.id, drag.rect);
    }
    renderAll();
    return true;
  }

  function handleCollabPointerDown(worldPx: { x: number; y: number }): boolean {
    if (tool === 'ping') {
      store.publishPing(roomId, worldPx);
      return true;
    }
    if (tool === 'pen') {
      penPoints = [worldPx];
      return true;
    }
    if (tool === 'measure') {
      // Raw lattice, deliberately unsnapped: a ruler that jumps to grid
      // vertices can't answer "how far is it from here to there".
      const p = toLatticeRaw(worldPx);
      measureDrag = { a: p, b: p };
      return true;
    }
    return false;
  }

  function handleCollabPointerMove(worldPx: { x: number; y: number }): boolean {
    if (tool === 'ping') return true; // click-only, nothing to drag
    if (tool === 'pen') {
      if (penPoints.length) {
        penPoints = [...penPoints, worldPx];
        renderAll();
      }
      return true;
    }
    if (tool === 'measure') {
      if (measureDrag) {
        measureDrag = { a: measureDrag.a, b: toLatticeRaw(worldPx) };
        renderAll();
        syncMeasureReadout();
      }
      return true;
    }
    return false;
  }

  async function handleCollabPointerUp(): Promise<boolean> {
    if (tool === 'ping') return true;
    if (tool === 'measure') {
      // Nothing is committed and nothing is remembered — the span exists only
      // while the button is down.
      measureDrag = null;
      renderAll();
      syncMeasureReadout();
      return true;
    }
    if (tool === 'pen') {
      if (penPoints.length > 1) {
        await store.writeDrawing(roomId, mapId, {
          layer: 'mapping',
          kind: 'freehand',
          points: penPoints,
          style: {},
        });
      }
      penPoints = [];
      renderAll();
      return true;
    }
    return false;
  }

  function onPointerDown(p: Point, raw: Point): void {
    hoverRaw = raw;
    if (selecting) {
      beginSelectGesture(p);
      renderAll();
      return;
    }
    if (tool === 'room' || tool === 'corridor' || tool === 'ngon' || captureAllowed) {
      if (awaitingSecondClick) {
        // Second click of a click-to-start/click-to-end shape — commit using
        // the pending first point (`dragStart`) and this click as the end.
        dragCur = p;
        dragCurRaw = raw;
        if (captureAllowed) {
          finishCaptureStroke();
        } else {
          void finishFloorStroke();
        }
        return;
      }
      dragging = true;
      dragStart = p;
      dragCur = p;
      dragStartRaw = raw;
      dragCurRaw = raw;
      // A fresh gesture has declared no axis yet (SPEC-028 §11).
      bendAxis = null;
    } else if (tool === 'carve') {
      // The brush is a single continuous drag: no click-to-start/click-to-end
      // second point, and it collects a polyline rather than two corners.
      // Cell-anchored (SPEC-028): the collected polyline is raw, like
      // dragStartRaw/dragCurRaw for Room/Corridor/N-gon.
      dragging = true;
      dragStart = p;
      dragCur = p;
      dragStartRaw = raw;
      dragCurRaw = raw;
      collecting = [raw];
    } else if (tool === 'path') {
      // Cell-anchored (SPEC-028 §7): Path collects *raw* click points, like the
      // Carve brush, because a band centred in the pointed-at tile needs to know
      // which tile that was — a vertex-snapped point has already lost it.
      collecting.push(raw);
      dragCur = p;
      dragCurRaw = raw;
    } else if (tool === 'polygon' || tool === 'wall') {
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
    dragStartRaw = null;
    dragCurRaw = null;
    bendAxis = null;
    clearDraft();
    await commitStroke(stroke);
    renderAll();
  }

  /** Commits the in-progress Capture stroke (drag or click-to-start/
   * click-to-end) to `MapToolController.pendingBattleCapture` (SPEC-029 §1)
   * — no document write, unlike `finishFloorStroke`: nothing outside this
   * client's own tool state changes until WI-036's Start button turns the
   * rect into a real temporary `GameMap`. Resets the shared 2-point state the
   * same way. Never publishes a draft: `publishDraft` only broadcasts for
   * `isFloorStrokeTool`, which Capture deliberately isn't. */
  function finishCaptureStroke(): void {
    if (dragStartRaw && dragCurRaw) {
      mapCtrl.pendingBattleCapture = vectorMap.captureRect(dragStartRaw, dragCurRaw);
    }
    dragging = false;
    awaitingSecondClick = false;
    dragStart = null;
    dragCur = null;
    dragStartRaw = null;
    dragCurRaw = null;
    bendAxis = null;
    renderAll();
  }

  function onPointerMove(p: Point, raw: Point): void {
    hoverRaw = raw;
    if (selecting) {
      if (activeDrag) {
        updateSelectDrag(p);
      } else if (objectDrag) {
        updateObjectDrag(p);
      } else if (lasso) {
        lasso.b = p;
      } else {
        hoverHandle = pickVertexHandle(
          p,
          vertexHandles(regions, walls, doors),
          latticeThreshold(PICK_PX),
        );
      }
      renderAll();
      return;
    }
    // The brush samples its polyline as the pointer moves, thinned to a
    // minimum on-screen spacing so a slow drag doesn't collect hundreds of
    // near-identical points for the boolean backend to chew through.
    if (tool === 'carve' && dragging) {
      const last = collecting[collecting.length - 1];
      if (!last || Math.hypot(raw.x - last.x, raw.y - last.y) > latticeThreshold(BRUSH_SAMPLE_PX)) {
        collecting.push(raw);
      }
    }
    dragCur = p;
    dragCurRaw = raw;
    // The Corridor's first leg follows the axis this gesture first commits to
    // (SPEC-028 §11): latched once, past a half-cell of travel, and held until
    // the gesture ends however the pointer moves afterwards. Latching here — on
    // the raw pointer, before the preview is rebuilt — is what makes the live
    // ghost show the same L that will commit. Also runs while a click-to-start
    // corridor is waiting for its second click, where `dragStartRaw` is still
    // the pending first point.
    if (tool === 'corridor') bendAxis = latchBendAxis(bendAxis, dragStartRaw, raw);
    publishDraft();
    renderAll();
  }

  async function onPointerUp(p: Point, raw: Point): Promise<void> {
    hoverRaw = raw;
    if (selecting) {
      if (activeDrag) await endSelectDrag();
      else if (objectDrag) await endObjectDrag();
      else if (lasso) finishLasso();
      renderAll();
      return;
    }
    if (dragging && tool === 'carve') {
      // A brush stroke always commits on release, even a single click (which
      // paints one cell / one dab) — there is no degenerate case to defer.
      dragCur = p;
      dragCurRaw = raw;
      const stroke = currentStroke();
      dragging = false;
      dragStart = null;
      dragCur = null;
      dragStartRaw = null;
      dragCurRaw = null;
      bendAxis = null;
      collecting = [];
      clearDraft();
      await commitStroke(stroke);
      renderAll();
      return;
    }
    if (dragging) {
      dragCur = p;
      dragCurRaw = raw;
      // Measured on the *raw* pointer: the question is whether the hand moved,
      // and a snapped comparison answers a different one (whether the snap
      // result changed), which under cell snap is false for a deliberate drag
      // inside one cell and true for a twitch across a cell line.
      const movedFar =
        dragStartRaw &&
        Math.hypot(raw.x - dragStartRaw.x, raw.y - dragStartRaw.y) >
          latticeThreshold(CLICK_MOVE_THRESHOLD_PX);
      if (!movedFar && fogCarve) {
        // A plain click while carving fog reveals/hides the whole floor region
        // under the pointer — the referee's actual unit of work — rather than
        // starting a two-click shape.
        dragging = false;
        dragStart = null;
        dragCur = null;
        dragStartRaw = null;
        dragCurRaw = null;
        bendAxis = null;
        clearDraft();
        await commitFogRegionAt(p);
        renderAll();
        return;
      }
      if (!movedFar && (tool === 'room' || tool === 'corridor' || tool === 'ngon' || captureAllowed)) {
        // A plain click, not a drag — wait for the second click instead of
        // committing a degenerate (zero-size) shape. `dragStart`/`dragCur`
        // stay set so the live preview keeps tracking the cursor.
        dragging = false;
        awaitingSecondClick = true;
        renderAll();
        return;
      }
      if (captureAllowed) {
        finishCaptureStroke();
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
      await commitStroke(stroke);
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
    dragStartRaw = null;
    dragCurRaw = null;
    bendAxis = null;
    activeDrag = null;
    clearSelection();
    penPoints = [];
    measureDrag = null;
    // The tooltip's position is captured in screen pixels, so anything that
    // moves the camera (a pan gesture calls this) invalidates it — the pinned
    // one included (SPEC-033 §4).
    hoverLabel = null;
    pinnedLabel = null;
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
      // Escape is the canvas-side way out of a background transform
      // (SPEC-038 §§3–4): it drops the selection, and with it the overlay and
      // the pointer interception, without a trip back to the Assets activity.
      if (selectedBackground) {
        bgDrag = null;
        mapCtrl.selectedBackgroundId = null;
      }
      cancelStroke();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // The whole selection, vertices included (SPEC-037 §3) — not just the
      // one object the retired Object mode could hold.
      if (selecting && (selectedHandles.length || selectedObjects.length)) {
        e.preventDefault();
        void deleteSelection();
      }
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') altKey = false;
  }

  // ---- render ----

  /** Publishes the last computed dimension chip to the hidden DOM readout.
   * Called from the Pixi pointer handlers only — never from an effect, and
   * never from `renderAll` itself (see `strokeMeasure`'s declaration). */
  function syncMeasureReadout(): void {
    strokeMeasureText_ = strokeMeasure?.text ?? '';
    const cell = targetedCellFor(tool, effectiveSnap(), dragCurRaw ?? hoverRaw);
    // Same split as `strokeMeasureText_`: a *string* mirror, assigned only on
    // the pointer-event path, never from `renderAll`.
    snapCellText_ = cell ? `${cell.x},${cell.y} @${cell.size}` : '';
    const band = targetedBandFor(tool, effectiveSnap(), bandWidth, dragCurRaw ?? hoverRaw);
    snapBandText_ = band
      ? band.kind === 'rect'
        ? `${band.x},${band.y} @${band.size}`
        : `⌀ ${band.radius * 2}`
      : '';
  }

  function renderAll(): void {
    if (!engine) return;
    // One map, one coordinate space (RULE-006), so one grid: a hex crawl draws
    // the axial lattice and its coordinate pills (SPEC-030 §1), every other map
    // draws the square one exactly as before. `hex.size` is the hex map's
    // render-time multiplier; `grid.cellSize` is not.
    if (hexGrid) engine.renderHexGrid(hexGrid.size);
    else engine.renderGrid(gridCellSize, map.gridSettings.subdivide);
    const disp = displayState();
    const liveScene = activeDrag ? buildVectorScene(disp.regions, disp.walls, disp.doors) : scene;
    engine.renderScene(liveScene, cellSize);
    engine.renderDoors(disp.doors, cellSize);
    const dispOverlay = displayOverlayState();
    engine.renderOverlayObjects(
      dispOverlay.symbols,
      dispOverlay.mapRooms,
      cellSize,
      editingLabelId,
      noteDotRoomIds,
    );
    engine.renderAnnotations(annotationsWithLiveStroke(dispOverlay.drawings));
    // Fog sits above the overlay and below tokens, so it must be drawn before
    // `syncSprites` positions them. The referee sees a translucent wash (where
    // fog *remains*); players see it opaque.
    engine.renderFog({
      enabled: map.fog?.enabled ?? false,
      revealed: fogRegions.map((r) => r.rings),
      cellSize,
      mode: isGM ? 'gm' : 'player',
    });
    // The selected background's alignment grid (SPEC-038 §4) — present the
    // whole time something is selected, not only mid-drag (DEC-063), and gone
    // the moment nothing is. Drawn from the *live* rect so it tracks the
    // image through a move or resize rather than lagging a frame behind it.
    engine.renderBackgroundAlignment(
      selectedBackground ? liveBackgroundRect(selectedBackground) : null,
      cellSize,
      // The drawn grid square in lattice units — halved on a battle map, the
      // same conversion `renderGrid`'s own `gridCellSize` carries.
      gridCellSize / cellSize,
      map.gridSettings.subdivide,
    );

    const strokePolys = FLOOR_TOOLS.includes(tool) ? currentStroke() : null;
    const previewSegs =
      tool === 'wall'
        ? buildWallPreviewSegs(collecting, dragCur)
        : tool === 'door' && collecting.length === 1
          ? [buildDoorPreviewSeg(collecting[0]!, dragCur)].filter(
              (s): s is vectorMap.Segment => s !== null,
            )
          : [];
    const visibility =
      tool === 'eye' && eye
        ? vectorMap.visibilityPolygon(eye, liveScene.sight, eyeMaxDistLattice())
        : null;
    // The in-progress Capture rect (SPEC-029 §1): always the raw drag, always
    // whole cells, regardless of the map's snap mode — `vectorMap.captureRect`
    // takes no mode argument at all.
    const capturePreview =
      captureAllowed && dragStartRaw && dragCurRaw
        ? vectorMap.captureRect(dragStartRaw, dragCurRaw)
        : null;
    // Live size readout for the click-and-drag shapes. Derived purely from the
    // in-progress drag, so committing or cancelling the stroke (which nulls
    // `dragStart`/`dragCur`) makes the chip disappear on its own. Plain local:
    // see `strokeMeasure`'s declaration for why this must not be reactive.
    // The Measure tool reuses the very same chip, so a span read with the ruler
    // and a span read while drawing a room agree on units and rounding.
    // Capture never goes through `strokeMeasureText`, which is typed to the
    // floor primitives and reports in the map's `RoomMeasure` units — see
    // `captureMeasureText`'s own doc comment for why cells, not feet.
    strokeMeasure =
      tool === 'measure'
        ? measureSpanText(measureDrag?.a ?? null, measureDrag?.b ?? null, map.measure ?? null)
        : captureAllowed
          ? captureMeasureText(dragStartRaw, dragCurRaw)
          : strokeMeasureText(
              tool as FloorPrimitiveTool,
              // Cell-anchored tools measure the raw drag, since the snapping that
              // decides the committed size happens inside the readout itself.
              isCellAnchoredTool(tool) ? dragStartRaw : dragStart,
              isCellAnchoredTool(tool) ? dragCurRaw : dragCur,
              map.measure ?? null,
              effectiveSnap(),
            );

    engine.renderToolPreview(
      {
        strokePolys,
        captureRect: capturePreview,
        // Revealing fog previews as "adding floor", hiding it as "adding
        // rock" — the same read as carving the floor itself.
        strokeSubtract: carveSubtract,
        previewSegs,
        // The brush's samples are an implementation detail, not placed
        // vertices — dotting every one of them just speckles the preview.
        // Path's points are raw (cell-anchored), so its dots go where the
        // points will actually land: the centre of the cell each click was in.
        collecting:
          tool === 'carve'
            ? []
            : tool === 'path'
              ? collecting.map((p) => vectorMap.snapCellCenter(p, effectiveSnap()))
              : collecting,
        vertexHandles: selecting ? vertexHandles(disp.regions, disp.walls, disp.doors) : [],
        hoveredHandle: hoverHandle,
        selectedHandles: selecting ? selectedHandles : [],
        lasso: lasso ? lassoBBox(lasso.a, lasso.b) : null,
        coarsePointer: isCoarsePointer,
        visibility,
        eye,
        measure: strokeMeasure,
        ruler: measureDrag,
        // Cell-anchored tools point their dot at the anchor they actually use —
        // the centre of the targeted cell. Leaving it on the vertex-snapped
        // point would have it sit on a grid corner that no longer means
        // anything to Room, Corridor or N-gon.
        cursorSnap: snapCursorPoint(),
        // A carve tool's dot reads as the material it's about to lay down;
        // Wall/Door place geometry rather than carving, so they keep the
        // selection yellow every other tool affordance uses. Reveal/Hide read
        // as floor/rock too — they uncover and re-cover the same material.
        cursorSnapKind: FLOOR_TOOLS.includes(tool) ? (carveSubtract ? 'rock' : 'floor') : 'select',
        cursorCell: targetedCellFor(tool, effectiveSnap(), dragCurRaw ?? hoverRaw),
        // Corridor/Path's band — narrower than the whole tile whenever
        // `bandWidth` is below the snap step (WI-052).
        cursorBand: targetedBandFor(tool, effectiveSnap(), bandWidth, dragCurRaw ?? hoverRaw),
        objectHighlights: selecting
          ? selectedObjects
              .map((sel) => objectHighlightBBox(sel))
              .filter((b): b is { a: Point; b: Point } => b !== null)
          : [],
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
      const blob = await engine.exportPng({
        regions,
        cellSize,
        marginCells: EXPORT_MARGIN_CELLS,
        maxLayer: mapCtrl.exportMaxLayer,
      });
      downloadBlob(blob, `${roomId}-map.png`);
    } finally {
      mapCtrl.exportingPng = false;
    }
  }

  // ---- Battle map quick sheet preview (SPEC-029 §§2, 5) — reuses the same
  // engine export, pointed at the candidate capture rect instead of the
  // whole floor, background/floor/overlay only and no grid, since that's
  // exactly what a battle map itself renders (§4). ----

  function exportBattlePreview(rect: vectorMap.BBox): Promise<Blob> {
    if (!engine) return Promise.reject(new Error('map view not mounted'));
    return engine.exportPng({
      regions,
      cellSize,
      marginCells: 0,
      maxLayer: 'overlay',
      hideGrid: true,
      frame: {
        x: rect.minX * cellSize,
        y: rect.minY * cellSize,
        width: (rect.maxX - rect.minX) * cellSize,
        height: (rect.maxY - rect.minY) * cellSize,
      },
      backgroundColor: backgroundState.kind === 'color' ? hexToNumber(backgroundState.color) : null,
    });
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

  <!-- The only DOM drag handlers on the map: a token thrown here from a quick
  sheet arrives as an HTML5 drop, since sheet and canvas can't share Pixi's
  federated pointer events. All other map input stays on the Pixi stage. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="vf-canvas-wrap"
    bind:this={hostEl}
    data-testid="vector-map-canvas"
    ondragover={onCanvasDragOver}
    ondrop={onCanvasDrop}
  >
    {#if editingLabelId}
      <textarea
        bind:this={labelEditInputEl}
        bind:value={editingLabelText}
        data-testid="label-edit-input"
        class="vf-label-editor"
        style={`left:${editingLabelPos.x}px; top:${editingLabelPos.y}px; --label-font:${labelFontPx}px;`}
        rows="1"
        placeholder="Room name…"
        onkeydown={handleLabelEditKeydown}
      ></textarea>
    {/if}

    {#if showLabelTooltip && activeLabel}
      <!-- `pointer-events: none` (see the CSS) so it can never eat a click on
      the label it is describing. Positioned below-right of the label's cell
      centre, then clamped so a label near an edge doesn't push it off screen.
      One popover for both paths: hovered on a fine pointer, pinned by a tap on
      the note dot on a coarse one (SPEC-033 §4). -->
      <div
        class="vf-label-tip"
        data-testid="map-label-tooltip"
        style={`--tip-x:${activeLabel.x}px; --tip-y:${activeLabel.y}px;`}
      >
        <MarkdownView text={activeLabelText} />
      </div>
    {/if}
  </div>

  <div class="vf-hint">{hint}</div>

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
      <!-- Presence dimming (R26.2) — the Pixi alpha is a bitmap, so mirror the
      decision itself rather than leaving the e2e to eyeball a canvas. -->
      <span data-testid={`token-away-${token.id}`}>{isAway(token)}</span>
    {/each}
    {#each collapsedGroups as g (g.id)}
      <span data-testid={`collapsed-group-${g.id}`}>{g.memberTokenIds.length}</span>
    {/each}
    {#each mapRooms as r (r.id)}
      <span data-testid={`maproom-name-${r.id}`}>{r.name}</span>
      <span data-testid={`maproom-key-${r.id}`}>{r.key}</span>
      <!-- The note dot (SPEC-033 §4) is Pixi-drawn, so this is how a test sees
      whether one renders: `true` only on a coarse pointer, and only for a room
      whose players' notes are non-empty. -->
      <span data-testid={`maproom-note-dot-${r.id}`}>{noteDotRoomIds.has(r.id)}</span>
    {/each}
    <!-- Which actor the last token pick-up raised in the Character sheet: a
    seat id for a character, a token id for a creature (empty = none). The
    sheet itself lives outside this component. -->
    <span data-testid="selected-actor">{selectedActorId ?? ''}</span>
    <!-- The dimension chip itself is drawn on the Pixi canvas, so the readout
    is how a test can see it (empty = no chip showing). -->
    <span data-testid="stroke-dimensions">{strokeMeasureText_}</span>
    <!-- Same chip, but only while the Measure tool has a span under the
    pointer, so a test can tell a ruler reading from a drag dimension. -->
    <span data-testid="measure-readout">{tool === 'measure' ? strokeMeasureText_ : ''}</span>
    <!-- The targeted-cell highlight is Pixi-drawn too: `x,y @size` in lattice
    units, empty when no cell is targeted (free snap, or a tool without one). -->
    <span data-testid="snap-cell-readout">{snapCellText_}</span>
    <!-- The Corridor/Path band indicator (WI-052) — `x,y @size` under Cell/Half
    snap (the band, narrower than the tile whenever bandWidth is below the
    snap step), `⌀ size` under Free snap, empty for every other tool. -->
    <span data-testid="snap-band-readout">{snapBandText_}</span>
    <!-- The Capture tool's last committed rect (SPEC-029 §1) — `pendingBattleCapture`
    on the shared controller, so a test (and eventually WI-036's quick sheet)
    can see it without reading the Pixi canvas. `minX,minY,maxX,maxY` in
    lattice units, empty before any capture has been drawn this mount. -->
    <span data-testid="battle-capture-rect"
      >{mapCtrl.pendingBattleCapture
        ? `${mapCtrl.pendingBattleCapture.minX},${mapCtrl.pendingBattleCapture.minY},${mapCtrl.pendingBattleCapture.maxX},${mapCtrl.pendingBattleCapture.maxY}`
        : ''}</span
    >
    <!-- Count of tokens whose imageRef failed to load (IN-008/WI-032) — the
    warning badge itself is Pixi-drawn, so this is how a test observes it. -->
    <span data-testid="broken-token-count">{brokenTokenCount}</span>
    <span data-testid="floor-region-count">{regions.length}</span>
    <span data-testid="fog-enabled">{map.fog?.enabled ?? false}</span>
    <span data-testid="fog-region-count">{fogRegions.length}</span>
    <span data-testid="wall-count">{walls.length}</span>
    <span data-testid="door-count">{doors.length}</span>
    <span data-testid="drawing-count">{drawings.length}</span>
    <!-- The one selected object, `kind:id` — empty when nothing, or more than
    one thing, is picked. -->
    <span data-testid="selected-object"
      >{selectedObject ? `${selectedObject.kind}:${selectedObject.id}` : ''}</span
    >
    <!-- Everything the Select tool holds (SPEC-037 §2): vertex handles plus
    objects. The handles are Pixi-drawn, so this count is how a test sees what
    a lasso caught. -->
    <span data-testid="selection-count">{selectionCount_}</span>
    <span data-testid="last-batch-move-count">{lastBatchMoveCount}</span>
    <!-- What one *drawn grid square* is worth. On a battle map that is half a
    lattice cell, so the per-square value halves to match (SPEC-029 §4);
    measured distances are unchanged, since a doubled square count against a
    halved per-square value is the same span of ground. -->
    <span data-testid="measure-summary"
      >{displayPerSquare(map)}/{map.measure.unit}</span
    >
    <span data-testid="grid-subdivide">{map.gridSettings.subdivide}</span>
    <!-- Which coordinate space this map's geometry is in (RULE-006): `hex` for
    a hex crawl, `square` for everything else. The hex grid and its coordinate
    pills are Pixi-drawn, so this plus `map-hex-size` is how a test sees which
    grid the renderer was handed. -->
    <span data-testid="map-grid-kind">{hexGrid ? 'hex' : 'square'}</span>
    <!-- The hex circumradius in pixels — the hex map's render-time multiplier
    (SPEC-030 §1), empty on a square-grid map. -->
    <span data-testid="map-hex-size">{hexGrid ? hexGrid.size : ''}</span>
    <!-- The camera this map was last left at (see `mapCtrl.camera`) — written
    on unmount, so after an activity round-trip it is what the view was
    restored to. -->
    <span data-testid="map-camera"
      >{mapCtrl.camera[ownMapId]
        ? `${Math.round(mapCtrl.camera[ownMapId]!.x)},${Math.round(mapCtrl.camera[ownMapId]!.y)},${mapCtrl.camera[ownMapId]!.scale.toFixed(2)}`
        : ''}</span
    >
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
  .vf-canvas-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
    /* The map implements its own pan/pinch/drag on the stage's federated
       pointer events (`map/pan-zoom.ts`); without this declaration the
       browser's native touch gestures race the map's own, non-
       deterministically (SPEC-033 §2). Presentation-layer only — no
       pointer handler or coordinate transform lives here. */
    touch-action: none;
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
      bold var(--label-font, 13px) / 1.3 system-ui,
      sans-serif;
    text-align: center;
  }
  .vf-label-editor:focus {
    outline: 1px solid rgba(127, 178, 255, 0.6);
    outline-offset: 2px;
  }
  /* The hovered label's long description. Same panel treatment as the Room
     sheet's row preview (`RoomsPanel`'s `.notes-pop`), so the two read as one
     thing shown in two places. `max-width`/`max-height` keep a long note from
     covering the map; `translate` plus the `max()`/`min()` clamps keep it inside
     the canvas when the label is near an edge. */
  .vf-label-tip {
    position: absolute;
    z-index: 6;
    transform: translate(-50%, 0);
    left: clamp(120px, var(--tip-x, 0px), calc(100% - 120px));
    top: min(calc(var(--tip-y, 0px) + 14px), calc(100% - 232px));
    width: 240px;
    max-height: 220px;
    overflow-y: auto;
    background: var(--bg-inset);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.78rem;
    pointer-events: none;
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
