<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DEFAULT_ENCOUNTER,
    publishRoll,
    isDieField,
    type CampaignStore,
    type Encounter,
    type ProfileTemplateField,
    type RollConvention,
    type ProfileValue,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';

  /**
   * The encounter status strip — what used to be the hardcoded Difficulty /
   * Danger / danger-clock widgets (Encounter Screen Spec §7), now rendered
   * generically from the room's `encounterTemplate`. Difficulty, Danger and
   * Clock are just the three fields `DEFAULT_ENCOUNTER_TEMPLATE` seeds; the
   * referee can relabel, retype, reorder, unpin or delete them and add their
   * own, exactly like a profile field. This component has no per-field-id
   * code — the app still stores and displays without interpreting (§2.5).
   *
   * Two placements, mirroring `TurnStrip`:
   *  - `rail` — the compact strip in the top status bar, showing the *pinned*
   *    fields. Editable in place by the referee so tension can be adjusted
   *    mid-play without opening a modal; strictly read-only for players.
   *  - `panel` — Session settings ▸ Encounter profile, showing *every* field
   *    (pinned or not). The template's shape is configured there, next to it.
   *
   * Values live on the room's single `encounter` doc (`Encounter.values`).
   * Rooms that set the pre-template widgets still show them: a field whose
   * value is unset falls back to the legacy `difficultyDie`/`dangerDie` slots
   * for the three seeded ids, so no live session loses its state on upgrade.
   * The first write moves that field onto `values` for good.
   */
  let {
    roomId,
    encounter,
    isGM,
    variant = 'panel',
    encounterFields = [],
    myUid = '',
    conventions = [],
  }: {
    roomId: string;
    encounter: Encounter | null;
    isGM: boolean;
    variant?: 'panel' | 'rail';
    /** The pressing seat — every seat may roll a tension die. */
    myUid?: string;
    conventions?: RollConvention[];
    encounterFields?: ProfileTemplateField[];
  } = $props();

  /** The referee edits in both placements; players only ever read. */
  const editable = $derived(isGM);
  /** The rail keeps the canonical testids (it is the one everyone sees); the
   * Session-settings editor prefixes its own so both can be on screen at once
   * without a locator matching two elements. */
  const tid = $derived(variant === 'rail' ? '' : 'encounter-');

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let rolling = $state(false);
  /** Roll a tension die. Labelled with the field so the log says which one. */
  async function rollField(field: ProfileTemplateField): Promise<void> {
    const die = String(rawValue(field) ?? '').trim();
    if (rolling || !die || !myUid) return;
    rolling = true;
    try {
      await publishRoll(
        store,
        roomId,
        myUid,
        { exprs: [die], mode: 'separate', label: field.label },
        conventions,
      );
    } finally {
      rolling = false;
    }
  }

  /** Offered for `roll` fields — a die expression is still free text on the
   * doc; this is only a convenience list, not a constraint. */
  const DIE_OPTIONS = ['', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20'];

  /** The rail shows the pinned subset; settings shows everything. */
  const fields = $derived(
    variant === 'rail' ? encounterFields.filter((f) => f.pinned) : encounterFields,
  );

  /**
   * Pre-template rooms kept these three values in dedicated slots. Read-only
   * fallback, consulted only while `values[id]` is unset.
   */
  function legacyValue(fieldId: string): ProfileValue | undefined {
    if (fieldId === 'difficulty') return encounter?.difficultyDie;
    if (fieldId === 'danger') return encounter?.dangerDie?.value;
    if (fieldId === 'clock') return encounter?.dangerDie?.clock?.filled;
    return undefined;
  }

  function rawValue(field: ProfileTemplateField): ProfileValue | undefined {
    return encounter?.values?.[field.id] ?? legacyValue(field.id) ?? field.default;
  }

  /** Display text. Booleans read as yes/no; everything else is echoed. */
  function displayValue(field: ProfileTemplateField): string {
    const raw = rawValue(field);
    if (raw === undefined || raw === '') return '—';
    if (typeof raw === 'boolean') return raw ? 'yes' : 'no';
    if (field.type === 'counter' && field.max) return `${raw}/${field.max}`;
    return String(raw);
  }

  function counterValue(field: ProfileTemplateField): number {
    const raw = rawValue(field);
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async function setValue(fieldId: string, value: ProfileValue): Promise<void> {
    const base = encounter ?? DEFAULT_ENCOUNTER;
    await store.writeEncounter(roomId, {
      ...base,
      values: { ...(base.values ?? {}), [fieldId]: value },
    });
  }

  /** Step a counter, clamped to `[0, max]` when the referee set a `max` — the
   * same bound the danger clock's segment count always applied. */
  function step(field: ProfileTemplateField, delta: number): void {
    const next = counterValue(field) + delta;
    const clamped = Math.max(0, field.max ? Math.min(field.max, next) : next);
    void setValue(field.id, clamped);
  }

  function onInput(field: ProfileTemplateField, e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (field.type === 'checkbox') {
      void setValue(field.id, (el as HTMLInputElement).checked);
      return;
    }
    if (field.type === 'number' || field.type === 'counter') {
      const n = Number(el.value);
      void setValue(field.id, el.value.trim() === '' || Number.isNaN(n) ? '' : n);
      return;
    }
    void setValue(field.id, el.value);
  }
</script>

<div class="tension-bar" class:rail={variant === 'rail'} data-testid={`${tid}tension-bar`}>
  {#each fields as field (field.id)}
    <div class="widget" data-testid={`${tid}field-${field.id}`}>
      <span class="label">{field.label}</span>

      {#if field.type === 'counter'}
        {#if field.max}
          <span class="pips">
            {#each Array(field.max) as _, i (i)}
              <span class="pip" class:filled={i < counterValue(field)}></span>
            {/each}
          </span>
        {/if}
        <span class="value" data-testid={`${tid}field-value-${field.id}`}>
          {displayValue(field)}
        </span>
        {#if editable}
          <div class="controls">
            <button data-testid={`${tid}field-up-${field.id}`} onclick={() => step(field, 1)}
              >▲</button
            >
            <button data-testid={`${tid}field-down-${field.id}`} onclick={() => step(field, -1)}
              >▼</button
            >
          </div>
        {/if}
      {:else if field.type === 'checkbox'}
        <span class="value" data-testid={`${tid}field-value-${field.id}`}>
          {displayValue(field)}
        </span>
        {#if editable}
          <input
            type="checkbox"
            data-testid={`${tid}field-input-${field.id}`}
            checked={rawValue(field) === true}
            onchange={(e) => onInput(field, e)}
          />
        {/if}
      {:else if isDieField(field.type)}
        <!-- The die indicator is a button *any* seat may press to roll it —
        tension dice are the table's, not just the referee's. Changing which
        die it is stays GM-only (the select below). -->
        <button
          class="value die-roll"
          data-testid={`${tid}field-roll-${field.id}`}
          disabled={rolling || !myUid || !String(rawValue(field) ?? '').trim()}
          title={`Roll ${displayValue(field)}`}
          onclick={() => void rollField(field)}
        >
          <span data-testid={`${tid}field-value-${field.id}`}>{displayValue(field)}</span>
        </button>
        {#if editable}
          <select
            data-testid={`${tid}field-input-${field.id}`}
            value={String(rawValue(field) ?? '')}
            onchange={(e) => onInput(field, e)}
          >
            {#each DIE_OPTIONS as die (die)}
              <option value={die}>{die || 'none'}</option>
            {/each}
            <!-- A referee-typed expression the list doesn't carry stays
            selectable rather than being silently rewritten. -->
            {#if rawValue(field) && !DIE_OPTIONS.includes(String(rawValue(field)))}
              <option value={String(rawValue(field))}>{rawValue(field)}</option>
            {/if}
          </select>
        {/if}
      {:else}
        <span class="value" data-testid={`${tid}field-value-${field.id}`}>
          {displayValue(field)}
        </span>
        {#if editable}
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            data-testid={`${tid}field-input-${field.id}`}
            value={rawValue(field) ?? ''}
            onchange={(e) => onInput(field, e)}
          />
        {/if}
      {/if}
    </div>
  {/each}

  {#if fields.length === 0 && variant === 'panel'}
    <p class="empty">No encounter fields yet — add one above.</p>
  {/if}
</div>

<style>
  .die-roll {
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0.05rem 0.35rem;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .die-roll:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .die-roll:disabled {
    cursor: default;
  }

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
  .tension-bar.rail input,
  .tension-bar.rail select {
    font-size: 0.68rem;
    padding: 0.05rem 0.2rem;
    max-width: 6rem;
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
  .empty {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.7;
  }
  select,
  input,
  button {
    background: var(--bg-inset);
    color: inherit;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
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
  .controls {
    display: flex;
    gap: 0.2rem;
    flex-wrap: wrap;
  }
</style>
