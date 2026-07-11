<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, ProfileFieldType, ProfileTemplateField } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { addField, coerceDefault, moveField, removeField } from '../profile/template-editor';

  /**
   * GM-only editor for the room's `profileTemplate` (Plan §2.5). Every
   * change here is a plain write to the room doc's `profileTemplate` array
   * — the Dock (CharacterDock.svelte) re-renders generically from whatever
   * comes back, with no per-field-id code on either side.
   */
  let { roomId, template }: { roomId: string; template: ProfileTemplateField[] } = $props();

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

  async function add(): Promise<void> {
    const label = newLabel.trim();
    if (!label) return;
    const next = addField(template, {
      label,
      type: newType,
      ...(newDefault.trim() ? { default: coerceDefault(newType, newDefault.trim()) } : {}),
    });
    await store.updateProfileTemplate(roomId, next);
    newLabel = '';
    newDefault = '';
  }

  async function remove(fieldId: string): Promise<void> {
    await store.updateProfileTemplate(roomId, removeField(template, fieldId));
  }

  async function move(fieldId: string, direction: -1 | 1): Promise<void> {
    await store.updateProfileTemplate(roomId, moveField(template, fieldId, direction));
  }
</script>

<div class="template-editor" data-testid="profile-template-editor">
  <h2>Profile Template</h2>
  <ul class="field-list">
    {#each template as field, index (field.id)}
      <li data-testid={`template-field-${field.id}`}>
        <span class="label">{field.label}</span>
        <span class="type">{field.type}</span>
        <button
          data-testid={`template-field-up-${field.id}`}
          disabled={index === 0}
          onclick={() => void move(field.id, -1)}>↑</button
        >
        <button
          data-testid={`template-field-down-${field.id}`}
          disabled={index === template.length - 1}
          onclick={() => void move(field.id, 1)}>↓</button
        >
        <button
          class="delete"
          data-testid={`template-field-remove-${field.id}`}
          onclick={() => void remove(field.id)}>✕</button
        >
      </li>
    {/each}
    {#if template.length === 0}
      <li class="empty">No fields yet.</li>
    {/if}
  </ul>

  <div class="add-field">
    <input data-testid="template-new-label" placeholder="Field label" bind:value={newLabel} />
    <select data-testid="template-new-type" bind:value={newType}>
      {#each FIELD_TYPES as t (t)}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <input
      data-testid="template-new-default"
      placeholder="Default (optional)"
      bind:value={newDefault}
    />
    <button data-testid="template-add-field" onclick={() => void add()} disabled={!newLabel.trim()}
      >Add field</button
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
