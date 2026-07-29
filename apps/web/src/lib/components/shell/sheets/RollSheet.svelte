<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    publishRoll,
    type CampaignStore,
    type PlayerSeat,
    type RollConvention,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../../context';
  import { diceTray } from '../../../dice/staged-store';
  import DiceTray from '../../DiceTray.svelte';
  import TrayControls from '../../dice/TrayControls.svelte';
  import MacroList from '../../dice/MacroList.svelte';

  /** Roll quick sheet (Shell UI Redesign) — the former Dice activity and its
   * mini-card, merged. Docked it is the die buttons plus the roll-shaping
   * controls (modifier, advantage, resolution mode) and saved macros; expanded
   * it adds the full `DiceTray` (custom dice, shared rolls) which renders
   * `TrayControls`/`MacroList` itself — so every `tray-*` / `macro-*` testid
   * stays mounted exactly once. The tray's staged state is a shared singleton,
   * so the tray itself is only ever mounted expanded.
   *
   * Building the roll is the quick sheet's job (playtest feedback): a die
   * button *stages* a die rather than rolling it immediately, so a complex
   * pool can be assembled without expanding anything, and the staged chips +
   * Roll button live here in both modes rather than only in the expanded tray.
   * Saving a macro is the expanded view's job; docked shows saved macros only.
   * Recent rolls are no longer duplicated here; the Log view owns them. */
  let {
    roomId,
    authorUid,
    isGM = false,
    players = [],
    conventions = [],
    expanded = false,
  }: {
    roomId: string;
    authorUid: string;
    isGM?: boolean;
    players?: PlayerSeat[];
    conventions?: RollConvention[];
    expanded?: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let rolling = $state(false);

  function stage(sides: number): void {
    diceTray.stage(`d${sides}`);
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

<div class="roll-sheet">
  <div class="dice-row" data-testid="quick-roll-row">
    {#each DIE_SIDE_OPTIONS as sides (sides)}
      <button
        class="die-btn"
        data-testid={`quick-roll-d${sides}`}
        disabled={!authorUid}
        onclick={() => stage(sides)}
      >
        d{sides}
      </button>
    {/each}
  </div>

  <div class="staged" data-testid="quick-roll-staged">
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
      <span class="empty">Tap a die to build a roll.</span>
    {/if}
  </div>

  <button
    class="roll-button"
    data-testid="roll-button"
    onclick={rollStaged}
    disabled={$diceTray.dice.length === 0 || rolling || !authorUid}
  >
    {rolling ? 'Rolling…' : 'Roll'}
  </button>

  <!-- Docked only: expanded renders `DiceTray`, which mounts these two itself
  (a testid must never exist twice). Docked, the macro list shows only already
  saved macros — the creator lives in the expanded view. -->
  {#if !expanded}
    <TrayControls compact />
    <MacroList {roomId} {authorUid} compact showCreate={false} />
  {/if}

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
  .staged {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 1.5rem;
    align-items: center;
  }
  .chip {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    font-size: 0.75rem;
    color: inherit;
    cursor: pointer;
  }
  .empty {
    font-size: 0.72rem;
    opacity: 0.6;
  }
  .roll-button {
    align-self: flex-start;
    padding: 0.35rem 0.9rem;
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
  .tray {
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
</style>
