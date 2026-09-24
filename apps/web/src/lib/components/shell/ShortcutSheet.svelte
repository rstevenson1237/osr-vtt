<script lang="ts">
  import Dialog from './Dialog.svelte';
  import { digitRanges } from '../../shell/activities';
  import { TOOL_GROUPS } from '../../map/tool-groups';

  /** Keyboard map (Master Plan v2, R1.7). Entries marked "(soon)" are
   * documented here but wired in later WIs — Space-drag pan in WI-5a. Chat
   * focus (`L`) and `/` commands landed in WI-7. */
  let {
    onClose,
    isGM = false,
    onShowMeAround,
  }: { onClose: () => void; isGM?: boolean; onShowMeAround: () => void } = $props();

  // Derived from what this seat can actually see: a player has two main views,
  // not three, so the ranges shift. Hardcoding "1 – 3" / "4 – 7" advertised a
  // key (`3`) that did nothing for players.
  const ranges = $derived(digitRanges(isGM));

  const SHORTCUTS = $derived<{ keys: string; desc: string; soon?: boolean }[]>([
    { keys: ranges.views, desc: 'Switch main view' },
    { keys: ranges.sheets, desc: 'Toggle quick sheet' },
    { keys: 'Esc', desc: 'Collapse sheet / close dialog' },
    { keys: 'Ctrl+Z', desc: 'Undo (map)' },
    { keys: 'Ctrl+Shift+Z', desc: 'Redo (map)' },
    { keys: '?', desc: 'This shortcut sheet' },
    { keys: 'Space+drag', desc: 'Pan the map', soon: true },
    { keys: 'L', desc: 'Focus chat input' },
    { keys: '/', desc: 'Chat command (e.g. /r 2d6)' },
  ]);

  /** Tool hotkeys (SPEC-054 §7), read straight off `TOOL_GROUPS`'s own `key`
   * field so this sheet can never name a binding the handler doesn't
   * honour. Only while the Map view is the main view. */
  const MAP_TOOL_SHORTCUTS = $derived(
    TOOL_GROUPS.flatMap((g) => g.tools)
      .filter((t) => t.key)
      .map((t) => ({
        keys: t.key as string,
        desc: `${t.id.charAt(0).toUpperCase()}${t.id.slice(1)} tool`,
      })),
  );
</script>

<Dialog title="Keyboard shortcuts" {onClose} testid="shortcut-sheet">
  <dl class="shortcuts">
    {#each SHORTCUTS as s (s.keys)}
      <div class="row" class:soon={s.soon}>
        <dt><kbd>{s.keys}</kbd></dt>
        <dd>
          {s.desc}{#if s.soon}<span class="tag">soon</span>{/if}
        </dd>
      </div>
    {/each}
  </dl>
  <h3 class="section-heading">Map tools (while the Map view is active)</h3>
  <dl class="shortcuts">
    {#each MAP_TOOL_SHORTCUTS as s (s.keys)}
      <div class="row">
        <dt><kbd>{s.keys}</kbd></dt>
        <dd>{s.desc}</dd>
      </div>
    {/each}
  </dl>
  <button
    type="button"
    class="show-me-around"
    data-testid="show-me-around"
    onclick={() => {
      onShowMeAround();
      onClose();
    }}
  >
    Show me around
  </button>
</Dialog>

<style>
  .section-heading {
    margin: 1rem 0 0.4rem;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
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
  .show-me-around {
    margin-top: 1rem;
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
</style>
