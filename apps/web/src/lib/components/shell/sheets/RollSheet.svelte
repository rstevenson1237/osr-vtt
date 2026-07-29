<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    publishHiddenRoll,
    publishRoll,
    type BlindDraw,
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

  /** Referee-only: send this roll to `gmPrivate` instead of publishing it.
   * Sticky across rolls — a referee making secret checks usually makes
   * several in a row. */
  let hidden = $state(false);

  /** The referee's own hidden results. Only they can read `gmPrivate` at all
   * (Security Rules deny players the read outright), so this subscription is
   * opened only for the GM — a player's client would simply be denied. */
  let hiddenRolls = $state<BlindDraw[]>([]);
  $effect(() => {
    if (!isGM) {
      hiddenRolls = [];
      return;
    }
    const unsub = store.subscribeBlindDraws(roomId, (draws) => (hiddenRolls = draws));
    return () => unsub();
  });
  /** Newest first — a referee wants the roll they just made, not the first. */
  const recentHidden = $derived([...hiddenRolls].sort((a, b) => b.ts - a.ts).slice(0, 8));

  function stage(sides: number): void {
    diceTray.stage(`d${sides}`);
  }

  async function rollStaged(): Promise<void> {
    const tray = $diceTray;
    if (tray.dice.length === 0 || rolling || !authorUid) return;
    rolling = true;
    try {
      const req = {
        exprs: tray.dice.map((d) => d.die),
        modifier: tray.modifier,
        advantage: tray.advantage,
        mode: tray.mode,
      };
      // One pipeline for every roll in the app (`dice/publish.ts`): seed,
      // roll, `Roll` doc, log entry with the convention-derived result class.
      // A hidden roll shares the construction but diverges at the write,
      // landing in `gmPrivate` with no `Roll` doc and no log entry.
      const result =
        hidden && isGM
          ? await publishHiddenRoll(store, roomId, authorUid, req)
          : await publishRoll(store, roomId, authorUid, req, conventions);
      if (result) diceTray.clearDice();
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

  {#if isGM}
    <!-- Referee-only. The result goes to `gmPrivate`, which players cannot
    read — not a "please don't look" flag on a public doc. There is no reveal:
    if the table should see it, roll it normally. -->
    <label class="hidden-toggle" title="Result goes only to you — no log entry, no dice on screen">
      <input type="checkbox" data-testid="hidden-roll" bind:checked={hidden} />
      Hidden roll
    </label>
  {/if}

  <button
    class="roll-button"
    class:hidden-roll={hidden && isGM}
    data-testid="roll-button"
    onclick={rollStaged}
    disabled={$diceTray.dice.length === 0 || rolling || !authorUid}
  >
    {rolling ? 'Rolling…' : hidden && isGM ? 'Roll hidden' : 'Roll'}
  </button>

  {#if isGM && recentHidden.length > 0}
    <div class="hidden-results" data-testid="hidden-roll-list">
      <h3>Your hidden rolls</h3>
      <ul>
        {#each recentHidden as draw (draw.id)}
          <li data-testid={`hidden-roll-${draw.id}`}>
            <span class="hr-title">{draw.title}</span>
            <span class="hr-text">{draw.text}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

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
  .roll-button.hidden-roll {
    background: var(--panel-referee-line, var(--accent));
    color: var(--text);
  }
  .hidden-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-dim);
    cursor: pointer;
  }
  .hidden-results {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .hidden-results h3 {
    margin: 0 0 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }
  .hidden-results ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .hidden-results li {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    background: var(--bg-inset);
  }
  .hr-title {
    color: var(--text-dim);
    flex: 0 0 auto;
  }
  .hr-text {
    flex: 1;
    min-width: 0;
    color: var(--accent-text);
  }
  .tray {
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
</style>
