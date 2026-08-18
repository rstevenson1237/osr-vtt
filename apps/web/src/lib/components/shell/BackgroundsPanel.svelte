<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import {
    STARTER_MAP_REF,
    type AssetRef,
    type AssetStore,
    type CampaignStore,
    type GameMap,
    type MapBackground,
  } from '@osr-vtt/shared';
  import {
    ASSET_STORE_KEY,
    CAMPAIGN_STORE_KEY,
    MAP_TOOL_KEY,
    SHELL_STATE_KEY,
  } from '../../context';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';
  import type { ShellState } from '../../shell/shell-state.svelte';
  import { fitBackgroundToGrid } from '../../map/background-transform';
  import { loadImageElement } from '../../tokens/texture-load';

  /**
   * Backgrounds manager (SPEC-038 §5) — the successor to Session config's
   * `session-background-*` block, which this replaces outright. A map carries
   * any number of placed background **images** (`maps/{mapId}/backgrounds`,
   * SPEC-038 §1) plus one independent solid **colour** (`GameMap.background`)
   * that shows through wherever no image covers it; both are managed here,
   * beside `MapsPanel`'s per-map management, because which images a map shows
   * is a question about its assets.
   *
   * Placement itself is deliberately *not* a set of numeric fields: an image
   * is selected here and then moved/resized on the map canvas against the
   * translucent-yellow alignment grid (SPEC-038 §§3–4), which is the only way
   * to see the art line up with the grid while adjusting it. This panel owns
   * selection, addition, the **lock**, the colour, the readout and removal; the
   * canvas owns the gesture.
   *
   * The lock (SPEC-039 §1, `background-lock-{id}`) is a stored property of the
   * image, not a per-viewer mode: a locked background is not an object any map
   * gesture can grab, so map tools work over it everywhere. A new image starts
   * unlocked; every image that predates v27 was migrated locked (DEC-069).
   *
   * GM-only (DEC-063), like every background control before it — and like the
   * Assets activity it sits in.
   */
  let {
    roomId,
    map,
    isGM,
  }: {
    roomId: string;
    map: GameMap | null;
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  /** The map⇄panel bridge (`selectedBackgroundId`), and the shell state that
   * puts the map back on stage once an image is selected for adjusting — the
   * Assets activity is a full main view, so the canvas the referee is about to
   * drag on is not on screen while they are choosing here. */
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);
  const shell = getContext<ShellState>(SHELL_STATE_KEY);

  let backgrounds = $state<MapBackground[]>([]);
  $effect(() => {
    const mapId = map?.id;
    if (!mapId) {
      backgrounds = [];
      return;
    }
    return store.subscribeBackgrounds(roomId, mapId, (b) => (backgrounds = b));
  });

  /** Paint order, lowest first — the same sort the renderer uses, so the list
   * reads bottom-of-the-stack first exactly as the map paints it. */
  const ordered = $derived(
    [...backgrounds].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
  );

  let savedRefs = $state<AssetRef[]>([]);
  onMount(() => store.subscribeAssetRefs(roomId, (items) => (savedRefs = items)));

  const bundled: { ref: string; label: string }[] = [
    { ref: STARTER_MAP_REF, label: 'Starter map' },
  ];

  /** A named preset alongside free hex entry — carried over from the retired
   * Session config block, where #5582CA was the requested default swatch. */
  const COLOR_PRESETS: { color: string; label: string }[] = [
    { color: '#5582CA', label: 'Slate blue' },
  ];
  let customColorDraft = $state('#5582ca');
  let pickerOpen = $state(false);
  let adding = $state(false);

  function labelForRef(ref: string): string {
    const saved = savedRefs.find((s) => s.ref === ref);
    if (saved?.label) return saved.label;
    return ref;
  }

  /**
   * Places a new image, fitted to the grid at its **native** aspect ratio
   * (SPEC-038 §3 — nothing this UI produces is stretched) and stacked on top
   * of whatever is already placed, so add order is paint order until the
   * referee says otherwise.
   *
   * A ref whose natural size can't be read (a host that refuses the
   * cross-origin load) falls back to the grid's own ratio, which is the whole
   * -grid placement the retired Session control always produced.
   */
  async function addBackground(ref: string): Promise<void> {
    if (!map || adding) return;
    adding = true;
    try {
      const grid = { w: map.grid.w, h: map.grid.h };
      let aspect = grid.w / grid.h;
      try {
        const img = await loadImageElement(assets.resolve(ref));
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          aspect = img.naturalWidth / img.naturalHeight;
        }
      } catch {
        // Keep the grid-shaped fallback; the referee can resize it on the map.
      }
      const rect = fitBackgroundToGrid(grid, aspect);
      const order = backgrounds.reduce((max, b) => Math.max(max, b.order + 1), 0);
      // Unlocked (SPEC-039 §1): a referee who has just placed an image wants to
      // position it. Stated rather than left absent — absence is the pre-v27
      // marker `lockLegacyBackground` reads.
      const id = await store.addBackground(roomId, map.id, { ref, ...rect, order, locked: false });
      pickerOpen = false;
      // Straight into the adjust flow: an image that has just been placed is
      // the one the referee wants to line up with the grid.
      selectForAdjust(id);
    } finally {
      adding = false;
    }
  }

  /** Selects an image and puts the map back on stage, where the alignment
   * grid and the move/resize handle live (SPEC-038 §§3–4). Clicking the same
   * row again clears the selection instead, which is also what Escape on the
   * canvas does. */
  function selectForAdjust(id: string): void {
    if (mapCtrl.selectedBackgroundId === id) {
      mapCtrl.selectedBackgroundId = null;
      return;
    }
    mapCtrl.selectedBackgroundId = id;
    shell.mainView = 'map';
  }

  /** Pins an image in place, or releases it (SPEC-039 §1). A locked background
   * is not an object the Select tool can pick up, anywhere on the map — which
   * is what keeps a full-grid floor plan from owning every click on it. There
   * is no modifier key that overrides the lock; this toggle is the override,
   * and it is stored, so both referees see the same state. */
  async function toggleLocked(bg: MapBackground): Promise<void> {
    if (!map) return;
    await store.setBackgroundLocked(roomId, map.id, bg.id, !(bg.locked ?? false));
  }

  /** Back to the whole-grid placement — the recovery path when an image has
   * been dragged somewhere unhelpful, and the placement the pre-v23 fold
   * gives an upgraded room. */
  async function fitToGrid(bg: MapBackground): Promise<void> {
    if (!map) return;
    await store.setBackgroundTransform(roomId, map.id, bg.id, {
      x: 0,
      y: 0,
      w: map.grid.w,
      h: map.grid.h,
    });
  }

  async function remove(bg: MapBackground): Promise<void> {
    if (!map) return;
    if (mapCtrl.selectedBackgroundId === bg.id) mapCtrl.selectedBackgroundId = null;
    await store.removeBackground(roomId, map.id, bg.id);
  }

  /** The solid colour is not an image (SPEC-038 §1): it is the renderer's
   * clear colour and coexists with every placed image, showing through
   * wherever none covers it. Setting it therefore removes nothing. */
  async function chooseColor(color: string): Promise<void> {
    if (!map) return;
    await store.setMapBackgroundColor(roomId, map.id, color);
  }

  async function clearColor(): Promise<void> {
    if (!map) return;
    await store.removeMapBackground(roomId, map.id);
  }

  /** Two decimals: lattice units are floats (RULE-006) and a hand-dragged rect
   * is never round, but a full-precision float is unreadable in a list row. */
  function rectText(bg: MapBackground): string {
    const n = (v: number): string => (Math.round(v * 100) / 100).toString();
    return `${n(bg.x)}, ${n(bg.y)} · ${n(bg.w)} × ${n(bg.h)}`;
  }
</script>

{#if isGM}
  <div class="backgrounds-panel" data-testid="backgrounds-panel">
    <div class="panel-head">
      <button
        type="button"
        data-testid="background-add"
        disabled={!map || adding}
        onclick={() => (pickerOpen = !pickerOpen)}
      >
        + Add image
      </button>
    </div>

    {#if pickerOpen}
      <div class="picker" data-testid="background-picker">
        <p class="picker-heading">Bundled</p>
        <div class="tile-grid">
          {#each bundled as item (item.ref)}
            <button
              type="button"
              class="tile"
              data-testid={`background-pick-${item.label}`}
              onclick={() => void addBackground(item.ref)}
            >
              <img src={assets.resolve(item.ref)} alt="" />
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
        <p class="picker-heading">Saved URL</p>
        {#if savedRefs.length === 0}
          <p class="hint">No saved image URLs — add one under "By URL" above.</p>
        {:else}
          <div class="tile-grid">
            {#each savedRefs as saved (saved.id)}
              <button
                type="button"
                class="tile"
                data-testid={`background-pick-saved-${saved.id}`}
                onclick={() => void addBackground(saved.ref)}
              >
                <img src={assets.resolve(saved.ref)} alt="" />
                <span>{saved.label || saved.ref}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if ordered.length === 0}
      <p class="hint" data-testid="backgrounds-empty">
        No background images placed. The map shows its background colour, or bare rock.
      </p>
    {:else}
      <ul class="bg-list">
        {#each ordered as bg (bg.id)}
          <li
            class="bg-row"
            class:selected={mapCtrl.selectedBackgroundId === bg.id}
            data-testid={`background-row-${bg.id}`}
          >
            <img src={assets.resolve(bg.ref)} alt="" />
            <div class="bg-meta">
              <span class="bg-label" data-testid={`background-label-${bg.id}`}
                >{labelForRef(bg.ref)}</span
              >
              <span class="bg-rect" data-testid={`background-rect-${bg.id}`}>{rectText(bg)}</span>
            </div>
            <button
              type="button"
              class="adjust"
              data-testid={`background-adjust-${bg.id}`}
              aria-pressed={mapCtrl.selectedBackgroundId === bg.id}
              title="Move and resize this image on the map"
              onclick={() => selectForAdjust(bg.id)}
            >
              {mapCtrl.selectedBackgroundId === bg.id ? 'Adjusting' : 'Adjust on map'}
            </button>
            <button
              type="button"
              class="icon lock"
              data-testid={`background-lock-${bg.id}`}
              aria-pressed={bg.locked ?? false}
              title={bg.locked
                ? 'Unlock: let the Select tool pick this image up on the map'
                : 'Lock: pin this image so map tools work over it'}
              onclick={() => void toggleLocked(bg)}
            >
              {bg.locked ? '🔒 Locked' : '🔓 Unlocked'}
            </button>
            <button
              type="button"
              class="icon"
              data-testid={`background-fit-${bg.id}`}
              title="Fit to the whole grid"
              onclick={() => void fitToGrid(bg)}
            >
              Fit
            </button>
            <button
              type="button"
              class="icon danger"
              data-testid={`background-remove-${bg.id}`}
              title="Remove this image"
              onclick={() => void remove(bg)}
            >
              ✕
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="color-block">
      <div class="color-current">
        {#if map?.background}
          <span class="swatch" style={`background:${map.background.color}`}></span>
        {/if}
        <span data-testid="background-color-current">
          {map?.background ? map.background.color : 'None (bare rock)'}
        </span>
        <button
          type="button"
          class="icon"
          data-testid="background-color-clear"
          disabled={!map?.background}
          onclick={() => void clearColor()}
        >
          Clear colour
        </button>
      </div>
      <div class="color-choices">
        {#each COLOR_PRESETS as preset (preset.color)}
          <button
            type="button"
            class="tile tile-color"
            class:selected={map?.background?.color.toLowerCase() === preset.color.toLowerCase()}
            style={`background:${preset.color}`}
            data-testid={`background-pick-color-${preset.color}`}
            onclick={() => void chooseColor(preset.color)}
          >
            <span>{preset.label}</span>
          </button>
        {/each}
        <label class="custom-color">
          Custom
          <input type="color" data-testid="background-color-input" bind:value={customColorDraft} />
          <button
            type="button"
            class="icon"
            data-testid="background-color-apply"
            onclick={() => void chooseColor(customColorDraft)}
          >
            Use colour
          </button>
        </label>
      </div>
    </div>
  </div>
{/if}

<style>
  .backgrounds-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .panel-head {
    display: flex;
    justify-content: flex-end;
  }
  .panel-head button {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .picker {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.6rem;
    background: var(--bg-panel);
  }
  .picker-heading {
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }
  .tile img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .tile.selected {
    border-color: var(--accent);
  }
  .tile-color {
    min-height: 48px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .bg-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .bg-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-panel);
    font-size: 0.85rem;
  }
  .bg-row.selected {
    border-color: var(--accent);
  }
  .bg-row img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .bg-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .bg-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bg-rect {
    font-size: 0.72rem;
    opacity: 0.7;
  }
  .adjust,
  .icon {
    font-size: 0.78rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .adjust[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent-text, var(--accent));
  }
  .lock {
    white-space: nowrap;
  }
  .lock[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent-text, var(--accent));
  }
  .icon.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
  .icon:disabled {
    opacity: 0.4;
    cursor: default;
    color: inherit;
    border-color: var(--line-strong);
  }
  .color-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.6rem;
    border-top: 1px dashed var(--line);
  }
  .color-current {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .swatch {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
  }
  .color-choices {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .custom-color {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
    margin: 0;
  }
</style>
