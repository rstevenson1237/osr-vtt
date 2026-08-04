<script lang="ts">
  import Icon from './Icon.svelte';
  import type { MainViewDef, MainViewId } from '../../shell/types';

  /** Main-view switcher (Shell UI Redesign). One full-screen stage at a time:
   * Map / Encounter / Assets. Renders as a vertical icon group at the top of
   * the desktop side rail (above the quick-sheet toggles, separated by a
   * divider), as a labelled tab bar pinned to the bottom on mobile, and as a
   * segmented control in the `desktop` variant kept for any inline use. Assets
   * is already filtered out for players upstream. */
  let {
    views,
    active,
    variant = 'rail',
    onSelect,
  }: {
    views: MainViewDef[];
    active: MainViewId;
    variant?: 'rail' | 'desktop' | 'mobile' | 'drawer';
    onSelect: (id: MainViewId) => void;
  } = $props();
</script>

<div
  class="view-tabs"
  class:mobile={variant === 'mobile'}
  class:rail={variant === 'rail'}
  class:drawer={variant === 'drawer'}
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
      <Icon name={def.icon} size={variant === 'desktop' ? 15 : 19} />
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

  /* Rail: a vertical icon group matching `QuickSheetRail`'s buttons, so the
     two groups read as one column split by the divider between them. Both
     sides take their size from `--hit`, which pointer coarseness sets
     (SPEC-033 §7). */
  .view-tabs.rail {
    flex-direction: column;
    align-items: center;
    gap: var(--hit-gap);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
  }
  .view-tabs.rail .vtab {
    width: var(--hit);
    height: var(--hit);
    padding: 0;
    justify-content: center;
    border-radius: 8px;
  }
  .view-tabs.rail .label {
    /* Visually hidden — `title` carries the name, as on the sheet toggles. */
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Drawer: a vertical list with the names *shown* — the slide-out exists so
     the activities can be read, which is the one place the rail's icon-only
     shorthand doesn't serve. The panel supplies its own chrome. */
  .view-tabs.drawer {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
  }
  .view-tabs.drawer .vtab {
    justify-content: flex-start;
    gap: 8px;
    padding: 0.36rem 0.5rem;
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
