<script lang="ts">
  import Icon from './Icon.svelte';
  import { GROUP_COLOR_VAR, type QuickSheetDef, type QuickSheetId } from '../../shell/types';

  /** Quick-sheet toggles (Shell UI Redesign). Each icon independently opens or
   * closes its sheet — several can be lit at once. Renders as the left icon
   * rail on desktop and as a row of chips directly above the main-view tab bar
   * on mobile, where only one sheet is active at a time. The mobile chip
   * carries its title under the glyph (SPEC-051 §4, DEC-099), matching
   * `MainViewTabs`'s mobile variant. */
  let {
    sheets,
    isOpen,
    variant = 'rail',
    showLabels = false,
    onToggle,
  }: {
    sheets: QuickSheetDef[];
    isOpen: (id: QuickSheetId) => boolean;
    variant?: 'rail' | 'chips';
    /** Rail-only (SPEC-054 §3): render the label beside each icon, rather
     * than hidden, until the viewer's first rail interaction. */
    showLabels?: boolean;
    onToggle: (id: QuickSheetId) => void;
  } = $props();
</script>

<nav
  class="sheet-toggles"
  class:chips={variant === 'chips'}
  class:labeled={variant === 'rail' && showLabels}
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
      <Icon name={def.icon} />
      {#if variant === 'chips' || (variant === 'rail' && showLabels)}
        <span class="label">{def.title}</span>
      {/if}
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
  @media (hover: hover) {
    .stoggle:hover {
      color: var(--text);
    }
  }
  .stoggle:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .stoggle.on {
    border-color: var(--group);
    background: color-mix(in srgb, var(--group) 15%, transparent);
    color: var(--text);
  }

  /* Until the viewer's first rail interaction (SPEC-054 §3), the label
     renders beside the icon instead of relying on `title` alone. */
  .sheet-toggles.labeled {
    align-items: stretch;
  }
  .sheet-toggles.labeled .stoggle {
    width: auto;
    height: var(--hit);
    padding: 0 0.6rem 0 0;
    justify-content: flex-start;
    gap: 6px;
  }
  .sheet-toggles.labeled .stoggle .label {
    font-size: 0.72rem;
    white-space: nowrap;
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
    flex-direction: column;
    gap: 2px;
    width: auto;
    min-width: 0;
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
  /* Stacked icon-over-label, matching `MainViewTabs`'s mobile variant directly
     above it (DEC-099, SPEC-051 §4). Titles are one or two words ("Map
     tools", "Random tables") in a chip too narrow to wrap them onto two
     lines without growing the row, so a long one truncates instead. */
  .sheet-toggles.chips .label {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 0.6rem;
  }
</style>
