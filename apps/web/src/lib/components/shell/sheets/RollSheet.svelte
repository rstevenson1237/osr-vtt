<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    type CampaignStore,
    type PlayerSeat,
    type RollConvention,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../../context';
  import { quickRollDie } from '../../../dice/quick-roll';
  import DiceTray from '../../DiceTray.svelte';
  import TrayControls from '../../dice/TrayControls.svelte';
  import MacroList from '../../dice/MacroList.svelte';

  /** Roll quick sheet (Shell UI Redesign) — the former Dice activity and its
   * mini-card, merged. Docked it is one-tap die buttons plus the roll-shaping
   * controls (modifier, advantage, resolution mode) and saved macros; expanded
   * it swaps those for the full `DiceTray` (staging, shared rolls) which
   * renders the same two components itself — so every `tray-*` / `macro-*` /
   * `roll-button` testid stays mounted exactly once. The tray's staged state
   * is a shared singleton, so the tray itself is only ever mounted expanded.
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

  async function roll(sides: number): Promise<void> {
    if (rolling) return;
    rolling = true;
    try {
      await quickRollDie(store, roomId, authorUid, sides, conventions);
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

  <!-- Docked only: expanded renders `DiceTray`, which mounts these two itself
  (a testid must never exist twice). -->
  {#if !expanded}
    <TrayControls compact />
    <MacroList {roomId} {authorUid} compact />
  {/if}

  {#if expanded}
    <div class="tray">
      <DiceTray {roomId} {authorUid} {isGM} {players} {conventions} />
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
  .tray {
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
</style>
