import type { SnapMode, Token } from '@osr-vtt/shared';
import type { ToolId } from '../map/tools';

export type FogMode = 'emergent' | 'manual' | 'dynamic';

const NOOP = (): void => {};

/** Bridges the Map stage and the right Tools rail (Master Plan v2, R1 — "map
 * tools migrate off the canvas-top toolbar"). `MapView` used to own this state
 * locally and render `MapToolbar` itself; now a single instance of this class
 * is created per `RoomShell`, shared through context, read/written by `MapView`
 * and rendered by `ToolsRail` (which mounts the existing `MapToolbar` bound to
 * these fields). Because both sides mutate the same runes object, a keyboard
 * shortcut in `MapView` and a click in the rail stay in sync automatically. */
export class MapToolController {
  activeTool = $state<ToolId>('carve');
  wallStyle = $state<'masonry' | 'natural'>('masonry');
  /** Wall tool erase toggle (Master Plan v2, R9.2 — "dragging along an
   * existing run with the same tool in 'erase' mode removes"). */
  wallErase = $state(false);
  selectedSymbolKind = $state('chest');
  /** Base token snap mode (Master Plan v2, R9.7) — the mobile/tools toggle used
   * when no drop modifier is held (desktop Alt/Alt+Shift still override it). */
  tokenSnap = $state<SnapMode>('cell');
  selectedToken = $state<Token | null>(null);
  canUndo = $state(false);
  canRedo = $state(false);
  /** Mirrored from `room.fog.mode` for the map tools' quick fog-cycle toggle
   * (Master Plan v2, R4 — the full mode select lives in Session Config). */
  fogMode = $state<FogMode>('emergent');
  importing = $state(false);
  isGM = $state(false);
  /** True while a `MapView` instance is mounted and driving this controller;
   * the Tools rail only renders the map palette when this is set. */
  mounted = $state(false);

  onUndo: () => void = NOOP;
  onRedo: () => void = NOOP;
  onResizeToken: (size: number) => void = NOOP;
  onSetFogMode: (mode: FogMode) => void = NOOP;
  onImportSampleUvtt: () => void = NOOP;
  onImportUvttFile: (file: File) => void = NOOP;

  /** Called by `MapView.onDestroy` so a stale palette can't drive a torn-down
   * map after an activity switch. Persistent selections (tool, wall style,
   * symbol kind) are intentionally kept across mounts. */
  release(): void {
    this.selectedToken = null;
    this.canUndo = false;
    this.canRedo = false;
    this.importing = false;
    this.mounted = false;
    this.onUndo = NOOP;
    this.onRedo = NOOP;
    this.onResizeToken = NOOP;
    this.onSetFogMode = NOOP;
    this.onImportSampleUvtt = NOOP;
    this.onImportUvttFile = NOOP;
  }
}
