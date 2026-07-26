<script lang="ts">
  import type { Encounter, Group, Token } from '@osr-vtt/shared';
  import { refLabel } from '../encounter/labels';

  /** Compact "Round N · X is up" readout, now in the top status bar so the
   * shared initiative/round state stays visible on *every* stage, not just
   * the map (Encounter Screen Spec §9 — switching Main Stage mode never loses
   * encounter state). Read-only; all editing happens on the Board. */
  let {
    encounter,
    groups,
    tokens,
    variant = 'stage',
  }: {
    encounter: Encounter | null;
    groups: Group[];
    tokens: Token[];
    /** `stage` floats it over the map canvas (the original placement, kept for
     * any inline use); `rail` sits inline in the top status bar, which is
     * where the shell puts it now. */
    variant?: 'stage' | 'rail';
  } = $props();

  const currentEntry = $derived(
    encounter && encounter.order.length > 0
      ? (encounter.order[encounter.currentIndex] ?? null)
      : null,
  );
</script>

{#if encounter && currentEntry}
  <div class="turn-strip" class:rail={variant === 'rail'} data-testid="turn-strip">
    <span class="round" data-testid="turn-strip-round">Round {encounter.round}</span>
    <span class="current" data-testid="turn-strip-current"
      >{refLabel(currentEntry, groups, tokens)} is up</span
    >
  </div>
{/if}

<style>
  .turn-strip {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 2;
    display: flex;
    gap: 0.6rem;
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    font-size: 0.8rem;
  }
  /* In the top status bar it is just another inline pill. */
  .turn-strip.rail {
    position: static;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .round {
    font-weight: 600;
  }
</style>
