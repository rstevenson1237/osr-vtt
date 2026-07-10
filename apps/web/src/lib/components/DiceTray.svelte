<script lang="ts">
  import { getContext } from 'svelte';
  import { resolveSeparate, type CampaignStore } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { stagedDice } from '../dice/staged-store';
  import { createSeed, rollDice } from '../dice/seed';

  let { roomId, authorUid }: { roomId: string; authorUid: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let rolling = $state(false);

  async function rollStaged(): Promise<void> {
    const staged = $stagedDice;
    if (staged.length === 0 || rolling || !authorUid) return;
    rolling = true;
    try {
      const dieExprs = staged.map((d) => d.die);
      const count = dieExprs.length;
      const seed = createSeed();
      const results = rollDice(seed, count, 6);

      await store.writeRoll(roomId, {
        ts: Date.now(),
        authorUid,
        seed,
        params: { die: dieExprs[0] ?? 'd6', count },
        dice: results,
        mode: 'separate',
        results,
      });

      // Separate mode flags each die individually (Plan §Phase 3 preview);
      // Phase 0's single starter `roll` field only ever stages one die at a
      // time in the acceptance flow, so one summarizing log line is enough
      // here — per-die multi-flagging is Phase 3 scope.
      const resultClass = count === 1 ? resolveSeparate(results[0]!) : undefined;
      const text =
        count === 1
          ? `Rolled ${dieExprs[0]}: ${results[0]}`
          : `Rolled ${count} dice (${dieExprs.join(', ')}): ${results.join(', ')}`;

      await store.writeLog(roomId, {
        ts: Date.now(),
        authorUid,
        type: 'roll',
        text,
        ...(resultClass ? { resultClass } : {}),
      });

      stagedDice.clear();
    } finally {
      rolling = false;
    }
  }
</script>

<div class="tray" data-testid="dice-tray">
  <h2>Dice Tray</h2>
  <div class="staged">
    {#each $stagedDice as die (die.id)}
      <span class="chip" data-testid={`staged-die-${die.id}`}>{die.die}</span>
    {/each}
    {#if $stagedDice.length === 0}
      <span class="empty">Tap a 🎲 field to stage a die.</span>
    {/if}
  </div>
  <button
    data-testid="roll-button"
    onclick={rollStaged}
    disabled={$stagedDice.length === 0 || rolling}
  >
    {rolling ? 'Rolling…' : 'Roll'}
  </button>
</div>

<style>
  .tray {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .tray h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .staged {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 1.6rem;
    margin-bottom: 0.5rem;
  }
  .chip {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: #362d20;
    border: 1px solid #a6763f;
    font-size: 0.8rem;
  }
  .empty {
    font-size: 0.8rem;
    opacity: 0.6;
  }
  button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: none;
    background: #a6763f;
    color: #14110d;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
