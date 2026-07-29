<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore, DiceMacro } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';
  import { diceTray } from '../../dice/staged-store';

  /** Saved dice macros — save the staged tray under a name, load one back, or
   * delete it. Extracted from `DiceTray` so the *docked* Roll quick sheet can
   * offer already-created macros without expanding, keeping every `macro-*`
   * testid in one place (see `TrayControls` for why that stays unambiguous).
   *
   * `showCreate` is what splits the two mount points: the docked sheet lists
   * only already-saved macros (playtest feedback — naming and saving a macro
   * is deliberate work, not something the compact sheet should spend space
   * on), while the expanded tray carries the creator. */
  let {
    roomId,
    authorUid,
    compact = false,
    showCreate = true,
  }: { roomId: string; authorUid: string; compact?: boolean; showCreate?: boolean } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let macroName = $state('');
  let macros = $state<DiceMacro[]>([]);

  $effect(() => {
    const unsub = store.subscribeMacros(roomId, (m) => (macros = m));
    return unsub;
  });

  const myMacros = $derived(macros.filter((m) => m.ownerUid === authorUid));

  async function saveMacro(): Promise<void> {
    const name = macroName.trim();
    const tray = $diceTray;
    if (!name || tray.dice.length === 0 || !authorUid) return;
    await store.saveMacro(roomId, {
      ownerUid: authorUid,
      name,
      dice: tray.dice.map((d) => d.die),
      modifier: tray.modifier,
      mode: tray.mode,
      advantage: tray.advantage,
    });
    macroName = '';
  }

  function replayMacro(macro: DiceMacro): void {
    diceTray.loadMacro(macro);
  }

  async function removeMacro(macroId: string): Promise<void> {
    await store.deleteMacro(roomId, macroId);
  }
</script>

<div class="macros" class:compact>
  {#if showCreate}
    <div class="save-macro">
      <input data-testid="macro-name-input" placeholder="Macro name" bind:value={macroName} />
      <button
        data-testid="macro-save"
        onclick={() => void saveMacro()}
        disabled={!macroName.trim() || $diceTray.dice.length === 0}
      >
        Save as macro
      </button>
    </div>
  {/if}
  {#if myMacros.length > 0}
    <ul class="macro-list">
      {#each myMacros as macro (macro.id)}
        <li data-testid={`macro-row-${macro.id}`}>
          <span class="macro-name">{macro.name}</span>
          <span class="macro-dice">{macro.dice.join(', ')}</span>
          <button data-testid={`macro-replay-${macro.id}`} onclick={() => replayMacro(macro)}
            >Load</button
          >
          <button
            data-testid={`macro-delete-${macro.id}`}
            onclick={() => void removeMacro(macro.id)}>✕</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .macros {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .macros.compact {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  button {
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .save-macro {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }
  .save-macro input {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  .macro-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .macro-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
  }
  .macro-name {
    font-weight: 600;
  }
  .macro-dice {
    flex: 1;
    opacity: 0.7;
  }
  .compact .save-macro input,
  .compact .macro-list li {
    font-size: 0.72rem;
  }
</style>
