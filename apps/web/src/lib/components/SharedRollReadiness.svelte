<script lang="ts">
  import { getContext } from 'svelte';
  import {
    applySharedRollToInitiative,
    DIE_SIDE_OPTIONS,
    type CampaignStore,
    type Encounter,
    type PlayerSeat,
    type Roll,
    type SharedRoll,
    type Token,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { describeSharedRoll } from '../dice/describe';
  import { seatColor } from '../dice/seat-color';

  /**
   * Shared-roll readiness + "Apply results to initiative" (Master Plan v2,
   * R3.6.1/.5) — the Encounter tools' half of the shared-roll flow. Staging
   * (per-seat die/modifier/ready controls) lives in the Dice activity/
   * mini-card (`SharedRollStaging.svelte`); this panel is read-only readiness
   * plus the referee's Roll and Apply actions on the same `sharedRoll/current`
   * doc.
   */
  let {
    roomId,
    isGM,
    myUid,
    players,
    rolls,
    encounter,
    tokens,
  }: {
    roomId: string;
    isGM: boolean;
    myUid: string;
    players: PlayerSeat[];
    rolls: Roll[];
    encounter: Encounter | null;
    tokens: Token[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let sharedRoll = $state<SharedRoll | null>(null);
  $effect(() => {
    const unsub = store.subscribeSharedRoll(roomId, (sr) => (sharedRoll = sr));
    return unsub;
  });

  const isStaging = $derived(sharedRoll?.status === 'staging');
  const slotEntries = $derived(Object.entries(sharedRoll?.slots ?? {}));
  // The most recent shared roll, regardless of whether it came from this
  // tracker or the Dice activity — "Apply" is explicit and available
  // whenever there's something to apply (Gate 4b).
  const lastSharedRoll = $derived(
    [...rolls].reverse().find((r) => (r.parts?.length ?? 0) > 0) ?? null,
  );

  function authorName(seatId: string): string {
    return players.find((p) => p.uid === seatId)?.displayName ?? seatId;
  }

  let opening = $state(false);
  async function openForInitiative(): Promise<void> {
    if (opening) return;
    opening = true;
    try {
      await store.openSharedRoll(roomId, { openedBy: myUid, label: 'Initiative' });
    } finally {
      opening = false;
    }
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

  // GM-only: stage an arbitrary slot id — a groupId for a Side-mode roll
  // (Party/Monsters), or any label for a monster side that isn't a tracked
  // group at all (spec: "the referee may also include their own slots").
  let newSlotId = $state('');
  let newSlotDie = $state('d20');
  function addSlot(): void {
    const id = newSlotId.trim();
    if (!id) return;
    void store.stageSharedSlot(roomId, id, {
      die: newSlotDie,
      modifier: 0,
      advantage: 'normal',
      ready: true,
    });
    newSlotId = '';
  }

  function applyToInitiative(): void {
    if (!encounter || !lastSharedRoll?.parts) return;
    const ownerSeatByTokenId = Object.fromEntries(tokens.map((t) => [t.id, t.ownerSeatId]));
    const order = applySharedRollToInitiative(encounter.order, lastSharedRoll.parts, ownerSeatByTokenId);
    void store.writeEncounter(roomId, { ...encounter, order });
  }
</script>

{#if isStaging}
  <div class="shared-roll-readiness" data-testid="shared-roll-tracker-panel">
    <h3>{sharedRoll?.label ? `Shared roll — ${sharedRoll.label}` : 'Shared roll'}</h3>
    {#if slotEntries.length === 0}
      <p class="hint">Waiting for seats to stage a die (in the Dice activity).</p>
    {:else}
      <ul class="readiness" data-testid="shared-roll-tracker-readiness">
        {#each slotEntries as [seatId, slot] (seatId)}
          <li data-testid={`shared-roll-tracker-readiness-${seatId}`} class:ready={slot.ready}>
            <span class="swatch" style={`background:${seatColor(seatId)}`}></span>
            <span class="name">{authorName(seatId)}</span>
            <span class="die-label">{slot.die}</span>
            <span class="state">{slot.ready ? 'Ready' : 'Staging…'}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if isGM}
      <div class="add-slot">
        <input
          data-testid="shared-roll-add-slot-id"
          placeholder="Slot id (e.g. a groupId, for a side)"
          bind:value={newSlotId}
        />
        <select data-testid="shared-roll-add-slot-die" bind:value={newSlotDie}>
          {#each DIE_SIDE_OPTIONS as sides (sides)}
            <option value={`d${sides}`}>d{sides}</option>
          {/each}
        </select>
        <button
          data-testid="shared-roll-add-slot-button"
          onclick={addSlot}
          disabled={!newSlotId.trim()}
        >
          Add slot
        </button>
      </div>
      <button
        data-testid="shared-roll-tracker-roll-button"
        onclick={() => void rollNow()}
        disabled={rolling || !slotEntries.some(([, s]) => s.ready)}
      >
        {rolling ? 'Rolling…' : 'Roll!'}
      </button>
    {/if}
  </div>
{:else if isGM}
  <button
    class="open-initiative"
    data-testid="shared-roll-tracker-open"
    onclick={() => void openForInitiative()}
    disabled={opening}
  >
    Roll initiative (shared roll)
  </button>
{/if}

{#if isGM && encounter && lastSharedRoll}
  <button
    class="apply-initiative"
    data-testid="shared-roll-apply-initiative"
    onclick={applyToInitiative}
  >
    Apply results to initiative
  </button>
{/if}

<style>
  .shared-roll-readiness {
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 0.82rem;
  }
  .shared-roll-readiness h3 {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
  }
  .hint {
    font-size: 0.78rem;
    opacity: 0.7;
    margin: 0 0 0.4rem;
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
  button {
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .open-initiative,
  .apply-initiative {
    margin-bottom: 0.5rem;
  }
  .add-slot {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }
  .add-slot input {
    flex: 1;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.78rem;
  }
  .add-slot select {
    padding: 0.2rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
</style>
