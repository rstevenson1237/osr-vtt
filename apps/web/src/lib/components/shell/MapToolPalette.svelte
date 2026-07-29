<script lang="ts">
  import MapToolbar from '../MapToolbar.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';

  /** The map tool catalog bound to the shared `MapToolController`, extracted so
   * both the desktop Tools rail (R1.1) and the mobile tool bottom-sheet (R1.8)
   * render one identical palette — every `map-*` testid is preserved. */
  let { controller, expanded = false }: { controller: MapToolController; expanded?: boolean } =
    $props();
</script>

<MapToolbar
  bind:activeTool={controller.activeTool}
  bind:selectedSymbolKind={controller.selectedSymbolKind}
  bind:carveMode={controller.carveMode}
  bind:snapMode={controller.snapMode}
  bind:width={controller.width}
  bind:sides={controller.sides}
  bind:tolerance={controller.tolerance}
  bind:selectedDoorArt={controller.selectedDoorArt}
  bind:selectMode={controller.selectMode}
  selectedToken={controller.selectedToken}
  rotatableSelection={controller.rotatableSelection}
  canUndo={controller.canUndo}
  canRedo={controller.canRedo}
  isGM={controller.isGM}
  bind:exportMaxLayer={controller.exportMaxLayer}
  exportingPng={controller.exportingPng}
  canAddCreature={controller.canAddCreature}
  fogEnabled={controller.fogEnabled}
  canRevealFromEye={controller.canRevealFromEye}
  {expanded}
  onUndo={controller.onUndo}
  onRedo={controller.onRedo}
  onResizeToken={controller.onResizeToken}
  onExportPng={controller.onExportPng}
  onRotateSelection={controller.onRotateSelection}
  onAddCreature={controller.onAddCreature}
  onRevealAll={controller.onRevealAll}
  onResetFog={controller.onResetFog}
  onRevealFromEye={controller.onRevealFromEye}
/>
