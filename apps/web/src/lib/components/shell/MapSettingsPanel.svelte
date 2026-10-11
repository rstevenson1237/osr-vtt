<script lang="ts">
  import { MapSettingsPanelStrings as S } from '../../strings/MapSettingsPanel';
  import { getContext } from 'svelte';
  import { isHexMap, type CampaignStore, type GameMap } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';

  /**
   * Map settings (SPEC-064 §1) — the per-map `GameMap` configuration the referee
   * sets once and the table shares: grid dimensions and cell size, half-grid
   * subdivision, measurement, and the fog on/off switch. It moved here out of
   * the Session settings modal (WI-222) so it sits beside the Maps and Background
   * sections it is a property of; every control is the same thin `CampaignStore`
   * call it was there, so what is written is unchanged.
   *
   * Renders nothing without an active map. GM-only by placement: the Assets
   * activity is itself GM-only.
   *
   * The Map tools sheet keeps the fog *authoring* controls (the Fog carve modes,
   * Reveal all / Reset fog) — those are drawing actions, not map configuration.
   */
  let {
    roomId,
    map,
  }: {
    roomId: string;
    map: GameMap | null;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  // ---- Grid & measurement (per map, Master Plan v2, R17.3) ----
  // The old grid-shrink guard (D3, docs/VTT_Master_Plan.md Part V §2) checked the
  // requested w/h against the carved cellular floor's bounding box. The
  // vector floor is an unbounded set of polygon regions with no cell-grid
  // ceiling to shrink against, so that guard no longer applies — the floor's
  // own soft max-extent is enforced at carve-commit time instead (see
  // `MAX_FLOOR_EXTENT` in `apps/web/src/lib/map/vector-tools.ts`).

  // eslint-disable-next-line svelte/valid-compile
  let gridWDraft = $state(map?.grid.w ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let gridHDraft = $state(map?.grid.h ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let cellSizeDraft = $state(map?.grid.cellSize ?? 0);
  $effect(() => {
    gridWDraft = map?.grid.w ?? 0;
    gridHDraft = map?.grid.h ?? 0;
    cellSizeDraft = map?.grid.cellSize ?? 0;
  });
  let gridError = $state('');

  async function applyGrid(): Promise<void> {
    if (!map) return;
    gridError = '';
    if (gridWDraft < 1 || gridHDraft < 1) {
      gridError = S.gridTooSmall;
      return;
    }
    await store.setMapGridDimensions(roomId, map.id, {
      w: gridWDraft,
      h: gridHDraft,
      cellSize: cellSizeDraft,
    });
  }

  /** SPEC-049 §2: the field is the same `perSquare`, but its label follows
   * the map's grid kind, the way the coordinate space, snap set and palette
   * already do. */
  const measureIsHex = $derived(map ? isHexMap(map) : false);
  // eslint-disable-next-line svelte/valid-compile
  let perSquareDraft = $state(map?.measure.perSquare ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let unitDraft = $state(map?.measure.unit ?? '');
  $effect(() => {
    perSquareDraft = map?.measure.perSquare ?? 0;
    unitDraft = map?.measure.unit ?? '';
  });
  async function applyMeasure(): Promise<void> {
    if (!map) return;
    await store.setMapMeasurement(roomId, map.id, { perSquare: perSquareDraft, unit: unitDraft });
  }

  async function setSubdivide(subdivide: boolean): Promise<void> {
    if (!map) return;
    await store.setMapGridSubdivide(roomId, map.id, subdivide);
  }

  async function setFogEnabled(enabled: boolean): Promise<void> {
    if (!map) return;
    await store.setMapFogEnabled(roomId, map.id, enabled);
  }
</script>

{#if map}
  <div class="map-settings-panel" data-testid="map-settings-panel">
    <section>
      <h3>Grid & measurement</h3>
      <div class="row">
        <label class="field narrow">
          Width
          <input type="number" min="1" data-testid="grid-w" bind:value={gridWDraft} />
        </label>
        <label class="field narrow">
          Height
          <input type="number" min="1" data-testid="grid-h" bind:value={gridHDraft} />
        </label>
        <label class="field narrow">
          Cell size (px)
          <input type="number" min="1" data-testid="grid-cellsize" bind:value={cellSizeDraft} />
        </label>
        <button data-testid="grid-apply" onclick={applyGrid}>{S.set}</button>
      </div>
      {#if gridError}
        <p class="error" data-testid="grid-error">{gridError}</p>
      {/if}

      <label class="field checkbox">
        <input
          type="checkbox"
          data-testid="grid-subdivide-toggle"
          checked={map.gridSettings.subdivide}
          onchange={(e) => void setSubdivide((e.target as HTMLInputElement).checked)}
        />
        Half-grid subdivision
      </label>

      <div class="row">
        <label class="field narrow">
          {measureIsHex ? 'Per hex' : 'Per square'}
          <input type="number" min="1" data-testid="measure-per-square" bind:value={perSquareDraft} />
        </label>
        <label class="field narrow">
          Unit
          <input type="text" data-testid="measure-unit" bind:value={unitDraft} />
        </label>
        <button data-testid="measure-apply" onclick={applyMeasure}>{S.set}</button>
      </div>
    </section>

    <!-- Fog of war (docs/VTT_Master_Plan.md Part II §2 (fog)). The on/off switch is a
    per-map setting, not a drawing tool; the Map tools sheet carries only the fog
    *authoring* controls (the Fog carve modes, Reveal all / Reset fog). -->
    <section>
      <h3>Fog of war</h3>
      <label class="field checkbox">
        <input
          type="checkbox"
          data-testid="fog-enabled-toggle"
          checked={map.fog?.enabled ?? false}
          onchange={(e) => void setFogEnabled((e.target as HTMLInputElement).checked)}
        />
        Fog of war on this map
      </label>
      <p class="hint">
        With fog on, players see only what you have revealed — and tokens standing in fog are hidden
        from them. Reveal areas from the Map tools sheet: set a shape tool's Carve to “Fog: reveal”,
        or use Reveal all / Reset fog in its expanded view.
      </p>
    </section>
  </div>
{/if}

<style>
  .map-settings-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  section {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.85rem 1rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
  }
  .field.narrow {
    max-width: 140px;
  }
  .field.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
  }
  input {
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
  }
  button {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
    height: fit-content;
  }
  .hint {
    font-size: 0.78rem;
    opacity: 0.7;
    margin: 0.2rem 0;
  }
  .error {
    color: var(--failure);
    font-size: 0.8rem;
    margin: 0.3rem 0 0;
  }
</style>
