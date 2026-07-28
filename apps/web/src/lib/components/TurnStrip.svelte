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
  }: {
    encounter: Encounter | null;
    groups: Group[];
    tokens: Token[];
  } = $props();

  const currentEntry = $derived(
    encounter && encounter.order.length > 0
      ? (encounter.order[encounter.currentIndex] ?? null)
      : null,
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
  /* An inline pill in the top status bar — the only placement there is. The
     floating-over-the-map `stage` variant it used to share this rule with was
     unreachable (every call site passed `rail`), so its positioning and the
     variant prop are both gone. */
  .turn-strip {
    display: flex;
    gap: 0.6rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .round {
    font-weight: 600;
  }
</style>
