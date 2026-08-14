<script lang="ts">
  import MapToolPalette from '../MapToolPalette.svelte';
  import HexTilePanel from '../HexTilePanel.svelte';
  import { HEX_TOOL_IDS, VIEW_TOOL_IDS } from '../../../map/tool-groups';
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
    expanded = false,
  }: {
    controller: MapToolController;
    /** Expanded shows the occasional, screen-sized actions (PNG export, add
     * creature); docked stays a compact drawing palette. */
    expanded?: boolean;
    /** The tools only drive the Map stage; on another stage the sheet says so
     * rather than presenting controls that would silently do nothing. */
    mainView: string;
  } = $props();

  /** Which tools this map offers. A battle map is a snapshot of another map
   * (SPEC-029 §4), so it offers the View tools only — editing it would
   * desynchronize it from its source. A hex crawl (SPEC-030 §5) offers those
   * plus **Select**, which on a hex map picks the hex the panel below edits;
   * everything else is out because it would write square-lattice geometry into
   * a map whose space is axial (RULE-006 — see `HEX_TOOL_IDS`). `null` is the
   * ordinary map's whole catalog. This sheet is where the choice belongs: it is
   * the one component that knows both what is on stage and what the palette
   * renders. */
  const toolSubset = $derived(
    controller.isBattleMap ? VIEW_TOOL_IDS : controller.isHexMap ? HEX_TOOL_IDS : null,
  );
</script>

{#if mainView !== 'map'}
  <p class="hint" data-testid="map-tools-off-stage">Switch to the Map view to use these tools.</p>
{:else if !controller.mounted}
  <p class="hint" data-testid="map-tools-waiting">Loading map…</p>
{:else}
  <!-- The hex-tile quick sheet (SPEC-030 §5) is the hex crawl's body of *this*
  sheet rather than a seventh entry in `QUICK_SHEETS`: it is contextual to the
  map on stage, and a rail button that is dead on every square-grid map is the
  dead button `quickSheetsFor` exists to prevent. It sits above the palette
  because Select — the tool that fills it — is the first button in it. -->
  {#if controller.isHexMap}
    <HexTilePanel {controller} />
  {/if}
  <MapToolPalette {controller} {expanded} {toolSubset} />
{/if}

<style>
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
</style>
