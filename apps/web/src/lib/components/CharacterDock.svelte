<script lang="ts">
  import { getContext } from 'svelte';
  import {
    DEFAULT_GRID_CONFIG,
    type AssetStore,
    type CampaignStore,
    type PlayerSeat,
    type ProfileInstance,
    type ProfileTemplateField,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, DIALOG_KEY } from '../context';
  import type { DialogService } from '../shell/dialogs.svelte';
  import { buildProfileRows } from '../profile/profile-view';
  import { diceTray } from '../dice/staged-store';
  import { defaultPortraitRef, seatLetterFor } from '../tokens/labels';

  let {
    template,
    profile,
    seatId,
    roomId,
    players = [],
    tokens = [],
    readOnly = false,
    canSetOwnToken = false,
  }: {
    template: ProfileTemplateField[];
    profile: ProfileInstance | undefined;
    seatId: string;
    roomId: string;
    players?: PlayerSeat[];
    tokens?: Token[];
    /** Viewing another actor's card (Encounter Screen Spec §5) — fields
     * still render, but only the owning seat or the GM may edit them
     * (Security Rules already enforce this server-side; this just avoids
     * a doomed write attempt in the UI). */
    readOnly?: boolean;
    /** Shows the "My token" action (Master Plan v2, R7.3) — only when this
     * dock is showing the viewer's own seat, GM or not. */
    canSetOwnToken?: boolean;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);

  const rows = $derived(buildProfileRows(template, profile));

  // A fresh seat has no `portraitRef` yet — falls back to the same
  // generated colored-circled-letter default the token layer uses (Gate 9:
  // "a fresh seat automatically has a colored circled-letter token/portrait").
  const portraitRef = $derived(profile?.portraitRef || defaultPortraitRef(players, seatId));

  function setValue(fieldId: string, value: string | number | boolean): void {
    if (!seatId || readOnly) return;
    void store.setProfileValue(roomId, seatId, fieldId, value);
  }

  function stageRoll(die: string): void {
    diceTray.stage(String(die));
  }

  let settingToken = $state(false);

  async function pickMyToken(): Promise<void> {
    if (settingToken) return;
    const picked = await dialogs.pickToken({
      title: 'My token',
      roomId,
      mode: 'portrait',
      confirmLabel: 'Set as my token',
      genDefaultLabel: seatLetterFor(players, seatId),
      genDefaultColorSeed: seatId,
    });
    if (!picked) return;
    settingToken = true;
    try {
      const ref = picked.ref || defaultPortraitRef(players, seatId);
      await store.setProfilePortrait(roomId, seatId, ref);
      const mine = tokens.find((t) => t.ownerSeatId === seatId);
      if (mine) {
        await store.setTokenImage(roomId, mine.id, ref);
      } else {
        await store.createToken(roomId, {
          pos: { x: 160 + tokens.length * DEFAULT_GRID_CONFIG.cellSize, y: 160 },
          size: 1,
          layer: 'tokens',
          imageRef: ref,
          ownerSeatId: seatId,
        });
      }
    } finally {
      settingToken = false;
    }
  }
</script>

<!--
  Renders ANY profileTemplate generically (Plan §2.5) — this component has
  no per-field-id logic and never inspects a value for game meaning. Only
  the field's declared `type` decides which control renders.
-->
<div class="dock" data-testid="character-dock">
  <div class="header">
    <img class="portrait" data-testid="dock-portrait" src={assets.resolve(portraitRef)} alt="" />
    <h2>Character</h2>
    {#if canSetOwnToken}
      <button
        class="my-token"
        data-testid="my-token"
        onclick={() => void pickMyToken()}
        disabled={settingToken}
      >
        My token
      </button>
    {/if}
  </div>
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
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .dock h2 {
    margin: 0;
    font-size: 1rem;
    flex: 1;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .portrait {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--line-strong);
    flex-shrink: 0;
  }
  .my-token {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .my-token:disabled {
    opacity: 0.5;
    cursor: default;
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
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
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
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .roll-chip {
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-panel-alt);
    color: inherit;
    cursor: pointer;
  }
</style>
