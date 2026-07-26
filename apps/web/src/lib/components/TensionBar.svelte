<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DEFAULT_ENCOUNTER,
    type CampaignStore,
    type Encounter,
    type ProfileTemplateField,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';

  /**
   * Tension widgets (Encounter Screen Spec §7): the global Difficulty Die and
   * Danger Die. GM-controlled, all-readable — shared, mounting tension everyone
   * sees. The app only *displays* the values; it encodes no rule (a smaller
   * difficulty die being "more dangerous" is the referee's convention, not the
   * app's). State lives on the room's single `encounter` doc.
   *
   * Two placements, mirroring `TurnStrip`:
   *  - `rail` — the compact, strictly read-only strip in the top status bar,
   *    next to the account controls. Referee and players see the identical
   *    thing; no control renders here for anyone, so shared tension is
   *    visible on every stage without being editable by accident.
   *  - `panel` — the editor, which lives in Session settings (GM-only) and is
   *    where the referee actually sets these.
   *
   * `encounterFields` are the room's `encounterTemplate` fields; the pinned
   * ones render as read-only `label: value` chips beside the dice, the same
   * way a profile's pinned fields surface on an actor card. Values are echoed
   * verbatim — the app never interprets them (§2.5 hard rule).
   */
  let {
    roomId,
    encounter,
    isGM,
    variant = 'panel',
    encounterFields = [],
  }: {
    roomId: string;
    encounter: Encounter | null;
    isGM: boolean;
    variant?: 'panel' | 'rail';
    encounterFields?: ProfileTemplateField[];
  } = $props();

  /** No control renders in the rail — it is a read-only mirror for everyone. */
  const editable = $derived(isGM && variant === 'panel');
  /** The rail keeps the canonical testids (it is the one everyone sees); the
   * Session-settings editor prefixes its own so both can be on screen at once
   * without a locator matching two elements. */
  const tid = $derived(variant === 'rail' ? '' : 'encounter-');

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const DIE_OPTIONS = ['', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20'];
  const CLOCK_SIZES = [4, 6, 8];

  const difficultyDie = $derived(encounter?.difficultyDie ?? '');
  const dangerValue = $derived(encounter?.dangerDie?.value ?? '');
  const clock = $derived(encounter?.dangerDie?.clock ?? null);
  const pinnedFields = $derived(encounterFields.filter((f) => f.pinned));

  /** Display text for an encounter field value. Purely presentational —
   * booleans read as yes/no, everything else is echoed as typed. */
  function displayValue(field: ProfileTemplateField): string {
    const raw = encounter?.values?.[field.id] ?? field.default;
    if (raw === undefined || raw === '') return '—';
    if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
    return String(raw);
  }

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
      dangerDie: {
        ...(value ? { value } : {}),
        ...(existingClock ? { clock: existingClock } : {}),
      },
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
    void patchEncounter({
      dangerDie: { ...(value ? { value } : {}), clock: { ...clock, filled } },
    });
  }
</script>

<div class="tension-bar" class:rail={variant === 'rail'} data-testid={`${tid}tension-bar`}>
  <div class="widget" data-testid={`${tid}difficulty-widget`}>
    <span class="label">Difficulty</span>
    <span class="value" data-testid={`${tid}difficulty-die-value`}>{difficultyDie || '—'}</span>
    {#if editable}
      <select
        data-testid={`${tid}difficulty-die-select`}
        value={difficultyDie}
        onchange={(e) => setDifficulty((e.target as HTMLSelectElement).value)}
      >
        {#each DIE_OPTIONS as die (die)}
          <option value={die}>{die || 'none'}</option>
        {/each}
      </select>
    {/if}
  </div>

  <div class="widget" data-testid={`${tid}danger-widget`}>
    <span class="label">Danger</span>
    <span class="value" data-testid={`${tid}danger-die-value`}>{dangerValue || '—'}</span>
    {#if editable}
      <select
        data-testid={`${tid}danger-die-select`}
        value={dangerValue}
        onchange={(e) => setDangerValue((e.target as HTMLSelectElement).value)}
      >
        {#each DIE_OPTIONS as die (die)}
          <option value={die}>{die || 'none'}</option>
        {/each}
      </select>
    {/if}

    <div class="clock" data-testid={`${tid}danger-clock`}>
      {#if clock}
        <span class="pips">
          {#each Array(clock.size) as _, i (i)}
            <span class="pip" class:filled={i < clock.filled}></span>
          {/each}
        </span>
        <span class="clock-count" data-testid={`${tid}danger-clock-count`}
          >{clock.filled}/{clock.size}</span
        >
      {:else}
        <span class="clock-count" data-testid={`${tid}danger-clock-count`}>no clock</span>
      {/if}
      {#if editable}
        <div class="clock-controls">
          {#if clock}
            <button data-testid={`${tid}danger-clock-advance`} onclick={() => advanceClock(1)}
              >▲</button
            >
            <button data-testid={`${tid}danger-clock-back`} onclick={() => advanceClock(-1)}
              >▼</button
            >
          {/if}
          {#each CLOCK_SIZES as size (size)}
            <button
              data-testid={`${tid}danger-clock-size-${size}`}
              onclick={() => setClockSize(size)}
            >
              {size}-seg
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#each pinnedFields as field (field.id)}
    <div class="widget" data-testid={`${tid}field-${field.id}`}>
      <span class="label">{field.label}</span>
      <span class="value" data-testid={`${tid}field-value-${field.id}`}>
        {displayValue(field)}
      </span>
    </div>
  {/each}
</div>

<style>
  .tension-bar {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--panel-tension-bg);
    border: 1px solid var(--panel-tension-line);
    border-radius: 8px;
  }
  /* Rail placement: a flat inline strip, not a bordered panel — it sits
     inside the top status bar's own chrome. */
  .tension-bar.rail {
    gap: 0.75rem;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    flex-wrap: nowrap;
    font-size: 0.72rem;
  }
  .tension-bar.rail .label {
    font-size: 0.62rem;
  }
  .tension-bar.rail .value {
    font-size: 0.8rem;
    min-width: 0;
  }
  .tension-bar.rail .pip {
    width: 7px;
    height: 7px;
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
    color: var(--accent-text);
  }
  select,
  button {
    background: var(--bg-inset);
    color: inherit;
    border: 1px solid var(--line-strong);
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
    border: 1px solid var(--accent);
    background: transparent;
  }
  .pip.filled {
    background: var(--danger);
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
