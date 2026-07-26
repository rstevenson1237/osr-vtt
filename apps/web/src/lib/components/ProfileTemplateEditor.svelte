<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, ProfileFieldType, ProfileTemplateField } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import {
    addField,
    coerceDefault,
    moveField,
    removeField,
    togglePinned,
  } from '../profile/template-editor';

  /**
   * GM-only editor for one of the room's field templates (Plan §2.5). Every
   * change here is a plain write to the room doc's template array — the Dock
   * (CharacterDock.svelte) re-renders generically from whatever comes back,
   * with no per-field-id code on either side.
   *
   * `target` picks which template is edited: the per-seat `profileTemplate`
   * or the room's `encounterTemplate`. Both are `ProfileTemplateField[]` and
   * share this editor and its field-type list on purpose — one vocabulary for
   * both, so a referee configures an encounter exactly like a character. Only
   * the store method and the testid prefix differ, so each instance's
   * controls stay individually addressable.
   */
  let {
    roomId,
    template,
    target = 'profile',
    title = 'Profile Template',
    pinHint = 'actor card',
  }: {
    roomId: string;
    template: ProfileTemplateField[];
    target?: 'profile' | 'encounter';
    title?: string;
    pinHint?: string;
  } = $props();

  /** Testid prefix — the profile editor keeps the original unprefixed ids. */
  const tid = $derived(target === 'profile' ? '' : `${target}-`);

  async function save(next: ProfileTemplateField[]): Promise<void> {
    if (target === 'encounter') await store.updateEncounterTemplate(roomId, next);
    else await store.updateProfileTemplate(roomId, next);
  }

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const FIELD_TYPES: ProfileFieldType[] = [
    'text',
    'longtext',
    'number',
    'counter',
    'checkbox',
    'roll',
  ];

  let newLabel = $state('');
  let newType = $state<ProfileFieldType>('text');
  let newDefault = $state('');
  /** Segment count for a `counter` field (the generalized danger clock).
   * A number, not a string: `bind:value` on a number input coerces for us
   * (and hands back `null` when the box is empty). */
  let newMax = $state<number | null>(null);

  async function add(): Promise<void> {
    const label = newLabel.trim();
    if (!label) return;
    const max = newMax;
    const next = addField(template, {
      label,
      type: newType,
      ...(newDefault.trim() ? { default: coerceDefault(newType, newDefault.trim()) } : {}),
      ...(newType === 'counter' && max !== null && Number.isFinite(max) && max > 0
        ? { max: Math.round(max) }
        : {}),
    });
    await save(next);
    newLabel = '';
    newDefault = '';
    newMax = null;
  }

  async function remove(fieldId: string): Promise<void> {
    await save(removeField(template, fieldId));
  }

  async function move(fieldId: string, direction: -1 | 1): Promise<void> {
    await save(moveField(template, fieldId, direction));
  }

  /** Pin/unpin a field so it renders read-only where that template's pinned
   * fields surface: the Encounter Board actor card for a profile field
   * (Master Plan v2, R8.1), the top status bar for an encounter field. */
  async function pin(fieldId: string): Promise<void> {
    await save(togglePinned(template, fieldId));
  }
</script>

<div class="template-editor" data-testid={`${tid}profile-template-editor`}>
  <h2>{title}</h2>
  <ul class="field-list">
    {#each template as field, index (field.id)}
      <li data-testid={`${tid}template-field-${field.id}`}>
        <span class="label">{field.label}</span>
        <span class="type">{field.type}{field.max ? ` · ${field.max}` : ''}</span>
        <button
          class="pin"
          class:active={field.pinned}
          data-testid={`${tid}template-field-pin-${field.id}`}
          title={field.pinned ? `Unpin from ${pinHint}` : `Pin to ${pinHint}`}
          aria-pressed={field.pinned ? 'true' : 'false'}
          onclick={() => void pin(field.id)}>📌</button
        >
        <button
          data-testid={`${tid}template-field-up-${field.id}`}
          disabled={index === 0}
          onclick={() => void move(field.id, -1)}>↑</button
        >
        <button
          data-testid={`${tid}template-field-down-${field.id}`}
          disabled={index === template.length - 1}
          onclick={() => void move(field.id, 1)}>↓</button
        >
        <button
          class="delete"
          data-testid={`${tid}template-field-remove-${field.id}`}
          onclick={() => void remove(field.id)}>✕</button
        >
      </li>
    {/each}
    {#if template.length === 0}
      <li class="empty">No fields yet.</li>
    {/if}
  </ul>

  <div class="add-field">
    <input
      data-testid={`${tid}template-new-label`}
      placeholder="Field label"
      bind:value={newLabel}
    />
    <select data-testid={`${tid}template-new-type`} bind:value={newType}>
      {#each FIELD_TYPES as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <input
      data-testid={`${tid}template-new-default`}
      placeholder="Default (optional)"
      bind:value={newDefault}
    />
    {#if newType === 'counter'}
      <input
        type="number"
        min="1"
        class="max"
        data-testid={`${tid}template-new-max`}
        placeholder="Segments"
        bind:value={newMax}
      />
    {/if}
    <button
      data-testid={`${tid}template-add-field`}
      onclick={() => void add()}
      disabled={!newLabel.trim()}>Add field</button
    >
  </div>
</div>

<style>
  .template-editor {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .template-editor h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .add-field .max {
    max-width: 7rem;
  }
  .field-list {
    list-style: none;
    margin: 0 0 0.6rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .field-list .empty {
    opacity: 0.6;
  }
  .label {
    flex: 1;
    font-weight: 600;
  }
  .type {
    opacity: 0.7;
    font-size: 0.7rem;
  }
  button {
    padding: 0.15rem 0.4rem;
    font-size: 0.75rem;
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
  .delete {
    color: var(--error);
  }
  .pin {
    opacity: 0.4;
    filter: grayscale(1);
  }
  .pin.active {
    opacity: 1;
    filter: none;
    border-color: var(--accent);
    background: var(--bg-panel-alt);
  }
  .add-field {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .add-field input,
  .add-field select {
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  .add-field input {
    flex: 1;
    min-width: 6rem;
    box-sizing: border-box;
  }
</style>
