<script lang="ts">
  import {
    summarizeRoll,
    type DieView,
    type PlayerSeat,
    type Roll,
    type RollConvention,
    type ResultClass,
  } from '@osr-vtt/shared';

  /**
   * The roll strip (Encounter Screen Spec §6) — "everyone rolls at once":
   * recent rolls collect here, sorted highest→lowest, each die banded by the
   * room's own convention. The app only sorts and bands; it never decides
   * what a band *does*. A shared roll (Master Plan v2, R3.6.4) contributes one
   * entry per part rather than one for the whole doc — "roll strip shows parts
   * individually, sorted."
   *
   * Flattening is `summarizeRoll`'s job now: this used to re-implement the
   * solo/shared split and the author lookup itself, and had drifted from the
   * overlay and the log.
   */
  let {
    rolls,
    players,
    conventions = [],
  }: { rolls: Roll[]; players: PlayerSeat[]; conventions?: RollConvention[] } = $props();

  const STRIP_SIZE = 8;

  interface StripEntry {
    key: string;
    authorName: string;
    sortKey: number;
    dice: DieView[];
    summed: boolean;
    total?: number;
    band?: { class: ResultClass; label: string };
  }

  function authorName(uid: string): string {
    return players.find((p) => p.uid === uid)?.displayName ?? 'Unknown';
  }

  const entries = $derived.by((): StripEntry[] => {
    const flat: StripEntry[] = [];
    for (const roll of rolls) {
      const summary = summarizeRoll(roll, conventions);
      for (const part of summary.parts) {
        flat.push({
          key: summary.parts.length > 1 ? `${roll.id}:${part.slotId}` : roll.id,
          authorName: authorName(part.slotId),
          sortKey: part.total ?? Math.max(0, ...part.dice.map((d) => d.kept)),
          dice: part.dice,
          summed: summary.summed,
          ...(part.total !== undefined ? { total: part.total } : {}),
          ...(part.band ? { band: part.band } : {}),
        });
      }
    }
    return flat.slice(-STRIP_SIZE).sort((a, b) => b.sortKey - a.sortKey);
  });
</script>

<div class="roll-strip" data-testid="roll-strip">
  <h3>Roll Strip</h3>
  {#if entries.length === 0}
    <p class="empty">No rolls yet.</p>
  {:else}
    <ul>
      {#each entries as entry (entry.key)}
        <li data-testid={`roll-strip-entry-${entry.key}`}>
          <span class="author">{entry.authorName}</span>
          {#if entry.summed}
            <span class="total" data-testid={`roll-strip-total-${entry.key}`}>{entry.total}</span>
            {#if entry.band}
              <span class={`band ${entry.band.class}`}>{entry.band.label}</span>
            {/if}
            {#each entry.dice.filter((d) => d.poolDropped) as die, i (i)}
              <span class="dropped">−{die.kept}</span>
            {/each}
          {:else}
            <span class="dice">
              {#each entry.dice as die, i (i)}
                <span class={`die ${die.band?.class ?? 'unbanded'}`} title={die.band?.label ?? ''}
                  >{die.kept}</span
                >
                {#if die.dropped !== undefined}
                  <span class="dropped">{die.dropped}</span>
                {/if}
              {/each}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .roll-strip {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
  }
  .roll-strip h3 {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
  }
  .empty {
    margin: 0;
    font-size: 0.78rem;
    opacity: 0.6;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .author {
    min-width: 5rem;
    opacity: 0.75;
  }
  .dice {
    display: flex;
    gap: 0.25rem;
  }
  .die {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.75rem;
  }
  .die.success {
    background: var(--success-bg-strong);
    color: var(--success);
  }
  .die.complication {
    background: var(--complication-bg-strong);
    color: var(--complication);
  }
  .die.failure {
    background: var(--failure-bg-strong);
    color: var(--failure);
  }
  /* No convention matched this face — show the number plainly rather than
     borrowing some other die size's colours. */
  .die.unbanded {
    background: var(--bg-panel-alt);
  }
  .band {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .band.success {
    background: var(--success-bg-strong);
    color: var(--success);
  }
  .band.complication {
    background: var(--complication-bg-strong);
    color: var(--complication);
  }
  .band.failure {
    background: var(--failure-bg-strong);
    color: var(--failure);
  }
  .total {
    font-weight: 600;
  }
  .dropped {
    font-size: 0.7rem;
    opacity: 0.45;
    text-decoration: line-through;
  }
</style>
