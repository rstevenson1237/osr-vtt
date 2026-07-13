<script lang="ts">
  import MapToolPalette from './MapToolPalette.svelte';
  import GroupsPanel from '../GroupsPanel.svelte';
  import BlindDrawer from '../BlindDrawer.svelte';
  import TableRunner from '../TableRunner.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';
  import type { ActivityId } from '../../shell/types';
  import type { Group, PlayerSeat, Token } from '@osr-vtt/shared';

  /** Right rail (Master Plan v2, R1.1). Context-sensitive to the *current stage
   * activity*. The Map activity publishes the migrated `MapToolbar` (every
   * `map-*` testid preserved), bound to the shared `MapToolController`. The
   * Encounter activity publishes the GM's management chrome (R8.3) — Groups
   * roster + reveal/collapse toggles, Blind Drawer, Tables — so the cast area
   * stays clean for everyone; players see an empty rail there. It is a
   * collapsible docked panel (not a flyout) so it stays pinned while working
   * on the stage. */
  let {
    activeActivity,
    controller,
    collapsed,
    onToggle,
    roomId,
    groups = [],
    tokens = [],
    players = [],
    isGM = false,
    myUid = '',
  }: {
    activeActivity: ActivityId;
    controller: MapToolController;
    collapsed: boolean;
    onToggle: () => void;
    roomId?: string;
    groups?: Group[];
    tokens?: Token[];
    players?: PlayerSeat[];
    isGM?: boolean;
    myUid?: string;
  } = $props();

  const hasMapTools = $derived(activeActivity === 'map' && controller.mounted);
  const hasEncounterTools = $derived(activeActivity === 'encounter' && isGM && roomId !== undefined);
  const hasTools = $derived(hasMapTools || hasEncounterTools);
</script>

<aside class="tools-rail" class:collapsed={collapsed || !hasTools} data-testid="tools-rail">
  {#if hasTools}
    {#if collapsed}
      <button class="spine-toggle" data-testid="tools-expand" title="Show tools" onclick={onToggle}>
        ⟨
      </button>
    {:else}
      <header>
        <span class="label">{hasEncounterTools ? 'Referee' : 'Tools'}</span>
        <button class="collapse" data-testid="tools-collapse" title="Hide tools" onclick={onToggle}>
          ⟩
        </button>
      </header>
      <div class="palette">
        {#if hasMapTools}
          <MapToolPalette {controller} />
        {:else if hasEncounterTools && roomId}
          <div class="encounter-tools">
            <GroupsPanel {roomId} {groups} {tokens} {players} />
            <BlindDrawer {roomId} {isGM} authorUid={myUid} />
            <TableRunner {roomId} {isGM} authorUid={myUid} />
          </div>
        {/if}
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
  .encounter-tools {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
