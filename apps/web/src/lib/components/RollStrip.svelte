<script lang="ts">
  import { resolveSeparate, type PlayerSeat, type Roll } from '@osr-vtt/shared';

  /**
   * The roll strip (Encounter Screen Spec §6) — "everyone rolls at once":
   * recent rolls collect here, sorted highest→lowest, each die flagged by
   * the active convention. The app only sorts and flags faces; it never
   * decides what a flag *does*.
   */
  let { rolls, players }: { rolls: Roll[]; players: PlayerSeat[] } = $props();

  const STRIP_SIZE = 8;

  interface StripEntry {
    roll: Roll;
    authorName: string;
    sortKey: number;
  }

  function authorName(uid: string): string {
    return players.find((p) => p.uid === uid)?.displayName ?? 'Unknown';
  }

  const entries = $derived.by((): StripEntry[] => {
    const recent = rolls.slice(-STRIP_SIZE);
    return recent
      .map((roll) => ({
        roll,
        authorName: authorName(roll.authorUid),
        sortKey:
          roll.mode === 'summed'
            ? (roll.total ?? 0)
            : Math.max(0, ...roll.dice.map((d) => d.kept)),
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  });
</script>

<div class="roll-strip" data-testid="roll-strip">
  <h3>Roll Strip</h3>
  {#if entries.length === 0}
    <p class="empty">No rolls yet.</p>
  {:else}
    <ul>
      {#each entries as entry (entry.roll.id)}
        <li data-testid={`roll-strip-entry-${entry.roll.id}`}>
          <span class="author">{entry.authorName}</span>
          {#if entry.roll.mode === 'summed'}
            <span class="total" data-testid={`roll-strip-total-${entry.roll.id}`}
              >{entry.roll.total}</span
            >
          {:else}
            <span class="dice">
              {#each entry.roll.dice as die, i (i)}
                <span class={`die ${resolveSeparate(die.kept)}`}>{die.kept}</span>
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
    background: #241f18;
    border: 1px solid #3a3226;
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
    background: #2f5c34;
    color: #bdf2c4;
  }
  .die.complication {
    background: #6b5a20;
    color: #f2e2ab;
  }
  .die.failure {
    background: #5c2f2f;
    color: #f2bdbd;
  }
  .total {
    font-weight: 600;
  }
</style>
