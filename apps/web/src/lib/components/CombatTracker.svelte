<script lang="ts">
  import { getContext } from 'svelte';
  import {
    advanceTurn,
    buildOrder,
    previousTurn,
    rollInitiative,
    setInit,
    sortOrder,
    syncOrder,
    toggleActed,
    type CampaignStore,
    type Encounter,
    type EncounterMode,
    type Group,
    type Token,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { refLabel } from '../encounter/labels';

  /**
   * Combat tracker (Encounter Screen Spec §4). Side/Group and Individual
   * modes only — Free/Caller is Phase 4. The GM starts an encounter from
   * the room's `[Active]` groups, types or rolls initiative, sorts, then
   * steps turns. The `[Active]` pool stays reconciled live: toggling a
   * group's `[Active]` switch while combat is running adds/removes its
   * row without losing anyone else's initiative (Spec §9).
   */
  let {
    roomId,
    groups,
    encounter,
    tokens,
    isGM,
  }: {
    roomId: string;
    groups: Group[];
    encounter: Encounter | null;
    tokens: Token[];
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let selectedMode = $state<EncounterMode>('side');

  const activeGroups = $derived(groups.filter((g) => g.active));
  const isRunning = $derived(encounter !== null && encounter.order.length > 0);
  const currentEntry = $derived(
    encounter && encounter.order.length > 0 ? (encounter.order[encounter.currentIndex] ?? null) : null,
  );

  /** The refIds that *should* be in the pool right now for the relevant
   * mode (the running encounter's mode once started, otherwise the
   * pre-start mode selector). */
  const expectedActiveIds = $derived.by(() => {
    const mode = encounter?.mode ?? selectedMode;
    if (mode === 'individual') {
      const ids = new Set<string>();
      for (const g of activeGroups) for (const id of g.memberTokenIds) ids.add(id);
      return [...ids];
    }
    return activeGroups.map((g) => g.id);
  });

  // GM-only live reconciliation: a group's [Active] toggle flipping mid-fight
  // adds/removes its row without disturbing anyone else's init/acted state.
  $effect(() => {
    if (!isGM || !encounter || encounter.order.length === 0) return;
    const refType = encounter.mode === 'individual' ? 'actor' : 'side';
    const synced = syncOrder(encounter.order, refType, expectedActiveIds);
    if (JSON.stringify(synced) === JSON.stringify(encounter.order)) return;
    const currentIndex = Math.min(encounter.currentIndex, Math.max(synced.length - 1, 0));
    void store.writeEncounter(roomId, { ...encounter, order: synced, currentIndex });
  });

  async function start(): Promise<void> {
    const refType = selectedMode === 'individual' ? 'actor' : 'side';
    const order = buildOrder(refType, expectedActiveIds);
    await store.writeEncounter(roomId, { mode: selectedMode, round: 1, order, currentIndex: 0 });
  }

  async function endCombat(): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, { ...encounter, round: 1, order: [], currentIndex: 0 });
  }

  async function sort(): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, {
      ...encounter,
      order: sortOrder(encounter.order),
      currentIndex: 0,
    });
  }

  async function advance(): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, advanceTurn(encounter));
  }

  async function previous(): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, previousTurn(encounter));
  }

  async function setInitValue(refId: string, value: number | undefined): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, {
      ...encounter,
      order: setInit(encounter.order, refId, value),
    });
  }

  function rollFor(refId: string): void {
    void setInitValue(refId, rollInitiative(6));
  }

  function actedToggle(refId: string): void {
    if (!encounter) return;
    void store.writeEncounter(roomId, { ...encounter, order: toggleActed(encounter.order, refId) });
  }
</script>

<div class="combat-tracker" data-testid="combat-tracker">
  <h2>Combat Tracker</h2>

  {#if !isRunning}
    <div class="mode-select">
      <label>
        <input
          type="radio"
          name="encounter-mode"
          data-testid="combat-mode-side"
          value="side"
          bind:group={selectedMode}
        />
        Side / Group
      </label>
      <label>
        <input
          type="radio"
          name="encounter-mode"
          data-testid="combat-mode-individual"
          value="individual"
          bind:group={selectedMode}
        />
        Individual
      </label>
    </div>
    {#if expectedActiveIds.length === 0}
      <p class="hint">Toggle a group's [Active] switch to add it to the initiative pool.</p>
    {/if}
    {#if isGM}
      <button
        data-testid="combat-start"
        onclick={() => void start()}
        disabled={expectedActiveIds.length === 0}
      >
        Start combat
      </button>
    {/if}
  {:else}
    <div class="status-row">
      <span class="mode-label"
        >{encounter?.mode === 'individual' ? 'Individual' : 'Side / Group'} mode</span
      >
      <span class="round" data-testid="combat-round">Round {encounter?.round}</span>
    </div>

    <ul class="order-list">
      {#each encounter?.order ?? [] as entry, index (entry.refId)}
        <li
          class="order-row"
          class:current={index === encounter?.currentIndex}
          class:acted={entry.acted}
          data-testid={`combat-row-${entry.refId}`}
        >
          <span class="label">{refLabel(entry, groups, tokens)}</span>
          {#if isGM}
            <input
              class="init-input"
              type="number"
              data-testid={`combat-init-input-${entry.refId}`}
              value={entry.init ?? ''}
              oninput={(e) =>
                void setInitValue(
                  entry.refId,
                  e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value),
                )}
            />
            <button data-testid={`combat-roll-${entry.refId}`} onclick={() => rollFor(entry.refId)}
              >🎲</button
            >
            <button
              data-testid={`combat-acted-${entry.refId}`}
              onclick={() => actedToggle(entry.refId)}
            >
              {entry.acted ? 'Acted' : 'Mark acted'}
            </button>
          {:else}
            <span class="init-value">{entry.init ?? '—'}</span>
          {/if}
        </li>
      {/each}
    </ul>

    {#if currentEntry}
      <p class="current-label" data-testid="combat-current-label">
        {refLabel(currentEntry, groups, tokens)} is up
      </p>
    {/if}

    {#if isGM}
      <div class="controls">
        <button data-testid="combat-sort" onclick={() => void sort()}>Sort by initiative</button>
        <button data-testid="combat-previous" onclick={() => void previous()}>◀ Previous</button>
        <button data-testid="combat-advance" onclick={() => void advance()}>Advance ▶</button>
        <button data-testid="combat-end" onclick={() => void endCombat()}>End combat</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .combat-tracker {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .combat-tracker h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .mode-select {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  .round {
    font-weight: 600;
  }
  .order-list {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .order-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #3a3226;
    font-size: 0.85rem;
  }
  .order-row.current {
    border-color: #a6763f;
    background: #362d20;
  }
  .order-row.acted {
    opacity: 0.55;
  }
  .order-row .label {
    flex: 1;
  }
  .init-input {
    width: 3.5rem;
    box-sizing: border-box;
    padding: 0.2rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
  }
  .current-label {
    font-weight: 600;
    margin: 0 0 0.5rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  button {
    margin-top: 0;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
