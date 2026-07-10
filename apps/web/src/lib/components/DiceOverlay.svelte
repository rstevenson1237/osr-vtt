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
  const latestResultClass = $derived(
    latest && latest.results.length === 1 ? resolveSeparate(latest.results[0]!) : null,
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
          void scene.roll(r.seed, r.results);
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
      {latest.results.join(', ')}
      {#if latestResultClass}
        <span class={`badge ${latestResultClass}`}>{latestResultClass}</span>
      {/if}
    </p>
  {/if}
</div>

<style>
  .overlay {
    background: #241f18;
    border: 1px solid #3a3226;
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
    background: #14110d;
    border-radius: 6px;
    overflow: hidden;
  }
  .result {
    margin: 0.5rem 0 0;
    font-family: monospace;
  }
  .badge {
    margin-left: 0.5rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-family: inherit;
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  .badge.success {
    background: #2f5c34;
    color: #bdf2c4;
  }
  .badge.complication {
    background: #6b5a20;
    color: #f2e2ab;
  }
  .badge.failure {
    background: #5c2f2f;
    color: #f2bdbd;
  }
</style>
