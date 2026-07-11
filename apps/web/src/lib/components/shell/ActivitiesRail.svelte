<script lang="ts">
  import Icon from './Icon.svelte';
  import { GROUP_ORDER } from '../../shell/activities';
  import { GROUP_COLOR_VAR, GROUP_TITLE, type ActivityDef, type ActivityId, type GroupId } from '../../shell/types';
  import type { Flyout } from '../../shell/shell-state.svelte';

  /** Left rail (Master Plan v2, R1.1/R1.4). Grouped, colour-boxed, single-colour
   * icons. Clicking an activity with a mini-card toggles its docked flyout;
   * otherwise it switches the stage directly. Referee group is already filtered
   * out for players upstream. */
  let {
    activities,
    activeActivity,
    flyout,
    logUnread,
    onActivate,
  }: {
    activities: ActivityDef[];
    activeActivity: ActivityId;
    flyout: Flyout;
    logUnread: number;
    onActivate: (def: ActivityDef) => void;
  } = $props();

  function groupActivities(group: GroupId): ActivityDef[] {
    return activities.filter((a) => a.group === group);
  }
  const visibleGroups = $derived(GROUP_ORDER.filter((g) => groupActivities(g).length > 0));

  function isOpen(def: ActivityDef): boolean {
    return flyout?.rail === 'activities' && flyout.activity === def.id;
  }
</script>

<nav class="activities-rail" data-testid="activities-rail" aria-label="Activities">
  {#each visibleGroups as group (group)}
    <div class="groupbox" style={`color:${GROUP_COLOR_VAR[group]}`} aria-label={GROUP_TITLE[group]}>
      {#each groupActivities(group) as def (def.id)}
        <button
          class="abtn"
          class:active={activeActivity === def.id}
          class:open={isOpen(def)}
          data-testid={`activity-tab-${def.id}`}
          title={def.title}
          aria-pressed={activeActivity === def.id}
          onclick={() => onActivate(def)}
        >
          <Icon name={def.icon} />
          {#if def.id === 'log' && logUnread > 0}
            <span class="badge" data-testid="log-unread-badge">{logUnread > 9 ? '9+' : logUnread}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</nav>

<style>
  .activities-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0;
    height: 100%;
    box-sizing: border-box;
  }
  .groupbox {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.25rem 0.15rem;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 8px;
    position: relative;
  }
  .groupbox::before {
    content: '';
    position: absolute;
    left: -1px;
    top: -1px;
    bottom: -1px;
    width: 3px;
    border-radius: 8px 0 0 8px;
    background: currentColor;
    opacity: 0.9;
  }
  .abtn {
    width: 32px;
    height: 32px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    padding: 0;
  }
  .abtn:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .abtn.active,
  .abtn.open {
    background: color-mix(in srgb, currentColor 18%, transparent);
    outline: 1px solid color-mix(in srgb, currentColor 55%, transparent);
  }
  .badge {
    position: absolute;
    top: -3px;
    right: -3px;
    min-width: 13px;
    height: 13px;
    border-radius: 7px;
    background: var(--group-play);
    color: var(--bg-root);
    font-size: 0.55rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
  }
</style>
