<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Shell-owned docked-flyout primitive (Master Plan v2, R1.6). Used for the
   * Activities-rail mini-cards and the Tools-rail palette (Option A: docked, not
   * floating). Non-modal — the shell closes it on Esc or stage-click; this just
   * provides the framed, token-styled container with a titled header. Position
   * is supplied by the caller via the `style` prop (docked to a rail edge). */
  let {
    title,
    groupColor,
    onClose,
    style = '',
    testid,
    children,
  }: {
    title: string;
    groupColor?: string;
    onClose: () => void;
    style?: string;
    testid?: string;
    children: Snippet;
  } = $props();
</script>

<div class="popover" {style} data-testid={testid} role="group" aria-label={title}>
  <header>
    {#if groupColor}
      <span class="gdot" style={`background:${groupColor}`}></span>
    {/if}
    <h4>{title}</h4>
    <button class="close" aria-label="Close" onclick={onClose}>✕</button>
  </header>
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .popover {
    position: absolute;
    z-index: 40;
    width: 260px;
    background: var(--bg-panel-alt);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
    padding: 0.6rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .gdot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  h4 {
    margin: 0;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }
  .close:hover {
    color: var(--text);
  }
</style>
