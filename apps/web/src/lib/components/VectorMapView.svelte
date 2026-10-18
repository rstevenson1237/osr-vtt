<script lang="ts">
  import { VectorMapViewStrings as S } from '../strings/VectorMapView';
  import { getContext, onDestroy, onMount } from 'svelte';
  import * as PIXI from 'pixi.js';
  import {
    hexMap,
    vectorMap,
    buildVectorScene,
    canActOnToken,
    genColorHex,
    collapsedDragUpdates,
    currentActorTokenIds,
    groupAnchorId,
    isHexMap,
    parseRoomImageRef,
    snapFor,
    snapModeFromModifiers,
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
  import {
    creatureBatchColor,
    creatureBatchNames,
    defaultCreatureBatch,
    tokenRingColor,
  } from '../tokens/labels';
  import { letterStyleFor } from '../tokens/letter-style';
  import { hasTokenDrag, readTokenDrag } from '../tokens/drag';
  import { loadImageElement } from '../tokens/texture-load';
  import type { DialogService } from '../shell/dialogs.svelte';
  import {
    ASSET_STORE_KEY,
    CAMPAIGN_STORE_KEY,
    DIALOG_KEY,
    MAP_TOOL_KEY,
    ROOM_NOTES_KEY,
    SESSION_MODE_KEY,
    UNDO_KEY,
    type SessionMode,
  } from '../context';
  import type { RoomNotesDoc } from '../collab/room-notes.svelte';
  import MarkdownView from './MarkdownView.svelte';
  import {
    createVectorMapEngine,
    type RenderedScene,
    type ToolPreviewInput,
    type VectorMapEngine,
  } from '../map/vector-engine';
  import { createDragSight } from '../map/drag-sight';
  import {
    displayOverlayState as overlayStateFor,
    displayState as dragStateFor,
    objectHighlightBBox as highlightBBoxFor,
  } from '../map/drag-display';
  import {
    isAway as tokenIsAway,
    revealedAt as posRevealed,
    TOKEN_PX,
    tokenAtPoint,
    tokenRadiusPx,
  } from '../map/token-view';
  import { backgroundSpaceScale, type BackgroundSpace } from '../map/background-view';
  import { latticeThreshold as latticeThresholdFor } from '../map/view-helpers';
  import { createMapRenderer } from '../map/map-renderer';
  import { MapLabels } from '../map/map-labels.svelte';
  import { MapDraw } from '../map/map-draw.svelte';
  import { HexAuthoringController } from '../map/map-hex.svelte';
  import { MapBackgrounds } from '../map/map-backgrounds.svelte';
  import { applyTheme, hexToNumber, readMapTheme, resolveThemeName } from '../theme';
  import {
    carveKind,
    isFogCarve,
    isSelectTool,
    MapToolController,
    type MapToolId,
  } from '../shell/map-tool-controller.svelte';
  import { cursorForTool } from '../map/tool-groups';
  import type { UndoController } from '../shell/undo-controller.svelte';
  import {
    attractsToVertex,
    buildCarveOp,
    buildDoorPreviewSeg,
    buildDragOp,
    buildFloorStroke,
    buildFogCarveOp,
    buildHandleRemovalOp,
    buildObjectRemovalOp,
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
    lassoSelectTokens,
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
    hexMeasureSpanText,
    pathMeasureText,
    hexPathMeasureText,
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
  import { battleCameraBounds, displayPerSquare, gridStepPx, isBattleMap } from '../map/battle-map';

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
   *    `label` places/edits a `MapRoom` (`MapLabels.place`), everything else
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
  // Peer cursors, pings and in-progress carve strokes are the RTDB half of
  // RULE-003 and every one of them means "somebody else" — absent in a local
  // build rather than rendered empty (SPEC-041 §3).
  const { multiplayer } = getContext<SessionMode>(SESSION_MODE_KEY);
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
  const undoCtrl = getContext<UndoController>(UNDO_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);
  /** The per-map-room players' notes (a Yjs doc, see `collab/room-notes`) — the
   * long-form description behind a label. Optional: `RoomShell` provides it, but
   * this component is also mounted in isolation by tests. */
  const roomNotes = getContext<RoomNotesDoc | undefined>(ROOM_NOTES_KEY);

  /** `revealedAt`'s revealed set on a map with no hex controller (a square map,
   * or the instant before `onMount` builds one). */
  const NO_HEXES: ReadonlySet<string> = new Set();

  let hostEl: HTMLDivElement;
  let engine: VectorMapEngine | null = null;
  let ready = $state(false);

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
  /** The hex authoring seam (SPEC-066, DEC-133), constructed in `onMount` and
   * only on a hex map: a square map holds `null`, so the axial boundary is
   * whether the object exists rather than a guard in each method (RULE-006).
   * It owns the painted hexes, placed symbols, roads/rivers, the Road/River
   * run, the note hover and the Reveal / Hide stroke. `$state` because the
   * composers and the markup read it before it is constructed. */
  let hex = $state<HexAuthoringController | null>(null);

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
  /** The space this map's backgrounds are drawn and dragged in (SPEC-059 §3):
   * lattice units scaled by `cellSize` on a square map, world pixels on a hex
   * map, whose settled write converts them to `HexPoint` corners once. */
  const bgSpace = $derived<BackgroundSpace>(
    hexGrid ? { kind: 'hex', hexSize: hexGrid.size, cellSize } : { kind: 'square', cellSize },
  );
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
  /** The background the Select tool has picked up (SPEC-039 §2), if it is
   * still on this map and still unlocked — a lock applied elsewhere (another
   * client, or this one) drops the selection and its overlay immediately,
   * matching "unlocking is the only override; no gesture survives a lock"
   * (SPEC-039 §4). GM-only (DEC-063): a player's Select never sees a
   * background as an object, whatever its `locked` value. */
  const selectedBackground = $derived(
    isGM ? (backgrounds.find((b) => b.id === selectedBackgroundId && !b.locked) ?? null) : null,
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
  /** The Eye mark's lifetime (SPEC-046 §1) — client-local, since no other
   * client ever sees an eye. `EYE_LIFETIME_MS` is this renderer's own budget,
   * not a store TTL like the ping's: there is nothing to expire from a store
   * for state that never leaves this tab. */
  const EYE_LIFETIME_MS = 4000;
  let eyeRemainingMs = $state(EYE_LIFETIME_MS);
  /** Legible countdown for the engine's dot (1 = just placed, 0 = about to
   * clear); frozen while `canRevealFromEye` — see `startEyeTimer`. */
  const eyeAlpha = $derived(eyeRemainingMs / EYE_LIFETIME_MS);
  let eyeTimer: ReturnType<typeof setInterval> | undefined;
  const EYE_TICK_MS = 100;

  /** Ticks the eye's countdown down to zero and clears the mark — except
   * while `MapToolController.canRevealFromEye` is true (SPEC-046 §1 rule 4):
   * the eye is an input to a pending "reveal from here" action then, and
   * clearing itself out from under a referee still deciding whether to press
   * it is exactly the failure the countdown must not introduce. The clock
   * simply doesn't advance until the referee acts (`revealFromEye` clears
   * `eye` itself) or moves on (switches tool, or fog goes off), at which
   * point it resumes with whatever life was left. */
  function startEyeTimer(): void {
    clearInterval(eyeTimer);
    eyeTimer = setInterval(() => {
      if (!eye) {
        clearInterval(eyeTimer);
        return;
      }
      if (mapCtrl.canRevealFromEye) return;
      eyeRemainingMs = Math.max(0, eyeRemainingMs - EYE_TICK_MS);
      if (eyeRemainingMs === 0) {
        eye = null;
        clearInterval(eyeTimer);
      } else {
        renderer.invalidate('tools');
      }
    }, EYE_TICK_MS);
  }
  // Undo/redo/export state lives on the shared `mapCtrl` (single source of
  // truth), so the rail's `MapToolbar` and this editor never disagree
  // (action-plan item 4). The toolbar's `onUndo`/`onRedo`/`onExportPng`
  // handlers are wired to this editor's functions in `onMount`.
  // D3 (docs/VTT_Master_Plan.md Part V §2) — soft bounded-extent guard: a commit
  // that would push the floor union's bbox past MAX_FLOOR_EXTENT is blocked
  // with a visible error rather than silently applied/truncated.
  let floorExtentError = $state('');

  const HINTS: Record<ToolId, string> = S.toolHints;

  /** The hint the active tool shows, with the fog carve modes spelled out —
   * the same five shape tools mean something different while Carve is set to
   * one of them, and "click a carved area to reveal the whole room" is the
   * gesture a referee reaches for most. */
  const hint = $derived(fogCarve ? S.fogCarveHint(carveMode === 'fog') : HINTS[tool]);

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
   * Deliberately split in two. The measure itself is never stored:
   * `currentStrokeMeasure()` recomputes it from the stroke state, both for the
   * tools pass (which hands it straight to the engine) and for the pointer
   * path. `strokeMeasureText_` is the reactive mirror the hidden DOM readout
   * renders (the chip itself is on the Pixi canvas, so a readout is the only
   * way a test can see it).
   *
   * The draw passes must NOT write reactive state: their inputs are read
   * inside `$effect`s, and assigning a fresh object there re-invalidates them
   * every frame — `effect_update_depth_exceeded`. The mirror is a *string*,
   * written only on the pointer-event path (`syncMeasureReadout`).
   */
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
  /** The Select tool's background pick (SPEC-039 §2) — a document id, not the
   * `MapBackground` itself, so a lock or removal elsewhere is picked up
   * automatically through `selectedBackground` above rather than going stale.
   * Mutually exclusive with `selectedHandles`/`selectedObjects`; `$state` for
   * the same `selected-object` readout reason. */
  let selectedBackgroundId = $state<string | null>(null);
  /** The one selected object, or null while nothing — or more than one thing
   * — is picked. Rotate, the Room quick sheet's published selection and the
   * `selected-object` readout are all single-target by nature. */
  const selectedObject = $derived(selectedObjects.length === 1 ? selectedObjects[0]! : null);
  /** How many things (handles + objects) the Select tool currently holds. The
   * handles are a plain local, so this mirror is what makes the count visible
   * to the DOM readout; written on the pointer path only, never in a draw pass. */
  let selectionCount_ = $state(0);
  let objectDrag: ObjectDrag | null = null;

  // Mirror the rotatable part of the selection out to the toolbar, which shows
  // its Rotate/Flip button only while a single symbol or door is picked.
  $effect(() => {
    const kind = selectedObject?.kind;
    mapCtrl.rotatableSelection = kind === 'symbol' || kind === 'door' ? kind : null;
  });

  // Mirrors the shared per-client stack (DEC-108, owned by `RoomShell`) onto
  // `mapCtrl`, the toolbar's own read — same pattern as `rotatableSelection`
  // above.
  $effect(() => {
    mapCtrl.canUndo = undoCtrl.canUndo;
    mapCtrl.canRedo = undoCtrl.canRedo;
  });

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
      bgCtrl.applyColor(backgroundState);
      void bgCtrl.apply(orderedBackgrounds, bgSpace);
      wireStagePointerEvents(created);
      created.setGestureListener((active) => {
        gestureActive = active;
        if (active) cancelStroke();
      });
      ready = true;
      renderAll();
    })();

    // Each snapshot only assigns its state: the layer tracking effects (see
    // `renderer`) invalidate whichever layers read it, and a vertex drag in
    // progress keeps previewing over the new arrays (`liveScene`).
    unsubs.push(
      store.subscribeFloorRegions(roomId, mapId, (r) => {
        regions = r;
      }),
    );
    unsubs.push(
      store.subscribeFogRegions(roomId, mapId, (r) => {
        fogRegions = r;
      }),
    );
    unsubs.push(
      store.subscribeWalls(roomId, mapId, (w) => {
        walls = w;
      }),
    );
    unsubs.push(
      store.subscribeDoors(roomId, mapId, (d) => {
        doors = d;
      }),
    );
    unsubs.push(
      store.subscribeBackgrounds(roomId, mapId, (b) => {
        backgrounds = b;
      }),
    );
    // Painted hexes (SPEC-030 §§2–3) — hex maps only. A square-grid map has no
    // axial coordinates for these documents to be keyed by (RULE-006), so it
    // has none to read and this is one listener it never opens. The grid kind
    // is fixed at creation, so this decision can be made once here rather than
    // being re-derived per snapshot.
    // The controller is what makes that decision here (SPEC-066 §2): it is
    // constructed only on a hex map, and opens the painted-hex, symbol and
    // road/river listeners.
    if (hexGrid) {
      hex = new HexAuthoringController({
        invalidate: (...layers) => renderer.invalidate(...layers),
        store,
        roomId,
        mapId,
        tools: mapCtrl,
        hexSize: () => hexGrid?.size ?? 0,
        selecting: () => selecting,
        tool: () => tool,
        isGM: () => isGM,
        fogEnabled: () => map.fog?.enabled ?? false,
        gestureActive: () => gestureActive,
        dragging: () => dragging,
        isCoarsePointer: () => isCoarsePointer,
        effectiveSnap: () => effectiveSnap(),
        toScreen: (p) => engine?.toScreen(p) ?? null,
        pickBackground: (worldPx) => bgCtrl.pointerDown(worldPx),
        dropBackgroundPick: () => {
          selectedBackgroundId = null;
          syncSelectionCount();
        },
      });
      unsubs.push(...hex.subscribe());
      // The hex-tile body of the Map tools sheet (SPEC-030 §§2–5) writes
      // through these three handlers, the same mirror-plus-callbacks shape
      // `onUndo`/`canUndo` use: the sheet knows the catalogs, the controller
      // knows the store, the room and the map.
      const authoring = hex;
      mapCtrl.onSetHexTerrain = (kind) => authoring.setTerrain(kind);
      mapCtrl.onSetHexContents = (kind) => authoring.setContents(kind);
      mapCtrl.onSetHexNote = (note) => authoring.setNote(note);
    }
    unsubs.push(
      store.subscribeSymbols(roomId, mapId, (s) => {
        symbols = s;
      }),
    );
    unsubs.push(
      store.subscribeMapRooms(roomId, mapId, (r) => {
        mapRooms = r;
      }),
    );
    if (multiplayer) {
      unsubs.push(
        store.subscribeVectorMapDraft(roomId, mapId, (drafts) => {
          const peers = drafts.filter((d) => d.uid !== myUid);
          engine?.renderPeerDrafts(peers, cellSize);
        }),
      );
    }
    unsubs.push(
      store.subscribeDrawings(roomId, mapId, (d) => {
        drawings = d;
      }),
    );
    // Live collaboration overlays — rendered straight from the subscription
    // (their own sprite lifecycle in the engine), no `renderAll` needed.
    // (`draw.subscribe` opens nothing in a local build — SPEC-041 §3.)
    unsubs.push(...draw.subscribe());

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
    labels.destroy();
    bgCtrl.destroy();
    // Remember the camera before the engine goes, so remounting this map
    // (an activity switch, a sheet toggle) resumes the same view.
    if (engine) {
      mapCtrl.camera[ownMapId] = {
        x: engine.world.position.x,
        y: engine.world.position.y,
        scale: engine.world.scale.x,
        width: engine.app.screen.width,
        height: engine.app.screen.height,
      };
    }
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    clearInterval(eyeTimer);
    for (const unsub of unsubs) unsub();
    unsubs = [];
    // Token-layer bookkeeping — engine.destroy() tears down the Pixi nodes
    // themselves ({ children: true }); clear our lookup maps so no stale
    // references survive the unmount.
    viewsByToken.clear();
    ringLayer = null;
    refsByToken.clear();
    badgesByGroup.clear();
    draggingIds.clear();
    if (myUid) store.clearVectorMapDraft(roomId, ownMapId, myUid);
    mapCtrl.release();
    renderer.dispose();
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
    // A player's selected hex that the referee fogs (SPEC-056 §9) is dropped,
    // so the sheet stops showing — or writing — what the fog now hides.
    hex?.dropFoggedSelection();
  });

  $effect(() => {
    // The empty-state hint (SPEC-054 §1) reads this mirror rather than
    // subscribing to floor/background state itself. Hex crawls have no
    // carved floor to be empty of, so they never trigger it.
    mapCtrl.mapIsEmpty = hexGrid === null && regions.length === 0 && backgrounds.length === 0;
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
    // The hex-tile body of the Map tools sheet (SPEC-030 §§2–5) reads what the
    // selected hex carries off this mirror; its writes are the handlers
    // `onMount` hands `mapCtrl`.
    mapCtrl.selectedHexTile = hex?.selectedTile ?? null;
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
    if (ready) bgCtrl.applyColor(bg);
  });

  $effect(() => {
    // Re-place every background sprite when the set, any one image's rect, or
    // the map's multiplier changes — `cellSize` (or `hex.size` on a hex map)
    // is the render-time multiplier that turns the stored placement into
    // pixels (RULE-006), so a live grid resize has to re-run this just as an
    // edit does.
    const bgs = orderedBackgrounds;
    const space = bgSpace;
    if (ready) void bgCtrl.apply(bgs, space);
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
    void selectedTokenIds;
    // Presence changes nothing about the roster, so the sprite layer has to be
    // told to re-sync when a seat connects or drops (R26.2).
    void presentSeatIds;
    // Also track the per-token fields the sprite layer actually paints from,
    // so an in-place edit (colour, art, size, position) re-syncs even when the
    // roster array itself is unchanged.
    for (const t of tokens) {
      void t.color;
      void t.imageRef;
      // An `img:` ref resolves reactively (SPEC-057 §6): reading it here
      // re-syncs the sprite when the image document arrives.
      void textureKey(t.imageRef);
      void t.size;
      void t.pos.x;
      void t.pos.y;
    }
    if (ready) syncSprites(renderableTokens);
  });

  $effect(() => {
    // A token-aimed ping is dropped the moment its token moves off the mark
    // (SPEC-046 §2), so this re-resolves on every committed token move too —
    // not only when `draw.livePings` itself changes.
    for (const t of tokens) {
      void t.pos.x;
      void t.pos.y;
    }
    if (ready) engine?.renderPings(draw.resolvePings());
  });

  // ---- undo/redo (op-forward re-commit, same pattern as MapView.svelte;
  // pushed onto the shared per-client stack, DEC-108) ----

  async function applyOp(op: VectorEditorOp): Promise<void> {
    if (isNoopVectorOp(op)) return;
    await commitVectorOpForward(store, roomId, mapId, op);
    undoCtrl.push({
      undo: () => commitVectorOpForward(store, roomId, mapId, invertVectorOp(op)),
      redo: () => commitVectorOpForward(store, roomId, mapId, op),
    });
  }
  async function undo(): Promise<void> {
    await undoCtrl.undo();
  }
  async function redo(): Promise<void> {
    await undoCtrl.redo();
  }

  /** A single token's settled drag write, pushed onto the shared stack as one
   * undo entry (SPEC-056 §2.3) — `from` is `null` for a drag with no captured
   * pickup point (shouldn't happen from a pointer drag, but guards a stray
   * programmatic call), and the entry is skipped outright when the drop
   * lands back where the drag started. */
  async function moveTokenUndoable(
    tokenId: string,
    to: { x: number; y: number },
    from: { x: number; y: number } | null,
  ): Promise<void> {
    await store.moveToken(roomId, tokenId, to);
    if (!from || (from.x === to.x && from.y === to.y)) return;
    undoCtrl.push({
      undo: () => store.moveToken(roomId, tokenId, from),
      redo: () => store.moveToken(roomId, tokenId, to),
    });
  }

  /** A collapsed group's batched drag write (anchor drag, every member moved
   * by its stored offset) as one undo entry — a multi-token drag undoes as a
   * single step, not one per member (SPEC-056 §2.3). */
  async function moveTokensUndoable(
    to: Array<{ tokenId: string; pos: { x: number; y: number } }>,
    from: Array<{ tokenId: string; pos: { x: number; y: number } }> | null,
  ): Promise<void> {
    await store.moveTokens(roomId, to);
    const moved = from?.some((f, i) => f.pos.x !== to[i]?.pos.x || f.pos.y !== to[i]?.pos.y);
    if (!from || !moved) return;
    undoCtrl.push({
      undo: () => store.moveTokens(roomId, from),
      redo: () => store.moveTokens(roomId, to),
    });
  }

  // ---- token / encounter layer (ported from the former cellular MapView.svelte
  // onto the vector engine's `tokens` layer; SPEC §2.2 — tokens are unchanged
  // by the vector floor system). Sprite lifecycle + drag/snap/move live here
  // exactly as they did before the cutover; only the host layer changed.
  // Dynamic-LoS token hiding (old fog `dynamic` mode) is intentionally dropped
  // — fog/LoS rendering was removed in the cutover (SPEC §4), so no viewer
  // consumes it. See docs/VTT_Master_Plan.md Part V §2 action-plan item 5. ----

  /** The token whose disc contains pixel-space point `p`, or `null`. */
  function tokenAt(p: { x: number; y: number }): Token | null {
    return tokenAtPoint(tokens, p);
  }
  /** One token's drawing on the `tokens` layer (SPEC-063 §1): a single
   * `PIXI.Container` placed at the token's position, whose children sit at
   * fixed local offsets, back to front — colour disc, art sprite, letter,
   * away badge, broken-image badge, status ring. Moving the container moves
   * every child, so a drag writes one position and nothing re-syncs. The
   * letter and the two corner badges exist only while their state does
   * (absence is legitimate), so they are created and destroyed in place. */
  interface TokenView {
    container: PIXI.Container;
    /** Shows `Token.color` through a transparent uploaded image and behind a
     * letter token's own disc alike (quick-sheet token/color split). */
    disc: PIXI.Graphics;
    /** The art, and the token's only hit target (SPEC-063 §3). */
    sprite: PIXI.Sprite;
    /** The token letter drawn over whatever art the token has (SPEC-048 §4). */
    letter: PIXI.Text | null;
    /** "Owner disconnected" badge (R26.2). */
    awayBadge: PIXI.Graphics | null;
    /** Failed-`imageRef` badge (IN-008/WI-032). */
    brokenBadge: PIXI.Graphics | null;
    /** Selection/group status ring — rendered through `ringLayer` (§2). */
    ring: PIXI.Graphics;
  }
  const viewsByToken = new Map<string, TokenView>();
  /** Where every token's status ring and every collapsed-group count badge
   * is *rendered* (SPEC-063 §2, DEC-130 (a)): one `RenderLayer`, kept the last
   * child of the `tokens` layer, so a ring is never covered by another
   * token's art whatever order the tokens were created in. The ring and badge
   * stay children of their token's container, so they still move with it. */
  let ringLayer: PIXI.RenderLayer | null = null;
  /** The `imageRef` each sprite's current texture was loaded from, so a ref
   * change (e.g. recolouring a letter token) reloads it. An `img:` ref
   * (SPEC-057 §6) is keyed with what it currently resolves to, so the texture
   * also reloads when the image arrives after the token does. */
  const refsByToken = new Map<string, string | undefined>();
  function textureKey(imageRef: string | undefined): string | undefined {
    if (imageRef === undefined || parseRoomImageRef(imageRef) === null) return imageRef;
    return `${imageRef} ${assets.resolve(imageRef)}`;
  }
  /** Tokens whose current `imageRef` failed to load (IN-008/WI-032) — either
   * an unrecognized URL shape or a CORS-blocked host. Keyed by token id;
   * cleared the moment `refsByToken` sees a different ref for that token, so
   * picking a different image retries. Drives `brokenImageTexture` and
   * `syncBrokenImageBadges`, the visible-failure half of the fix — a broken
   * host stays broken, but the referee sees why instead of a blank square. */
  const brokenImageIds = new Set<string>();
  let brokenImageTextureCache: PIXI.Texture | null = null;
  // Reactive mirror of `brokenImageIds.size` — the badge itself is Pixi-drawn
  // (not queryable from the DOM), so this is how a test observes it, same
  // idiom as `stroke-dimensions`/`snap-cell-readout` below.
  let brokenTokenCount = $state(0);
  /** DOM mirror of the drawn token letters (SPEC-048 §4) — `glyphs:mode` per
   * lettered token, sorted and space-joined. The letters themselves are on the
   * Pixi canvas, so this is the only way a test can see them. */
  let tokenLetterText_ = $state('');
  const badgesByGroup = new Map<string, PIXI.Container>();
  const draggingIds = new Set<string>();
  let selectedTokenId = $state<string | null>(null);
  /** Multi-token select (SPEC-056 §3, DEC-109): every token the Select tool
   * currently holds — a click replaces it with one, Shift-click toggles a
   * member, a lasso that catches any token replaces it with the whole catch.
   * Reassigned rather than mutated so `$state` (and the `selected-token-count`
   * readout below) sees every change. Mutually exclusive with
   * `selectedHandles`/`selectedObjects`/`selectedBackgroundId`, the same way
   * those three already are with each other. */
  let selectedTokenIds = $state<string[]>([]);
  // Number of token docs the last drop wrote (1 for a lone token, N for a
  // collapsed group's or a multi-select's batched move) — surfaced for e2e
  // introspection.
  let lastBatchMoveCount = $state(1);

  // A player only sees tokens flagged [Map]-visible; the GM sees all, with the
  // not-yet-visible ones dimmed (same rule as the cellular MapView).
  const mapVisibleIds = $derived(visibleTokenIds(tokens, groups, 'map'));
  /** Fog also hides tokens standing in it, or a player would watch monsters
   * slide around inside a black region. Uses the existing occupancy query at
   * render time over a token-count-sized list — not per-frame-per-cell (SPEC
   * §7). Token positions are pixel-space; fog geometry is lattice units. */
  function revealedAt(pos: { x: number; y: number }): boolean {
    return posRevealed(pos, {
      enabled: map.fog?.enabled ?? false,
      hexGrid,
      hexRevealed: hex?.revealed ?? NO_HEXES,
      cellSize,
      fogRegions,
    });
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
    const snapped = snapFor(
      'token',
      snapModeFromModifiers(e.altKey, e.shiftKey, mapCtrl.tokenSnap),
      { x: local.x, y: local.y },
      { cellSize, size, hexSize: hexGrid?.size },
    );

    if (existing) {
      lastBatchMoveCount = 1;
      await moveTokenUndoable(existing.id, snapped, existing.pos);
      return;
    }
    // A character with no token yet gets one here rather than at "My token"'s
    // fixed spot — the drop already said where it goes. Real art travels as
    // `imageRef`; a generated default travels as `letter`/`color` fields
    // instead, never a `gen:disc:` ref (SPEC-048 §5).
    await store.createToken(roomId, {
      pos: snapped,
      size: 1,
      layer: 'tokens',
      ...(payload.imageRef ? { imageRef: payload.imageRef } : {}),
      ...(payload.letter ? { letter: payload.letter } : {}),
      ...(payload.color ? { color: payload.color } : {}),
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
    const picked = await dialogs.pickToken({
      title: S.addCreatureTitle,
      roomId,
      mode: 'creature',
      confirmLabel: S.addCreatureConfirm,
      // The first letter this batch will take. A batch started from the map
      // toolbar forms its **own** group (below), so it never joins existing
      // members and always starts at A (SPEC-040 §4).
      genDefaultLabel: 'A',
    });
    if (!picked) return;
    addingCreature = true;
    try {
      // No existing members to avoid: `createGroup` below makes the group this
      // batch lands in, so both the letters and the numbering start clean.
      // A picked bundled/URL ref carries no letter (SPEC-048 §3's second
      // exclusion); a generated batch is written as `letter`/`color` fields,
      // never a `gen:disc:` ref (§5).
      const batch = picked.ref
        ? null
        : defaultCreatureBatch(
            picked.count,
            [],
            creatureBatchColor(picked.name, picked.genColor),
            picked.genLabel,
          );
      // `Token.color` is validated hex (`HEX_COLOR_RE`); the batch colour is
      // an `hsl(...)` paint value, the same conversion `backfillLetterFromRef`
      // once ran on a ref's baked-in one (SPEC-048 §2).
      const batchColorHex = batch ? genColorHex(batch.color) : null;
      const names = creatureBatchNames(picked.name, picked.count, []);
      const newTokenIds: string[] = [];
      for (let i = 0; i < picked.count; i++) {
        const step = tokens.length + newTokenIds.length;
        const id = await store.createToken(roomId, {
          pos: { x: STARTER_DROP_POS.x + step * cellSize, y: STARTER_DROP_POS.y },
          size: 1,
          layer: 'tokens',
          // Real art only when the referee actually picked some (§1) — a
          // generated batch has no ref at all.
          ...(picked.ref ? { imageRef: picked.ref } : {}),
          // Absent when the referee named nothing — `Token.name` stays unset
          // and the `creatureLabel` fallback reads exactly as it did before
          // v28 (SPEC-040 §3).
          ...(names[i] ? { name: names[i]! } : {}),
          // Stored at creation so a second batch added in the same room-open
          // reads this one's letters back (SPEC-048 §3).
          ...(batch ? { letter: batch.letters[i]! } : {}),
          ...(batchColorHex ? { color: batchColorHex } : {}),
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

  function isAway(token: Token): boolean {
    return tokenIsAway(token, presentSeatIds);
  }

  /** Creates a token's container and its always-present children (disc,
   * sprite, ring), inserted below `ringLayer` so the layer stays the last
   * child of `tokens` (SPEC-063 §2). */
  function createTokenView(tokenId: string): TokenView {
    const layer = engine!.layers.tokens;
    if (!ringLayer) {
      ringLayer = new PIXI.RenderLayer();
      layer.addChild(ringLayer);
    }
    const container = new PIXI.Container();
    // Lets the sprite inside receive pointer events without the container
    // itself being a target (SPEC-063 §3).
    container.eventMode = 'passive';
    const disc = new PIXI.Graphics();
    disc.eventMode = 'none';
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'static';
    sprite.cursor = 'grab';
    const ring = new PIXI.Graphics();
    ring.eventMode = 'none';
    container.addChild(disc, sprite, ring);
    ringLayer.attach(ring);
    layer.addChildAt(container, layer.getChildIndex(ringLayer));
    const view: TokenView = {
      container,
      disc,
      sprite,
      letter: null,
      awayBadge: null,
      brokenBadge: null,
      ring,
    };
    attachDragHandlers(sprite, container, tokenId);
    viewsByToken.set(tokenId, view);
    return view;
  }

  /** Adds a lazily-created child (letter or a corner badge) at its slot in
   * the container's back-to-front order (SPEC-063 §1). Assign it to `view`
   * first. */
  function addTokenChild(view: TokenView, child: PIXI.Container): void {
    const order: (PIXI.Container | null)[] = [
      view.disc,
      view.sprite,
      view.letter,
      view.awayBadge,
      view.brokenBadge,
    ];
    const before = order.slice(0, order.indexOf(child)).filter((c) => c !== null).length;
    view.container.addChildAt(child, before);
  }

  /** Destroys a token's whole drawing. A collapsed-group count badge the
   * token anchored is a child of its container (SPEC-063 §2), so it goes too
   * and leaves `badgesByGroup`; `syncCollapsedBadges` rebuilds it on a new
   * anchor if the group is still collapsed. */
  function destroyTokenView(tokenId: string, view: TokenView): void {
    for (const [groupId, badge] of badgesByGroup) {
      if (badge.parent === view.container) badgesByGroup.delete(groupId);
    }
    view.container.destroy({ children: true });
    viewsByToken.delete(tokenId);
  }

  function syncSprites(list: Token[]): void {
    if (!engine) return;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      const view = viewsByToken.get(token.id) ?? createTokenView(token.id);
      const { container, disc, sprite } = view;
      // The texture is (re)loaded whenever the ref changes, not only when the
      // sprite is created — a referee can swap a token's art at any time
      // through the Assets panel or "My token".
      const key = textureKey(token.imageRef);
      if (refsByToken.get(token.id) !== key) {
        refsByToken.set(token.id, key);
        if (brokenImageIds.delete(token.id)) brokenTokenCount = brokenImageIds.size;
        // An absent ref means *no art* (SPEC-048 §§1, 5), not a failed load:
        // the sprite falls back to the plain white texture it is created
        // with, which the token's background disc shows through, and no
        // broken badge is raised. `syncTokenLetters` (§4) is what gives such
        // a token its letter to draw.
        if (token.imageRef === undefined) sprite.texture = PIXI.Texture.WHITE;
        else void loadTokenTexture(sprite, token.id, token.imageRef);
      }
      if (!draggingIds.has(token.id)) {
        // The container owns the position (SPEC-063 §1); the drag writes it
        // directly while it holds the token.
        container.position.set(token.pos.x, token.pos.y);
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

      disc.visible = sprite.visible;
      disc.alpha = sprite.alpha;
      disc.clear();
      if (token.color) {
        disc.circle(0, 0, (TOKEN_PX * token.size) / 2).fill(hexToNumber(token.color));
      }
    }
    for (const [id, view] of viewsByToken) {
      if (!seen.has(id)) {
        destroyTokenView(id, view);
        refsByToken.delete(id);
        if (brokenImageIds.delete(id)) brokenTokenCount = brokenImageIds.size;
      }
    }
    syncTokenRings(list);
    syncTokenLetters(list);
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
    const seen = new Set<string>();
    for (const token of list) {
      if (!isAway(token) || hiddenTokenIds.has(token.id)) continue;
      const view = viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let badge = view.awayBadge;
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        view.awayBadge = badge;
        addTokenChild(view, badge);
      }
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(r * 0.72, r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x1b1712).stroke({ width: 1.5, color: 0x9a8f7a });
    }
    for (const [id, view] of viewsByToken) {
      if (view.awayBadge && !seen.has(id)) {
        view.awayBadge.destroy();
        view.awayBadge = null;
      }
    }
  }

  /** Small warning badge on a token whose `imageRef` failed to load
   * (IN-008/WI-032) — same corner-badge idiom as `syncAwayBadges`, on the
   * opposite side so a token can show both at once (away *and* broken). */
  function syncBrokenImageBadges(list: Token[]): void {
    if (!engine) return;
    const seen = new Set<string>();
    for (const token of list) {
      if (!brokenImageIds.has(token.id) || hiddenTokenIds.has(token.id)) continue;
      const view = viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let badge = view.brokenBadge;
      if (!badge) {
        badge = new PIXI.Graphics();
        badge.eventMode = 'none';
        view.brokenBadge = badge;
        addTokenChild(view, badge);
      }
      const r = (TOKEN_PX * token.size) / 2;
      badge.position.set(-r * 0.72, r * 0.72);
      badge.clear();
      badge.circle(0, 0, 7).fill(0x4a1414).stroke({ width: 1.5, color: 0xe3a23a });
      badge.moveTo(0, -3.5).lineTo(0, 1).stroke({ width: 1.5, color: 0xe3a23a });
      badge.circle(0, 3.5, 0.75).fill(0xe3a23a);
    }
    for (const [id, view] of viewsByToken) {
      if (view.brokenBadge && !seen.has(id)) {
        view.brokenBadge.destroy();
        view.brokenBadge = null;
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
    for (const token of list) {
      const ring = viewsByToken.get(token.id)?.ring;
      if (!ring) continue;
      ring.visible = !hiddenTokenIds.has(token.id);
      const r = (TOKEN_PX * token.size) / 2;
      ring.clear();
      ring
        .circle(0, 0, r)
        .stroke({ width: 4, color: tokenRingColor(token, groups, selectedTokenIds, myUid) });
    }
  }

  /** The token letter (SPEC-048 §4) — a render pass on the token layer rather
   * than a shape inside the token's texture, which is what makes a lettered
   * *uploaded image* possible: the letter no longer competes for the
   * `imageRef` slot.
   *
   * **Two-tone by seat** (DEC-086 (a)): a token with an `ownerSeatId` reads as
   * somebody's character and draws white-on-black; one without reads as a
   * creature or scenery and draws black-on-white. The colours no longer
   * consult the disc's lightness — this *replaces* `discStyle`'s contrast flip
   * (R7.1) rather than extending it — so black-on-a-dark-disc and
   * white-on-a-light-disc are both reachable and the **outline is the only
   * thing keeping the glyph legible**. It is therefore a genuine stroke on the
   * glyph (Pixi paints the stroke first and the fill over it, so the letterform
   * keeps its full weight), never the disc's own ring.
   *
   * The status ring (SPEC-022) is untouched: it is state, the letter is
   * identity, and neither borrows the other's channel. */
  function syncTokenLetters(list: Token[]): void {
    if (!engine) return;
    const seen = new Set<string>();
    for (const token of list) {
      const style = letterStyleFor(token);
      if (!style) continue;
      const view = viewsByToken.get(token.id);
      if (!view) continue;
      seen.add(token.id);
      let text = view.letter;
      if (!text) {
        text = new PIXI.Text({ text: style.glyphs });
        text.anchor.set(0.5);
        // Never intercepts a pointer the sprite underneath should receive —
        // the sprite carries the drag handlers, and the letter sits on top.
        text.eventMode = 'none';
        view.letter = text;
        addTokenChild(view, text);
      }
      text.text = style.glyphs;
      text.style = {
        fill: style.fill,
        fontFamily: "'Trebuchet MS', Verdana, sans-serif",
        fontSize: style.fontSize,
        fontWeight: 'bold',
        stroke: { color: style.stroke, width: style.strokeWidth, join: 'round' },
      };
      // Inherits the sprite's visibility and alpha, so a GM-only or
      // away-dimmed token dims whole rather than showing a solid letter over
      // faded art.
      text.visible = view.sprite.visible;
      text.alpha = view.sprite.alpha;
    }
    for (const [id, view] of viewsByToken) {
      if (view.letter && !seen.has(id)) {
        view.letter.destroy();
        view.letter = null;
      }
    }
    // Reactive mirror for e2e (the letters are Pixi-drawn, so this is how a
    // test sees them): `glyphs:mode` per drawn letter, sorted, space-joined.
    // A *string* mirror on purpose — `renderAll` reaches here every frame and
    // must not re-invalidate the `$effect`s that call it, and an equal string
    // assigns without invalidating (same idiom as `strokeMeasureText_`).
    tokenLetterText_ = list
      .map((token) => letterStyleFor(token))
      .filter((style): style is NonNullable<typeof style> => style !== null)
      .map((style) => `${style.glyphs}:${style.mode}`)
      .sort()
      .join(' ');
  }

  /** Count bubble on each collapsed group's anchor token — a child of the
   * anchor's container, so it moves with the anchor by construction, rendered
   * through `ringLayer` above all token art (SPEC-063 §2). */
  function syncCollapsedBadges(): void {
    if (!engine || !ringLayer) return;
    const seen = new Set<string>();
    for (const group of collapsedGroups) {
      const anchorId = groupAnchorId(group);
      if (!anchorId) continue;
      const anchor = renderableTokens.find((t) => t.id === anchorId);
      if (!anchor) continue; // anchor not visible to this viewer
      const view = viewsByToken.get(anchorId);
      if (!view) continue;
      seen.add(group.id);
      let badge = badgesByGroup.get(group.id);
      if (!badge) {
        badge = createCountBadge();
        badgesByGroup.set(group.id, badge);
      }
      // Re-parented when the group's anchor changes; re-parenting detaches
      // it from the render layer, so it is attached again after.
      if (badge.parent !== view.container) {
        view.container.addChild(badge);
        ringLayer.attach(badge);
      }
      const label = badge.getChildByLabel('count') as PIXI.Text | null;
      if (label) label.text = String(group.memberTokenIds.length);
      const r = (TOKEN_PX * anchor.size) / 2;
      badge.position.set(r * 0.7, -r * 0.7);
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

  /** Fixed raster resolution a token's art is rasterized to before it
   * becomes a texture (IN-119/WI-125). Deliberately independent of the
   * source image's own reported size: an SVG with no `width`/`height`
   * attributes (only a `viewBox`, sized via CSS on its own root, or nothing
   * at all) has no fixed intrinsic bitmap, and Chromium's DOM-facing
   * `naturalWidth`/`naturalHeight` (a CSS default-object-size fallback, not
   * a real raster) can disagree with what its own WebGL `texImage2D` will
   * accept — silently rejecting the source with a console-only
   * `INVALID_VALUE: texImage2D: bad image data` our promise-based
   * `try`/`catch` never sees, leaving the sprite an untextured black quad.
   * Rasterizing onto a canvas at an explicit size first sidesteps the
   * disagreement entirely: `drawImage` can force a concrete size on an SVG
   * source the same way CSS sizing does for the character sheet's plain
   * `<img>` preview (which is why that preview already displays such a
   * token correctly), and a canvas is always a well-defined WebGL texture
   * source. 256 comfortably covers the map's zoom range at `TOKEN_PX`
   * (48) × the largest token scale without visible upscaling blur. */
  const TOKEN_ART_RASTER_PX = 256;

  function rasterizeTokenImage(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TOKEN_ART_RASTER_PX;
    canvas.height = TOKEN_ART_RASTER_PX;
    // Matches the sprite's own square width/height (`TOKEN_PX * token.size`,
    // set unconditionally below) — a non-square source was already being
    // stretched to fill a square sprite before this change.
    canvas.getContext('2d')!.drawImage(img, 0, 0, TOKEN_ART_RASTER_PX, TOKEN_ART_RASTER_PX);
    return canvas;
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
   * `syncSprites`) is what retries a token whose image is later changed.
   *
   * A source that is genuinely, verifiably empty — `naturalWidth`/
   * `naturalHeight` both 0, e.g. an SVG with explicit `width="0" height="0"`
   * — is rejected before rasterizing: there is no content `drawImage` could
   * recover, and letting it through would silently produce a blank
   * (fully-transparent) canvas rather than the broken-image indicator a
   * genuinely unusable ref should raise. Checked here rather than in
   * `loadImageElement` because that loader also backs `BackgroundsPanel`,
   * where this is a different, unscoped problem (RULE-015). */
  async function loadTokenTexture(
    sprite: PIXI.Sprite,
    tokenId: string,
    imageRef: string,
  ): Promise<void> {
    try {
      const img = await loadImageElement(assets.resolve(imageRef));
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        throw new Error(`token image has no intrinsic size: ${imageRef}`);
      }
      sprite.texture = PIXI.Texture.from(rasterizeTokenImage(img));
    } catch (err) {
      console.warn(`[VectorMapView] token image failed to load: ${imageRef}`, err);
      brokenImageIds.add(tokenId);
      brokenTokenCount = brokenImageIds.size;
      sprite.texture = brokenImageTexture();
      syncBrokenImageBadges(renderableTokens);
    }
  }

  /** Pointer handling for one token (SPEC-063 §3). The `sprite` is the hit
   * target and carries the cursor; the drag reads and writes the token's
   * `container` position, which moves every part of the token at once. */
  function attachDragHandlers(
    sprite: PIXI.Sprite,
    container: PIXI.Container,
    tokenId: string,
  ): void {
    let tokenDragging = false;
    /** The drag's start point, lattice units (SPEC-054 §12) — set on pickup,
     * `null` otherwise. The distance chip below goes through `measureSpanText`,
     * the same formatting the Measure tool's own readout uses. */
    let tokenDragStart: Point | null = null;
    let tokenDragChip: PIXI.Text | null = null;
    /** The token's (or, for a collapsed-group/multi-select anchor, the
     * anchor's) pixel position at pickup — the undo entry's `from`
     * (SPEC-056 §2.3). */
    let tokenMoveFrom: Point | null = null;
    /** A multi-token set drag (SPEC-056 §3, DEC-109): every other selected,
     * actionable token's pickup-time offset from this one, carried through to
     * the drop the same way a collapsed group's `memberOffsets` are. Empty
     * outside a multi-select drag (a lone token, or a collapsed-group anchor
     * drag, which takes priority — see `stop` below). */
    let dragSetOffsets: Array<{ tokenId: string; offset: Point; from: Point }> = [];
    /** Whether the pointer actually moved during this gesture — a plain
     * click (down, up, no `globalpointermove` in between) never sets it.
     * Gates the passenger write below: the *grabbed* token already accepts
     * a same-position "drop" as a harmless no-op (`moveTokenUndoable` skips
     * only the undo push, not the write, for that one), but relaying a
     * stationary click into a batch move of every *other* selected token
     * would relocate them by nothing but snap-grid quantization noise —
     * `STARTER_DROP_POS` isn't itself snap-aligned, so that noise is not
     * always zero. A click that never moved touches no passenger at all. */
    let moved = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const token = tokens.find((t) => t.id === tokenId) ?? null;
      // Eye/Ping aim at the token under the pointer instead of picking it up
      // (SPEC-046 §2): a View-tool click resolves the token at click time and
      // is done, rather than falling into the ordinary select-and-drag below.
      if (tool === 'ping') {
        if (token) store.publishPing(roomId, token.pos);
        e.stopPropagation();
        return;
      }
      if (tool === 'eye') {
        if (token) {
          eye = { x: token.pos.x / cellSize, y: token.pos.y / cellSize };
          eyeRemainingMs = EYE_LIFETIME_MS;
          startEyeTimer();
        }
        e.stopPropagation();
        return;
      }
      // Shift-click toggles this token in the multi-selection, in either
      // Edit/View mode (SPEC-056 §3, DEC-109); a plain click on a token
      // outside the current selection replaces it, and a plain click on one
      // already inside it leaves the whole set selected — so grabbing any
      // member without Shift drags the group. Geometry's own selection is
      // mutually exclusive with a token catch, same as every other pick.
      if (e.shiftKey) {
        selectedTokenIds = selectedTokenIds.includes(tokenId)
          ? selectedTokenIds.filter((id) => id !== tokenId)
          : [...selectedTokenIds, tokenId];
      } else if (!selectedTokenIds.includes(tokenId)) {
        selectedTokenIds = [tokenId];
      }
      selectedHandles = [];
      selectedObjects = [];
      selectedBackgroundId = null;
      selectedTokenId = tokenId;
      mapCtrl.selectedToken = token;
      // Picking up a token raises its character's sheet, the same way clicking
      // that actor's card on the Encounter board does. `pointerdown` *is* the
      // selection moment here (it also starts the drag), so there is no
      // click-versus-drag discrimination to make.
      // Still gated on an owning seat: the callback is actor-keyed since
      // WI-055, but raising a *creature's* sheet is WI-056 (SPEC-032 §4).
      if (token?.ownerSeatId) onSelectActor(token.ownerSeatId);
      if (!selectedTokenIds.includes(tokenId)) {
        // A Shift-click that just deselected this token — nothing to drag.
        e.stopPropagation();
        return;
      }
      // Selection is unconditional; the drag itself is ownership-gated
      // (SPEC-032 §5) — a token this seat may not act on stays inspectable
      // but does not move.
      if (canActOnToken(groups, tokens, myUid ?? '', tokenId, isGM)) {
        tokenDragging = true;
        moved = false;
        draggingIds.add(tokenId);
        sprite.cursor = 'grabbing';
        tokenDragStart = {
          x: container.position.x / cellSize,
          y: container.position.y / cellSize,
        };
        tokenMoveFrom = { x: container.position.x, y: container.position.y };
        // Every other selected, actionable token joins this drag as a set
        // (SPEC-056 §3) — skipped when this token anchors a collapsed group,
        // which already moves its own members and takes priority (`stop`).
        dragSetOffsets = collapsedGroupAnchoredBy(tokenId)
          ? []
          : selectedTokenIds
              .filter(
                (id) =>
                  id !== tokenId &&
                  // A collapsed group's own anchor moves its members through
                  // its own anchor-drag path only — carrying it along here as
                  // a plain offset would desync it from its stacked members.
                  !collapsedGroupAnchoredBy(id) &&
                  canActOnToken(groups, tokens, myUid ?? '', id, isGM),
              )
              .map((id) => {
                const other = viewsByToken.get(id)?.container;
                const pos = other
                  ? { x: other.position.x, y: other.position.y }
                  : (tokens.find((t) => t.id === id)?.pos ?? {
                      x: container.position.x,
                      y: container.position.y,
                    });
                draggingIds.add(id);
                return {
                  tokenId: id,
                  offset: { x: pos.x - container.position.x, y: pos.y - container.position.y },
                  from: pos,
                };
              });
      }
      e.stopPropagation();
    });
    sprite.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!tokenDragging || !engine) return;
      moved = true;
      const local = engine.world.toLocal(e.global);
      container.position.set(local.x, local.y);
      // RTDB drag frames for the anchor only — a collapsed group publishes one
      // stream, not one per member.
      store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
      // A multi-select set drag moves every other member's container by the
      // same delta, live — the batched write happens once, on drop.
      for (const member of dragSetOffsets) {
        viewsByToken
          .get(member.tokenId)
          ?.container.position.set(local.x + member.offset.x, local.y + member.offset.y);
      }
      // The drag-distance chip (SPEC-054 §12): a lightweight overlay this
      // handler owns directly, rather than routing through `renderAll`'s full
      // tool-preview pass on every pointer move.
      if (tokenDragStart) {
        const cur = { x: local.x / cellSize, y: local.y / cellSize };
        const span = measureSpanText(tokenDragStart, cur, map.measure ?? null);
        if (span && engine) {
          if (!tokenDragChip) {
            tokenDragChip = new PIXI.Text({
              text: '',
              style: { fill: 0xffffff, stroke: { color: 0x000000, width: 3 }, fontSize: 12 },
            });
            engine.world.addChild(tokenDragChip);
          }
          tokenDragChip.text = span.text;
          tokenDragChip.position.set(local.x + 14, local.y - 14);
        } else {
          tokenDragChip?.destroy();
          tokenDragChip = null;
        }
      }
    });
    const stop = (e: PIXI.FederatedPointerEvent) => {
      if (!tokenDragging) return;
      tokenDragging = false;
      draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      tokenDragStart = null;
      tokenDragChip?.destroy();
      tokenDragChip = null;
      const fromPos = tokenMoveFrom;
      tokenMoveFrom = null;
      const setMembers = dragSetOffsets;
      dragSetOffsets = [];
      for (const m of setMembers) draggingIds.delete(m.tokenId);
      // Snap on drop: cell grid by default, half-grid with Alt, free with
      // Alt+Shift; the rail's snap toggle is the base mode. Honors token size.
      const size = tokens.find((t) => t.id === tokenId)?.size ?? 1;
      const mode = snapModeFromModifiers(e.altKey, e.shiftKey, mapCtrl.tokenSnap);
      const snapped = snapFor(
        'token',
        mode,
        { x: container.position.x, y: container.position.y },
        { cellSize, size, hexSize: hexGrid?.size },
      );
      container.position.set(snapped.x, snapped.y);
      const collapsedGroup = collapsedGroupAnchoredBy(tokenId);
      if (collapsedGroup) {
        // One batched write of every member's new position, offsets preserved.
        const updates = collapsedDragUpdates(collapsedGroup, snapped);
        lastBatchMoveCount = updates.length;
        void moveTokensUndoable(
          updates,
          fromPos ? collapsedDragUpdates(collapsedGroup, fromPos) : null,
        );
      } else if (moved && setMembers.length) {
        // A multi-select set drag (SPEC-056 §3): every selected token keeps
        // its pickup-time offset from the grabbed one — not independently
        // re-snapped, the same "formation preserved exactly" rule a
        // collapsed group's drag already follows. Gated on `moved`: a plain
        // click that never dragged touches no passenger (see `moved`'s own
        // comment above) — it falls through to the single-token branch below,
        // exactly like clicking a token outside any multi-selection always has.
        const to = [
          { tokenId, pos: snapped },
          ...setMembers.map((m) => ({
            tokenId: m.tokenId,
            pos: { x: snapped.x + m.offset.x, y: snapped.y + m.offset.y },
          })),
        ];
        lastBatchMoveCount = to.length;
        const from = fromPos
          ? [
              { tokenId, pos: fromPos },
              ...setMembers.map((m) => ({ tokenId: m.tokenId, pos: m.from })),
            ]
          : null;
        void moveTokensUndoable(to, from);
      } else {
        lastBatchMoveCount = 1;
        void moveTokenUndoable(tokenId, snapped, fromPos);
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
    if (hex) {
      await hex.revealAll();
      return;
    }
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
    if (hex) {
      await hex.resetFog();
      return;
    }
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
      floorExtentError = S.floorExtentBlocked(MAX_FLOOR_EXTENT);
      return;
    }
    floorExtentError = '';
    await applyOp(buildCarveOp(before, result.floor, strokeBBox));
  }

  // ---- door tool ----

  function latticeThreshold(screenPx: number): number {
    return latticeThresholdFor(screenPx, engine ? engine.world.scale.x : null, cellSize);
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
    selectedBackgroundId = null;
    bgCtrl.cancel();
    selectedTokenIds = [];
    syncSelectionCount();
  }

  function syncSelectionCount(): void {
    selectionCount_ =
      selectedHandles.length + selectedObjects.length + (selectedBackground ? 1 : 0);
  }

  /**
   * One click, one gesture (SPEC-037 §1). A vertex handle under the pointer
   * wins — the priority the old Vertex mode had — and starts a geometric drag;
   * failing that an object under the pointer is picked and, for the kinds that
   * move, dragged; failing both, an unlocked background under the pointer is
   * picked, lowest priority of everything Select considers (SPEC-039 §2);
   * failing all three, the drag is a lasso over open canvas (§2).
   *
   * A token under the pointer never reaches here — its own sprite intercepts
   * the pointer event first (`attachDragHandlers`) and stops it propagating,
   * the same priority tokens already had over the canvas before multi-select
   * (SPEC-056 §3).
   *
   * Under the View lock (`mapCtrl.mapMode === 'view'`, DEC-109) a handle or
   * object pick still selects — the inspect half of "read-only geometry" —
   * but `beginHandleDrag`/`beginObjectDrag` themselves skip arming the actual
   * drag, so nothing here has to know the mode.
   */
  function beginSelectGesture(point: Point, worldPx: Point): void {
    const threshold = latticeThreshold(PICK_PX);
    const handle = pickVertexHandle(point, vertexHandles(regions, walls, doors), threshold);
    if (handle) {
      selectedObjects = [];
      selectedBackgroundId = null;
      selectedTokenIds = [];
      selectedHandles = [handle];
      syncSelectionCount();
      beginHandleDrag(handle);
      return;
    }
    const hit = pickObject(point, cellSize, objectCatalog(), threshold);
    if (hit) {
      selectedHandles = [];
      selectedBackgroundId = null;
      selectedTokenIds = [];
      beginObjectDrag(hit, point);
      syncSelectionCount();
      return;
    }
    if (bgCtrl.pointerDown(worldPx)) return;
    // Open canvas: start sweeping. Nothing is deselected yet — the release
    // decides, so a lasso that catches something replaces the selection and
    // one that catches nothing clears it, both in one place.
    selectedBackgroundId = null;
    lasso = { a: point, b: point };
  }

  function beginHandleDrag(handle: Handle): void {
    // Read-only under the View lock (SPEC-056 §3, DEC-109): the handle is
    // still selected (highlighted, inspectable) by the caller, but nothing
    // here arms a drag to move it.
    if (mapCtrl.mapMode === 'view') return;
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

  /** Collects everything the released lasso caught (SPEC-037 §2, extended by
   * SPEC-056 §3/DEC-109) — vertex handles and whole objects in one set,
   * unless the sweep caught any token, in which case it selects tokens only
   * (Backspace never deletes a token, so a mixed catch would otherwise be
   * asymmetric about what a following Backspace removes). A sweep that
   * caught nothing at all clears the selection, matching a click on open
   * canvas. */
  function finishLasso(): void {
    const rect = lassoBBox(lasso!.a, lasso!.b);
    lasso = null;
    const caughtTokenIds = lassoSelectTokens(rect, tokens, cellSize);
    if (caughtTokenIds.length) {
      selectedHandles = [];
      selectedObjects = [];
      selectedTokenIds = caughtTokenIds;
      const last = caughtTokenIds[caughtTokenIds.length - 1]!;
      selectedTokenId = last;
      mapCtrl.selectedToken = tokens.find((t) => t.id === last) ?? null;
      syncSelectionCount();
      return;
    }
    const caught = lassoSelect(
      rect,
      vertexHandles(regions, walls, doors),
      objectCatalog(),
      cellSize,
    );
    selectedHandles = caught.handles;
    selectedObjects = caught.objects;
    selectedTokenIds = [];
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
    // Read-only under the View lock (SPEC-056 §3, DEC-109): still selected
    // for inspect (the Room quick sheet publish above included), just never
    // armed to move.
    if (mapCtrl.mapMode === 'view') return;
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
      // snap mode gives (see `MapLabels.place`), not forced to whole cells.
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
    // Read-only under the View lock (SPEC-056 §3, DEC-109) — rotate is a
    // geometry edit like any other; the Rotate/Flip button's own visibility
    // only tracks *what* is selected, not the lock, so this is where that's
    // enforced.
    if (mapCtrl.mapMode === 'view') return;
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
   * Backspace/Delete over the whole current selection (SPEC-037 §3,
   * SPEC-056 §2.2).
   *
   * Two halves, because the two kinds of member are removed two different
   * ways — but both go through the undo stack as one combined entry, so one
   * Backspace is one Ctrl+Z. Selected **vertices** are a geometric edit on
   * committed floor geometry — a floor vertex re-stitches its ring where it
   * can (§4), a wall or door endpoint takes its whole segment. Selected
   * **objects** (symbol, label, door, drawing) are removed and re-created
   * whole, the same `from`/`to: null` shape a door endpoint already used.
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
    const handleOp = buildHandleRemovalOp(handles, records);

    // A door caught both as an object and by one of its endpoints is already
    // gone via `handleOp`; removing it twice would be a wasted write and a
    // duplicate undo entry.
    const removedDoors = new Set(
      handles.filter((h) => h.owner.kind === 'door').map((h) => h.owner.id),
    );
    const objectRecords = new Map<string, MapSymbol | MapRoom | VectorDoor | Drawing>();
    for (const sel of objects) {
      const key = `${sel.kind}:${sel.id}`;
      if (objectRecords.has(key)) continue;
      const rec =
        sel.kind === 'symbol'
          ? symbols.find((s) => s.id === sel.id)
          : sel.kind === 'mapRoom'
            ? mapRooms.find((r) => r.id === sel.id)
            : sel.kind === 'door'
              ? doors.find((d) => d.id === sel.id)
              : drawings.find((d) => d.id === sel.id);
      if (rec) objectRecords.set(key, structuredClone($state.snapshot(rec)));
    }
    const objectOp = buildObjectRemovalOp(objects, removedDoors, objectRecords);

    const ops = [handleOp, objectOp].filter((o): o is VectorEditorOp => o !== null);
    if (ops.length) await applyOp(ops.length === 1 ? ops[0]! : { kind: 'batch', ops });
    renderAll();
  }

  /** The stored records with the in-progress drag's working copy substituted
   * (see `map/drag-display.ts`). */
  function displayOverlayState() {
    return overlayStateFor(objectDrag, symbols, mapRooms, drawings);
  }

  function displayState() {
    return dragStateFor(activeDrag, regions, walls, doors);
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
    if (!points.length || !multiplayer) return;
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
    return snapFor('tool', effectiveSnap(), toLatticeRaw(world), { attract: vertexAttraction() });
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
      if (labels.pointerDown(worldPx)) return;
      if (draw.pointerDown(worldPx)) return;
      // A hex map's Select (SPEC-030 §5) and its click tools (SPEC-066 §5): the
      // controller picks the hex under the pointer, or acts on it, and stops
      // there. It must come before `onPointerDown`, which would otherwise run
      // the square-lattice select machinery — vertex handles, object picking,
      // the lasso — in a space this map does not have (RULE-006).
      if (hex?.pointerDown(worldPx)) return;
      if (tool === 'label') {
        // Same cell-floor reasoning as `symbol` below: a label lives *inside*
        // a cell, so the click must land in the cell it was made in rather
        // than at whichever lattice vertex happens to be closest.
        labels.toolClick(worldPx);
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
      if (tool === 'text') {
        // Raw world pixels, matching the Pen's own `Drawing` write — annotations
        // are not lattice geometry (RULE-006 governs floor/wall/door), and the
        // renderer draws `Drawing.points` untransformed either way.
        void placeTextAt(worldPx);
        return;
      }
      onPointerDown(toLatticeSnapped(worldPx), toLatticeRaw(worldPx), worldPx);
      syncMeasureReadout();
    });
    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      draw.publishCursor(worldPx);
      // Before the per-tool dispatch: the label tooltip is not a tool. Its
      // hex-map counterpart (SPEC-030 §4) sits in the hex controller's move
      // for the same reason — whichever grid kind is on stage, exactly one of
      // the two can find anything to show — and so does the Road/River
      // preview's pointer (SPEC-047 §12), which needs the raw world pixel the
      // lattice arguments below have already thrown away. It consumes the
      // event only while a fog stroke is open.
      labels.pointerMove(worldPx);
      if (hex?.pointerMove(worldPx)) return;
      // A hex map's background drag (SPEC-059 §3.3) is taken here, before the
      // lattice arguments `onPointerMove` receives have thrown the pixel away.
      // The release still ends it through `onPointerUp`.
      if (hexGrid && bgCtrl.pointerMove(worldPx)) return;
      if (draw.pointerMove(worldPx)) return;
      onPointerMove(toLatticeSnapped(worldPx), toLatticeRaw(worldPx), worldPx);
      syncMeasureReadout();
    });
    const end = (e: PIXI.FederatedPointerEvent) => {
      const worldPx = mapEngine.toWorld(e.global);
      void (async () => {
        if (await hex?.pointerUp()) return;
        if (await draw.pointerUp()) return;
        await onPointerUp(toLatticeSnapped(worldPx), toLatticeRaw(worldPx));
        syncMeasureReadout();
      })();
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
    stage.on('pointerout', () => {
      labels.pointerOut();
      hex?.pointerOut();
    });
    mapEngine.app.canvas.addEventListener('dblclick', () => {
      if (tool === 'measure') finishMeasure();
      else void finishMultiClick();
    });
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

  /** The Text tool's click (SPEC-054 §13): a `DrawingKindSchema` value the
   * engine already renders (`renderAnnotations`), through the Pen's own write
   * path — one settled `Drawing` per click (RULE-003), never on an empty or
   * cancelled prompt. */
  async function placeTextAt(worldPx: { x: number; y: number }): Promise<void> {
    const text = await dialogs.promptText({
      title: S.addTextTitle,
      label: S.addTextLabel,
      confirmLabel: S.addTextConfirm,
    });
    if (!text?.trim()) return;
    await store.writeDrawing(roomId, mapId, {
      layer: 'mapping',
      kind: 'text',
      points: [worldPx],
      style: { text },
    });
  }

  // ---- room labels: editor, tooltip, note dot (SPEC-060, WI-218) ----
  // The label seam owns its state; the composers and the template below read it
  // as plain fields (`labels.editingId`, `labels.noteDotRoomIds`).
  const labels = new MapLabels({
    invalidate: (...layers) => renderer.invalidate(...layers),
    store,
    // Getters: `roomId`/`mapId` are props, so the seam reads the current value.
    get roomId() {
      return roomId;
    },
    get mapId() {
      return mapId;
    },
    toLatticeRaw,
    mapRooms: () => mapRooms,
    noteText: (id) => roomNotes?.get(id) ?? '',
    isCoarsePointer: () => isCoarsePointer,
    cellSize: () => cellSize,
    pickThreshold: () => latticeThreshold(PICK_PX),
    isBusy: () =>
      gestureActive || dragging || !!activeDrag || !!objectDrag || collecting.length > 0,
    snapCell: (raw) => vectorMap.snapCell(raw, effectiveSnap()),
    snapCellSize: () => vectorMap.snapCellSize(effectiveSnap()),
    toScreen: (p) => engine?.toScreen(p) ?? null,
  });

  /** One tooltip, two sources: a room label's players' notes on a square map
   * (`map-label-tooltip`, unchanged), a hex's own note on a hex crawl. They can
   * never both be live — a hex map has no room labels — so the DOM node, its
   * testid and its markdown rendering are shared rather than duplicated. */
  const activeTooltip = $derived.by(() => {
    if (labels.tooltip) return labels.tooltip;
    if (hex?.hoverNote && hex.hoverNoteText.trim().length > 0) {
      return { x: hex.hoverNote.x, y: hex.hoverNote.y, text: hex.hoverNoteText };
    }
    return null;
  });

  // ---- collaboration tools: pen (freehand), ping, measure, live cursor ----
  // The seam owns the pen buffer, the live pings, the Measure path and the
  // cursor publish (SPEC-060, WI-226). It operates on the *pixel-space* world
  // point (drawings, cursors and pings store pixel-space coords, like tokens —
  // unlike the lattice-snapped points the floor/wall/door tools consume), and
  // its pointer handlers return true when they consume the event.
  const draw = new MapDraw({
    invalidate: (...layers) => renderer.invalidate(...layers),
    store,
    get roomId() {
      return roomId;
    },
    get mapId() {
      return mapId;
    },
    toLatticeRaw,
    hexAt: (worldPx) => hex?.hexAt(worldPx) ?? null,
    multiplayer,
    myUid,
    tool: () => tool,
    tokens: () => tokens,
    renderCursors: (cursors, uid) => engine?.renderCursors(cursors, uid),
    syncReadout: () => syncMeasureReadout(),
  });

  /** Bbox corners (lattice space) for the Object mode selection highlight —
   * null when nothing's selected or the selected object no longer exists
   * (e.g. deleted by a peer). */
  function objectHighlightBBox(sel: ObjectSelection): { a: Point; b: Point } | null {
    return highlightBBoxFor(
      sel,
      displayOverlayState(),
      doors,
      cellSize,
      vectorMap.snapCellSize(effectiveSnap()),
    );
  }

  // ---- placed background transform (SPEC-039 §2, reversing SPEC-038 §3) ----
  // The Select tool picks up an unlocked background itself — no Assets panel
  // bridge: a press inside its rect selects it and starts moving it in the same
  // gesture, and a press on a handle resizes it. The sprite lifecycle and that
  // gesture live in the background seam (`map/map-backgrounds.svelte.ts`,
  // SPEC-060 §2–§5); the selection model stays here, and the seam reports a pick
  // through `onPick`. A background is dragged in the space its map's grid kind
  // declares (RULE-006): `toSpace` is the raw lattice point on a square map and
  // the world pixel on a hex map, so the seam is handed one conversion and never
  // a lattice one on a hex map.
  const bgCtrl = new MapBackgrounds({
    invalidate: (...layers) => renderer.invalidate(...layers),
    store,
    get roomId() {
      return roomId;
    },
    get mapId() {
      return mapId;
    },
    toSpace: (worldPx) => (hexGrid ? worldPx : toLatticeRaw(worldPx)),
    space: () => bgSpace,
    ordered: () => orderedBackgrounds,
    isGM: () => isGM,
    layer: () => engine?.layers.background ?? null,
    zoom: () => (engine ? engine.world.scale.x : null),
    setClearColor: (color) => engine?.setBackgroundColor(color),
    loadTexture: (ref) => PIXI.Assets.load(assets.resolve(ref)) as Promise<PIXI.Texture>,
    reportBroken: (ids) => mapCtrl.setBrokenBackgrounds(ownMapId, ids),
    onPick: (id) => {
      selectedHandles = [];
      selectedObjects = [];
      selectedTokenIds = [];
      selectedBackgroundId = id;
      syncSelectionCount();
    },
  });

  function onPointerDown(p: Point, raw: Point, worldPx: Point): void {
    hoverRaw = raw;
    if (selecting) {
      beginSelectGesture(p, worldPx);
      // What a press changes by itself — the picked handle, a lasso's first
      // corner, a background's drag — is all on `tools`; a selection change is
      // reactive and invalidates its own layers. A handle drag armed here
      // draws nothing new until the pointer moves, which is when `floor`
      // first reconciles its preview (WI-193).
      renderer.invalidate('tools');
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
      eyeRemainingMs = EYE_LIFETIME_MS;
      startEyeTimer();
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

  function onPointerMove(p: Point, raw: Point, worldPx: Point): void {
    hoverRaw = raw;
    if (selecting) {
      // Only the layers the move touches (WI-193): the handles, lasso, hover
      // ring and highlights are all on `tools`; a vertex drag also redraws the
      // floor it reshapes (and `overlay`, where a dragged door is drawn); an
      // object drag moves a symbol, label or drawing on `overlay`.
      if (activeDrag) {
        updateSelectDrag(p);
        if (activeDrag.owner.kind === 'door') renderer.invalidate('floor', 'overlay', 'tools');
        else renderer.invalidate('floor', 'tools');
      } else if (objectDrag) {
        updateObjectDrag(p);
        renderer.invalidate('overlay', 'tools');
      } else if (bgCtrl.dragging) {
        bgCtrl.pointerMove(worldPx);
      } else if (lasso) {
        lasso.b = p;
        renderer.invalidate('tools');
      } else {
        hoverHandle = pickVertexHandle(
          p,
          vertexHandles(regions, walls, doors),
          latticeThreshold(PICK_PX),
        );
        renderer.invalidate('tools');
      }
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
    // Every in-progress stroke, snap cursor and Road/River preview is drawn on
    // `tools`; nothing is committed until release.
    renderer.invalidate('tools');
  }

  async function onPointerUp(p: Point, raw: Point): Promise<void> {
    hoverRaw = raw;
    if (selecting) {
      if (activeDrag) await endSelectDrag();
      else if (objectDrag) await endObjectDrag();
      else if (bgCtrl.dragging) await bgCtrl.pointerUp();
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
      if (
        !movedFar &&
        (tool === 'room' || tool === 'corridor' || tool === 'ngon' || captureAllowed)
      ) {
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
    } else if (tool === 'road' || tool === 'river') {
      await hex?.finishLine();
    }
    renderAll();
  }

  /** Ends the Measure tool's path on a double-click (SPEC-054 §12) — the
   * `Escape` equivalent, `cancelStroke`, clears the same state. Nothing is
   * committed either way; there is no write to finish. */
  function finishMeasure(): void {
    draw.finishMeasure();
    syncMeasureReadout();
  }

  function cancelStroke(): void {
    collecting = [];
    hex?.cancel();
    dragging = false;
    awaitingSecondClick = false;
    dragStart = null;
    dragCur = null;
    dragStartRaw = null;
    dragCurRaw = null;
    bendAxis = null;
    activeDrag = null;
    clearSelection();
    draw.cancel();
    // The tooltip's position is captured in screen pixels, so anything that
    // moves the camera (a pan gesture calls this) invalidates it — the pinned
    // one included (SPEC-033 §4).
    labels.dismissTooltips();
    clearDraft();
    renderAll();
    syncMeasureReadout();
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
      // Drops whatever Select is holding — handles, objects, or a background
      // (SPEC-039 §2) — and with a background, its overlay and pointer
      // interception too; `cancelStroke` → `clearSelection` clears all three
      // the same way.
      cancelStroke();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // The whole selection, vertices included (SPEC-037 §3) — not just the
      // one object the retired Object mode could hold. Read-only under the
      // View lock (SPEC-056 §3, DEC-109) — a selection can be *held* under
      // View, just never removed. Tokens are never in `selectedHandles`/
      // `selectedObjects`, so this already can't reach one either way.
      if (
        selecting &&
        mapCtrl.mapMode !== 'view' &&
        (selectedHandles.length || selectedObjects.length)
      ) {
        e.preventDefault();
        void deleteSelection();
      }
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') altKey = false;
  }

  // ---- render ----

  /** Publishes the current dimension chip to the hidden DOM readout.
   * Called from the Pixi pointer handlers only — never from an effect, and
   * never from a draw pass (see `strokeMeasureText_`'s declaration). The
   * measure is recomputed here rather than read back from the tools pass,
   * which now runs on the next frame, after this. */
  function syncMeasureReadout(): void {
    strokeMeasureText_ = currentStrokeMeasure()?.text ?? '';
    const cell = targetedCellFor(tool, effectiveSnap(), dragCurRaw ?? hoverRaw);
    // Same split as `strokeMeasureText_`: a *string* mirror, assigned only on
    // the pointer-event path, never from a draw pass.
    snapCellText_ = cell ? `${cell.x},${cell.y} @${cell.size}` : '';
    const band = targetedBandFor(tool, effectiveSnap(), bandWidth, dragCurRaw ?? hoverRaw);
    snapBandText_ = band
      ? band.kind === 'rect'
        ? `${band.x},${band.y} @${band.size}`
        : `⌀ ${band.radius * 2}`
      : '';
  }

  /**
   * The five draw passes, one per engine layer, run by `renderer` (WI-193,
   * SPEC-057 §4.2). Each is split into an `*Inputs()` that gathers everything
   * the layer is drawn from and a draw that hands it to the engine, so the
   * layer's tracking `$effect` below can read exactly the reactive state the
   * pass reads without drawing anything.
   *
   * Neither half may write reactive state: the inputs run inside `$effect`s,
   * and assigning a fresh object there re-invalidates them every frame —
   * `effect_update_depth_exceeded`.
   */
  function gridInputs() {
    return {
      hexSize: hexGrid?.size ?? null,
      gridCellSize,
      subdivide: map.gridSettings.subdivide,
    };
  }
  function drawGrid(i = gridInputs()): void {
    // One map, one coordinate space (RULE-006), so one grid: a hex crawl draws
    // the axial lattice and its coordinate pills (SPEC-030 §1), every other map
    // draws the square one exactly as before. `hex.size` is the hex map's
    // render-time multiplier; `grid.cellSize` is not.
    if (i.hexSize !== null) engine!.renderHexGrid(i.hexSize);
    else engine!.renderGrid(i.gridCellSize, i.subdivide);
  }

  /** The drag preview's builder, kept for as long as the drag and the
   * committed arrays under it are the same (`drag-sight.ts`). */
  let dragSightCache: {
    drag: ActiveDrag;
    regions: VectorFloorRegion[];
    walls: StoredVectorWall[];
    doors: VectorDoor[];
    build: (working: OwnerRecord) => RenderedScene;
  } | null = null;
  /** The scene the floor layer draws: the committed one at rest, and during a
   * vertex drag the committed one with the dragged owner swapped for its
   * working copy — reconciled incrementally, never rebuilt per move. The full
   * `buildVectorScene` runs once, on the store echo after release. */
  function liveScene(): RenderedScene {
    const drag = activeDrag;
    if (!drag) {
      dragSightCache = null;
      return scene;
    }
    let cache = dragSightCache;
    if (
      !cache ||
      cache.drag !== drag ||
      cache.regions !== regions ||
      cache.walls !== walls ||
      cache.doors !== doors
    ) {
      cache = dragSightCache = {
        drag,
        regions,
        walls,
        doors,
        build: createDragSight({ regions, walls, doors }, drag.owner),
      };
    }
    return cache.build(drag.working);
  }

  function floorInputs() {
    return {
      hexTiles: hex?.tiles ?? [],
      hexSize: hexGrid?.size ?? 0,
      scene: liveScene(),
      cellSize,
    };
  }
  function drawFloor(i = floorInputs()): void {
    // Terrain and contents (SPEC-030 §§2–3) ride the same multiplier as the
    // grid they are painted on. On a square map this clears the layer, which
    // is what an empty tile list means — the two grid kinds never coexist.
    engine!.renderHexTiles(i.hexTiles, i.hexSize);
    engine!.renderScene(i.scene, i.cellSize);
  }

  function overlayInputs() {
    const dispOverlay = displayOverlayState();
    return {
      hexSymbols: hex?.symbols ?? [],
      hexLines: hex?.lines ?? [],
      hexSize: hexGrid?.size ?? 0,
      doors: displayState().doors,
      symbols: dispOverlay.symbols,
      mapRooms: dispOverlay.mapRooms,
      drawings: draw.annotationsWithLiveStroke(dispOverlay.drawings),
      cellSize,
      editingLabelId: labels.editingId,
      noteDotRoomIds: labels.noteDotRoomIds,
    };
  }
  function drawOverlay(i = overlayInputs()): void {
    // Placed symbols and drawn roads/rivers (SPEC-047 §§2, 4) — empty lists on
    // every square-grid map, which clears the layers.
    engine!.renderHexSymbols(i.hexSymbols, i.hexSize);
    engine!.renderHexLines(i.hexLines, i.hexSize);
    engine!.renderDoors(i.doors, i.cellSize);
    engine!.renderOverlayObjects(
      i.symbols,
      i.mapRooms,
      i.cellSize,
      i.editingLabelId,
      i.noteDotRoomIds,
    );
    engine!.renderAnnotations(i.drawings);
  }

  function fogInputs() {
    return {
      enabled: map.fog?.enabled ?? false,
      revealed: fogRegions.map((r) => r.rings),
      cellSize,
      mode: isGM ? ('gm' as const) : ('player' as const),
      // A hex crawl's fog is per hex (SPEC-056 §9), with an in-progress
      // Reveal / Hide stroke previewed on top of the stored flags.
      hex: hex?.fogView() ?? null,
    };
  }
  function drawFog(i = fogInputs()): void {
    // Fog sits above the overlay and below tokens. The referee sees a
    // translucent wash (where fog *remains*); players see it opaque.
    engine!.renderFog(i);
  }

  /** The live size readout (the Measure tool's path, a Capture rect, or a
   * floor shape's dimensions) — computed on demand rather than stored by a
   * draw pass, because the pointer path publishes it to the DOM readout
   * *before* the coalesced flush has run. See `strokeMeasureText_`'s
   * declaration for why this must not be reactive. */
  function currentStrokeMeasure(): StrokeMeasure | null {
    // The path plus its live extension to the pointer (SPEC-054 §12) — the
    // leg being aimed reads on the running total before it is placed, the way
    // every other multi-click tool's preview follows the cursor.
    const liveMeasurePath = draw.livePath;
    const liveHexPath = draw.liveHexPath;
    // Derived purely from the in-progress drag, so committing or cancelling
    // the stroke (which nulls `dragStart`/`dragCur`) makes the chip disappear
    // on its own. The Measure tool reuses the very same chip, so a span read
    // with the ruler and a span read while drawing a room agree on units and
    // rounding. Capture never goes through `strokeMeasureText`, which is typed
    // to the floor primitives and reports in the map's `RoomMeasure` units —
    // see `captureMeasureText`'s own doc comment for why cells, not feet.
    return tool === 'measure'
      ? hexGrid
        ? hexPathMeasureText(
            liveHexPath,
            liveMeasurePath.length ? liveMeasurePath[liveMeasurePath.length - 1]! : null,
            map.measure ?? null,
          )
        : pathMeasureText(liveMeasurePath, map.measure ?? null)
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
  }

  function toolsInputs() {
    const disp = displayState();
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
        ? vectorMap.visibilityPolygon(eye, liveScene().sight, eyeMaxDistLattice())
        : null;
    // The in-progress Capture rect (SPEC-029 §1): always the raw drag, always
    // whole cells, regardless of the map's snap mode — `vectorMap.captureRect`
    // takes no mode argument at all.
    const capturePreview =
      captureAllowed && dragStartRaw && dragCurRaw
        ? vectorMap.captureRect(dragStartRaw, dragCurRaw)
        : null;
    const liveMeasurePath = draw.livePath;
    const preview: ToolPreviewInput = {
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
      eyeAlpha,
      measure: currentStrokeMeasure(),
      ruler: liveMeasurePath.length >= 2 ? liveMeasurePath : null,
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
    };
    return {
      // The Road/River gesture still being clicked (SPEC-047 §12). `null` on
      // every other tool and every square map, which clears it — including
      // on the commit/cancel/tool-change paths, which empty the run
      // and then invalidate this layer.
      hexLinePreview: hex?.linePreview() ?? null,
      hexSize: hexGrid?.size ?? 0,
      // Which hex the sheet is editing (SPEC-030 §5). `null` on a square map,
      // which clears it.
      selectedHex: hexGrid ? mapCtrl.selectedHex : null,
      // The selected background's alignment grid (SPEC-038 §4) — present the
      // whole time something is selected, not only mid-drag (DEC-063), and
      // gone the moment nothing is. Drawn from the *live* rect so it tracks
      // the image through a move or resize rather than lagging behind it.
      backgroundRect: selectedBackground ? bgCtrl.liveRect(selectedBackground) : null,
      backgroundScale: backgroundSpaceScale(bgSpace),
      // The drawn grid square in lattice units — halved on a battle map, the
      // same conversion the grid pass's own `gridCellSize` carries. `null` on
      // a hex map, which gets the outline and handles but no square alignment
      // grid (SPEC-059 §3.5, RULE-006).
      gridStep: hexGrid ? null : gridCellSize / cellSize,
      subdivide: map.gridSettings.subdivide,
      preview,
      cellSize,
    };
  }
  function drawTools(i = toolsInputs()): void {
    // Everything here is on the never-exported tools layer.
    engine!.renderHexLinePreview(i.hexLinePreview, i.hexSize);
    engine!.renderHexSelection(i.selectedHex, i.hexSize);
    engine!.renderBackgroundAlignment(i.backgroundRect, i.backgroundScale, i.gridStep, i.subdivide);
    engine!.renderToolPreview(i.preview, i.cellSize);
  }

  /** Per-layer dirty tracking with one `requestAnimationFrame`-coalesced
   * flush (WI-193, SPEC-057 §4.2). A pass never runs before the engine
   * exists: every invalidation before mount is dropped by the guard, and
   * mount itself invalidates every layer. */
  const renderer = createMapRenderer({
    grid: () => engine && drawGrid(),
    floor: () => engine && drawFloor(),
    overlay: () => engine && drawOverlay(),
    fog: () => engine && drawFog(),
    tools: () => engine && drawTools(),
  });

  /** Every layer, redrawn on the next frame — for the discrete actions (a
   * commit, a click, a cancel) where which layers changed is not worth
   * narrowing. The hot paths (pointer moves, a vertex drag) invalidate only
   * the layers they touch. */
  function renderAll(): void {
    renderer.invalidate();
  }

  // One tracking effect per layer: each reads exactly the reactive state its
  // pass reads (by running the pass's own `*Inputs()`, not a hand-kept list)
  // and invalidates that layer alone when any of it changes. This is what
  // replaced the `renderAll()` calls effects and subscription callbacks used
  // to make, each of which redrew every layer synchronously.
  $effect(() => {
    if (!ready) return;
    gridInputs();
    renderer.invalidate('grid');
  });
  $effect(() => {
    if (!ready) return;
    floorInputs();
    renderer.invalidate('floor');
  });
  $effect(() => {
    if (!ready) return;
    overlayInputs();
    renderer.invalidate('overlay');
  });
  $effect(() => {
    if (!ready) return;
    fogInputs();
    renderer.invalidate('fog');
  });
  $effect(() => {
    if (!ready) return;
    toolsInputs();
    renderer.invalidate('tools');
  });

  // ---- "Download map as PNG" (M4 — bbox repointed to the union of
  // FloorRegion.bbox instead of the cellular carvedBoundingBox) ----

  const EXPORT_MARGIN_CELLS = 1;

  async function exportPng(): Promise<void> {
    if (!engine || mapCtrl.exportingPng) return;
    mapCtrl.exportingPng = true;
    // The export reads the layers as drawn, so draw anything still waiting
    // for the next frame first.
    renderer.flush();
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
    renderer.flush();
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
    {#if labels.editingId}
      <textarea
        bind:this={labels.inputEl}
        bind:value={labels.editingText}
        data-testid="label-edit-input"
        class="vf-label-editor"
        style={`left:${labels.editingPos.x}px; top:${labels.editingPos.y}px; --label-font:${labels.fontPx}px;`}
        rows="1"
        placeholder={S.roomName}
        onkeydown={(e) => labels.keydown(e)}
      ></textarea>
    {/if}

    {#if activeTooltip}
      <!-- `pointer-events: none` (see the CSS) so it can never eat a click on
      the label it is describing. Positioned below-right of the label's cell
      centre, then clamped so a label near an edge doesn't push it off screen.
      One popover for both paths: hovered on a fine pointer, pinned by a tap on
      the note dot on a coarse one (SPEC-033 §4) — and, on a hex crawl, for the
      hovered hex's own note (SPEC-030 §4), which is the same popover in the
      same place because a hex map has no room labels to compete with it. -->
      <div
        class="vf-label-tip"
        data-testid="map-label-tooltip"
        style={`--tip-x:${activeTooltip.x}px; --tip-y:${activeTooltip.y}px;`}
      >
        <MarkdownView text={activeTooltip.text} />
      </div>
    {/if}
  </div>

  <div class="vf-hint">{hint}</div>

  <!-- Hidden state readouts for e2e/introspection (mirrors the Pixi canvas
  state as queryable DOM, since Pixi renders to a bitmap). Vector-appropriate
  counts replace the old cellular `floor-cell-count`/`sight-wall-count`/etc.
  Gated behind `VITE_E2E_READOUTS` (SPEC-055 §3): none of this ships to
  production. No testid here moves — the flag only decides whether the whole
  block renders at all. -->
  {#if import.meta.env.VITE_E2E_READOUTS}
    <div class="vf-readouts" aria-hidden="true">
      {#each renderableTokens as token (token.id)}
        <span data-testid={`token-pos-${token.id}`}
          >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
        >
        <span data-testid={`token-size-${token.id}`}>{token.size}</span>
        <span data-testid={`token-current-${token.id}`}>{currentTurnIds.has(token.id)}</span>
        <span data-testid={`token-ring-${token.id}`}
          >{tokenRingColor(token, groups, selectedTokenIds, myUid)}</span
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
        <span data-testid={`maproom-note-dot-${r.id}`}>{labels.noteDotRoomIds.has(r.id)}</span>
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
    snap step) and, under Free snap, for the Corridor too (its legs never
    round-cap, SPEC-028 §6/IN-095); `⌀ size` under Free snap for Path only,
    matching its round cap. Empty for every other tool. -->
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
      <!-- Every token letter currently drawn (SPEC-048 §4), as `glyphs:mode`
    pairs — `mode` is `character` for a token with a seat and `creature`
    otherwise, which is what picks the two-tone colours. Pixi-drawn, so this
    readout is how a test observes it. -->
      <span data-testid="token-letter-readout">{tokenLetterText_}</span>
      <span data-testid="floor-region-count">{regions.length}</span>
      <span data-testid="fog-enabled">{map.fog?.enabled ?? false}</span>
      <span data-testid="fog-region-count">{fogRegions.length}</span>
      <span data-testid="wall-count">{walls.length}</span>
      <span data-testid="door-count">{doors.length}</span>
      <span data-testid="drawing-count">{drawings.length}</span>
      <!-- The one selected object, `kind:id` — empty when nothing, or more than
    one thing, is picked. A selected background (SPEC-039 §2) reports as
    `background:id`, the same shape every other kind uses; it's never
    simultaneous with `selectedObject` (mutual exclusivity, SPEC-039 §2). -->
      <span data-testid="selected-object"
        >{selectedBackground
          ? `background:${selectedBackground.id}`
          : selectedObject
            ? `${selectedObject.kind}:${selectedObject.id}`
            : ''}</span
      >
      <!-- Everything the Select tool holds (SPEC-037 §2): vertex handles plus
    objects (SPEC-039 §2 adds the background pick to the count). The handles
    are Pixi-drawn, so this count is how a test sees what a lasso caught. -->
      <span data-testid="selection-count">{selectionCount_}</span>
      <!-- Multi-token select (SPEC-056 §3, DEC-109) — a separate count from
    `selection-count` above: a token catch and a geometry catch are mutually
    exclusive, so this and `selection-count` are never both nonzero. -->
      <span data-testid="selected-token-count">{selectedTokenIds.length}</span>
      <span data-testid="last-batch-move-count">{lastBatchMoveCount}</span>
      <!-- What one *drawn grid square* is worth. On a battle map that is half a
    lattice cell, so the per-square value halves to match (SPEC-029 §4);
    measured distances are unchanged, since a doubled square count against a
    halved per-square value is the same span of ground. -->
      <span data-testid="measure-summary">{displayPerSquare(map)}/{map.measure.unit}</span>
      <span data-testid="grid-subdivide">{map.gridSettings.subdivide}</span>
      <!-- Which coordinate space this map's geometry is in (RULE-006): `hex` for
    a hex crawl, `square` for everything else. The hex grid and its coordinate
    pills are Pixi-drawn, so this plus `map-hex-size` is how a test sees which
    grid the renderer was handed. -->
      <span data-testid="map-grid-kind">{hexGrid ? 'hex' : 'square'}</span>
      <!-- The hex circumradius in pixels — the hex map's render-time multiplier
    (SPEC-030 §1), empty on a square-grid map. -->
      <span data-testid="map-hex-size">{hexGrid ? hexGrid.size : ''}</span>
      <!-- Which hex Select has picked (SPEC-030 §5), as its `axialKey` — the same
    `"q,r"` string that is its document id and its coordinate pill. Empty when
    nothing is picked. The outline itself is Pixi-drawn. -->
      <span data-testid="map-selected-hex"
        >{hexGrid && mapCtrl.selectedHex ? hexMap.axialKey(mapCtrl.selectedHex) : ''}</span
      >
      <!-- How many hexes carry anything at all — terrain, contents, a note or,
    from SPEC-056 §9, only the revealed flag. Sparse (SPEC-030 §§2–4), so this
    is what somebody has touched, not the size of the plane. -->
      <span data-testid="map-hex-tile-count">{hex?.tiles.length ?? 0}</span>
      <!-- How many of those are revealed to the players (SPEC-056 §9). The hex
    fog itself is Pixi-drawn; this is the state that drives it. -->
      <span data-testid="map-hex-revealed-count">{hex?.revealed.size ?? 0}</span>
      <!-- Placed symbols and drawn roads/rivers (SPEC-047 §§2, 4) — both
    Pixi-drawn, so these are how a test sees a commit landed. -->
      <span data-testid="map-hex-symbol-count">{hex?.symbols.length ?? 0}</span>
      <span data-testid="map-hex-line-count">{hex?.lines.length ?? 0}</span>
      <!-- The camera this map was last left at (see `mapCtrl.camera`) — written
    on unmount, so after an activity round-trip it is what the view was
    restored to. -->
      <span data-testid="map-camera"
        >{mapCtrl.camera[ownMapId]
          ? `${Math.round(mapCtrl.camera[ownMapId]!.x)},${Math.round(mapCtrl.camera[ownMapId]!.y)},${mapCtrl.camera[ownMapId]!.scale.toFixed(2)}`
          : ''}</span
      >
    </div>
  {/if}
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
