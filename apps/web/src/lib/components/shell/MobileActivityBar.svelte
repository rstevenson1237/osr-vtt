<script lang="ts">
  import Icon from './Icon.svelte';
  import { GROUP_COLOR_VAR, type ActivityDef, type ActivityId } from '../../shell/types';

  /** Bottom activity bar for mobile / tablet mode (Master Plan v2, R1.8). One
   * icon per registered activity; tapping switches the whole stage directly —
   * no mini-cards on mobile. The active tab shows a group-coloured underline,
   * and the Log tab carries the same unread badge as the desktop rail. */
  let {
    activities,
    activeActivity,
    logUnread,
    onSelect,
  }: {
    activities: ActivityDef[];
    activeActivity: ActivityId;
    logUnread: number;
    onSelect: (id: ActivityId) => void;
  } = $props();
</script>

<nav class="mbottom" data-testid="mobile-activity-bar" aria-label="Activities">
  {#each activities as def (def.id)}
    <button
      class="mtab"
      class:on={activeActivity === def.id}
      style={`--under:${GROUP_COLOR_VAR[def.group]}`}
      data-testid={`mobile-activity-${def.id}`}
      title={def.title}
      aria-pressed={activeActivity === def.id}
      onclick={() => onSelect(def.id)}
    >
      <Icon name={def.icon} />
      {#if def.id === 'log' && logUnread > 0}
        <span class="badge" data-testid="mobile-log-unread-badge">{logUnread > 9 ? '9+' : logUnread}</span>
      {/if}
      <span class="under"></span>
    </button>
  {/each}
</nav>

<style>
  .mbottom {
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    height: 100%;
    box-sizing: border-box;
  }
  .mtab {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    position: relative;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 0;
  }
  .mtab.on {
    color: var(--text);
  }
  .under {
    position: absolute;
    bottom: 6px;
    width: 22px;
    height: 3px;
    border-radius: 2px;
    background: var(--under);
    opacity: 0;
  }
  .mtab.on .under {
    opacity: 1;
  }
  .badge {
    position: absolute;
    top: 8px;
    right: calc(50% - 18px);
    min-width: 14px;
    height: 14px;
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
