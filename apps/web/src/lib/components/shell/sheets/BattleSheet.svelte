<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, GameMap } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../../context';
  import type { MapToolController } from '../../../shell/map-tool-controller.svelte';

  /**
   * Battle map quick sheet (SPEC-029 §5) — Capture area, Start and Exit.
   * Referee-only (`QuickSheetDef.availability: 'gm'`) and self-disabling when
   * the Map main view is off stage, the way `MapToolsSheet` already is: the
   * Capture gesture only plays out on the map canvas, and `pendingBattleCapture`
   * is cleared the moment `VectorMapView` unmounts, so there is nothing for
   * this sheet to act on once the referee has switched away.
   *
   * "Capture area" (SPEC-029 §1, DEC-066) arms the Capture tool by setting
   * `controller.activeTool = 'capture'` — the drag/click-click gesture and its
   * commit to `pendingBattleCapture` are unchanged, only the entry point moved
   * here from the map-tools palette; `capture` no longer belongs to any
   * `TOOL_GROUPS` group. "Start" (SPEC-029 §2) reuses `exportPng` for a local,
   * throwaway preview thumbnail of the candidate capture rect before
   * committing to it; "Exit" needs no preview since the temporary map already
   * fills the stage.
   */
  let {
    roomId,
    map,
    mainView,
    controller,
    isGM,
  }: {
    roomId: string;
    map: GameMap | null;
    mainView: string;
    controller: MapToolController;
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let previewUrl = $state<string | null>(null);
  let previewError = $state<string | null>(null);

  // Re-renders the preview whenever the pending capture rect changes; the
  // effect's own cleanup revokes the object URL it created, so a rect drawn
  // twice in a row (or leaving the sheet open while redrawing) never leaks one.
  $effect(() => {
    const rect = controller.pendingBattleCapture;
    if (!rect || controller.isBattleMap || mainView !== 'map') {
      previewUrl = null;
      previewError = null;
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    previewError = null;
    controller.onExportBattlePreview(rect).then(
      (blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        previewUrl = url;
      },
      (err: unknown) => {
        if (cancelled) return;
        previewError = err instanceof Error ? err.message : 'Preview failed';
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  let starting = $state(false);
  let startError = $state<string | null>(null);

  async function start(): Promise<void> {
    const rect = controller.pendingBattleCapture;
    if (!rect || !map || starting || !isGM) return;
    starting = true;
    startError = null;
    try {
      const battleMapId = await store.createBattleMap(roomId, map.id, rect);
      await store.setActiveMap(roomId, battleMapId);
      controller.pendingBattleCapture = null;
    } catch (err) {
      startError = err instanceof Error ? err.message : 'Failed to start battle map';
    } finally {
      starting = false;
    }
  }

  let exiting = $state(false);
  let exitError = $state<string | null>(null);

  async function exit(): Promise<void> {
    if (!map || exiting || !isGM) return;
    exiting = true;
    exitError = null;
    try {
      await store.exitBattleMap(roomId, map.id);
    } catch (err) {
      exitError = err instanceof Error ? err.message : 'Failed to exit battle map';
    } finally {
      exiting = false;
    }
  }
</script>

{#if mainView !== 'map'}
  <p class="hint" data-testid="battle-sheet-off-stage">Switch to the Map view to manage battle maps.</p>
{:else if !map}
  <p class="hint" data-testid="battle-sheet-waiting">Loading map…</p>
{:else if controller.isBattleMap}
  <div class="battle-sheet">
    <p class="hint">
      You're viewing a temporary battle map. Exiting returns everyone to the main map and
      deletes this one.
    </p>
    <button type="button" data-testid="battle-exit" onclick={exit} disabled={exiting}>
      {exiting ? 'Exiting…' : 'Exit battle map'}
    </button>
    {#if exitError}
      <p class="error" data-testid="battle-exit-error">{exitError}</p>
    {/if}
  </div>
{:else}
  <div class="battle-sheet">
    <button
      type="button"
      data-testid="vector-tool-capture"
      onclick={() => (controller.activeTool = 'capture')}
    >
      Capture area
    </button>
    {#if controller.pendingBattleCapture}
      {#if previewUrl}
        <img class="preview" data-testid="battle-preview" src={previewUrl} alt="Battle map preview" />
      {:else if previewError}
        <p class="error" data-testid="battle-preview-error">{previewError}</p>
      {:else}
        <p class="hint" data-testid="battle-preview-loading">Rendering preview…</p>
      {/if}
      <button type="button" data-testid="battle-start" onclick={start} disabled={starting}>
        {starting ? 'Starting…' : 'Start battle map'}
      </button>
      {#if startError}
        <p class="error" data-testid="battle-start-error">{startError}</p>
      {/if}
    {:else}
      <p class="hint" data-testid="battle-sheet-no-capture">
        Draw a capture rect with the Capture area tool to begin a battle map.
      </p>
    {/if}
  </div>
{/if}

<style>
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .battle-sheet {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .preview {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--line);
  }
  .error {
    margin: 0;
    font-size: 0.78rem;
    color: var(--failure);
  }
</style>
