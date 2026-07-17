<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { resolveSeparate, type PlayerSeat, type Roll } from '@osr-vtt/shared';
  import { DiceScene } from '../dice/scene';
  import { seatColor } from '../dice/seat-color';

  /**
   * Full-stage dice overlay (Master Plan v2, R3.4). A fixed, full-viewport,
   * pointer-transparent canvas above the stage tumbles the latest roll; a
   * result chip anchors near the dice with the author + faces/total.
   *
   * The chip DOM is the **authoritative, persistent readout** every client
   * agrees on — it always reflects the latest roll, so a passive observer (or a
   * client without WebGL) still sees the result and it never depends on the
   * tumble. The fade is a purely visual treatment: after the hold the chip
   * fades to transparent and the 3D canvas releases, but the chip stays mounted.
   * Only the **animation** is ephemeral — a genuinely new roll tumbles once.
   * `last-roll-*` testids are preserved.
   */
  let { rolls, players = [] }: { rolls: Roll[]; players?: PlayerSeat[] } = $props();

  let hostEl: HTMLDivElement;
  let scene: DiceScene | null = null;
  let webglOk = $state(true);
  const seenIds = new Set<string>();
  let initialized = false;
  let lastChipId: string | null = null;

  let chipFading = $state(false);
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const CHIP_HOLD_MS = 4000;
  const CHIP_FADE_MS = 600;

  const latest = $derived(rolls.length > 0 ? rolls[rolls.length - 1]! : null);
  const chipFlags = $derived(
    latest && latest.mode === 'separate' ? latest.dice.map((d) => resolveSeparate(d.kept)) : null,
  );
  // Backward-compat single-die overall class (what the two-context e2e reads).
  const chipResultClass = $derived(chipFlags && chipFlags.length === 1 ? chipFlags[0]! : null);

  function authorName(uid: string): string {
    return players.find((p) => p.uid === uid)?.displayName ?? '';
  }

  /** The advantage badge label, mode-aware (Master Plan v2, R20): Separate
   * shows ADV/DIS; Summed shows which end of the pool was dropped. */
  function advTag(r: Roll): string {
    if (r.mode === 'summed') {
      return r.advantage === 'advantage' ? 'DROP LOW' : 'DROP HIGH';
    }
    return r.advantage === 'advantage' ? 'ADV' : 'DIS';
  }

  /** (Re)anchors the chip fully opaque, then fades it and releases the 3D
   * canvas after the hold — the chip element stays mounted (it is the
   * persistent readout; only its opacity changes). */
  function anchorChip(): void {
    if (fadeTimer) clearTimeout(fadeTimer);
    if (clearTimer) clearTimeout(clearTimer);
    chipFading = false;
    fadeTimer = setTimeout(() => {
      chipFading = true;
      clearTimer = setTimeout(() => scene?.clear(), CHIP_FADE_MS);
    }, CHIP_HOLD_MS);
  }

  onMount(() => {
    scene = new DiceScene();
    webglOk = scene.mount(hostEl);
  });

  onDestroy(() => {
    if (fadeTimer) clearTimeout(fadeTimer);
    if (clearTimer) clearTimeout(clearTimer);
    scene?.dispose();
  });

  $effect(() => {
    const list = rolls;
    const newest = list.length > 0 ? list[list.length - 1]! : null;
    if (!initialized) {
      // Don't replay history on first mount — seed what's already seen so only
      // rolls arriving while this client watches animate. The chip still shows
      // `latest` (persistent readout), just without an entrance fade.
      for (const r of list) seenIds.add(r.id);
      lastChipId = newest?.id ?? null;
      initialized = true;
      return;
    }
    // A new latest roll (re)anchors and re-fades the chip.
    if (newest && newest.id !== lastChipId) {
      lastChipId = newest.id;
      anchorChip();
    }
    // Tumble only genuinely new rolls; the chip readout is independent of this.
    for (const r of list) {
      if (seenIds.has(r.id)) continue;
      seenIds.add(r.id);
      if (!webglOk || !scene) continue;
      if (r.parts && r.parts.length > 0) {
        // A shared roll's overlay is every part's dice at once, each tinted
        // to its seat (R3.6.4) — flattened in the same order parts were
        // produced (already seat-id-sorted, see `expandSharedRollSlots`).
        const dice = r.parts.flatMap((p) => p.dice);
        const tints = r.parts.flatMap((p) => p.dice.map(() => seatColor(p.seatId)));
        void scene.roll(dice, r.seed, tints);
      } else {
        void scene.roll(r.dice, r.seed);
      }
    }
  });
</script>

<div class="dice-canvas" data-testid="dice-canvas" bind:this={hostEl}></div>

{#if latest}
  <div class="chip-anchor">
    {#if latest.parts && latest.parts.length > 0}
      <!-- Shared roll (Master Plan v2, R3.6.4): a grouped chip, one tinted
      row per seat, instead of the single-roll readout below. -->
      <div
        class="chip parts-chip"
        class:fading={chipFading}
        data-testid="dice-result-chip"
        data-faded={chipFading ? 'true' : 'false'}
      >
        {#if latest.label}
          <span class="author">{latest.label}</span>
        {/if}
        <ul class="parts-list" data-testid="shared-roll-parts">
          {#each latest.parts as part (part.seatId)}
            <li data-testid={`shared-roll-part-${part.seatId}`}>
              <span class="seat-swatch" style={`background:${seatColor(part.seatId)}`}></span>
              <span class="seat-name">{authorName(part.seatId) || part.seatId}</span>
              <span class="seat-result">
                {part.dice.map((d) => d.kept).join(' + ')}
                {#if part.modifier !== 0}
                  {part.modifier > 0 ? ' + ' : ' − '}{Math.abs(part.modifier)}
                {/if}
                = <strong data-testid={`shared-roll-total-${part.seatId}`}>{part.total}</strong>
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <div
        class="chip"
        class:fading={chipFading}
        data-testid="dice-result-chip"
        data-faded={chipFading ? 'true' : 'false'}
      >
        {#if authorName(latest.authorUid)}
          <span class="author">{authorName(latest.authorUid)}</span>
        {/if}
        <p class="result" data-testid="last-roll-result" data-result-class={chipResultClass ?? ''}>
          {#if latest.mode === 'summed'}
            {latest.dice
              .filter((d) => !d.poolDropped)
              .map((d) => d.kept)
              .join(' + ')}
            {#if latest.modifier !== 0}
              {latest.modifier > 0 ? ' + ' : ' − '}{Math.abs(latest.modifier)}
            {/if}
            = <strong data-testid="last-roll-total">{latest.total}</strong>
            {#each latest.dice.filter((d) => d.poolDropped) as die, i (i)}
              <span class="dropped" data-testid="last-roll-dropped">dropped {die.kept}</span>
            {/each}
          {:else}
            <span class="dice-list">
              {#each latest.dice as die, i (i)}
                <span class={`badge ${resolveSeparate(die.kept)}`}>{die.kept}</span>
                {#if die.dropped !== undefined}
                  <span class="dropped" data-testid="last-roll-dropped">{die.dropped}</span>
                {/if}
              {/each}
            </span>
          {/if}
          {#if latest.advantage !== 'normal'}
            <span class="adv-tag" data-testid="last-roll-advantage">{advTag(latest)}</span>
          {/if}
        </p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .dice-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .chip-anchor {
    position: absolute;
    left: 50%;
    bottom: 12%;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.5rem 0.9rem;
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-panel) 82%, transparent);
    border: 1px solid var(--line);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(6px);
    transition: opacity var(--chip-fade, 0.6s) ease;
    opacity: 1;
  }
  .chip.fading {
    opacity: 0;
  }
  .author {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted, var(--accent-text));
  }
  .result {
    margin: 0;
    font-family: monospace;
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .dice-list {
    display: inline-flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .parts-chip {
    align-items: stretch;
  }
  .parts-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .parts-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: monospace;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .seat-swatch {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 999px;
    flex: none;
  }
  .seat-name {
    font-family: inherit;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.8;
  }
  .seat-result {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .badge {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-family: inherit;
    font-size: 0.9rem;
  }
  .badge.success {
    background: var(--success-bg-strong);
    color: var(--success);
  }
  .badge.complication {
    background: var(--complication-bg-strong);
    color: var(--complication);
  }
  .badge.failure {
    background: var(--failure-bg-strong);
    color: var(--failure);
  }
  .adv-tag {
    padding: 0.05rem 0.4rem;
    border-radius: 4px;
    background: var(--bg-panel-alt);
    border: 1px solid var(--accent);
    font-size: 0.7rem;
  }
  .dropped {
    font-size: 0.72rem;
    opacity: 0.45;
    text-decoration: line-through;
    color: var(--text-dim, var(--text-muted));
  }
</style>
