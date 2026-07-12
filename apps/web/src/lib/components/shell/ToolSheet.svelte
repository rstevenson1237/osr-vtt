<script lang="ts">
  import MapToolPalette from './MapToolPalette.svelte';
  import type { MapToolController } from '../../shell/map-tool-controller.svelte';

  /** Mobile tool bottom-sheet (Master Plan v2, R1.8). A drag-handle sheet with
   * closed / half / full snap points that houses the current activity's tool
   * palette (Map only in WI-2/WI-3). Tapping the handle cycles the snap points;
   * dragging it resizes live and snaps to the nearest point on release. */
  let { controller }: { controller: MapToolController } = $props();

  type Snap = 'closed' | 'half' | 'full';

  const TOP_BAR = 40;
  const BOTTOM_BAR = 52;
  const CLOSED_H = 46;

  let snap = $state<Snap>('closed');
  let dragging = $state(false);
  let dragHeight = $state(CLOSED_H);
  let viewportH = $state(typeof window !== 'undefined' ? window.innerHeight : 800);

  $effect(() => {
    const onResize = (): void => {
      viewportH = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  // Stage height available above the bottom bar; the sheet never exceeds it.
  const avail = $derived(Math.max(200, viewportH - TOP_BAR - BOTTOM_BAR));
  function snapHeight(s: Snap): number {
    if (s === 'closed') return CLOSED_H;
    return s === 'half' ? Math.round(avail * 0.5) : Math.round(avail * 0.85);
  }
  const height = $derived(dragging ? dragHeight : snapHeight(snap));
  const open = $derived(!dragging ? snap !== 'closed' : dragHeight > CLOSED_H + 20);

  let startY = 0;
  let startH = CLOSED_H;
  let moved = false;

  function onHandleDown(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = true;
    moved = false;
    startY = e.clientY;
    startH = snapHeight(snap);
    dragHeight = startH;
  }

  function onHandleMove(e: PointerEvent): void {
    if (!dragging) return;
    const dy = startY - e.clientY; // drag up ⇒ taller
    if (Math.abs(dy) > 4) moved = true;
    dragHeight = Math.min(snapHeight('full'), Math.max(CLOSED_H, startH + dy));
  }

  function onHandleUp(e: PointerEvent): void {
    if (!dragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragging = false;
    if (!moved) {
      // Tap cycles closed → half → full → closed.
      snap = snap === 'closed' ? 'half' : snap === 'half' ? 'full' : 'closed';
      return;
    }
    const targets: Snap[] = ['closed', 'half', 'full'];
    snap = targets.reduce((best, s) =>
      Math.abs(snapHeight(s) - dragHeight) < Math.abs(snapHeight(best) - dragHeight) ? s : best,
    );
  }
</script>

<section
  class="tool-sheet"
  class:open
  style={`height:${height}px; --bottom-bar:${BOTTOM_BAR}px`}
  data-testid="tool-sheet"
  data-snap={snap}
>
  <button
    class="handle-hit"
    data-testid="tool-sheet-handle"
    aria-label={open ? 'Collapse map tools' : 'Expand map tools'}
    onpointerdown={onHandleDown}
    onpointermove={onHandleMove}
    onpointerup={onHandleUp}
  >
    <span class="grip"></span>
    {#if !open}
      <span class="peek-label">Drag up for map tools</span>
    {/if}
  </button>

  {#if open}
    <div class="sheet-label">Map tools</div>
    <div class="palette">
      <MapToolPalette {controller} />
    </div>
    <div class="touch-hint">1-finger tool · 2-finger pan · pinch zoom</div>
  {/if}
</section>

<style>
  .tool-sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--bottom-bar);
    z-index: 30;
    background: var(--bg-panel);
    border-top: 1px solid var(--line-strong);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
  .handle-hit {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 0 4px;
    background: transparent;
    border: none;
    cursor: grab;
    color: var(--text-dim);
    touch-action: none;
  }
  .grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
  }
  .peek-label {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .sheet-label {
    flex: 0 0 auto;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-dim);
    padding: 0 0.9rem 0.3rem;
  }
  .palette {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0.6rem;
  }
  .touch-hint {
    flex: 0 0 auto;
    text-align: center;
    font-size: 0.62rem;
    color: var(--text-dim);
    padding: 0.4rem 0 0.5rem;
    border-top: 1px dashed var(--line);
  }
</style>
