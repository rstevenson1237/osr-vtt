<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, ProfileInstance, ProfileTemplateField } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { buildProfileRows } from '../profile/profile-view';
  import { diceTray } from '../dice/staged-store';

  let {
    template,
    profile,
    seatId,
    roomId,
    readOnly = false,
  }: {
    template: ProfileTemplateField[];
    profile: ProfileInstance | undefined;
    seatId: string;
    roomId: string;
    /** Viewing another actor's card (Encounter Screen Spec §5) — fields
     * still render, but only the owning seat or the GM may edit them
     * (Security Rules already enforce this server-side; this just avoids
     * a doomed write attempt in the UI). */
    readOnly?: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const rows = $derived(buildProfileRows(template, profile));

  function setValue(fieldId: string, value: string | number | boolean): void {
    if (!seatId || readOnly) return;
    void store.setProfileValue(roomId, seatId, fieldId, value);
  }

  function stageRoll(die: string): void {
    diceTray.stage(String(die));
  }
</script>

<!--
  Renders ANY profileTemplate generically (Plan §2.5) — this component has
  no per-field-id logic and never inspects a value for game meaning. Only
  the field's declared `type` decides which control renders.
-->
<div class="dock" data-testid="character-dock">
  <h2>Character</h2>
  {#each rows as row (row.field.id)}
    <div class="field" data-testid={`profile-field-${row.field.id}`}>
      <label for={`field-${row.field.id}`}>{row.field.label}</label>

      {#if row.field.type === 'text'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="text"
          value={row.value}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, e.currentTarget.value)}
        />
      {:else if row.field.type === 'longtext'}
        <textarea
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          value={String(row.value)}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, e.currentTarget.value)}
        ></textarea>
      {:else if row.field.type === 'number'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="number"
          value={row.value}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, Number(e.currentTarget.value))}
        />
      {:else if row.field.type === 'counter'}
        <div class="counter">
          <button
            data-testid={`profile-counter-dec-${row.field.id}`}
            disabled={readOnly}
            onclick={() => setValue(row.field.id, Number(row.value) - 1)}>−</button
          >
          <span data-testid={`profile-counter-value-${row.field.id}`}>{row.value}</span>
          <button
            data-testid={`profile-counter-inc-${row.field.id}`}
            disabled={readOnly}
            onclick={() => setValue(row.field.id, Number(row.value) + 1)}>+</button
          >
        </div>
      {:else if row.field.type === 'checkbox'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="checkbox"
          checked={Boolean(row.value)}
          disabled={readOnly}
          onchange={(e) => setValue(row.field.id, e.currentTarget.checked)}
        />
      {:else if row.field.type === 'roll'}
        <button
          class="roll-chip"
          data-testid={`profile-roll-${row.field.id}`}
          onclick={() => stageRoll(String(row.value))}
        >
          🎲 {row.value}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .dock {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .dock h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .field {
    margin-bottom: 0.6rem;
  }
  .field label {
    display: block;
    font-size: 0.75rem;
    opacity: 0.75;
    margin-bottom: 0.2rem;
  }
  .field input[type='text'],
  .field input[type='number'],
  .field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.4rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .counter button {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
    cursor: pointer;
  }
  .roll-chip {
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    border: 1px solid #a6763f;
    background: #362d20;
    color: inherit;
    cursor: pointer;
  }
</style>
