<script lang="ts">
  import Dialog from './Dialog.svelte';

  /** Keyboard map (Master Plan v2, R1.7). Entries marked "(soon)" are
   * documented here but wired in later WIs — Space-drag pan in WI-5a. Chat
   * focus (`L`) and `/` commands landed in WI-7. */
  let { onClose }: { onClose: () => void } = $props();

  const SHORTCUTS: { keys: string; desc: string; soon?: boolean }[] = [
    { keys: '1 – 7', desc: 'Switch activity' },
    { keys: 'Esc', desc: 'Close flyout / dialog' },
    { keys: 'Ctrl+Z', desc: 'Undo (map)' },
    { keys: 'Ctrl+Shift+Z', desc: 'Redo (map)' },
    { keys: '?', desc: 'This shortcut sheet' },
    { keys: 'Space+drag', desc: 'Pan the map', soon: true },
    { keys: 'L', desc: 'Focus chat input' },
    { keys: '/', desc: 'Chat command (e.g. /r 2d6)' },
  ];
</script>

<Dialog title="Keyboard shortcuts" {onClose} testid="shortcut-sheet">
  <dl class="shortcuts">
    {#each SHORTCUTS as s (s.keys)}
      <div class="row" class:soon={s.soon}>
        <dt><kbd>{s.keys}</kbd></dt>
        <dd>{s.desc}{#if s.soon}<span class="tag">soon</span>{/if}</dd>
      </div>
    {/each}
  </dl>
</Dialog>

<style>
  .shortcuts {
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .row {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: center;
    gap: 0.75rem;
  }
  .row.soon {
    opacity: 0.6;
  }
  dt {
    margin: 0;
  }
  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  kbd {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--bg-inset);
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
  }
  .tag {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 0.3rem;
    color: var(--text-dim);
  }
</style>
