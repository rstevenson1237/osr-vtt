<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    publishRoll,
    type CampaignStore,
    type PlayerSeat,
    type RollConvention,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { diceTray } from '../dice/staged-store';
  import SharedRollStaging from './SharedRollStaging.svelte';
  import TrayControls from './dice/TrayControls.svelte';
  import MacroList from './dice/MacroList.svelte';

  /**
   * The dynamic dice tray (Plan §7 Phase 3, Encounter Screen Spec §6):
   * add any number/mix of dice, a flat modifier, advantage/disadvantage,
   * and a Summed (OSE) or Separate (per-die flag) resolution mode. Rolling
   * writes one `rolls` doc every client re-derives deterministically from
   * `seed` (Plan §4) — no server round-trip needed to agree on a result.
   * Also hosts the shared-roll staging panel (Master Plan v2, R3.6.1) above
   * the personal tray — "the Dice activity/mini-card."
   */
  let {
    roomId,
    authorUid,
    isGM = false,
    players = [],
    conventions = [],
  }: {
    roomId: string;
    authorUid: string;
    isGM?: boolean;
    players?: PlayerSeat[];
    conventions?: RollConvention[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let rolling = $state(false);
  let customDie = $state('');

  function addDie(sides: number): void {
    diceTray.stage(`d${sides}`);
  }

  function addCustomDie(): void {
    const expr = customDie.trim();
    if (!expr) return;
    diceTray.stage(expr);
    customDie = '';
  }

  async function rollStaged(): Promise<void> {
    const tray = $diceTray;
    if (tray.dice.length === 0 || rolling || !authorUid) return;

    rolling = true;
    try {
      // One pipeline for every roll in the app (`dice/publish.ts`): seed,
      // roll, `Roll` doc, log entry with the convention-derived result class.
      const roll = await publishRoll(
        store,
        roomId,
        authorUid,
        {
          exprs: tray.dice.map((d) => d.die),
          modifier: tray.modifier,
          advantage: tray.advantage,
          mode: tray.mode,
        },
        conventions,
      );
      if (roll) diceTray.clearDice();
    } finally {
      rolling = false;
    }
  }
</script>

<div class="tray" data-testid="dice-tray">
  <h2>Dice Tray</h2>

  {#if authorUid}
    <SharedRollStaging {roomId} myUid={authorUid} {isGM} {players} />
  {/if}

  <div class="add-row">
    {#each DIE_SIDE_OPTIONS as sides (sides)}
      <button data-testid={`tray-add-d${sides}`} onclick={() => addDie(sides)}>d{sides}</button>
    {/each}
    <input
      class="custom-die"
      data-testid="tray-custom-die"
      placeholder="2d6"
      bind:value={customDie}
      onkeydown={(e) => e.key === 'Enter' && addCustomDie()}
    />
    <button data-testid="tray-add-custom" onclick={addCustomDie} disabled={!customDie.trim()}
      >Add</button
    >
  </div>

  <div class="staged">
    {#each $diceTray.dice as die (die.id)}
      <button
        class="chip"
        data-testid={`staged-die-${die.id}`}
        onclick={() => diceTray.remove(die.id)}
        title="Remove"
      >
        {die.die} ✕
      </button>
    {/each}
    {#if $diceTray.dice.length === 0}
      <span class="empty">Tap a die above or a 🎲 field to stage a die.</span>
    {/if}
  </div>

  <TrayControls />

  <button
    class="roll-button"
    data-testid="roll-button"
    onclick={rollStaged}
    disabled={$diceTray.dice.length === 0 || rolling}
  >
    {rolling ? 'Rolling…' : 'Roll'}
  </button>

  <MacroList {roomId} {authorUid} />
</div>

<style>
  .tray {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .tray h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .add-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }
  .add-row button {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }
  .custom-die {
    width: 4rem;
    box-sizing: border-box;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
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
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    font-size: 0.8rem;
    color: inherit;
    cursor: pointer;
  }
  .empty {
    font-size: 0.8rem;
    opacity: 0.6;
  }
  .roll-button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  .roll-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button {
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
</style>
