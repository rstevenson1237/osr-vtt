<script lang="ts">
  import { DialogStrings as S } from '../../strings/Dialog';
  import { getContext, onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import { MODAL_STACK_KEY } from '../../context';
  import type { ModalStack } from '../../shell/modal-stack.svelte';

  /** Shell-owned modal primitive (Master Plan v2, R1.6). Focus-trapped,
   * Esc-dismiss, backdrop-dismiss, styled by design tokens. Sits above the dice
   * overlay in the z-order (R1.5). One entry on the shell's modal stack
   * (SPEC-056 §7) — Escape and the Tab trap are no-ops here unless this
   * instance is the topmost entry, so a confirm raised over another dialog (or
   * over a Log/Session overlay) is the only one that reacts to a single Esc
   * press. */
  let {
    title,
    onClose,
    testid,
    children,
    footer,
  }: {
    title: string;
    onClose: () => void;
    testid?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let panelEl = $state<HTMLDivElement | null>(null);
  let previouslyFocused: HTMLElement | null = null;
  const modalStack = getContext<ModalStack>(MODAL_STACK_KEY);
  let stackId = -1;

  function focusables(): HTMLElement[] {
    if (!panelEl) return [];
    return Array.from(
      panelEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  onMount(() => {
    stackId = modalStack.open();
    previouslyFocused = document.activeElement as HTMLElement | null;
    const first = focusables()[0];
    (first ?? panelEl)?.focus();
    return () => {
      modalStack.close(stackId);
      previouslyFocused?.focus?.();
    };
  });

  function onKeyDown(e: KeyboardEvent): void {
    if (!modalStack.isTop(stackId)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<div
  class="backdrop"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    data-testid={testid}
    bind:this={panelEl}
  >
    <header>
      <h2>{title}</h2>
      <button class="close" aria-label={S.close} data-testid="dialog-close" onclick={onClose}
        ><Icon name="close" size="sm" /></button
      >
    </header>
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <footer>{@render footer()}</footer>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    overflow: auto;
    outline: none;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--line);
  }
  header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .close {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }
  @media (hover: hover) {
    .close:hover {
      color: var(--text);
    }
  }
  .body {
    padding: 1rem;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--line);
  }
</style>
