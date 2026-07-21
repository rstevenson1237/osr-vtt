<script lang="ts">
  import MapToolbar from '../MapToolbar.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';

  /** The map tool catalog bound to the shared `MapToolController`, extracted so
   * both the desktop Tools rail (R1.1) and the mobile tool bottom-sheet (R1.8)
   * render one identical palette — every `map-*` testid is preserved. */
  let { controller }: { controller: MapToolController } = $props();
</script>

<MapToolbar
  bind:activeTool={controller.activeTool}
  bind:selectedSymbolKind={controller.selectedSymbolKind}
  bind:carveMode={controller.carveMode}
  bind:snapMode={controller.snapMode}
  bind:width={controller.width}
  bind:sides={controller.sides}
  bind:tolerance={controller.tolerance}
  bind:doorType={controller.doorType}
  bind:selectMode={controller.selectMode}
  selectedToken={controller.selectedToken}
  canUndo={controller.canUndo}
  canRedo={controller.canRedo}
  isGM={controller.isGM}
  bind:includeHiddenLayer={controller.includeHiddenLayer}
  exportingPng={controller.exportingPng}
  onUndo={controller.onUndo}
  onRedo={controller.onRedo}
  onResizeToken={controller.onResizeToken}
  onExportPng={controller.onExportPng}
/>
