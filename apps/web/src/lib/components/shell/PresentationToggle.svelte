<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';
  import { createPresentation } from '../../shell/presentation.svelte';

  /** The full-screen control (SPEC-033 §5). One component, mounted by whichever
   * top bar the layout picked — `SessionTab` on desktop, `MobileTopBar` on a
   * narrow screen — so the control is available in both without either bar
   * knowing anything about presentation state.
   *
   * It owns its `createPresentation()` instance rather than taking one as a
   * prop (the pattern `createShellMedia()` follows in `RoomShell`) because it is
   * the only consumer: the two bars are mutually exclusive, so at most one
   * instance exists, and nothing else in the shell reads the state.
   *
   * The control renders **nothing** when it would be a lie: where the
   * Fullscreen API is unavailable (an iPhone browser has no element
   * full-screen — installing the app is the route there), and where the frame
   * already owns the display because the app was launched standalone. */
  let { size = 16 }: { size?: number } = $props();

  const presentation = createPresentation();
  onDestroy(() => presentation.dispose());

  const shown = $derived(presentation.canFullscreen && !presentation.isStandalone);
</script>

{#if shown}
  <button
    class="presentation"
    data-testid="fullscreen-toggle"
    title={presentation.isFullscreen ? 'Leave full screen' : 'Full screen'}
    aria-label={presentation.isFullscreen ? 'Leave full screen' : 'Full screen'}
    aria-pressed={presentation.isFullscreen}
    onclick={() => void presentation.toggleFullscreen()}
  >
    <Icon name={presentation.isFullscreen ? 'fullscreen-exit' : 'fullscreen'} {size} />
  </button>
{/if}

<style>
  /* Sized like the gear beside it, with SPEC-033 §7's `--hit-inline` applied as
     a floor: 18px on a precise pointer (below the 26px natural size, so it does
     not bind and the desktop bar is pixel-identical), 34px on a coarse one. */
  .presentation {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    min-width: var(--hit-inline);
    min-height: var(--hit-inline);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text);
    cursor: pointer;
    padding: 0;
  }
  @media (hover: hover) {
    .presentation:hover {
      border-color: var(--accent);
    }
  }
  .presentation:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .presentation[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent-text);
  }
</style>
