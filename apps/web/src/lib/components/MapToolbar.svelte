<script lang="ts">
  import type { SnapMode, Token } from '@osr-vtt/shared';
  import type { MapToolId } from '../shell/map-tool-controller.svelte';

  /**
   * Symbol/label authoring rail (DECISIONS.md WI-D D4 — hard cutover): the
   * Vector Map System reuses this EXISTING toolbar for symbol placement and
   * dungeon-room labeling rather than a reimplementation inside the vector
   * editor. Floor/wall/door/select/eye tools are the vector editor's own
   * inline tool rail (`VectorMapView.svelte`); this bar only ever drives
   * `symbols`/`mapRooms`, which SPEC §2.2 leaves unaffected by the cutover.
   */

  let {
    activeTool = $bindable(),
    selectedSymbolKind = $bindable(),
    tokenSnap = $bindable(),
    selectedToken,
    canUndo,
    canRedo,
    isGM,
    includeHiddenLayer = $bindable(),
    exportingPng,
    onUndo,
    onRedo,
    onResizeToken,
    onExportPng,
  }: {
    activeTool: MapToolId;
    selectedSymbolKind: string;
    tokenSnap: SnapMode;
    selectedToken: Token | null;
    canUndo: boolean;
    canRedo: boolean;
    isGM: boolean;
    includeHiddenLayer: boolean;
    exportingPng: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onResizeToken: (size: number) => void;
    onExportPng: () => void;
  } = $props();

  const TOOLS: { id: MapToolId; label: string }[] = [
    { id: 'symbol', label: 'Symbol' },
    { id: 'label', label: 'Label/Key' },
  ];

  const SYMBOL_KINDS = [
    'stairs-down',
    'spiral-stair',
    'column',
    'secret-door',
    'compass-star',
    'water',
    'rubble',
    'altar',
    'statue',
    'chest',
    'trap',
    'pit',
    'portcullis',
    'lever',
    'campfire',
    'note-pin',
  ];
</script>

<div class="toolbar" data-testid="map-toolbar">
  <div class="tool-group">
    {#each TOOLS as tool (tool.id)}
      <button
        data-testid={`map-tool-${tool.id}`}
        class:active={activeTool === tool.id}
        onclick={() => (activeTool = activeTool === tool.id ? 'none' : tool.id)}
      >
        {tool.label}
      </button>
    {/each}
  </div>

  <div class="tool-group">
    <button data-testid="map-undo" onclick={onUndo} disabled={!canUndo}>Undo</button>
    <button data-testid="map-redo" onclick={onRedo} disabled={!canRedo}>Redo</button>
  </div>

  <div class="tool-group" data-testid="map-export-tools">
    {#if isGM}
      <label class="inline">
        <input
          type="checkbox"
          data-testid="map-export-include-hidden"
          bind:checked={includeHiddenLayer}
        />
        Include hidden layer
      </label>
    {/if}
    <button data-testid="map-export-png" onclick={onExportPng} disabled={exportingPng}>
      {exportingPng ? 'Exporting…' : 'Download PNG'}
    </button>
  </div>

  <div class="map-defaults" data-testid="map-defaults">
    <span class="group-label">Map defaults</span>
    <label class="inline" data-testid="token-snap-control">
      Snap
      <select data-testid="token-snap-mode" bind:value={tokenSnap}>
        <option value="cell">Cell</option>
        <option value="half">Half</option>
        <option value="free">Free</option>
      </select>
    </label>
  </div>

  {#if activeTool === 'symbol'}
    <label class="inline">
      Symbol
      <select data-testid="symbol-kind" bind:value={selectedSymbolKind}>
        {#each SYMBOL_KINDS as kind (kind)}
          <option value={kind}>{kind}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if selectedToken}
    <label class="inline" data-testid="token-scale-control">
      Token scale
      <input
        type="range"
        data-testid="token-scale-slider"
        min="1"
        max="3"
        step="1"
        value={selectedToken.size}
        oninput={(e) => onResizeToken(Number((e.target as HTMLInputElement).value))}
      />
      <span data-testid="token-scale-value">{selectedToken.size}×{selectedToken.size}</span>
    </label>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 4px;
    margin-bottom: 0.4rem;
  }
  .tool-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  button {
    margin-top: 0;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  button.active {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  select {
    background: var(--bg-inset);
    color: inherit;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.2rem;
  }
  .map-defaults {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .group-label {
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
</style>
