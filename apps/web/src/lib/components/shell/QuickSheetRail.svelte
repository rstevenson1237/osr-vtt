<script lang="ts">
  import Icon from './Icon.svelte';
  import { GROUP_COLOR_VAR, type QuickSheetDef, type QuickSheetId } from '../../shell/types';

  /** Quick-sheet toggles (Shell UI Redesign). Each icon independently opens or
   * closes its sheet — several can be lit at once. Renders as the left icon
   * rail on desktop and as a row of chips directly above the main-view tab bar
   * on mobile, where only one sheet is active at a time. */
  let {
    sheets,
    isOpen,
    variant = 'rail',
    onToggle,
  }: {
    sheets: QuickSheetDef[];
    isOpen: (id: QuickSheetId) => boolean;
    variant?: 'rail' | 'chips';
    onToggle: (id: QuickSheetId) => void;
  } = $props();
</script>

<nav
  class="sheet-toggles"
  class:chips={variant === 'chips'}
  data-testid={variant === 'chips' ? 'quick-sheet-chips' : 'quick-sheet-rail'}
  aria-label="Quick sheets"
>
  {#each sheets as def (def.id)}
    <button
      class="stoggle"
      class:on={isOpen(def.id)}
      style={`--group:${GROUP_COLOR_VAR[def.group]}`}
      data-testid={`quick-sheet-toggle-${def.id}`}
      title={def.title}
      aria-pressed={isOpen(def.id)}
      onclick={() => onToggle(def.id)}
    >
      <Icon name={def.icon} size={variant === 'chips' ? 16 : 19} />
    </button>
  {/each}
</nav>

<style>
  /* The desktop rail container (`RoomShell`'s `.rail-left`) owns the column's
     outer padding now that it also holds the main-view tabs and the divider —
     this just stacks its own buttons. */
  .sheet-toggles {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--hit-gap);
    box-sizing: border-box;
  }
  /* Square hit target sized by pointer coarseness, not by screen width
     (SPEC-033 §7) — 34px on a mouse, 44px on touch, in either shell. */
  .stoggle {
    width: var(--hit);
    height: var(--hit);
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .stoggle:hover {
    color: var(--text);
  }
  .stoggle.on {
    border-color: var(--group);
    background: color-mix(in srgb, var(--group) 15%, transparent);
    color: var(--text);
  }

  /* Mobile: a flat row of chips with a group-coloured active underline. */
  .sheet-toggles.chips {
    flex-direction: row;
    align-items: stretch;
    gap: 0;
    padding: 0;
  }
  .sheet-toggles.chips .stoggle {
    flex: 1;
    width: auto;
    height: 100%;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
  }
  .sheet-toggles.chips .stoggle.on {
    border-bottom-color: var(--group);
    background: transparent;
    color: var(--text);
  }
</style>
