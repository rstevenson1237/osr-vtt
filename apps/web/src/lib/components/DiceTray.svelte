<script lang="ts">
  import { getContext } from 'svelte';
  import {
    createSeed,
    DIE_SIDE_OPTIONS,
    expandDiceExprs,
    resolveSeparate,
    rollTray,
    summedTotal,
    type AdvantageMode,
    type CampaignStore,
    type DiceMacro,
    type PlayerSeat,
    type Roll,
    type RollMode,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { diceTray } from '../dice/staged-store';
  import { describeRoll } from '../dice/describe';
  import SharedRollStaging from './SharedRollStaging.svelte';

  /**
   * The dynamic dice tray (Plan §7 Phase 3, Encounter Screen Spec §6):
   * add any number/mix of dice, a flat modifier, advantage/disadvantage,
   * and a Summed (OSE) or Separate (per-die flag) resolution mode. Rolling
   * writes one `rolls` doc every client re-derives deterministically from
   * `seed` (Plan §4) — no server round-trip needed to agree on a result.
   * Also hosts the shared-roll staging panel (Master Plan v2, R3.6.1) above
   * the personal tray — "the Dice activity/mini-card."
   */
  let {
    roomId,
    authorUid,
    isGM = false,
    players = [],
  }: {
    roomId: string;
    authorUid: string;
    isGM?: boolean;
    players?: PlayerSeat[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let rolling = $state(false);
  let customDie = $state('');
  let macroName = $state('');
  let macros = $state<DiceMacro[]>([]);

  $effect(() => {
    const unsub = store.subscribeMacros(roomId, (m) => (macros = m));
    return unsub;
  });

  const myMacros = $derived(macros.filter((m) => m.ownerUid === authorUid));

  function addDie(sides: number): void {
    diceTray.stage(`d${sides}`);
  }

  function addCustomDie(): void {
    const expr = customDie.trim();
    if (!expr) return;
    diceTray.stage(expr);
    customDie = '';
  }

  function setMode(mode: RollMode): void {
    diceTray.setMode(mode);
  }

  function setAdvantage(advantage: AdvantageMode): void {
    diceTray.setAdvantage(advantage);
  }

  async function rollStaged(): Promise<void> {
    const tray = $diceTray;
    if (tray.dice.length === 0 || rolling || !authorUid) return;
    const slots = expandDiceExprs(tray.dice.map((d) => d.die));
    if (slots.length === 0) return;

    rolling = true;
    try {
      const seed = createSeed();
      const dice = rollTray(seed, slots, tray.advantage);
      const total = tray.mode === 'summed' ? summedTotal(dice, tray.modifier) : undefined;

      const roll: Omit<Roll, 'id'> = {
        ts: Date.now(),
        authorUid,
        seed,
        dice,
        modifier: tray.modifier,
        advantage: tray.advantage,
        mode: tray.mode,
        ...(total !== undefined ? { total } : {}),
      };
      await store.writeRoll(roomId, roll);

      const text = describeRoll({ ...roll, id: '' });
      const resultClass =
        tray.mode === 'separate' && dice.length === 1 ? resolveSeparate(dice[0]!.kept) : undefined;

      await store.writeLog(roomId, {
        ts: Date.now(),
        authorUid,
        type: 'roll',
        text,
        ...(resultClass ? { resultClass } : {}),
      });

      diceTray.clearDice();
    } finally {
      rolling = false;
    }
  }

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

<div class="tray" data-testid="dice-tray">
  <h2>Dice Tray</h2>

  {#if authorUid}
    <SharedRollStaging {roomId} myUid={authorUid} {isGM} {players} />
  {/if}

  <div class="add-row">
    {#each DIE_SIDE_OPTIONS as sides (sides)}
      <button data-testid={`tray-add-d${sides}`} onclick={() => addDie(sides)}>d{sides}</button>
    {/each}
    <input
      class="custom-die"
      data-testid="tray-custom-die"
      placeholder="2d6"
      bind:value={customDie}
      onkeydown={(e) => e.key === 'Enter' && addCustomDie()}
    />
    <button data-testid="tray-add-custom" onclick={addCustomDie} disabled={!customDie.trim()}
      >Add</button
    >
  </div>

  <div class="staged">
    {#each $diceTray.dice as die (die.id)}
      <button
        class="chip"
        data-testid={`staged-die-${die.id}`}
        onclick={() => diceTray.remove(die.id)}
        title="Remove"
      >
        {die.die} ✕
      </button>
    {/each}
    {#if $diceTray.dice.length === 0}
      <span class="empty">Tap a die above or a 🎲 field to stage a die.</span>
    {/if}
  </div>

  <div class="controls-row">
    <label class="modifier-label">
      Modifier
      <input
        type="number"
        data-testid="tray-modifier"
        value={$diceTray.modifier}
        oninput={(e) => diceTray.setModifier(Number(e.currentTarget.value))}
      />
    </label>

    <div class="toggle-group" role="group" aria-label="Advantage">
      <button
        data-testid="tray-adv-normal"
        class:active={$diceTray.advantage === 'normal'}
        onclick={() => setAdvantage('normal')}>Normal</button
      >
      <button
        data-testid="tray-adv-advantage"
        class:active={$diceTray.advantage === 'advantage'}
        onclick={() => setAdvantage('advantage')}>Advantage</button
      >
      <button
        data-testid="tray-adv-disadvantage"
        class:active={$diceTray.advantage === 'disadvantage'}
        onclick={() => setAdvantage('disadvantage')}>Disadvantage</button
      >
    </div>

    <div class="toggle-group" role="group" aria-label="Resolution mode">
      <button
        data-testid="tray-mode-separate"
        class:active={$diceTray.mode === 'separate'}
        onclick={() => setMode('separate')}>Separate</button
      >
      <button
        data-testid="tray-mode-summed"
        class:active={$diceTray.mode === 'summed'}
        onclick={() => setMode('summed')}>Summed</button
      >
    </div>
  </div>

  <button
    class="roll-button"
    data-testid="roll-button"
    onclick={rollStaged}
    disabled={$diceTray.dice.length === 0 || rolling}
  >
    {rolling ? 'Rolling…' : 'Roll'}
  </button>

  <div class="macros">
    <div class="save-macro">
      <input
        data-testid="macro-name-input"
        placeholder="Macro name"
        bind:value={macroName}
      />
      <button
        data-testid="macro-save"
        onclick={() => void saveMacro()}
        disabled={!macroName.trim() || $diceTray.dice.length === 0}
      >
        Save as macro
      </button>
    </div>
    {#if myMacros.length > 0}
      <ul class="macro-list">
        {#each myMacros as macro (macro.id)}
          <li data-testid={`macro-row-${macro.id}`}>
            <span class="macro-name">{macro.name}</span>
            <span class="macro-dice">{macro.dice.join(', ')}</span>
            <button data-testid={`macro-replay-${macro.id}`} onclick={() => replayMacro(macro)}
              >Load</button
            >
            <button data-testid={`macro-delete-${macro.id}`} onclick={() => void removeMacro(macro.id)}
              >✕</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .tray {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .tray h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .add-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }
  .add-row button {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }
  .custom-die {
    width: 4rem;
    box-sizing: border-box;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  .staged {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 1.6rem;
    margin-bottom: 0.5rem;
  }
  .chip {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    font-size: 0.8rem;
    color: inherit;
    cursor: pointer;
  }
  .empty {
    font-size: 0.8rem;
    opacity: 0.6;
  }
  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
  }
  .modifier-label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .modifier-label input {
    width: 3.5rem;
    box-sizing: border-box;
    padding: 0.2rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .toggle-group {
    display: flex;
    gap: 0.2rem;
  }
  .toggle-group button {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .toggle-group button.active {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    border-color: var(--accent);
  }
  .roll-button {
    padding: 0.4rem 0.9rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }
  .roll-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button {
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .macros {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .save-macro {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }
  .save-macro input {
    flex: 1;
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
</style>
