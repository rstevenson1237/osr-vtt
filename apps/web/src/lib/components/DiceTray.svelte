<script lang="ts">
  import { DIE_SIDE_OPTIONS, type PlayerSeat } from '@osr-vtt/shared';
  import { diceTray } from '../dice/staged-store';
  import SharedRollStaging from './SharedRollStaging.svelte';
  import TrayControls from './dice/TrayControls.svelte';
  import MacroList from './dice/MacroList.svelte';

  /**
   * The dynamic dice tray (Plan §7 Phase 3, Encounter Screen Spec §6): the
   * expanded half of the Roll quick sheet. Adds custom dice expressions, the
   * shared-roll staging panel (Master Plan v2, R3.6.1) and the macro creator
   * on top of what the docked sheet already offers.
   *
   * Staging the pool and rolling it moved to `RollSheet` itself (playtest
   * feedback) so a complex roll can be built and thrown without expanding —
   * the staged chips (`staged-die-*`) and `roll-button` live there now, and
   * both mount points drive the same `diceTray` singleton either way.
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

  let customDie = $state('');

  function addDie(sides: number): void {
    diceTray.stage(`d${sides}`);
  }

  function addCustomDie(): void {
    const expr = customDie.trim();
    if (!expr) return;
    diceTray.stage(expr);
    customDie = '';
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

  <TrayControls />

  <MacroList {roomId} {authorUid} />
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
  button {
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
</style>
