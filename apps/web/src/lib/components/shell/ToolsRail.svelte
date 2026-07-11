<script lang="ts">
  import MapToolbar from '../MapToolbar.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';
  import type { ActivityId } from '../../shell/types';

  /** Right rail (Master Plan v2, R1.1). Context-sensitive to the *current stage
   * activity*. In WI-2 only the Map activity publishes tools — the existing
   * `MapToolbar` is re-housed here verbatim (every `map-*` testid preserved),
   * bound to the shared `MapToolController`. Encounter/Dice tool palettes are
   * later WIs; other activities show an empty rail. It is a collapsible docked
   * panel (not a flyout) so it stays pinned while working on the stage. */
  let {
    activeActivity,
    controller,
    collapsed,
    onToggle,
  }: {
    activeActivity: ActivityId;
    controller: MapToolController;
    collapsed: boolean;
    onToggle: () => void;
  } = $props();

  const hasTools = $derived(activeActivity === 'map' && controller.mounted);
</script>

<aside class="tools-rail" class:collapsed={collapsed || !hasTools} data-testid="tools-rail">
  {#if hasTools}
    {#if collapsed}
      <button class="spine-toggle" data-testid="tools-expand" title="Show tools" onclick={onToggle}>
        ⟨
      </button>
    {:else}
      <header>
        <span class="label">Tools</span>
        <button class="collapse" data-testid="tools-collapse" title="Hide tools" onclick={onToggle}>
          ⟩
        </button>
      </header>
      <div class="palette">
        <MapToolbar
          bind:activeTool={controller.activeTool}
          bind:wallStyle={controller.wallStyle}
          bind:selectedSymbolKind={controller.selectedSymbolKind}
          selectedToken={controller.selectedToken}
          canUndo={controller.canUndo}
          canRedo={controller.canRedo}
          isGM={controller.isGM}
          fogMode={controller.fogMode}
          importing={controller.importing}
          onUndo={controller.onUndo}
          onRedo={controller.onRedo}
          onResizeToken={controller.onResizeToken}
          onSetFogMode={controller.onSetFogMode}
          onImportSampleUvtt={controller.onImportSampleUvtt}
          onImportUvttFile={controller.onImportUvttFile}
        />
      </div>
    {/if}
  {:else}
    <div class="empty" aria-hidden="true"></div>
  {/if}
</aside>

<style>
  .tools-rail {
    height: 100%;
    box-sizing: border-box;
    background: var(--bg-panel);
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .tools-rail.collapsed {
    align-items: center;
  }
  .spine-toggle,
  .collapse {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.4rem;
    border-radius: 4px;
  }
  .spine-toggle:hover,
  .collapse:hover {
    color: var(--text);
  }
  .spine-toggle {
    margin-top: 0.5rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--line);
  }
  .label {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .palette {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.4rem;
  }
  .empty {
    flex: 1;
  }
</style>
