<script lang="ts">
  import type { Token } from '@osr-vtt/shared';
  import type { ToolId } from '../map/tools';

  let {
    activeTool = $bindable(),
    wallStyle = $bindable(),
    selectedSymbolKind = $bindable(),
    selectedToken,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onResizeToken,
  }: {
    activeTool: ToolId;
    wallStyle: 'masonry' | 'natural';
    selectedSymbolKind: string;
    selectedToken: Token | null;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onResizeToken: (size: number) => void;
  } = $props();

  const TOOLS: { id: ToolId; label: string }[] = [
    { id: 'carve', label: 'Carve' },
    { id: 'fill', label: 'Fill' },
    { id: 'corridor', label: 'Corridor' },
    { id: 'wall', label: 'Wall' },
    { id: 'door', label: 'Door' },
    { id: 'symbol', label: 'Symbol' },
    { id: 'label', label: 'Label/Key' },
    { id: 'select', label: 'Select' },
    { id: 'ruler', label: 'Ruler' },
    { id: 'ping', label: 'Ping' },
    { id: 'fogEraser', label: 'FoW Eraser' },
    { id: 'annotate', label: 'Annotate' },
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
        onclick={() => (activeTool = tool.id)}
      >
        {tool.label}
      </button>
    {/each}
  </div>

  <div class="tool-group">
    <button data-testid="map-undo" onclick={onUndo} disabled={!canUndo}>Undo</button>
    <button data-testid="map-redo" onclick={onRedo} disabled={!canRedo}>Redo</button>
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

  {#if activeTool === 'wall'}
    <label class="inline">
      Wall style
      <select data-testid="wall-style" bind:value={wallStyle}>
        <option value="masonry">Masonry</option>
        <option value="natural">Natural</option>
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
    background: #241f18;
    border: 1px solid #3a3226;
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
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    cursor: pointer;
  }
  button.active {
    background: #a6763f;
    color: #14110d;
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
    background: #14110d;
    color: inherit;
    border: 1px solid #4a4030;
    border-radius: 4px;
    padding: 0.2rem;
  }
</style>
