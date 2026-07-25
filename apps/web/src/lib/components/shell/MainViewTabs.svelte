<script lang="ts">
  import Icon from './Icon.svelte';
  import type { MainViewDef, MainViewId } from '../../shell/types';

  /** Main-view switcher (Shell UI Redesign). One full-screen stage at a time:
   * Map / Encounter / Assets. Renders as a segmented control in the desktop top
   * bar and as a labelled tab bar pinned to the bottom on mobile. Assets is
   * already filtered out for players upstream. */
  let {
    views,
    active,
    variant = 'desktop',
    onSelect,
  }: {
    views: MainViewDef[];
    active: MainViewId;
    variant?: 'desktop' | 'mobile';
    onSelect: (id: MainViewId) => void;
  } = $props();
</script>

<div
  class="view-tabs"
  class:mobile={variant === 'mobile'}
  data-testid={variant === 'mobile' ? 'mobile-view-tabs' : 'view-tabs'}
  role="tablist"
  aria-label="Main view"
>
  {#each views as def (def.id)}
    <button
      class="vtab"
      class:on={active === def.id}
      role="tab"
      aria-selected={active === def.id}
      data-testid={`activity-tab-${def.id}`}
      title={def.title}
      onclick={() => onSelect(def.id)}
    >
      <Icon name={def.icon} size={variant === 'mobile' ? 19 : 15} />
      <span class="label">{def.title}</span>
    </button>
  {/each}
</div>

<style>
  .view-tabs {
    display: flex;
    gap: 3px;
    padding: 3px;
    background: var(--bg-inset);
    border: 1px solid var(--line);
    border-radius: 8px;
    flex: 0 0 auto;
  }
  .vtab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0.32rem 0.6rem;
    font-size: 0.76rem;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    white-space: nowrap;
  }
  .vtab:hover {
    color: var(--text);
  }
  .vtab.on {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }

  /* Mobile: full-width tab bar, stacked icon over label, no segmented chrome. */
  .view-tabs.mobile {
    gap: 0;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    height: 100%;
    align-items: stretch;
    justify-content: space-around;
    flex: 1;
  }
  .view-tabs.mobile .vtab {
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    padding: 0;
    border-radius: 0;
  }
  .view-tabs.mobile .vtab.on {
    background: transparent;
    color: var(--text);
  }
  .view-tabs.mobile .label {
    font-size: 0.6rem;
  }
</style>
