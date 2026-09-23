<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import type { RailSide } from '../../shell/shell-state.svelte';

  /**
   * The rail's move-handle drawer (SPEC-054 §3). Used to also collapse the
   * three main views into a single "current activity" icon that slid the
   * full list out on hover or click — now all three views sit in the rail
   * directly (`MainViewTabs`, `variant="rail"`, rendered alongside this in
   * `RoomShell`), so the one thing this still holds is the rail-move
   * control, tucked behind a hover/click reveal so it doesn't compete with
   * the view icons for a permanent slot. The panel is translucent and
   * blurred rather than opaque: it opens over the stage.
   *
   * `extra` is the rail's move-to-other-side control, passed in as a snippet
   * so `RoomShell` keeps owning that button's drag/click handlers — it moved
   * in here rather than being reimplemented.
   */
  let { side, extra }: { side: RailSide; extra: Snippet } = $props();

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
    title="Rail options"
    aria-haspopup="true"
    aria-expanded={open}
    onclick={toggle}
  >
    <Icon name="grip" size="sm" />
    <span class="sr-only">Rail options</span>
  </button>

  {#if open}
    <div class="panel" class:right={side === 'right'} data-testid="activity-drawer">
      {@render extra()}
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
  .current:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
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
