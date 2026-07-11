<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import {
    createSeed,
    parseDieExpr,
    rollFaces,
    type BlindDraw,
    type CampaignStore,
    type Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';

  /**
   * The Blind Drawer (Plan §7 Phase 4). A referee makes a secret roll/draw
   * whose result is written ONLY to `gmPrivate` — Security Rules physically
   * deny players the read (Plan §3), so this whole panel is GM-only. "Reveal"
   * copies the result into the shared Action Log, the single deliberate path
   * by which a hidden result becomes public.
   */
  let {
    roomId,
    isGM,
    authorUid,
  }: {
    roomId: string;
    isGM: boolean;
    authorUid: string;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let draws = $state<BlindDraw[]>([]);
  let title = $state('');
  let dieExpr = $state('d20');
  let note = $state('');

  let unsub: Unsubscribe | null = null;
  onMount(() => {
    // Only the GM may read gmPrivate; subscribing as a player would be denied.
    if (isGM) unsub = store.subscribeBlindDraws(roomId, (d) => (draws = d));
  });
  onDestroy(() => unsub?.());

  const pending = $derived(draws.filter((d) => !d.revealed));
  const revealed = $derived(draws.filter((d) => d.revealed));

  async function secretRoll(): Promise<void> {
    const parsed = parseDieExpr(dieExpr.trim());
    if (!parsed) return;
    const seed = createSeed();
    const faces = rollFaces(seed, Array(parsed.count).fill(parsed.sides));
    const sum = faces.reduce((a, b) => a + b, 0);
    const text = faces.length === 1 ? String(faces[0]) : `${faces.join(' + ')} = ${sum}`;
    await store.writeBlindDraw(roomId, {
      kind: 'blindDraw',
      ts: Date.now(),
      authorUid,
      title: title.trim() || `Secret ${dieExpr.trim()} roll`,
      text,
      seed,
      dice: faces.map((f) => ({ die: `d${parsed.sides}`, sides: parsed.sides, kept: f })),
      revealed: false,
    });
    title = '';
  }

  async function secretNote(): Promise<void> {
    if (!note.trim()) return;
    await store.writeBlindDraw(roomId, {
      kind: 'blindDraw',
      ts: Date.now(),
      authorUid,
      title: title.trim() || 'Secret note',
      text: note.trim(),
      revealed: false,
    });
    title = '';
    note = '';
  }

  function reveal(draw: BlindDraw): void {
    void store.revealBlindDraw(roomId, draw);
  }
</script>

{#if isGM}
  <div class="blind-drawer" data-testid="blind-drawer">
    <h2>Blind Drawer</h2>
    <p class="hint">Results stay hidden from players until you reveal them.</p>

    <input
      class="title"
      data-testid="blind-draw-title"
      placeholder="What are you drawing for?"
      bind:value={title}
    />

    <div class="row">
      <input
        class="die"
        data-testid="blind-draw-die"
        bind:value={dieExpr}
        placeholder="d20"
      />
      <button data-testid="blind-draw-roll" onclick={() => void secretRoll()}>Secret roll</button>
    </div>

    <div class="row">
      <input
        class="note"
        data-testid="blind-draw-note"
        placeholder="…or type a secret result"
        bind:value={note}
      />
      <button data-testid="blind-draw-note-add" onclick={() => void secretNote()} disabled={!note.trim()}
        >Stash</button
      >
    </div>

    {#if pending.length > 0}
      <ul class="draw-list">
        {#each pending as draw (draw.id)}
          <li data-testid={`blind-draw-row-${draw.id}`}>
            <span class="draw-title">{draw.title}</span>
            <span class="draw-text" data-testid={`blind-draw-text-${draw.id}`}>{draw.text}</span>
            <button data-testid={`blind-draw-reveal-${draw.id}`} onclick={() => reveal(draw)}
              >Reveal</button
            >
          </li>
        {/each}
      </ul>
    {/if}

    {#if revealed.length > 0}
      <ul class="draw-list revealed">
        {#each revealed as draw (draw.id)}
          <li data-testid={`blind-draw-revealed-${draw.id}`}>
            <span class="draw-title">{draw.title}</span>
            <span class="draw-text">{draw.text}</span>
            <span class="tag">revealed</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .blind-drawer {
    background: var(--panel-referee-bg);
    border: 1px solid var(--panel-referee-line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .blind-drawer h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .hint {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    opacity: 0.7;
  }
  .title,
  .die,
  .note {
    box-sizing: border-box;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.8rem;
  }
  .title {
    width: 100%;
    margin-bottom: 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }
  .die {
    width: 4rem;
  }
  .note {
    flex: 1;
  }
  button {
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-panel-alt);
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .draw-list {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .draw-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    background: var(--bg-inset);
  }
  .draw-title {
    font-weight: 600;
  }
  .draw-text {
    flex: 1;
    color: var(--accent-text);
  }
  .draw-list.revealed li {
    opacity: 0.6;
  }
  .tag {
    font-size: 0.65rem;
    opacity: 0.7;
  }
</style>
