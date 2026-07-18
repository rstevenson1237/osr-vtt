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
  bind:wallStyle={controller.wallStyle}
  bind:wallErase={controller.wallErase}
  bind:selectedSymbolKind={controller.selectedSymbolKind}
  bind:doorType={controller.doorType}
  bind:doorState={controller.doorState}
  bind:tokenSnap={controller.tokenSnap}
  bind:gridSnap={controller.gridSnap}
  selectedToken={controller.selectedToken}
  canUndo={controller.canUndo}
  canRedo={controller.canRedo}
  isGM={controller.isGM}
  fogMode={controller.fogMode}
  importing={controller.importing}
  bind:includeHiddenLayer={controller.includeHiddenLayer}
  exportingPng={controller.exportingPng}
  onUndo={controller.onUndo}
  onRedo={controller.onRedo}
  onResizeToken={controller.onResizeToken}
  onSetFogMode={controller.onSetFogMode}
  onImportSampleUvtt={controller.onImportSampleUvtt}
  onImportUvttFile={controller.onImportUvttFile}
  onExportPng={controller.onExportPng}
/>
