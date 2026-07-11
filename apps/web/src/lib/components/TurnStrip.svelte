<script lang="ts">
  import type { Encounter, Group, Token } from '@osr-vtt/shared';
  import { refLabel } from '../encounter/labels';

  /** Compact "Round N · X is up" readout shown on Map View so the shared
   * initiative/round state stays visible when the fight is on the grid
   * (Encounter Screen Spec §9 — switching Main Stage mode never loses
   * encounter state). Read-only; all editing happens on the Board. */
  let {
    encounter,
    groups,
    tokens,
  }: { encounter: Encounter | null; groups: Group[]; tokens: Token[] } = $props();

  const currentEntry = $derived(
    encounter && encounter.order.length > 0 ? (encounter.order[encounter.currentIndex] ?? null) : null,
  );
</script>

{#if encounter && currentEntry}
  <div class="turn-strip" data-testid="turn-strip">
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
  .round {
    font-weight: 600;
  }
</style>
