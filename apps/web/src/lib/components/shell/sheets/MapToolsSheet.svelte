<script lang="ts">
  import MapToolPalette from '../MapToolPalette.svelte';
  import type { MapToolController } from '../../../shell/map-tool-controller.svelte';

  /** Map tools quick sheet (Shell UI Redesign) — the former right-side Tools
   * rail, re-housed as a docked sheet over the stage. No longer referee-gated:
   * every player gets the tool grid, its contextual parameters, undo/redo and
   * PNG export. The few referee-only controls (the hidden-layer export toggle)
   * keep their own `isGM` gate inside `MapToolbar`.
   *
   * The palette is `MapToolPalette` unchanged, so every `map-*` testid and the
   * shared `MapToolController` binding survive the move. */
  let {
    controller,
    mainView,
  }: {
    controller: MapToolController;
    /** The tools only drive the Map stage; on another stage the sheet says so
     * rather than presenting controls that would silently do nothing. */
    mainView: string;
  } = $props();
</script>

{#if mainView !== 'map'}
  <p class="hint" data-testid="map-tools-off-stage">Switch to the Map view to use these tools.</p>
{:else if !controller.mounted}
  <p class="hint" data-testid="map-tools-waiting">Loading map…</p>
{:else}
  <MapToolPalette {controller} />
{/if}

<style>
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
</style>
