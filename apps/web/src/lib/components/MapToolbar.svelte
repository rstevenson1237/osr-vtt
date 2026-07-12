<script lang="ts">
  import type { Token } from '@osr-vtt/shared';
  import type { ToolId } from '../map/tools';

  let {
    activeTool = $bindable(),
    wallStyle = $bindable(),
    wallErase = $bindable(),
    selectedSymbolKind = $bindable(),
    selectedToken,
    canUndo,
    canRedo,
    isGM,
    fogMode,
    measure,
    importing,
    onUndo,
    onRedo,
    onResizeToken,
    onSetFogMode,
    onImportSampleUvtt,
    onImportUvttFile,
    onSetMeasurement,
  }: {
    activeTool: ToolId;
    wallStyle: 'masonry' | 'natural';
    wallErase: boolean;
    selectedSymbolKind: string;
    selectedToken: Token | null;
    canUndo: boolean;
    canRedo: boolean;
    isGM: boolean;
    fogMode: 'emergent' | 'manual' | 'dynamic';
    measure: { perSquare: number; unit: string };
    importing: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onResizeToken: (size: number) => void;
    onSetFogMode: (mode: 'emergent' | 'manual' | 'dynamic') => void;
    onImportSampleUvtt: () => void;
    onImportUvttFile: (file: File) => void;
    onSetMeasurement: (measure: { perSquare: number; unit: string }) => void;
  } = $props();

  // Draft fields for the measurement quick control (Master Plan v2, R9.3) —
  // combined into one `onSetMeasurement` call on Apply so a two-field edit
  // (per-square + unit) never races as two separate partial room-doc writes.
  // eslint-disable-next-line svelte/valid-compile
  let perSquareDraft = $state(measure.perSquare);
  // eslint-disable-next-line svelte/valid-compile
  let unitDraft = $state(measure.unit);
  $effect(() => {
    perSquareDraft = measure.perSquare;
    unitDraft = measure.unit;
  });
  function applyMeasure(): void {
    onSetMeasurement({ perSquare: perSquareDraft, unit: unitDraft });
  }

  function onUvttFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onImportUvttFile(file);
    input.value = '';
  }

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

  {#if isGM}
    <div class="tool-group" data-testid="referee-map-tools">
      <label class="inline">
        Fog
        <select
          data-testid="fog-mode-select"
          value={fogMode}
          onchange={(e) =>
            onSetFogMode((e.target as HTMLSelectElement).value as 'emergent' | 'manual' | 'dynamic')}
        >
          <option value="emergent">Emergent</option>
          <option value="manual">Manual</option>
          <option value="dynamic">Dynamic (LoS)</option>
        </select>
      </label>
      <button
        data-testid="import-sample-uvtt"
        onclick={onImportSampleUvtt}
        disabled={importing}
      >
        {importing ? 'Importing…' : 'Load sample .uvtt'}
      </button>
      <label class="inline uvtt-file">
        Import .uvtt
        <input
          type="file"
          data-testid="import-uvtt-file"
          accept=".uvtt,.dd2vtt,.df2vtt,application/json"
          onchange={onUvttFileChange}
        />
      </label>
      <label class="inline">
        Measure
        <input
          type="number"
          data-testid="measure-per-square"
          min="1"
          bind:value={perSquareDraft}
        />
        <input type="text" data-testid="measure-unit" bind:value={unitDraft} />
        <button data-testid="measure-apply" onclick={applyMeasure}>Set</button>
      </label>
    </div>
  {/if}

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
    <label class="inline">
      <input type="checkbox" data-testid="wall-erase-toggle" bind:checked={wallErase} />
      Erase
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
</style>
