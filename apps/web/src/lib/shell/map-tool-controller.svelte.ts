import { vectorMap, type SnapMode, type Token } from '@osr-vtt/shared';
import type { MapExportLayer } from '../map/export-layers';
import { isViewTool } from '../map/tool-groups';

/**
 * The corridor width each snap mode starts at (SPEC-028). Half snap is
 * half-cell work, so it opens at ½; cell and free snap open at a full cell.
 */
export const DEFAULT_CORRIDOR_WIDTH: Record<vectorMap.VectorSnapMode, number> = {
  full: 1,
  half: 0.5,
  free: 1,
};

/** Every map tool, unified into one catalog (Master Plan v2 R1 — "map tools
 * migrate off the canvas-top toolbar"). Previously split across two rails:
 * a shared `symbol`/`label`-only rail here and the vector editor's own inline
 * `.vf-bar` for `select`/`room`/…/`ping`. There is now exactly one active
 * tool, one source of truth, rendered by the single `MapToolbar` in the Tools
 * rail and driven by `VectorMapView`. */
export type MapToolId =
  // Select is a *group* of three tools, one per thing you can grab, rather than
  // one tool with a mode dropdown next to it: picking what you are editing is
  // the same kind of choice as picking which shape you are drawing.
  | 'selectVertex'
  | 'selectEdge'
  | 'selectObject'
  | 'pan'
  | 'room'
  | 'corridor'
  | 'path'
  | 'polygon'
  | 'ngon'
  | 'carve'
  | 'wall'
  | 'door'
  | 'eye'
  | 'measure'
  | 'pen'
  | 'ping'
  | 'label'
  | 'symbol';

/** The three Select tools, which share every code path except which kind of
 * handle they pick. `vector-engine.ts`'s `ToolPreviewInput.selectMode` still
 * takes the mode, so the tool id is the single source of it. */
export type SelectMode = 'vertex' | 'edge' | 'object';

export function isSelectTool(tool: MapToolId): boolean {
  return tool === 'selectVertex' || tool === 'selectEdge' || tool === 'selectObject';
}

/** The handle kind a Select tool grabs; `'edge'` for anything that isn't one. */
export function selectModeForTool(tool: MapToolId): SelectMode {
  if (tool === 'selectVertex') return 'vertex';
  if (tool === 'selectObject') return 'object';
  return 'edge';
}

/**
 * What a carve tool lays down. Floor/rock carve `floorRegions` (the map
 * itself); the two fog modes point the identical stroke at `fogRegions`
 * instead, adding revealed area (`fog`) or taking it back (`unfog`) — which is
 * what retired the separate Reveal/Hide tools (playtest feedback: the fog
 * brushes were the same five shapes, minus the shapes). The fog modes are
 * referee-only and only offered while the map has fog enabled.
 */
export type CarveMode = 'add' | 'subtract' | 'fog' | 'unfog';

/** Whether a carve mode targets `fogRegions` rather than `floorRegions`. */
export function isFogCarve(mode: CarveMode): boolean {
  return mode === 'fog' || mode === 'unfog';
}

/** The Edit/View soft lock (IN-031): `'view'` disables every tool outside the
 * `view` group (`map/tool-groups.ts`) in the palette, so a stray click can't
 * start a carve or edit gesture. Per-viewer client state only — no store
 * write, no rules change, and explicitly not a resolution of DEC-001 (map
 * drawing stays open to every room member; this is a latch a viewer flips
 * for themselves). */
export type MapToolMode = 'edit' | 'view';

const NOOP = (): void => {};

/** Maps a carve tool id (`MapToolbar`'s `CARVE_TOOLS` / `vector-tools.ts`'s
 * `FloorPrimitiveTool`) to the shared `vectorMap.ToolKind` the simplify
 * policy (`packages/shared/src/map/vector/tolerance.ts`) is keyed on — the UI
 * calls the n-gon/circle tool `ngon`, the shared policy calls it `regular`. */
export function carveKind(tool: MapToolId): vectorMap.ToolKind {
  if (tool === 'ngon') return 'regular';
  // The freehand brush has no policy of its own: free-snap it *is* a buffered
  // polyline (the Path tool's own offset), and snapped it emits axis-aligned
  // cell squares that the path tolerance leaves alone. So it shares Path's.
  if (tool === 'carve') return 'path';
  return tool as vectorMap.ToolKind;
}

/** Bridges the Vector Map stage and the shared Tools rail. One instance is
 * created per `RoomShell`, shared through context, read/written by both
 * `VectorMapView` (the map canvas + its keyboard shortcuts) and `MapToolbar`
 * (the rail's buttons/params). Because both sides mutate the same runes
 * object, a click in the rail and a keyboard shortcut in the map view stay in
 * sync automatically — there is nothing left to reconcile between two
 * separate tool states. */
export class MapToolController {
  activeTool = $state<MapToolId>('room');
  /** See `MapToolMode`. Defaults to `'edit'`, unchanged from every prior
   * session's behaviour. */
  mapMode = $state<MapToolMode>('edit');
  selectedSymbolKind = $state('chest');
  /** Base token snap mode (Master Plan v2, R9.7). Its control lives on the
   * character quick sheet, not the map toolbar — a player sets their own drop
   * behavior from the sheet they're already looking at. */
  tokenSnap = $state<SnapMode>('cell');
  selectedToken = $state<Token | null>(null);
  /**
   * The token currently being dragged *out of a quick sheet* and onto the map,
   * or `null`. Set by the character sheet's `dragstart` and cleared by its
   * `dragend`; the map reads it to hide that token while the pointer carries
   * its translucent image, so the token really has left the map for the
   * duration of the drag rather than sitting there under its own ghost.
   *
   * This controller is already the map⇄sheet bridge and is in context under
   * `MAP_TOOL_KEY`, so neither side needs new plumbing to reach the other.
   */
  sheetDragTokenId = $state<string | null>(null);
  canUndo = $state(false);
  canRedo = $state(false);
  isGM = $state(false);
  /** True while `VectorMapView` is mounted and driving this controller; the
   * Tools rail only renders the map palette when this is set. */
  mounted = $state(false);
  /** The highest render layer included in a PNG download (Master Plan v2,
   * R9.8's export toggle, generalized): everything from the background up to
   * and including this layer is drawn, everything above it is hidden for the
   * duration of the export. Persisted preference, not reset on unmount. */
  exportMaxLayer = $state<MapExportLayer>('tokens');
  exportingPng = $state(false);
  /** Per-map camera (world pan + zoom), kept across mounts so leaving the Map
   * view for the Encounter board and coming back returns to where the referee
   * was looking instead of resetting the view. Written by `VectorMapView` on
   * unmount, read by it on mount. */
  camera = $state<Record<string, { x: number; y: number; scale: number }>>({});
  /** A "jump-to this room" request from the Rooms manager (Master Plan v2,
   * R17.2 / WI-20), consumed once the map engine is ready. Persisted across
   * mounts so a request made while the map is unmounted survives the
   * activity switch. */
  jumpToMapRoomId = $state<string | null>(null);
  /** The map room the Room quick sheet is looking at (Shell UI Redesign). Set
   * by the map canvas whenever Select → Object picks a room label, and by the
   * sheet's own list rows. Survives map unmount so the sheet keeps showing the
   * last selection while another main view is on stage. */
  selectedMapRoomId = $state<string | null>(null);

  // ---- vector draw-tool parameters (lifted from VectorMapView's local
  // state so the rail and the canvas share one copy; see MapToolbar for the
  // per-tool contextual display of these). ----
  carveMode = $state<CarveMode>('add');
  /** Not written directly — go through `setSnapMode`, which carries the
   * corridor width along with it (SPEC-028). */
  snapMode = $state<vectorMap.VectorSnapMode>('full');
  /** Path and Carve brush width, free-form in half-cell steps. */
  width = $state(2);
  /** Corridor width, one of `CORRIDOR_WIDTH_OPTIONS`. Separate from `width`
   * because a corridor is a run of whole cells rather than an arbitrary
   * ribbon, and because its default tracks the snap mode. */
  corridorWidth = $state(DEFAULT_CORRIDOR_WIDTH.full);
  /** N-gon side count, one of `NGON_SIDE_OPTIONS`; `1` is the circle. */
  sides = $state(1);
  /** Per-tool simplify tolerance (SPEC §5.4/§8.3), seeded from the shared
   * `DEFAULT_TOOL_TOLERANCE` policy so ngon/room/polygon commit crisp (tol 0)
   * and corridor/path prune redundant vertices — see `tolerance` below for
   * the active-tool view the rail's slider actually binds to. Keyed by the
   * shared `vectorMap.ToolKind`, not `MapToolId` (`carveKind` bridges them). */
  toolTolerances = $state<Record<vectorMap.ToolKind, number>>({
    ...vectorMap.DEFAULT_TOOL_TOLERANCE,
  });
  /** Door-art catalog kind to stamp on newly placed doors — the door tool's
   * single selection (SPEC §3.2 consolidation; there used to be a separate
   * `doorType` control too). `vectorMap.doorTypeForArt` derives the stored
   * `Door.type` from this at placement time, so LoS ("barred" always blocks)
   * still works without a second control. */
  selectedDoorArt = $state('door');

  /** The active tool's simplify tolerance — what `MapToolbar`'s Simplify
   * slider reads/writes via `bind:tolerance`. Each carve tool remembers its
   * own value in `toolTolerances`; switching tools switches which entry the
   * slider is looking at, rather than sharing one global value. */
  get tolerance(): number {
    return vectorMap.toolTolerance(
      carveKind(this.activeTool),
      this.toolTolerances[carveKind(this.activeTool)],
    );
  }
  set tolerance(value: number) {
    this.toolTolerances[carveKind(this.activeTool)] = value;
  }

  /**
   * Change the snap mode, resetting the corridor width to that mode's default
   * (SPEC-028): ½ under half snap, 1 under cell and free.
   *
   * The reset is unconditional rather than "only if untouched" (DEC-028). Snap
   * mode and corridor width are one decision in practice — a referee switching
   * to half snap is switching to half-cell work — and a controller that
   * remembers whether you have ever touched a control produces a default that
   * silently stops applying, which is harder to explain than a value that
   * visibly moves when you change modes.
   */
  setSnapMode(mode: vectorMap.VectorSnapMode): void {
    this.snapMode = mode;
    this.corridorWidth = DEFAULT_CORRIDOR_WIDTH[mode];
  }

  /**
   * Switch the Edit/View soft lock (IN-031). Entering `'view'` forces the
   * active tool back to Pan when it currently holds a carve/edit tool —
   * `VectorMapView`'s own tool-change effect then cancels any stroke already
   * in progress, so locking mid-drag can't leave one armed. Leaving `'view'`
   * never changes the active tool; there is nothing to restore to.
   */
  setMapMode(mode: MapToolMode): void {
    this.mapMode = mode;
    if (mode === 'view' && !isViewTool(this.activeTool)) {
      this.activeTool = 'pan';
    }
  }

  /** What Select → Object currently has picked, mirrored out of the map view
   * so the toolbar can offer the contextual actions that apply to it (today:
   * rotate). `null` when nothing is selected or the selection isn't rotatable.
   * Symbols cycle 90° at a time; a door flips end-for-end (180°). */
  rotatableSelection = $state<'symbol' | 'door' | null>(null);
  /** Referee-only: whether the map view can currently stamp a new creature
   * token. The button lives in the *expanded* map tools (Shell UI Redesign
   * follow-up) rather than floating over the stage, where it collided with
   * the docked quick-sheet column. */
  canAddCreature = $state(false);
  /** `GameMap.fog.enabled` for the map currently on stage (SPEC §4), mirrored
   * out of the map view so the palette can show the fog controls without
   * subscribing to the map doc itself. */
  fogEnabled = $state(false);
  /** True while the Eye tool has an eye placed and fog is on — the one state
   * in which "reveal what the eye can see" is meaningful. Turns the Eye tool's
   * LoS preview from a debug overlay into the authoring aid for fog. */
  canRevealFromEye = $state(false);

  onUndo: () => void = NOOP;
  onRedo: () => void = NOOP;
  onResizeToken: (size: number) => void = NOOP;
  onExportPng: () => void = NOOP;
  onRotateSelection: () => void = NOOP;
  onAddCreature: () => void = NOOP;
  onRevealAll: () => void = NOOP;
  onResetFog: () => void = NOOP;
  onRevealFromEye: () => void = NOOP;

  /** Called by the map view's `onDestroy` so a stale palette can't drive a
   * torn-down map after an activity switch. Persistent selections (tool,
   * symbol kind, draw params) are intentionally kept across mounts. */
  release(): void {
    this.selectedToken = null;
    // A drag whose drop never landed must not leave the next mount hiding a
    // token forever.
    this.sheetDragTokenId = null;
    this.rotatableSelection = null;
    this.canAddCreature = false;
    this.fogEnabled = false;
    this.canRevealFromEye = false;
    this.canUndo = false;
    this.canRedo = false;
    this.exportingPng = false;
    this.mounted = false;
    this.onUndo = NOOP;
    this.onRedo = NOOP;
    this.onResizeToken = NOOP;
    this.onExportPng = NOOP;
    this.onRotateSelection = NOOP;
    this.onAddCreature = NOOP;
    this.onRevealAll = NOOP;
    this.onResetFog = NOOP;
    this.onRevealFromEye = NOOP;
  }
}
