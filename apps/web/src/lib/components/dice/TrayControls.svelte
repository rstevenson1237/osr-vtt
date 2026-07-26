<script lang="ts">
  import type { AdvantageMode, RollMode } from '@osr-vtt/shared';
  import { diceTray } from '../../dice/staged-store';

  /** The tray's roll-shaping controls — flat modifier, advantage tri-state and
   * resolution mode — extracted from `DiceTray` so they can also render on the
   * *docked* Roll quick sheet without duplicating markup or `tray-*` testids.
   * They read and write the module-level `diceTray` store directly, so both
   * mount points drive the same staged roll; `RoomShell` never renders a sheet
   * docked and expanded at once, so a testid is never ambiguous.
   *
   * The advantage toggle relabels by resolution mode (Master Plan v2, R20):
   * Separate keeps Advantage/Disadvantage (roll each die twice, keep the better
   * of the pair); Summed offers Drop Lowest/Drop Highest (roll once, remove one
   * whole die from the pool). Both map onto the same stored `advantage` field —
   * "favour high" is advantage / drop-lowest, "favour low" is disadvantage /
   * drop-highest — so the data model stays a single tri-state. */
  let { compact = false }: { compact?: boolean } = $props();

  function setMode(mode: RollMode): void {
    diceTray.setMode(mode);
  }

  function setAdvantage(advantage: AdvantageMode): void {
    diceTray.setAdvantage(advantage);
  }
</script>

<div class="controls-row" class:compact>
  <label class="modifier-label">
    Modifier
    <input
      type="number"
      data-testid="tray-modifier"
      value={$diceTray.modifier}
      oninput={(e) => diceTray.setModifier(Number(e.currentTarget.value))}
    />
  </label>

  <div
    class="toggle-group"
    role="group"
    aria-label={$diceTray.mode === 'summed' ? 'Drop die' : 'Advantage'}
  >
    <button
      data-testid="tray-adv-normal"
      class:active={$diceTray.advantage === 'normal'}
      onclick={() => setAdvantage('normal')}>Normal</button
    >
    <button
      data-testid="tray-adv-advantage"
      class:active={$diceTray.advantage === 'advantage'}
      title={$diceTray.mode === 'summed'
        ? 'Roll every die once, drop the single lowest result'
        : 'Roll each die twice, keep the higher of each pair'}
      onclick={() => setAdvantage('advantage')}
      >{$diceTray.mode === 'summed' ? 'Drop Lowest' : 'Advantage'}</button
    >
    <button
      data-testid="tray-adv-disadvantage"
      class:active={$diceTray.advantage === 'disadvantage'}
      title={$diceTray.mode === 'summed'
        ? 'Roll every die once, drop the single highest result'
        : 'Roll each die twice, keep the lower of each pair'}
      onclick={() => setAdvantage('disadvantage')}
      >{$diceTray.mode === 'summed' ? 'Drop Highest' : 'Disadvantage'}</button
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

<style>
  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
  }
  .controls-row.compact {
    gap: 0.4rem;
    margin-bottom: 0;
    font-size: 0.75rem;
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
  .compact .modifier-label input {
    width: 2.8rem;
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
  .compact .toggle-group button {
    padding: 0.15rem 0.35rem;
    font-size: 0.68rem;
  }
  .toggle-group button.active {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    border-color: var(--accent);
  }
</style>
