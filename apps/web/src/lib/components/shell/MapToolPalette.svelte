<script lang="ts">
  import MapToolbar from '../MapToolbar.svelte';
  import type { MapToolController, MapToolId } from '../../shell/map-tool-controller.svelte';

  /** The map tool catalog bound to the shared `MapToolController`, extracted so
   * both the desktop Tools rail (R1.1) and the mobile tool bottom-sheet (R1.8)
   * render one identical palette — every `map-*` testid is preserved. */
  let {
    controller,
    expanded = false,
    toolSubset = null,
  }: {
    controller: MapToolController;
    expanded?: boolean;
    /** Passed straight through to `MapToolbar` — the palette itself has no
     * opinion on which tools a given map offers (SPEC-029 §4); `MapToolsSheet`
     * decides and this is the wire. */
    toolSubset?: readonly MapToolId[] | null;
  } = $props();
</script>

<MapToolbar
  bind:activeTool={controller.activeTool}
  bind:selectedSymbolKind={controller.selectedSymbolKind}
  bind:carveMode={controller.carveMode}
  snapMode={controller.snapMode}
  bind:width={controller.width}
  bind:bandWidth={controller.bandWidth}
  bind:sides={controller.sides}
  bind:tolerance={controller.tolerance}
  bind:selectedDoorArt={controller.selectedDoorArt}
  rotatableSelection={controller.rotatableSelection}
  canUndo={controller.canUndo}
  canRedo={controller.canRedo}
  isGM={controller.isGM}
  bind:exportMaxLayer={controller.exportMaxLayer}
  exportingPng={controller.exportingPng}
  canAddCreature={controller.canAddCreature}
  fogEnabled={controller.fogEnabled}
  canRevealFromEye={controller.canRevealFromEye}
  mapMode={controller.mapMode}
  {toolSubset}
  {expanded}
  onUndo={controller.onUndo}
  onRedo={controller.onRedo}
  onSetSnapMode={(m) => controller.setSnapMode(m)}
  onSetMapMode={(m) => controller.setMapMode(m)}
  onExportPng={controller.onExportPng}
  onRotateSelection={controller.onRotateSelection}
  onAddCreature={controller.onAddCreature}
  onRevealAll={controller.onRevealAll}
  onResetFog={controller.onResetFog}
  onRevealFromEye={controller.onRevealFromEye}
/>
