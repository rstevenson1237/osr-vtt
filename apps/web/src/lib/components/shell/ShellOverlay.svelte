<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Centered modal chrome for the Log and Session settings overlays (Shell UI
   * Redesign). Same visual chrome as an expanded quick sheet — blurred, dimmed
   * backdrop with the main view visible-but-unfocused underneath, and a ✕ to
   * close. The backdrop is a real button so a click-to-dismiss stays keyboard
   * reachable; Esc closes it from `RoomShell`'s global key handler.
   *
   * `bodyScroll` decides who owns the scrolling. By default the body scrolls,
   * which is what a long settings form wants. A consumer whose content has its
   * own internal scroller and something that must stay pinned beside it — the
   * Log, whose entry list scrolls while its chat input stays put — passes
   * `false`: the body then becomes a fixed-height flex column and its child is
   * responsible for scrolling. Without that, the child's `height: 100%` has no
   * definite height to resolve against, so it grows to its content and the
   * modal body scrolls the whole thing, chat input included. */
  let {
    title,
    testid,
    onClose,
    bodyScroll = true,
    children,
  }: {
    title: string;
    testid?: string;
    onClose: () => void;
    bodyScroll?: boolean;
    children: Snippet;
  } = $props();
</script>

<button class="backdrop" aria-label={`Close ${title}`} onclick={onClose}></button>
<div class="overlay" data-testid={testid} role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="close" data-testid="overlay-close" aria-label="Close" onclick={onClose}>✕</button
    >
  </header>
  <div class="body" class:own-scroll={!bodyScroll}>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px) saturate(120%);
    -webkit-backdrop-filter: blur(6px) saturate(120%);
    cursor: default;
  }
  .overlay {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, 92vw);
    max-height: 82vh;
    z-index: 100;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-panel-alt);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  @media (max-width: 899px) {
    .overlay {
      inset: 0;
      left: 0;
      top: 0;
      transform: none;
      width: 100%;
      max-height: none;
      border-radius: 0;
    }
  }
  header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-panel);
  }
  h2 {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--text-dim);
  }
  .close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
  }
  @media (hover: hover) {
    .close:hover {
      color: var(--text);
    }
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 14px 16px;
  }
  /* The child scrolls, not this. A flex column with `overflow: hidden` gives the
     child a definite height to fill, which is what lets it bound its own
     scroller. */
  .body.own-scroll {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
