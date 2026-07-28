<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    summarizeRoll,
    type PlayerSeat,
    type ProfileInstance,
    type Roll,
    type RollConvention,
  } from '@osr-vtt/shared';
  import { DiceScene } from '../dice/scene';
  import { characterDiceColor, characterDiceColorForUid } from '../dice/seat-color';

  /**
   * Full-stage dice overlay (Master Plan v2, R3.4). A fixed, full-viewport,
   * pointer-transparent canvas above the stage tumbles the latest roll; a
   * result chip anchors near the dice with the author + faces/total.
   *
   * The chip DOM is the **authoritative, persistent readout** every client
   * agrees on — while a roll is showing, a passive observer (or a client
   * without WebGL) still sees the result and it never depends on the tumble.
   * The fade is a purely visual treatment: after the hold the chip fades to
   * transparent and the 3D canvas releases, but the chip stays mounted. Only
   * the **animation** is ephemeral — a genuinely new roll tumbles once.
   * `last-roll-*` testids are preserved.
   *
   * This overlay mounts fresh every time a client (re)joins a room (it's
   * unconditional at the `RoomShell` level), and `rolls` already carries the
   * room's history — so `latest` at mount time is often a roll from a
   * *previous* session, not a fresh result. The chip only shows it if it's
   * still within its natural display lifetime (`STALE_ROLL_MS`); older rolls
   * stay unshown until a genuinely new one lands, so reentering a session
   * doesn't re-present someone else's — or your own past — roll as if new.
   */
  let {
    rolls,
    players = [],
    profiles = [],
    conventions = [],
  }: {
    rolls: Roll[];
    players?: PlayerSeat[];
    profiles?: ProfileInstance[];
    conventions?: RollConvention[];
  } = $props();

  let hostEl: HTMLDivElement;
  let scene: DiceScene | null = null;
  let webglOk = $state(true);
  const seenIds = new Set<string>();
  let lastChipId: string | null = null;
  /** When this overlay mounted. Everything older is history by definition —
   * see the `$effect` below for why this, and not a "first snapshot" flag, is
   * what decides freshness. */
  let mountedAt = 0;

  let chipFading = $state(false);
  /** Whether the chip should render at all. `DiceOverlay` mounts fresh every
   * time a client (re)joins a room (it lives at the `RoomShell` level, not
   * gated by activity), and `rolls` already carries the room's roll history —
   * so on a bare mount `latest` is often a roll from a *previous* session, not
   * one the reentering user just made. Without this gate the chip appeared at
   * full opacity with no fade timer ever started (that only fires for a
   * genuinely new roll), effectively re-presenting a stale result forever. */
  let chipVisible = $state(false);
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const CHIP_HOLD_MS = 4000;
  const CHIP_FADE_MS = 600;
  // A roll already this old when the overlay mounts is history, not a result
  // to re-present — anything younger is treated as still within its natural
  // display lifetime (as if the client had stayed connected throughout).
  const STALE_ROLL_MS = CHIP_HOLD_MS + CHIP_FADE_MS;

  /** The face colors handed to the renderer for the most recent tumble, as
   * queryable DOM. The dice themselves are a WebGL bitmap that Playwright
   * cannot read back (no `preserveDrawingBuffer`), so this is what guards the
   * pick → profile → renderer plumbing end to end; the pick → *pixel* half is
   * covered by the pure `faceColor`/`inkFor` unit tests. `''` = no character
   * color chosen, which the renderer paints as the `--dice-face` neutral. */
  let lastRollColors = $state<string[]>([]);

  const latest = $derived(rolls.length > 0 ? rolls[rolls.length - 1]! : null);
  /** The one shape the chip renders from, shared with the roll strip and the
   * log so the three cannot drift apart again. */
  const summary = $derived(latest ? summarizeRoll(latest, conventions) : null);
  const soloPart = $derived(summary && summary.parts.length === 1 ? summary.parts[0]! : null);
  // Backward-compat single-die overall class (what the two-context e2e reads).
  const chipResultClass = $derived(
    soloPart && soloPart.dice.length === 1 ? (soloPart.dice[0]?.band?.class ?? null) : null,
  );

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
   * canvas after `holdMs` — the chip element stays mounted (it is the
   * persistent readout; only its opacity changes). `holdMs` is shortened when
   * resuming a roll that was already partway through its hold when this
   * client (re)connected, so the fade still lands at the same wall-clock time
   * it would have if the client had been connected the whole time. */
  function anchorChip(holdMs: number = CHIP_HOLD_MS): void {
    if (fadeTimer) clearTimeout(fadeTimer);
    if (clearTimer) clearTimeout(clearTimer);
    chipVisible = true;
    chipFading = false;
    fadeTimer = setTimeout(() => {
      chipFading = true;
      clearTimer = setTimeout(() => scene?.clear(), CHIP_FADE_MS);
    }, holdMs);
  }

  onMount(() => {
    mountedAt = Date.now();
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

    // Freshness is decided by *timestamp against mount*, not by whether this
    // is the first effect run.
    //
    // The previous version flipped an `initialized` flag on the first run —
    // which happens while `rolls` is still the initial `[]`, before the
    // Firestore snapshot lands. So the history-seeding loop seeded nothing,
    // `lastChipId` stayed null, and when the real snapshot arrived every roll
    // looked new: the chip anchored for a full hold on a roll from a previous
    // session, and every roll in the room's history got queued into the
    // scene. `STALE_ROLL_MS` never got a chance to reject it, because it only
    // ever evaluated that empty first pass.
    //
    // Comparing `r.ts` to `mountedAt` is immune to snapshot timing: a roll
    // that predates this client's mount is history no matter when it arrives.
    for (const r of list) {
      if (seenIds.has(r.id)) continue;
      const isHistory = r.ts < mountedAt;
      seenIds.add(r.id);

      if (isHistory) {
        // Never tumble history. Do still anchor the chip if the roll is young
        // enough that a client connected all along would still be showing it,
        // with the hold shortened by however much has already elapsed.
        if (r.id === newest?.id) {
          const age = Date.now() - r.ts;
          if (age < STALE_ROLL_MS) {
            lastChipId = r.id;
            anchorChip(Math.max(0, CHIP_HOLD_MS - age));
          } else {
            // Old enough to be someone else's finished business: record it as
            // the last chip so it can never anchor later, and show nothing.
            lastChipId = r.id;
          }
        }
        continue;
      }

      if (r.id === newest?.id && r.id !== lastChipId) {
        lastChipId = r.id;
        anchorChip();
      }
      if (!webglOk || !scene) continue;
      if (r.parts && r.parts.length > 0) {
        // A shared roll's overlay is every part's dice at once, each tinted
        // to its seat (R3.6.4) — flattened in the same order parts were
        // produced (already seat-id-sorted, see `expandSharedRollSlots`).
        const dice = r.parts.flatMap((p) => p.dice);
        const tints = r.parts.flatMap((p) =>
          p.dice.map(() => characterDiceColor(p.seatId, profiles)),
        );
        lastRollColors = tints.map((t) => t ?? '');
        void scene.roll(dice, r.seed, tints);
      } else {
        // A solo roll carries its single roller's character colour too,
        // resolved from `authorUid`. `undefined` (no pick yet, or the seat
        // hasn't loaded) means the renderer paints the `--dice-face` neutral.
        const tint = characterDiceColorForUid(r.authorUid, players, profiles);
        lastRollColors = r.dice.map(() => tint ?? '');
        void scene.roll(
          r.dice,
          r.seed,
          r.dice.map(() => tint),
        );
      }
    }
  });
</script>

<div class="dice-canvas" data-testid="dice-canvas" bind:this={hostEl}></div>

<!-- Hidden readout for e2e/introspection — the WebGL canvas can't be read
back, so the face colors the renderer was handed are surfaced as DOM. -->
<span class="dice-readout" data-testid="dice-face-colors" aria-hidden="true"
  >{lastRollColors.join(',')}</span
>

{#if latest && chipVisible}
  <div class="chip-anchor">
    {#if latest.parts && latest.parts.length > 0}
      <!-- Shared roll (Master Plan v2, R3.6.4): a grouped chip, one tinted
      row per seat, instead of the single-roll readout below. -->
      <div
        class="chip parts-chip"
        class:fading={chipFading}
        data-testid="dice-result-chip"
        data-faded={chipFading ? 'true' : 'false'}
        data-roll-id={latest.id}
      >
        {#if latest.label}
          <span class="author">{latest.label}</span>
        {/if}
        <ul class="parts-list" data-testid="shared-roll-parts">
          {#each latest.parts as part (part.seatId)}
            <li data-testid={`shared-roll-part-${part.seatId}`}>
              <span
                class="seat-swatch"
                style={`background:${characterDiceColor(part.seatId, profiles) ?? 'var(--dice-face)'}`}
              ></span>
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
        data-roll-id={latest.id}
      >
        {#if authorName(latest.authorUid)}
          <span class="author">{authorName(latest.authorUid)}</span>
        {/if}
        <p class="result" data-testid="last-roll-result" data-result-class={chipResultClass ?? ''}>
          {#if soloPart && summary?.summed}
            {soloPart.dice
              .filter((d) => !d.poolDropped)
              .map((d) => d.kept)
              .join(' + ')}
            {#if soloPart.modifier !== 0}
              {soloPart.modifier > 0 ? ' + ' : ' − '}{Math.abs(soloPart.modifier)}
            {/if}
            = <strong data-testid="last-roll-total">{soloPart.total}</strong>
            {#if soloPart.band}
              <span class={`badge ${soloPart.band.class}`}>{soloPart.band.label}</span>
            {/if}
            {#each soloPart.dice.filter((d) => d.poolDropped) as die, i (i)}
              <span class="dropped" data-testid="last-roll-dropped">dropped {die.kept}</span>
            {/each}
          {:else if soloPart}
            <span class="dice-list">
              {#each soloPart.dice as die, i (i)}
                <span class={`badge ${die.band?.class ?? 'unbanded'}`} title={die.band?.label ?? ''}
                  >{die.kept}</span
                >
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
  .dice-readout {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
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
    /* Rises into place on appearance, then fades straight out on the hold
       timer — the fade keeps its own (longer) duration so dismissal stays
       unhurried while the entrance is quick. */
    animation: chip-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1) both;
    transition: opacity var(--chip-fade, 0.6s) ease;
    opacity: 1;
  }
  .chip.fading {
    opacity: 0;
  }
  @keyframes chip-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    /* The chip's own fade had no reduced-motion guard before this. */
    .chip {
      animation: none;
      transition: none;
    }
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
  /* No convention matched — show the number plainly rather than borrowing
     another die size's colours. */
  .badge.unbanded {
    background: var(--bg-panel-alt);
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
