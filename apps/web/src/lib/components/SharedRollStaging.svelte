<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DIE_SIDE_OPTIONS,
    type AdvantageMode,
    type CampaignStore,
    type PlayerSeat,
    type ProfileInstance,
    type SharedRoll,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { describeSharedRoll } from '../dice/describe';
  import { characterDiceColor } from '../dice/seat-color';

  /**
   * Shared roll staging (Master Plan v2, R3.6.1/.4) — lives in the Dice
   * activity/mini-card. A referee opens a round (optionally labeled); each
   * participant stages their own die/modifier/advantage and flips ready;
   * the referee presses one Roll once at least one seat is ready. Readiness
   * in the Encounter tracker (`SharedRollReadiness.svelte`) is a separate,
   * read-only-plus-apply view of the same `sharedRoll/current` doc.
   */
  let {
    roomId,
    myUid,
    isGM,
    players,
  }: {
    roomId: string;
    myUid: string;
    isGM: boolean;
    players: PlayerSeat[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let sharedRoll = $state<SharedRoll | null>(null);
  $effect(() => {
    const unsub = store.subscribeSharedRoll(roomId, (sr) => (sharedRoll = sr));
    return unsub;
  });

  // Character colors for the readiness swatches (quick-sheet token/color
  // split) — `characterDiceColor` falls back to the existing seatColor hash
  // for any seat that hasn't chosen a custom color yet.
  let profiles = $state<ProfileInstance[]>([]);
  $effect(() => {
    const unsub = store.subscribeProfiles(roomId, (p) => (profiles = p));
    return unsub;
  });

  const isStaging = $derived(sharedRoll?.status === 'staging');
  const mySlot = $derived(sharedRoll?.slots[myUid]);
  const otherSlots = $derived(
    Object.entries(sharedRoll?.slots ?? {}).filter(([seatId]) => seatId !== myUid),
  );

  function authorName(seatId: string): string {
    return players.find((p) => p.uid === seatId)?.displayName ?? seatId;
  }

  let openLabel = $state('');
  let opening = $state(false);
  async function openRound(): Promise<void> {
    if (opening) return;
    opening = true;
    try {
      await store.openSharedRoll(roomId, {
        openedBy: myUid,
        ...(openLabel.trim() ? { label: openLabel.trim() } : {}),
      });
      openLabel = '';
    } finally {
      opening = false;
    }
  }

  let die = $state('d20');
  let modifier = $state(0);
  let advantage = $state<AdvantageMode>('normal');

  function stage(ready: boolean): void {
    void store.stageSharedSlot(roomId, myUid, { die, modifier, advantage, ready });
  }

  let rolling = $state(false);
  async function rollNow(): Promise<void> {
    if (rolling) return;
    rolling = true;
    try {
      const roll = await store.resolveSharedRoll(roomId, myUid);
      await store.writeLog(roomId, {
        ts: Date.now(),
        authorUid: myUid,
        type: 'roll',
        text: describeSharedRoll(roll, players),
      });
    } finally {
      rolling = false;
    }
  }
</script>

{#if isStaging}
  <div class="shared-roll" data-testid="shared-roll-panel">
    <h3 data-testid="shared-roll-title">
      {sharedRoll?.label ? `Shared roll — ${sharedRoll.label}` : 'Shared roll'}
    </h3>

    <div class="my-slot">
      <select
        data-testid="shared-roll-die-select"
        bind:value={die}
        onchange={() => stage(mySlot?.ready ?? false)}
      >
        {#each DIE_SIDE_OPTIONS as sides (sides)}
          <option value={`d${sides}`}>d{sides}</option>
        {/each}
      </select>
      <input
        type="number"
        data-testid="shared-roll-modifier"
        value={modifier}
        oninput={(e) => {
          modifier = Number(e.currentTarget.value);
          stage(mySlot?.ready ?? false);
        }}
      />
      <div class="toggle-group" role="group" aria-label="Advantage">
        {#each [['normal', 'Normal'], ['advantage', 'Adv'], ['disadvantage', 'Dis']] as [value, label] (value)}
          <button
            type="button"
            data-testid={`shared-roll-adv-${value}`}
            class:active={advantage === value}
            onclick={() => {
              advantage = value as AdvantageMode;
              stage(mySlot?.ready ?? false);
            }}>{label}</button
          >
        {/each}
      </div>
      <label class="ready-toggle">
        <input
          type="checkbox"
          data-testid="shared-roll-ready"
          checked={mySlot?.ready ?? false}
          onchange={(e) => stage(e.currentTarget.checked)}
        />
        Ready
      </label>
    </div>

    {#if otherSlots.length > 0}
      <ul class="readiness" data-testid="shared-roll-readiness">
        {#each otherSlots as [seatId, slot] (seatId)}
          <li data-testid={`shared-roll-readiness-${seatId}`} class:ready={slot.ready}>
            <span class="swatch" style={`background:${characterDiceColor(seatId, profiles)}`}
            ></span>
            <span class="name">{authorName(seatId)}</span>
            <span class="die-label">{slot.die}</span>
            <span class="state">{slot.ready ? 'Ready' : 'Staging…'}</span>
          </li>
        {/each}
      </ul>
    {/if}

    {#if isGM}
      <button
        class="roll-now"
        data-testid="shared-roll-roll-button"
        onclick={() => void rollNow()}
        disabled={rolling || !Object.values(sharedRoll?.slots ?? {}).some((s) => s.ready)}
      >
        {rolling ? 'Rolling…' : 'Roll!'}
      </button>
    {/if}
  </div>
{:else if isGM}
  <div class="shared-roll-open" data-testid="shared-roll-open-panel">
    <input
      data-testid="shared-roll-open-label"
      placeholder="Label (optional)"
      bind:value={openLabel}
    />
    <button
      data-testid="shared-roll-open-button"
      onclick={() => void openRound()}
      disabled={opening}
    >
      Open shared roll
    </button>
  </div>
{/if}

<style>
  .shared-roll,
  .shared-roll-open {
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.82rem;
  }
  .shared-roll h3 {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
  }
  .my-slot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .my-slot select,
  .my-slot input[type='number'] {
    padding: 0.2rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .my-slot input[type='number'] {
    width: 3.2rem;
  }
  .toggle-group {
    display: flex;
    gap: 0.15rem;
  }
  .toggle-group button {
    padding: 0.15rem 0.4rem;
    font-size: 0.72rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .toggle-group button.active {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  .ready-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .readiness {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .readiness li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    opacity: 0.7;
  }
  .readiness li.ready {
    opacity: 1;
  }
  .swatch {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    flex: none;
  }
  .name {
    min-width: 5rem;
  }
  .die-label {
    opacity: 0.7;
  }
  .state {
    margin-left: auto;
    font-size: 0.72rem;
  }
  .roll-now {
    padding: 0.35rem 0.8rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  .roll-now:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .shared-roll-open {
    display: flex;
    gap: 0.4rem;
  }
  .shared-roll-open input {
    flex: 1;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .shared-roll-open button {
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
</style>
