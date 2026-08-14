<script lang="ts">
  import { getContext } from 'svelte';
  import { hexMap, type AssetStore } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY } from '../../context';
  import MarkdownEditor from '../MarkdownEditor.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';

  /**
   * The hex-tile quick sheet (SPEC-030 §5) — what a hex crawl has in place of
   * the carve parameters a square map's palette carries.
   *
   * It edits **the hex Select has picked** (`MapToolController.selectedHex`):
   * its terrain (§2), its contents (§3) and its note (§4). Three independent
   * fields on one document, so each control writes only its own — and clearing
   * the last one a hex carries unpaints the hex entirely, which is the store's
   * guarantee rather than this component's business.
   *
   * Store-free by construction, like every other quick sheet body: the writes
   * go through the controller's `onSetHex*` handlers, which `VectorMapView`
   * wires to the store, the room and the map on stage. What it does know is the
   * catalogs — the palette is `HEX_TERRAIN_CATALOG`/`HEX_CONTENTS_CATALOG` read
   * in order, so re-drawing the terrain set is still a change to one file.
   */
  let { controller }: { controller: MapToolController } = $props();

  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  const hex = $derived(controller.selectedHex);
  const tile = $derived(controller.selectedHexTile);
  /** The `"q,r"` heading — the same string as the hex's coordinate pill and its
   * document id (SPEC-030 §1 makes the coordinate the addressing scheme, so
   * there is no name to show instead). */
  const hexLabel = $derived(hex ? hexMap.axialKey(hex) : '');

  /**
   * The catalogs, minus their `unknown` entry: `unknown` is what a kind this
   * build does not recognise *resolves to* so the tile still draws, never
   * something a referee picks. Offering it would let one be authored.
   */
  const TERRAINS = hexMap.HEX_TERRAIN_CATALOG.filter(
    (e) => e.kind !== hexMap.UNKNOWN_HEX_KIND,
  );
  const CONTENTS = hexMap.HEX_CONTENTS_CATALOG.filter(
    (e) => e.kind !== hexMap.UNKNOWN_HEX_KIND,
  );

  /** The terrain overlay is white art tinted at the render boundary against its
   * own background colour (`hexOverlayTone`); the swatch reproduces that with a
   * CSS filter rather than a second tone table, so a re-coloured terrain's chip
   * flips with its hex. */
  function overlayDark(color: string): boolean {
    return hexMap.hexOverlayTone(color) === hexMap.HEX_OVERLAY_DARK;
  }

  /**
   * The note is edited locally and committed on blur — one settled write per
   * edit (RULE-003), not one per keystroke. `null` means "follow the store", so
   * a note another seat changes while this one is not typing still arrives.
   */
  let draft = $state<string | null>(null);
  const noteValue = $derived(draft ?? tile?.note ?? '');
  /** Changing the selection abandons any uncommitted draft: it belonged to the
   * hex that was picked, and carrying it onto the next one would write text
   * about somewhere else. */
  $effect(() => {
    void hexLabel;
    draft = null;
  });

  function commitNote(): void {
    if (draft === null) return;
    const text = draft.trim();
    draft = null;
    if (text === (tile?.note ?? '')) return;
    controller.onSetHexNote(text.length > 0 ? text : null);
  }

  /** Picking the kind a hex already carries clears it — the same click that set
   * it takes it off, so "erase this hex" needs no separate eraser. */
  function toggleTerrain(kind: string): void {
    controller.onSetHexTerrain(tile?.terrain === kind ? null : kind);
  }
  function toggleContents(kind: string): void {
    controller.onSetHexContents(tile?.contents === kind ? null : kind);
  }
</script>

<section class="hex-tile" data-testid="hex-tile-panel">
  {#if !hex}
    <p class="hint" data-testid="hex-tile-empty">
      Pick a hex with the Select tool to set its terrain, contents and note.
    </p>
  {:else}
    <header class="head">
      <span class="coord" data-testid="hex-tile-coord">{hexLabel}</span>
      <button
        type="button"
        class="clear"
        data-testid="hex-tile-deselect"
        title="Stop editing this hex"
        onclick={() => (controller.selectedHex = null)}>Done</button
      >
    </header>

    <div class="group">
      <span class="glabel">Terrain</span>
      <div class="swatches">
        {#each TERRAINS as entry (entry.kind)}
          <button
            type="button"
            class="swatch"
            class:active={tile?.terrain === entry.kind}
            style={`--swatch:${entry.color}`}
            title={entry.label}
            aria-label={entry.label}
            aria-pressed={tile?.terrain === entry.kind}
            data-testid={`hex-terrain-${entry.kind}`}
            onclick={() => toggleTerrain(entry.kind)}
          >
            <img
              class="art"
              class:dark={overlayDark(entry.color)}
              src={assets.resolve(entry.ref)}
              alt=""
            />
          </button>
        {/each}
      </div>
    </div>

    <div class="group">
      <span class="glabel">Contents</span>
      <div class="swatches">
        {#each CONTENTS as entry (entry.kind)}
          <button
            type="button"
            class="swatch contents"
            class:active={tile?.contents === entry.kind}
            title={entry.label}
            aria-label={entry.label}
            aria-pressed={tile?.contents === entry.kind}
            data-testid={`hex-contents-${entry.kind}`}
            onclick={() => toggleContents(entry.kind)}
          >
            <img class="art dark" src={assets.resolve(entry.ref)} alt="" />
          </button>
        {/each}
      </div>
    </div>

    <MarkdownEditor
      label="Note"
      value={noteValue}
      placeholder="What the party finds here…"
      minHeight="4.5rem"
      testidPrefix="hex-note"
      onchange={(markdown) => (draft = markdown)}
      onblur={commitNote}
    />
  {/if}
</section>

<style>
  .hex-tile {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--line);
  }
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .coord {
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .clear {
    margin-left: auto;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-dim);
    font-size: 0.72rem;
    cursor: pointer;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .glabel {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2rem, 1fr));
    gap: 0.25rem;
  }
  .swatch {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 0;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--swatch, var(--bg-inset));
    cursor: pointer;
  }
  .swatch.active {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .art {
    width: 74%;
    height: 74%;
    object-fit: contain;
    pointer-events: none;
  }
  /* The catalog art is authored white and tinted at the render boundary
  (SPEC-030 §§2–3). `brightness(0)` is the DOM's version of that tint: black
  for a contents icon, and for a terrain overlay on a pale enough background. */
  .art.dark {
    filter: brightness(0);
  }
</style>
