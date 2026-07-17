<script lang="ts">
  import { resolveSeparate, type PlayerSeat, type Roll, type RolledDie } from '@osr-vtt/shared';

  /**
   * The roll strip (Encounter Screen Spec §6) — "everyone rolls at once":
   * recent rolls collect here, sorted highest→lowest, each die flagged by
   * the active convention. The app only sorts and flags faces; it never
   * decides what a flag *does*. A shared roll (Master Plan v2, R3.6.4)
   * contributes one entry per part rather than one entry for the whole
   * doc — "roll strip shows parts individually, sorted."
   */
  let { rolls, players }: { rolls: Roll[]; players: PlayerSeat[] } = $props();

  const STRIP_SIZE = 8;

  interface StripEntry {
    key: string;
    authorName: string;
    sortKey: number;
    dice: RolledDie[];
    summed: boolean;
    total?: number;
  }

  function authorName(uid: string): string {
    return players.find((p) => p.uid === uid)?.displayName ?? 'Unknown';
  }

  const entries = $derived.by((): StripEntry[] => {
    const flat: StripEntry[] = [];
    for (const roll of rolls) {
      if (roll.parts && roll.parts.length > 0) {
        for (const part of roll.parts) {
          flat.push({
            key: `${roll.id}:${part.seatId}`,
            authorName: authorName(part.seatId),
            sortKey: part.total ?? Math.max(0, ...part.dice.map((d) => d.kept)),
            dice: part.dice,
            summed: true,
            total: part.total,
          });
        }
      } else {
        flat.push({
          key: roll.id,
          authorName: authorName(roll.authorUid),
          sortKey:
            roll.mode === 'summed'
              ? (roll.total ?? 0)
              : Math.max(0, ...roll.dice.map((d) => d.kept)),
          dice: roll.dice,
          summed: roll.mode === 'summed',
          total: roll.total,
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
            {#each entry.dice.filter((d) => d.poolDropped) as die, i (i)}
              <span class="dropped">−{die.kept}</span>
            {/each}
          {:else}
            <span class="dice">
              {#each entry.dice as die, i (i)}
                <span class={`die ${resolveSeparate(die.kept)}`}>{die.kept}</span>
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
  .total {
    font-weight: 600;
  }
  .dropped {
    font-size: 0.7rem;
    opacity: 0.45;
    text-decoration: line-through;
  }
</style>
