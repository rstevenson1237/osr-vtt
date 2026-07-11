<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { resolveSeparate, type Roll } from '@osr-vtt/shared';
  import { DiceScene } from '../dice/scene';

  let { rolls }: { rolls: Roll[] } = $props();

  let hostEl: HTMLDivElement;
  let scene: DiceScene | null = null;
  let webglOk = $state(true);
  const seenIds = new Set<string>();
  let initialized = false;

  const latest = $derived(rolls.length > 0 ? rolls[rolls.length - 1]! : null);
  const latestFlags = $derived(latest && latest.mode === 'separate' ? latest.dice.map((d) => resolveSeparate(d.kept)) : null);
  // Backward-compat single-die badge (also what the two-context e2e checks):
  // one die in Separate mode gets a single overall class.
  const latestResultClass = $derived(
    latestFlags && latestFlags.length === 1 ? latestFlags[0]! : null,
  );

  onMount(() => {
    scene = new DiceScene();
    // WebGL may be unavailable (headless/software-render edge cases) — the
    // DOM result readout below still reflects the authoritative roll either
    // way, so the 3D tumble is decorative, not load-bearing.
    webglOk = scene.mount(hostEl);
  });

  onDestroy(() => {
    scene?.dispose();
  });

  $effect(() => {
    const list = rolls;
    if (!initialized) {
      // Don't replay history as animation on first load/mount — only new
      // rolls that arrive after this client is watching get animated.
      for (const r of list) seenIds.add(r.id);
      initialized = true;
      return;
    }
    for (const r of list) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        if (webglOk && scene) {
          // Decorative-only tumble: the 3D scene only knows how to render
          // d6-style cubes (Plan §1.2 — the animation is cosmetic, never
          // authoritative). Any die size maps onto a 1-6 face just for the
          // visual; the real values are `r.dice[].kept`, read directly off
          // the synced Roll doc everywhere else on this screen.
          const decorative = r.dice.map((d) => ((d.kept - 1) % 6) + 1);
          void scene.roll(r.seed, decorative);
        }
      }
    }
  });
</script>

<div class="overlay">
  <h2>Dice</h2>
  <div class="canvas-host" data-testid="dice-canvas" bind:this={hostEl}></div>
  {#if latest}
    <p class="result" data-testid="last-roll-result" data-result-class={latestResultClass ?? ''}>
      {#if latest.mode === 'summed'}
        {latest.dice.map((d) => d.kept).join(' + ')}
        {#if latest.modifier !== 0}
          {latest.modifier > 0 ? ' + ' : ' − '}{Math.abs(latest.modifier)}
        {/if}
        = <strong data-testid="last-roll-total">{latest.total}</strong>
      {:else}
        <span class="dice-list">
          {#each latest.dice as die, i (i)}
            <span class={`badge ${resolveSeparate(die.kept)}`}>{die.kept}</span>
          {/each}
        </span>
      {/if}
      {#if latest.advantage !== 'normal'}
        <span class="adv-tag" data-testid="last-roll-advantage"
          >{latest.advantage === 'advantage' ? 'ADV' : 'DIS'}</span
        >
      {/if}
    </p>
  {/if}
</div>

<style>
  .overlay {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .overlay h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .canvas-host {
    width: 100%;
    height: 140px;
    position: relative;
    background: var(--bg-inset);
    border-radius: 6px;
    overflow: hidden;
  }
  .result {
    margin: 0.5rem 0 0;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .dice-list {
    display: inline-flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .badge {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-family: inherit;
    font-size: 0.85rem;
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
</style>
