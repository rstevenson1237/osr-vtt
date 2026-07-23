import { vectorMap, type SnapMode, type Token } from '@osr-vtt/shared';

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
  | 'wall'
  | 'door'
  | 'eye'
  | 'annotate'
  | 'ping'
  | 'label'
  | 'symbol';

const NOOP = (): void => {};

/** Maps a carve tool id (`MapToolbar`'s `CARVE_TOOLS` / `vector-tools.ts`'s
 * `FloorPrimitiveTool`) to the shared `vectorMap.ToolKind` the simplify
 * policy (`packages/shared/src/map/vector/tolerance.ts`) is keyed on — the UI
 * calls the n-gon/circle tool `ngon`, the shared policy calls it `regular`. */
export function carveKind(tool: MapToolId): vectorMap.ToolKind {
  return tool === 'ngon' ? 'regular' : (tool as vectorMap.ToolKind);
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
  /** GM-only "include hidden layer" export toggle (Master Plan v2, R9.8) —
   * persisted preference, not reset on unmount. Ignored for players. */
  includeHiddenLayer = $state(true);
  exportingPng = $state(false);
  /** A "jump-to this room" request from the Rooms manager (Master Plan v2,
   * R17.2 / WI-20), consumed once the map engine is ready. Persisted across
   * mounts so a request made while the map is unmounted survives the
   * activity switch. */
  jumpToMapRoomId = $state<string | null>(null);

  // ---- vector draw-tool parameters (lifted from VectorMapView's local
  // state so the rail and the canvas share one copy; see MapToolbar for the
  // per-tool contextual display of these). ----
  carveMode = $state<'add' | 'subtract'>('add');
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

  onUndo: () => void = NOOP;
  onRedo: () => void = NOOP;
  onResizeToken: (size: number) => void = NOOP;
  onExportPng: () => void = NOOP;

  /** Called by the map view's `onDestroy` so a stale palette can't drive a
   * torn-down map after an activity switch. Persistent selections (tool,
   * symbol kind, draw params) are intentionally kept across mounts. */
  release(): void {
    this.selectedToken = null;
    this.canUndo = false;
    this.canRedo = false;
    this.exportingPng = false;
    this.mounted = false;
    this.onUndo = NOOP;
    this.onRedo = NOOP;
    this.onResizeToken = NOOP;
    this.onExportPng = NOOP;
  }
}
