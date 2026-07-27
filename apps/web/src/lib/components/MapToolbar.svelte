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
    selectedDoorArt = $bindable(),
    selectMode = $bindable(),
    selectedToken,
    rotatableSelection = null,
    canUndo,
    canRedo,
    isGM,
    includeHiddenLayer = $bindable(),
    exportingPng,
    canAddCreature = false,
    expanded = false,
    fogEnabled = false,
    canRevealFromEye = false,
    onUndo,
    onRedo,
    onResizeToken,
    onExportPng,
    onRotateSelection,
    onAddCreature,
    onSetFogEnabled,
    onRevealAll,
    onResetFog,
    onRevealFromEye,
  }: {
    activeTool: MapToolId;
    selectedSymbolKind: string;
    carveMode: 'add' | 'subtract';
    snapMode: vectorMap.VectorSnapMode;
    width: number;
    sides: number;
    tolerance: number;
    selectedDoorArt: string;
    selectMode: 'vertex' | 'edge' | 'object';
    selectedToken: Token | null;
    /** Set while Select -> Object has a rotatable object picked. */
    rotatableSelection?: 'symbol' | 'door' | null;
    canUndo: boolean;
    canRedo: boolean;
    isGM: boolean;
    includeHiddenLayer: boolean;
    exportingPng: boolean;
    canAddCreature?: boolean;
    /** True when the Map tools quick sheet is expanded. The occasional,
     * screen-sized actions (PNG export, add creature) live there only — the
     * docked sheet stays a drawing palette. */
    expanded?: boolean;
    /** `GameMap.fog.enabled` for the active map (SPEC §4). */
    fogEnabled?: boolean;
    /** Eye tool active with an eye placed — offers the LoS-commit action. */
    canRevealFromEye?: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onResizeToken: (size: number) => void;
    onExportPng: () => void;
    onRotateSelection?: () => void;
    onAddCreature?: () => void;
    onSetFogEnabled?: (enabled: boolean) => void;
    /** Reveal the whole carved floor at once — "they have the map." */
    onRevealAll?: () => void;
    /** Drop every revealed region back to fully fogged. */
    onResetFog?: () => void;
    onRevealFromEye?: () => void;
  } = $props();

  // One tool catalog, one testid per tool. `symbol` keeps its original
  // `map-tool-symbol` testid (it only ever lived on the old cellular
  // MapToolbar). `label` used to have *two* separate buttons driving the
  // same `placeLabelAt` behavior — the old MapToolbar's `map-tool-label` and
  // the vf-bar's own inline `vector-tool-label` — collapsed here into one;
  // it keeps `vector-tool-label` since that's what the established e2e
  // coverage (rooms-manager.spec.ts's addLabel helper) actually exercises.
  // Every other draw tool keeps its original `vector-tool-*` testid (from
  // the old `.vf-bar`) — nothing here is a new control, only a new home.
  const TOOLS: { id: MapToolId; label: string; testid: string }[] = [
    { id: 'select', label: 'Select', testid: 'vector-tool-select' },
    { id: 'pan', label: 'Pan', testid: 'vector-tool-pan' },
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
    { id: 'label', label: 'Label', testid: 'vector-tool-label' },
    { id: 'symbol', label: 'Symbol', testid: 'map-tool-symbol' },
  ];

  // Fog of war (SPEC §4) is referee-only — a player who could reveal the map
  // to themselves is the whole thing fog exists to prevent. These live in
  // their own group rather than the tool catalog above so the catalog stays
  // identical for every viewer.
  const FOG_TOOLS: { id: MapToolId; label: string; testid: string }[] = [
    { id: 'reveal', label: 'Reveal', testid: 'map-tool-reveal' },
    { id: 'hide', label: 'Hide', testid: 'map-tool-hide' },
  ];

  // Driven by the dungeon-symbol SVG pack catalog (packages/shared/src/map/
  // vector/symbol-catalog.ts) — see that module for the filename -> kind-id
  // convention. Full replace of the old 16-entry hardcoded glyph catalog.
  const SYMBOL_KINDS = vectorMap.SYMBOL_CATALOG.map((e) => e.kind);

  // The door tool's single selection (SPEC §3.2 consolidation — this used to
  // be a separate type dropdown plus this art dropdown). Placement derives
  // the stored `Door.type` from the chosen art via `vectorMap.doorTypeForArt`,
  // so LoS ("barred" always blocks) still works with one control.
  const DOOR_ART_OPTIONS: { id: string; label: string }[] = vectorMap.DOOR_ART_CATALOG.map((e) => ({
    id: e.kind,
    label: e.kind,
  }));

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

  {#if isGM}
    <div class="tool-group" data-testid="map-fog-tools">
      <label class="inline">
        <input
          type="checkbox"
          data-testid="fog-enabled-toggle"
          checked={fogEnabled}
          onchange={(e) => onSetFogEnabled?.((e.target as HTMLInputElement).checked)}
        />
        Fog
      </label>
      {#if fogEnabled}
        {#each FOG_TOOLS as t (t.id)}
          <button
            type="button"
            data-testid={t.testid}
            class:active={activeTool === t.id}
            onclick={() => (activeTool = t.id)}
          >
            {t.label}
          </button>
        {/each}
        <button type="button" data-testid="fog-reveal-all" onclick={() => onRevealAll?.()}>
          Reveal all
        </button>
        <button type="button" data-testid="fog-reset" onclick={() => onResetFog?.()}>
          Reset fog
        </button>
        {#if canRevealFromEye}
          <!-- The Eye tool's LoS polygon, committed as revealed area — what
               turns that preview from a debug overlay into an authoring aid. -->
          <button
            type="button"
            data-testid="fog-reveal-from-eye"
            onclick={() => onRevealFromEye?.()}
          >
            Reveal what the eye sees
          </button>
        {/if}
      {/if}
    </div>
  {/if}

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
      <button
        type="button"
        data-testid="select-mode-object"
        class:active={selectMode === 'object'}
        onclick={() => (selectMode = 'object')}
      >
        ⬡ Object
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
          <select data-testid="door-art" bind:value={selectedDoorArt}>
            {#each DOOR_ART_OPTIONS as a (a.id)}
              <option value={a.id}>{a.label}</option>
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

  {#if rotatableSelection}
    <div class="tool-group">
      <button
        type="button"
        data-testid="map-rotate-selection"
        onclick={() => onRotateSelection?.()}
      >
        {rotatableSelection === 'door' ? 'Flip 180°' : 'Rotate 90°'}
      </button>
    </div>
  {/if}

  <div class="tool-group">
    <button type="button" data-testid="map-undo" onclick={onUndo} disabled={!canUndo}>Undo</button>
    <button type="button" data-testid="map-redo" onclick={onRedo} disabled={!canRedo}>Redo</button>
  </div>

  {#if expanded}
    {#if canAddCreature}
      <div class="tool-group">
        <button type="button" data-testid="add-creature" onclick={() => onAddCreature?.()}>
          + Add creature
        </button>
      </div>
    {/if}

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
  {/if}
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
