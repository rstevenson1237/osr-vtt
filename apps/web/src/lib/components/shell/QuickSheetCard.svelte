<script lang="ts">
  import type { Snippet } from 'svelte';
  import { GROUP_COLOR_VAR, type QuickSheetDef } from '../../shell/types';
  import type { MobileSnap } from '../../shell/shell-state.svelte';

  /** Shared chrome for every quick sheet (Shell UI Redesign).
   *
   * Three presentations off one markup tree, so a sheet's body never has to
   * know where it is being shown:
   *
   * - `docked` — a ~300px card in the desktop stage's left margin, capped at
   *   320px tall and scrolling internally.
   * - `mobile` — a bottom sheet above the chips/tab bars, draggable between a
   *   half-height peek and full height.
   * - `expanded` — the focused view: a centered modal on desktop, full-screen
   *   on mobile, over a blurred backdrop the shell renders behind it.
   *
   * The 3px left border carries the sheet's group colour in every mode. */
  let {
    def,
    mode,
    snap = 'half',
    onExpand,
    onCollapse,
    onClose,
    onCycleSnap,
    children,
  }: {
    def: QuickSheetDef;
    mode: 'docked' | 'mobile' | 'expanded';
    snap?: MobileSnap;
    onExpand: () => void;
    onCollapse: () => void;
    onClose: () => void;
    onCycleSnap?: () => void;
    children: Snippet;
  } = $props();

  const expanded = $derived(mode === 'expanded');

  // ---- mobile drag between the half and full snap points ----
  const HALF = 220;
  const FULL = 520;

  let dragging = $state(false);
  let dragHeight = $state(HALF);
  let startY = 0;
  let startH = HALF;
  let moved = false;

  const height = $derived(dragging ? dragHeight : snap === 'full' ? FULL : HALF);

  function onHandleDown(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = true;
    moved = false;
    startY = e.clientY;
    startH = snap === 'full' ? FULL : HALF;
    dragHeight = startH;
  }

  function onHandleMove(e: PointerEvent): void {
    if (!dragging) return;
    const dy = startY - e.clientY; // drag up ⇒ taller
    if (Math.abs(dy) > 4) moved = true;
    dragHeight = Math.min(FULL, Math.max(HALF, startH + dy));
  }

  function onHandleUp(e: PointerEvent): void {
    if (!dragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragging = false;
    // A tap toggles; a drag snaps to whichever point it ended nearer.
    const wantFull = moved ? dragHeight - HALF > FULL - dragHeight : snap !== 'full';
    if (wantFull !== (snap === 'full')) onCycleSnap?.();
  }
</script>

<section
  class={`sheet ${mode}`}
  class:full={mode === 'mobile' && snap === 'full'}
  style={`--group:${GROUP_COLOR_VAR[def.group]};${mode === 'mobile' ? `height:${height}px` : ''}`}
  data-testid={`quick-sheet-${def.id}`}
  data-mode={mode}
  aria-label={def.title}
>
  {#if mode === 'mobile'}
    <button
      class="grip-hit"
      data-testid={`quick-sheet-grip-${def.id}`}
      aria-label={snap === 'full' ? `Collapse ${def.title}` : `Expand ${def.title}`}
      onpointerdown={onHandleDown}
      onpointermove={onHandleMove}
      onpointerup={onHandleUp}
    >
      <span class="grip"></span>
    </button>
  {/if}

  <header>
    <span class="gdot"></span>
    <h2>{def.title}</h2>
    <div class="actions">
      <button
        class="chrome"
        data-testid={`quick-sheet-${expanded ? 'collapse' : 'expand'}-${def.id}`}
        title={expanded ? 'Collapse' : 'Expand'}
        aria-label={expanded ? `Collapse ${def.title}` : `Expand ${def.title}`}
        onclick={expanded ? onCollapse : onExpand}
      >
        {expanded ? '⤦' : '⤢'}
      </button>
      <button
        class="chrome"
        data-testid={`quick-sheet-close-${def.id}`}
        title="Close"
        aria-label={`Close ${def.title}`}
        onclick={onClose}
      >
        ✕
      </button>
    </div>
  </header>

  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .sheet {
    background: var(--bg-panel-alt);
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--group);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    pointer-events: auto;
  }

  .sheet.docked {
    border-radius: 9px;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
    max-height: 320px;
    flex: 0 1 auto;
    min-height: 0;
  }

  .sheet.mobile {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--mobile-sheet-bottom, 90px);
    border-left-width: 3px;
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
    z-index: 60;
    max-height: calc(100dvh - var(--mobile-sheet-bottom, 90px) - 48px);
  }

  .sheet.expanded {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(620px, 92vw);
    max-height: 82vh;
    border-left-width: 4px;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }
  @media (max-width: 899px) {
    .sheet.expanded {
      inset: 0;
      left: 0;
      top: 0;
      transform: none;
      width: 100%;
      max-height: none;
      border-radius: 0;
    }
  }

  .grip-hit {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    padding: 7px 0 3px;
    background: transparent;
    border: none;
    cursor: grab;
    touch-action: none;
  }
  .grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
  }

  header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 11px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-panel);
  }
  .gdot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--group);
    flex: 0 0 auto;
  }
  h2 {
    margin: 0;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--text-dim);
  }
  .actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }
  .chrome {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
  }
  .chrome:hover {
    color: var(--text);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 11px;
  }
</style>
