import { vectorMap, type SnapMode, type Token } from '@osr-vtt/shared';
import type { MapExportLayer } from '../map/export-layers';

/** Every map tool, unified into one catalog (Master Plan v2 R1 — "map tools
 * migrate off the canvas-top toolbar"). Previously split across two rails:
 * a shared `symbol`/`label`-only rail here and the vector editor's own inline
 * `.vf-bar` for `select`/`room`/…/`ping`. There is now exactly one active
 * tool, one source of truth, rendered by the single `MapToolbar` in the Tools
 * rail and driven by `VectorMapView`. */
export type MapToolId =
  | 'select'
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
  | 'annotate'
  | 'ping'
  | 'label'
  | 'symbol';

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
  selectedSymbolKind = $state('chest');
  /** Base token snap mode (Master Plan v2, R9.7). Its control lives on the
   * character quick sheet, not the map toolbar — a player sets their own drop
   * behavior from the sheet they're already looking at. */
  tokenSnap = $state<SnapMode>('cell');
  selectedToken = $state<Token | null>(null);
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
  snapMode = $state<vectorMap.VectorSnapMode>('full');
  width = $state(2);
  sides = $state(6);
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
  selectMode = $state<'vertex' | 'edge' | 'object'>('edge');

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
