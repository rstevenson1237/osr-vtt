<script lang="ts">
  import { vectorMap, type Token } from '@osr-vtt/shared';
  import type { MapToolId } from '../shell/map-tool-controller.svelte';

  /**
   * The single map tools panel (Master Plan v2 R1 — "map tools migrate off
   * the canvas-top toolbar"). Used to be two toolbars: this one drove only
   * `symbol`/`label` from the right rail, while `VectorMapView`'s own
   * canvas-top `.vf-bar` drove every draw tool and its parameters. They are
   * now unified here — one tool catalog, one set of contextual parameters,
   * bound to the shared `MapToolController` so a click here and a keyboard
   * shortcut on the canvas stay in sync automatically.
   */

  let {
    activeTool = $bindable(),
    selectedSymbolKind = $bindable(),
    carveMode = $bindable(),
    snapMode = $bindable(),
    width = $bindable(),
    sides = $bindable(),
    tolerance = $bindable(),
    doorType = $bindable(),
    selectMode = $bindable(),
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
    carveMode: 'add' | 'subtract';
    snapMode: vectorMap.VectorSnapMode;
    width: number;
    sides: number;
    tolerance: number;
    doorType: vectorMap.DoorType;
    selectMode: 'vertex' | 'edge';
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

  // One tool catalog. `symbol`/`label` keep their original `map-tool-*`
  // testid (pre-existing e2e coverage); every draw tool keeps its original
  // `vector-tool-*` testid (from the old `.vf-bar`) — nothing here is a new
  // control, only a new home for it.
  const TOOLS: { id: MapToolId; label: string; testid: string }[] = [
    { id: 'select', label: 'Select', testid: 'vector-tool-select' },
    { id: 'room', label: 'Room', testid: 'vector-tool-room' },
    { id: 'corridor', label: 'Corridor', testid: 'vector-tool-corridor' },
    { id: 'path', label: 'Path', testid: 'vector-tool-path' },
    { id: 'polygon', label: 'Polygon', testid: 'vector-tool-polygon' },
    { id: 'ngon', label: 'N-gon', testid: 'vector-tool-ngon' },
    { id: 'wall', label: 'Wall', testid: 'vector-tool-wall' },
    { id: 'door', label: 'Door', testid: 'vector-tool-door' },
    { id: 'eye', label: 'Eye', testid: 'vector-tool-eye' },
    { id: 'annotate', label: 'Annotate', testid: 'vector-tool-annotate' },
    { id: 'ping', label: 'Ping', testid: 'vector-tool-ping' },
    { id: 'label', label: 'Label', testid: 'map-tool-label' },
    { id: 'symbol', label: 'Symbol', testid: 'map-tool-symbol' },
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

  const DOOR_TYPES: { id: vectorMap.DoorType; label: string }[] = [
    { id: 'single', label: 'Single' },
    { id: 'double', label: 'Double' },
    { id: 'secret', label: 'Secret' },
    { id: 'trapped', label: 'Trapped' },
    { id: 'oneWay', label: 'One-Way' },
    { id: 'barred', label: 'Barred' },
  ];

  const SNAP_MODES: { id: vectorMap.VectorSnapMode; label: string }[] = [
    { id: 'full', label: 'Cell' },
    { id: 'half', label: 'Half' },
    { id: 'free', label: 'Free' },
  ];

  // Contextual parameters — each shows only for the tool(s) it actually
  // drives, grouped logically rather than always-visible (Master Plan v2 R1).
  const CARVE_TOOLS: MapToolId[] = ['room', 'corridor', 'path', 'polygon', 'ngon'];
  const SNAP_TOOLS: MapToolId[] = ['room', 'corridor', 'path', 'polygon', 'ngon', 'wall', 'door'];
  const showCarve = $derived(CARVE_TOOLS.includes(activeTool));
  const showSnap = $derived(SNAP_TOOLS.includes(activeTool));
  const showWidth = $derived(activeTool === 'corridor' || activeTool === 'path');
  const showSides = $derived(activeTool === 'ngon');
  const showDoorType = $derived(activeTool === 'door');
  const showSimplify = $derived(CARVE_TOOLS.includes(activeTool));
  const showSelectMode = $derived(activeTool === 'select');
</script>

<div class="toolbar" data-testid="map-toolbar">
  <div class="tool-group" data-testid="vector-map-toolbar">
    {#each TOOLS as t (t.id)}
      <button
        type="button"
        data-testid={t.testid}
        class:active={activeTool === t.id}
        onclick={() => (activeTool = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  {#if showSelectMode}
    <div class="tool-group">
      <button
        type="button"
        class:active={selectMode === 'vertex'}
        onclick={() => (selectMode = 'vertex')}
      >
        ◆ Vertex
      </button>
      <button
        type="button"
        class:active={selectMode === 'edge'}
        onclick={() => (selectMode = 'edge')}
      >
        ▬ Edge
      </button>
    </div>
  {/if}

  {#if showCarve || showSnap || showWidth || showSides || showDoorType}
    <div class="tool-group params">
      {#if showCarve}
        <button
          type="button"
          class:active={carveMode === 'subtract'}
          onclick={() => (carveMode = carveMode === 'add' ? 'subtract' : 'add')}
        >
          Carve: {carveMode === 'add' ? 'Floor' : 'Rock'}
        </button>
      {/if}
      {#if showSnap}
        <label class="inline">
          Snap:
          <select bind:value={snapMode}>
            {#each SNAP_MODES as m (m.id)}
              <option value={m.id}>{m.label}</option>
            {/each}
          </select>
        </label>
      {/if}
      {#if showWidth}
        <label class="inline">
          Width:
          <input type="number" min="0.5" max="10" step="0.5" bind:value={width} />
        </label>
      {/if}
      {#if showSides}
        <label class="inline">
          Sides:
          <input type="number" min="1" max="24" step="1" bind:value={sides} />
        </label>
      {/if}
      {#if showDoorType}
        <label class="inline">
          Door:
          <select bind:value={doorType}>
            {#each DOOR_TYPES as d (d.id)}
              <option value={d.id}>{d.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
  {/if}

  {#if showSimplify}
    <div class="tool-group">
      <label class="inline">
        Simplify: {tolerance.toFixed(2)}
        <input type="range" min="0" max="0.6" step="0.01" bind:value={tolerance} />
      </label>
    </div>
  {/if}

  {#if activeTool === 'symbol'}
    <div class="tool-group">
      <label class="inline">
        Symbol
        <select data-testid="symbol-kind" bind:value={selectedSymbolKind}>
          {#each SYMBOL_KINDS as kind (kind)}
            <option value={kind}>{kind}</option>
          {/each}
        </select>
      </label>
    </div>
  {/if}

  {#if selectedToken}
    <div class="tool-group">
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
    </div>
  {/if}

  <div class="tool-group">
    <button type="button" data-testid="map-undo" onclick={onUndo} disabled={!canUndo}>Undo</button>
    <button type="button" data-testid="map-redo" onclick={onRedo} disabled={!canRedo}>Redo</button>
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
    <button
      type="button"
      data-testid="map-export-png"
      onclick={onExportPng}
      disabled={exportingPng}
    >
      {exportingPng ? 'Exporting…' : 'Download PNG'}
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 4px;
    margin-bottom: 0.4rem;
  }
  .tool-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }
  .tool-group.params {
    border-top: 1px solid var(--line);
    padding-top: 0.35rem;
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
  select,
  input[type='number'] {
    background: var(--bg-inset);
    color: inherit;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.2rem;
  }
</style>
