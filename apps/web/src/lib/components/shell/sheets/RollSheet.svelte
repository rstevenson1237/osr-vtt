<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    resolveSeparate,
    type CampaignStore,
    type PlayerSeat,
    type Roll,
    type RolledDie,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../../context';
  import { quickRollDie } from '../../../dice/quick-roll';
  import DiceTray from '../../DiceTray.svelte';

  /** Roll quick sheet (Shell UI Redesign) — the former Dice activity and its
   * mini-card, merged. Docked it is one-tap die buttons plus a short
   * result-classed recent-rolls list; expanded it adds the full `DiceTray`
   * (staging, modifier, advantage, macros, shared rolls) with every `tray-*` /
   * `roll-button` testid intact. The tray's staged state is a shared
   * singleton, so it is only ever mounted in the expanded view. */
  let {
    roomId,
    authorUid,
    isGM = false,
    players = [],
    rolls = [],
    expanded = false,
  }: {
    roomId: string;
    authorUid: string;
    isGM?: boolean;
    players?: PlayerSeat[];
    rolls?: Roll[];
    expanded?: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const RECENT = 6;
  let rolling = $state(false);

  interface RecentEntry {
    key: string;
    who: string;
    dice: RolledDie[];
    total?: number;
  }

  function seatName(uid: string): string {
    return players.find((p) => p.uid === uid)?.displayName ?? 'Unknown';
  }

  const recent = $derived.by((): RecentEntry[] => {
    const flat: RecentEntry[] = [];
    for (const roll of rolls) {
      if (roll.parts && roll.parts.length > 0) {
        for (const part of roll.parts) {
          flat.push({
            key: `${roll.id}:${part.seatId}`,
            who: seatName(part.seatId),
            dice: part.dice,
            total: part.total,
          });
        }
      } else {
        flat.push({
          key: roll.id,
          who: seatName(roll.authorUid),
          dice: roll.dice,
          total: roll.mode === 'summed' ? roll.total : undefined,
        });
      }
    }
    return flat.slice(-RECENT).reverse();
  });

  async function roll(sides: number): Promise<void> {
    if (rolling) return;
    rolling = true;
    try {
      await quickRollDie(store, roomId, authorUid, sides);
    } finally {
      rolling = false;
    }
  }
</script>

<div class="roll-sheet">
  <div class="dice-row" data-testid="quick-roll-row">
    {#each DIE_SIDE_OPTIONS as sides (sides)}
      <button
        class="die-btn"
        data-testid={`quick-roll-d${sides}`}
        disabled={rolling || !authorUid}
        onclick={() => void roll(sides)}
      >
        d{sides}
      </button>
    {/each}
  </div>

  <div class="recent" data-testid="quick-roll-recent">
    {#if recent.length === 0}
      <p class="hint">No rolls yet.</p>
    {:else}
      {#each recent as entry (entry.key)}
        <div class="entry">
          <span class="who">{entry.who}</span>
          {#if entry.total !== undefined}
            <span class="total">{entry.total}</span>
          {/if}
          <span class="dice">
            {#each entry.dice as die, i (i)}
              <span class={`die ${resolveSeparate(die.kept)}`}>{die.kept}</span>
            {/each}
          </span>
        </div>
      {/each}
    {/if}
  </div>

  {#if expanded}
    <div class="tray">
      <DiceTray {roomId} {authorUid} {isGM} {players} />
    </div>
  {/if}
</div>

<style>
  .roll-sheet {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .dice-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .die-btn {
    padding: 0.28rem 0.55rem;
    font-size: 0.72rem;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: var(--text);
    cursor: pointer;
  }
  .die-btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .die-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .recent {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
  }
  .who {
    min-width: 3.5rem;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .total {
    font-weight: 600;
  }
  .dice {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .die {
    padding: 0.05rem 0.5rem;
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
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .tray {
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
</style>
