<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import MainViewTabs from './MainViewTabs.svelte';
  import type { RailSide } from '../../shell/shell-state.svelte';
  import type { MainViewDef, MainViewId } from '../../shell/types';

  /**
   * The rail's activity switcher, collapsed to a single icon.
   *
   * Only one main view is ever on stage, so the rail spent three permanent
   * slots advertising a choice that is made rarely — this shows the *current*
   * activity instead, and slides the full list out on hover or click. The
   * panel is translucent and blurred rather than opaque: it opens over the
   * stage, and a referee flicking between Map and Encounter shouldn't lose
   * sight of what's underneath it.
   *
   * `extra` is the rail's move-to-other-side control, passed in as a snippet
   * so `RoomShell` keeps owning that button's drag/click handlers — it moved
   * in here rather than being reimplemented.
   */
  let {
    views,
    active,
    side,
    onSelect,
    extra,
  }: {
    views: MainViewDef[];
    active: MainViewId;
    side: RailSide;
    onSelect: (id: MainViewId) => void;
    extra?: Snippet;
  } = $props();

  const activeDef = $derived(views.find((v) => v.id === active) ?? views[0]!);

  let open = $state(false);
  /** A click pins the drawer open, so it survives the pointer leaving — the
   * keyboard and touch path, and also what lets you drag the move handle out
   * of the panel without it closing under you. */
  let pinned = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelClose(): void {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function onEnter(): void {
    cancelClose();
    open = true;
  }

  /** Small grace period so a pointer clipping the panel's corner on its way in
   * doesn't slam it shut. */
  function onLeave(): void {
    if (pinned) return;
    cancelClose();
    closeTimer = setTimeout(() => {
      open = false;
      closeTimer = null;
    }, 180);
  }

  function toggle(): void {
    cancelClose();
    if (open && pinned) {
      open = false;
      pinned = false;
    } else {
      open = true;
      pinned = true;
    }
  }

  function close(): void {
    cancelClose();
    open = false;
    pinned = false;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      close();
      e.stopPropagation();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="activity-drawer"
  class:right={side === 'right'}
  data-testid="activity-switcher"
  onpointerenter={onEnter}
  onpointerleave={onLeave}
  onfocusin={onEnter}
>
  <button
    class="current"
    class:open
    data-testid="activity-current"
    title={`${activeDef.title} — click for all activities`}
    aria-haspopup="true"
    aria-expanded={open}
    onclick={toggle}
  >
    <Icon name={activeDef.icon} size={19} />
    <span class="sr-only">{activeDef.title}</span>
  </button>

  {#if open}
    <div class="panel" class:right={side === 'right'} data-testid="activity-drawer">
      <MainViewTabs
        {views}
        {active}
        variant="drawer"
        onSelect={(id: MainViewId) => {
          onSelect(id);
          close();
        }}
      />
      {#if extra}
        <hr class="panel-rule" />
        {@render extra()}
      {/if}
    </div>
  {/if}
</div>

<style>
  .activity-drawer {
    position: relative;
    flex: 0 0 auto;
  }
  .current {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  /* `.open` is a state, not a hover, so it stays unconditional — only the
   * hover half is gated (SPEC-033 §4). */
  .current.open {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  @media (hover: hover) {
    .current:hover {
      background: var(--accent);
      color: var(--accent-ink);
      border-color: var(--accent);
    }
  }

  /* Slides out over the stage, alongside the rail. Translucent + blurred so
     the map or board underneath stays legible while it's open. */
  .panel {
    position: absolute;
    top: -6px;
    left: calc(100% + 8px);
    z-index: 60;
    min-width: 11rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: color-mix(in srgb, var(--bg-panel) 72%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
    animation: drawer-in 0.16s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  .panel.right {
    left: auto;
    right: calc(100% + 8px);
    animation-name: drawer-in-right;
  }
  .panel-rule {
    width: 100%;
    margin: 2px 0;
    border: none;
    border-top: 1px solid var(--line);
  }

  @keyframes drawer-in {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
  }
  @keyframes drawer-in-right {
    from {
      opacity: 0;
      transform: translateX(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
