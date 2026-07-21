import type { SnapMode, Token } from '@osr-vtt/shared';

/** The tool ids the symbol/label authoring rail exposes (D4 — the hard
 * cutover keeps the *existing* cellular symbol/label tools as the reused
 * authoring UI for the Vector Map System; floor/wall/door/select/eye are the
 * vector editor's own inline tool rail in `VectorMapView.svelte`, not this
 * one). `'none'` means "no map tool active" — the vector editor's own tools
 * are driving instead. */
export type MapToolId = 'none' | 'symbol' | 'label';

const NOOP = (): void => {};

/** Bridges the Vector Map stage and the shared Tools rail (Master Plan v2,
 * R1 — "map tools migrate off the canvas-top toolbar"; DECISIONS.md WI-D D4
 * — symbol/label authoring reuses the existing `MapToolbar`/`ToolsRail`
 * rather than a reimplementation inside the vector editor). One instance is
 * created per `RoomShell`, shared through context, read/written by
 * `VectorMapView` and rendered by `ToolsRail` (which mounts the existing
 * `MapToolbar` bound to these fields). Because both sides mutate the same
 * runes object, a click in the rail and a keyboard shortcut in the map view
 * stay in sync automatically. */
export class MapToolController {
  activeTool = $state<MapToolId>('none');
  selectedSymbolKind = $state('chest');
  /** Base token snap mode (Master Plan v2, R9.7). */
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

  onUndo: () => void = NOOP;
  onRedo: () => void = NOOP;
  onResizeToken: (size: number) => void = NOOP;
  onExportPng: () => void = NOOP;

  /** Called by the map view's `onDestroy` so a stale palette can't drive a
   * torn-down map after an activity switch. Persistent selections (tool,
   * symbol kind) are intentionally kept across mounts. */
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
