<script lang="ts">
  import { getContext } from 'svelte';
  import { DEFAULT_ENCOUNTER, type CampaignStore, type Encounter } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';

  /**
   * Tension widgets (Encounter Screen Spec §7): the global Difficulty Die and
   * Danger Die. GM-controlled, all-readable — shared, mounting tension everyone
   * sees. The app only *displays* the values; it encodes no rule (a smaller
   * difficulty die being "more dangerous" is the referee's convention, not the
   * app's). State lives on the room's single `encounter` doc.
   */
  let {
    roomId,
    encounter,
    isGM,
  }: {
    roomId: string;
    encounter: Encounter | null;
    isGM: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const DIE_OPTIONS = ['', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20'];
  const CLOCK_SIZES = [4, 6, 8];

  const difficultyDie = $derived(encounter?.difficultyDie ?? '');
  const dangerValue = $derived(encounter?.dangerDie?.value ?? '');
  const clock = $derived(encounter?.dangerDie?.clock ?? null);

  /** Writes a patch onto the encounter doc, creating a default one if the room
   * hasn't started any encounter yet (the widgets stand alone — Spec §2). */
  async function patchEncounter(patch: Partial<Encounter>): Promise<void> {
    const base = encounter ?? DEFAULT_ENCOUNTER;
    await store.writeEncounter(roomId, { ...base, ...patch });
  }

  function setDifficulty(value: string): void {
    void patchEncounter({ difficultyDie: value || undefined });
  }

  function setDangerValue(value: string): void {
    const existingClock = encounter?.dangerDie?.clock;
    void patchEncounter({
      dangerDie: { ...(value ? { value } : {}), ...(existingClock ? { clock: existingClock } : {}) },
    });
  }

  function setClockSize(size: number): void {
    const value = encounter?.dangerDie?.value;
    void patchEncounter({
      dangerDie: { ...(value ? { value } : {}), clock: { filled: 0, size } },
    });
  }

  function advanceClock(delta: number): void {
    if (!clock) return;
    const filled = Math.max(0, Math.min(clock.size, clock.filled + delta));
    const value = encounter?.dangerDie?.value;
    void patchEncounter({ dangerDie: { ...(value ? { value } : {}), clock: { ...clock, filled } } });
  }
</script>

<div class="tension-bar" data-testid="tension-bar">
  <div class="widget" data-testid="difficulty-widget">
    <span class="label">Difficulty</span>
    <span class="value" data-testid="difficulty-die-value">{difficultyDie || '—'}</span>
    {#if isGM}
      <select
        data-testid="difficulty-die-select"
        value={difficultyDie}
        onchange={(e) => setDifficulty((e.target as HTMLSelectElement).value)}
      >
        {#each DIE_OPTIONS as die (die)}
          <option value={die}>{die || 'none'}</option>
        {/each}
      </select>
    {/if}
  </div>

  <div class="widget" data-testid="danger-widget">
    <span class="label">Danger</span>
    <span class="value" data-testid="danger-die-value">{dangerValue || '—'}</span>
    {#if isGM}
      <select
        data-testid="danger-die-select"
        value={dangerValue}
        onchange={(e) => setDangerValue((e.target as HTMLSelectElement).value)}
      >
        {#each DIE_OPTIONS as die (die)}
          <option value={die}>{die || 'none'}</option>
        {/each}
      </select>
    {/if}

    <div class="clock" data-testid="danger-clock">
      {#if clock}
        <span class="pips">
          {#each Array(clock.size) as _, i (i)}
            <span class="pip" class:filled={i < clock.filled}></span>
          {/each}
        </span>
        <span class="clock-count" data-testid="danger-clock-count"
          >{clock.filled}/{clock.size}</span
        >
      {:else}
        <span class="clock-count" data-testid="danger-clock-count">no clock</span>
      {/if}
      {#if isGM}
        <div class="clock-controls">
          {#if clock}
            <button data-testid="danger-clock-advance" onclick={() => advanceClock(1)}>▲</button>
            <button data-testid="danger-clock-back" onclick={() => advanceClock(-1)}>▼</button>
          {/if}
          {#each CLOCK_SIZES as size (size)}
            <button data-testid={`danger-clock-size-${size}`} onclick={() => setClockSize(size)}>
              {size}-seg
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .tension-bar {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: #2a1f18;
    border: 1px solid #4a2f26;
    border-radius: 8px;
  }
  .widget {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .value {
    font-size: 1.1rem;
    font-weight: 700;
    min-width: 2.2rem;
    text-align: center;
    color: #f2c98a;
  }
  select,
  button {
    background: #14110d;
    color: inherit;
    border: 1px solid #4a4030;
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .clock {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .pips {
    display: inline-flex;
    gap: 2px;
  }
  .pip {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid #a6763f;
    background: transparent;
  }
  .pip.filled {
    background: #c8532f;
  }
  .clock-count {
    font-size: 0.75rem;
    opacity: 0.85;
  }
  .clock-controls {
    display: flex;
    gap: 0.2rem;
    flex-wrap: wrap;
  }
</style>
