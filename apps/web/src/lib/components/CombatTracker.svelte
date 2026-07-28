<script lang="ts">
  import { getContext } from 'svelte';
  import {
    advanceTurn,
    applySharedRollToInitiative,
    buildOrder,
    DEFAULT_ENCOUNTER,
    describeSharedRoll,
    previousTurn,
    removeRefFromEncounter,
    initiativeActors,
    initiativeSlotId,
    publishRoll,
    setInit,
    sortOrder,
    syncOrder,
    toggleActed,
    type CampaignStore,
    type Encounter,
    type EncounterMode,
    type Group,
    type ProfileInstance,
    type ProfileTemplateField,
    type PlayerSeat,
    type Roll,
    type RollConvention,
    type SharedRoll,
    type Token,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { refLabel } from '../encounter/labels';
  import SharedRollReadiness from './SharedRollReadiness.svelte';

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
    myUid = '',
    players = [],
    rolls = [],
    conventions = [],
    initiativeDie = 'd6',
    initiativeMode = 'side',
    profileTemplate = [],
    profiles = [],
    encounterTemplate = [],
  }: {
    roomId: string;
    groups: Group[];
    encounter: Encounter | null;
    tokens: Token[];
    isGM: boolean;
    myUid?: string;
    players?: PlayerSeat[];
    rolls?: Roll[];
    conventions?: RollConvention[];
    initiativeDie?: string;
    initiativeMode?: EncounterMode;
    profileTemplate?: ProfileTemplateField[];
    profiles?: ProfileInstance[];
    encounterTemplate?: ProfileTemplateField[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  // The configured mode lives in Session settings now (the revamp §1); the
  // tracker's own radios are gone — they rendered for players who could never
  // commit them. A *running* encounter keeps the mode it started with, so
  // changing the setting mid-fight doesn't reshape a live order.
  const selectedMode = $derived<EncounterMode>(encounter?.mode ?? initiativeMode);

  let sharedRoll = $state<SharedRoll | null>(null);
  $effect(() => store.subscribeSharedRoll(roomId, (sr) => (sharedRoll = sr)));

  /** An initiative call is open and still taking dice. */
  const callOpen = $derived(sharedRoll?.kind === 'initiative' && sharedRoll.status === 'staging');

  /** Everyone who should be in the current call, and the die each stages. */
  const actors = $derived(
    initiativeActors({
      mode: initiativeMode,
      groups,
      tokens,
      gmUid: myUid,
      defaultDie: initiativeDie,
      profileTemplate,
      profiles,
      encounterTemplate,
      encounterValues: encounter?.values,
    }),
  );

  /** The next Advance will wrap into a new round (Workflow 2 step 6). */
  const atLastEntry = $derived(
    encounter !== null &&
      encounter.order.length > 0 &&
      encounter.currentIndex === encounter.order.length - 1,
  );

  const readyCount = $derived(
    Object.values(sharedRoll?.slots ?? {}).filter((slot) => slot.ready).length,
  );

  const activeGroups = $derived(groups.filter((g) => g.active));
  // Free/Caller mode has no ordered pool (Spec §4) — it's "running" as soon as
  // the GM starts it, driven by the Caller marker + round counter instead.
  const isFree = $derived(encounter?.mode === 'free');
  const isRunning = $derived(
    encounter !== null && (encounter.order.length > 0 || encounter.mode === 'free'),
  );
  const caller = $derived(players.find((p) => p.seatId === encounter?.callerSeatId) ?? null);
  const currentEntry = $derived(
    encounter && encounter.order.length > 0
      ? (encounter.order[encounter.currentIndex] ?? null)
      : null,
  );

  /** The refIds that *should* be in the pool right now for the relevant
   * mode (the running encounter's mode once started, otherwise the
   * pre-start mode selector). */
  const expectedActiveIds = $derived.by(() => {
    const mode = selectedMode;
    if (mode === 'individual') {
      const ids = new Set<string>();
      for (const g of activeGroups) for (const id of g.memberTokenIds) ids.add(id);
      return [...ids];
    }
    return activeGroups.map((g) => g.id);
  });

  /** Every ref that still exists, so a deleted group/token's row is pruned
   * rather than lingering forever — `deleteGroup`/`deleteToken` never touch
   * the encounter doc. */
  const liveIds = $derived(
    new Set(selectedMode === 'individual' ? tokens.map((t) => t.id) : groups.map((g) => g.id)),
  );

  // Reconciliation writes the encounter doc, which `writeEncounter` sets
  // wholesale (no merge). Without this guard the effect could re-fire on its
  // own echo and race a manual edit made in between.
  let reconciling = false;

  // GM-only live reconciliation: a group's [Active] toggle flipping mid-fight
  // adds/removes its row without disturbing anyone else's init/acted state.
  $effect(() => {
    if (!isGM || !encounter || encounter.order.length === 0 || reconciling) return;
    const refType = encounter.mode === 'individual' ? 'actor' : 'side';
    // Refs the referee added directly stay in, even though no `[Active]`
    // group put them there — that's what lets an ungrouped token be in a fight.
    const pinned = encounter.pinnedRefIds ?? [];
    const wanted = [...new Set([...expectedActiveIds, ...pinned])];
    const synced = syncOrder(encounter.order, refType, wanted, liveIds);
    if (JSON.stringify(synced) === JSON.stringify(encounter.order)) return;
    const currentIndex = Math.min(encounter.currentIndex, Math.max(synced.length - 1, 0));
    reconciling = true;
    void store
      .writeEncounter(roomId, { ...encounter, order: synced, currentIndex })
      .finally(() => (reconciling = false));
  });

  async function removeRef(refId: string): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, removeRefFromEncounter(encounter, refId));
  }

  async function setCaller(seatId: string): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, { ...encounter, callerSeatId: seatId || undefined });
  }

  function rotateCaller(): void {
    if (!encounter || players.length === 0) return;
    const seats = players.map((p) => p.seatId);
    const idx = encounter.callerSeatId ? seats.indexOf(encounter.callerSeatId) : -1;
    void setCaller(seats[(idx + 1) % seats.length]!);
  }

  async function bumpRound(delta: number): Promise<void> {
    if (!encounter) return;
    await store.writeEncounter(roomId, {
      ...encounter,
      round: Math.max(1, encounter.round + delta),
    });
  }

  async function endCombat(): Promise<void> {
    if (!encounter) return;
    // Reset to a clean, non-running state (mode `side`, no order, no caller)
    // while preserving the tension widgets that share this doc. `undefined`
    // callerSeatId is stripped by the encounter converter.
    await store.writeEncounter(roomId, {
      ...encounter,
      mode: 'side',
      round: 1,
      order: [],
      currentIndex: 0,
      callerSeatId: undefined,
    });
  }

  async function sort(): Promise<void> {
    if (!encounter) return;
    // Arrange highest-first and begin at the top. The diagnostic flagged the
    // `currentIndex: 0` as "a mid-round sort silently rewinds the turn", and a
    // turn-preserving variant was tried — but Sort is specified (and gate-
    // tested) as "arrange by initiative, highest is up", which is also its
    // dominant use: press it right after the numbers land. A button that
    // sometimes moves the marker and sometimes doesn't is worse than one that
    // always does the same thing.
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
      order: setInit(
        encounter.order,
        refId,
        value,
        encounter.mode === 'individual' ? 'actor' : 'side',
      ),
    });
  }

  /**
   * Roll initiative for one row.
   *
   * This used to call `rollInitiative(6)` — a bare `Math.random()` that
   * produced no seed, no `Roll` doc, no log entry, no dice animation and no
   * broadcast, so the players never saw the most important roll of the fight;
   * a number simply appeared in the tracker. It now goes through the same
   * `publishRoll` pipeline as every other roll (so it tumbles on every
   * client and lands in the log), and only *then* is the resulting face
   * routed into the row. Routing a result, never deriving one (Spec §4).
   */
  async function rollFor(refId: string): Promise<void> {
    const roll = await publishRoll(
      store,
      roomId,
      myUid,
      { exprs: [initiativeDie], mode: 'separate', label: 'Initiative' },
      conventions,
    );
    const face = roll?.dice[0]?.kept;
    if (face !== undefined) await setInitValue(refId, face);
  }

  function actedToggle(refId: string): void {
    if (!encounter) return;
    void store.writeEncounter(roomId, {
      ...encounter,
      order: toggleActed(
        encounter.order,
        refId,
        encounter.mode === 'individual' ? 'actor' : 'side',
      ),
    });
  }

  // ---- Call for Initiative (the revamp §4) -------------------------------
  // The whole staged flow is the existing shared-roll machinery with a
  // different skin: open a staging round, players load dice for the actors
  // they own, one press resolves them all simultaneously on every client.

  let calling = $state(false);
  /**
   * Open a staged initiative round.
   *
   * Also (re)builds the order from the current `[Active]` set and advances the
   * round if a fight is already running — pressing this again mid-fight is
   * Workflow 2's "advance the Round number and redo the rolls".
   *
   * Every active group/token with no assigned player is staged here, by the
   * referee's own client, with its configured die: nobody else is going to,
   * and a row nobody staged for would be silently skipped at resolution.
   */
  async function callForInitiative(): Promise<void> {
    if (calling || !isGM) return;
    calling = true;
    try {
      const refType = initiativeMode === 'individual' ? 'actor' : 'side';
      const running = encounter && encounter.order.length > 0;
      await store.writeEncounter(roomId, {
        ...(encounter ?? DEFAULT_ENCOUNTER),
        mode: initiativeMode,
        round: running ? encounter!.round + 1 : 1,
        order: buildOrder(
          refType,
          actors.map((a) => a.refId),
        ),
        currentIndex: 0,
      });

      await store.openSharedRoll(roomId, {
        openedBy: myUid,
        label: 'Initiative',
        kind: 'initiative',
      });
      for (const actor of actors) {
        if (actor.ownerUid !== undefined) continue;
        await store.stageSharedSlot(roomId, initiativeSlotId(initiativeMode, actor), {
          die: actor.die,
          modifier: 0,
          advantage: 'normal',
          ready: true,
        });
      }
    } finally {
      calling = false;
    }
  }

  let rollingInit = $state(false);
  /**
   * Resolve the call: one seeded composite `Roll`, animated simultaneously on
   * every client, then routed straight onto the tracker rows.
   *
   * Applying is automatic here rather than the explicit tap R3.6.5 specifies
   * — an initiative call exists *only* to fill these rows, so the extra tap
   * was pure ceremony. Any other shared roll keeps the explicit Apply button
   * in `SharedRollReadiness`.
   */
  async function rollForInitiative(): Promise<void> {
    if (rollingInit || !isGM || !encounter) return;
    rollingInit = true;
    try {
      const roll = await store.resolveSharedRoll(roomId, myUid);
      await store.writeLog(roomId, {
        ts: Date.now(),
        authorUid: myUid,
        type: 'roll',
        text: describeSharedRoll(roll, players, conventions),
        rollId: roll.id,
      });

      const ownerSeatByTokenId = Object.fromEntries(tokens.map((t) => [t.id, t.ownerSeatId]));
      const applied = applySharedRollToInitiative(
        encounter.order,
        roll.parts ?? [],
        ownerSeatByTokenId,
      );
      // Sort, and start at the *top* — "high die roll is updated as current
      // party" (Workflow 2) — same arrangement the Sort button applies.
      await store.writeEncounter(roomId, {
        ...encounter,
        order: sortOrder(applied),
        currentIndex: 0,
      });
    } finally {
      rollingInit = false;
    }
  }
</script>

<div class="combat-tracker" data-testid="combat-tracker">
  <h2>Combat Tracker</h2>

  <SharedRollReadiness
    {roomId}
    {isGM}
    {myUid}
    {players}
    {rolls}
    {encounter}
    {tokens}
    {conventions}
  />

  {#if !isRunning}
    <p class="hint" data-testid="combat-mode-hint">
      {initiativeMode === 'individual' ? 'Individual initiative' : 'Side-based initiative'} — change this
      in Session settings.
    </p>
    {#if expectedActiveIds.length === 0}
      <p class="hint">Toggle a group's [Active] switch to add it to the initiative pool.</p>
    {/if}
    {#if isGM}
      <button
        data-testid="combat-call-initiative"
        onclick={() => void callForInitiative()}
        disabled={calling || expectedActiveIds.length === 0}
      >
        Call for Initiative
      </button>
    {/if}
  {:else if isFree}
    <div class="status-row">
      <span class="mode-label">Free / Caller mode</span>
      <span class="round" data-testid="combat-round">Round {encounter?.round}</span>
    </div>

    <div class="caller-row">
      <span class="caller-label">Caller:</span>
      <span class="caller-name" data-testid="caller-name">{caller?.displayName ?? '—'}</span>
      {#if isGM}
        <select
          data-testid="caller-select"
          value={encounter?.callerSeatId ?? ''}
          onchange={(e) => void setCaller((e.target as HTMLSelectElement).value)}
        >
          <option value="">— none —</option>
          {#each players as p (p.seatId)}
            <option value={p.seatId}>{p.displayName}</option>
          {/each}
        </select>
        <button data-testid="caller-rotate" onclick={rotateCaller}>Rotate ▶</button>
      {/if}
    </div>

    {#if isGM}
      <div class="controls">
        <button data-testid="combat-round-back" onclick={() => void bumpRound(-1)}>◀ Round</button>
        <button data-testid="combat-round-advance" onclick={() => void bumpRound(1)}>Round ▶</button
        >
        <button data-testid="combat-end" onclick={() => void endCombat()}>End scene</button>
      </div>
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
            <button
              data-testid={`combat-roll-${entry.refId}`}
              onclick={() => void rollFor(entry.refId)}>🎲</button
            >
            <button
              data-testid={`combat-acted-${entry.refId}`}
              onclick={() => actedToggle(entry.refId)}
            >
              {entry.acted ? 'Acted' : 'Mark acted'}
            </button>
            <button
              class="remove-row"
              title="Remove from initiative"
              data-testid={`combat-remove-${entry.refId}`}
              onclick={() => void removeRef(entry.refId)}>×</button
            >
          {:else}
            <span class="init-value">{entry.init ?? '—'}</span>
          {/if}
        </li>
      {/each}
    </ul>

    {#if callOpen}
      <p class="staging-note" data-testid="combat-staging-note">
        Waiting on initiative — {readyCount} of {actors.length} ready.
      </p>
    {/if}

    {#if currentEntry}
      <p class="current-label" data-testid="combat-current-label">
        {refLabel(currentEntry, groups, tokens)} is up
      </p>
    {/if}

    {#if isGM}
      <div class="controls">
        {#if callOpen}
          <button
            data-testid="combat-roll-initiative"
            onclick={() => void rollForInitiative()}
            disabled={rollingInit || readyCount === 0}
          >
            Roll for Initiative
          </button>
        {:else}
          <button
            data-testid="combat-call-initiative"
            onclick={() => void callForInitiative()}
            disabled={calling}
          >
            Call for Initiative
          </button>
        {/if}
        <button data-testid="combat-sort" onclick={() => void sort()}>Sort by initiative</button>
        <button data-testid="combat-previous" onclick={() => void previous()}>◀ Previous</button>
        <!-- At the bottom of the order the next press starts a new round, so
        the label says so rather than leaving the referee to infer it. -->
        <button data-testid="combat-advance" onclick={() => void advance()}>
          {atLastEntry ? 'Next Round ▶' : 'Next ▶'}
        </button>
        <button data-testid="combat-end" onclick={() => void endCombat()}>End combat</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .combat-tracker {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .combat-tracker h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .staging-note {
    margin: 0.4rem 0;
    font-size: 0.8rem;
    opacity: 0.8;
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
    border: 1px solid var(--line);
    font-size: 0.85rem;
  }
  .order-row.current {
    border-color: var(--accent);
    background: var(--bg-panel-alt);
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
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
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
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
