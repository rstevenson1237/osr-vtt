<script lang="ts" module>
  import type { IconId } from '../../shell/types';

  /** Single-colour stroke icons drawn as `currentColor` (Master Plan v2, R1.4)
   * so the group / hover / active colour is pure CSS. Inner SVG traced verbatim
   * from the R1 mockup (`docs/mockups/vtt-ui-mockups.html`). No multicolour art,
   * no emoji in UI chrome. The markup below is a fixed constant (never user
   * input), so the `{@html}` render is safe. */
  const MARKUP: Record<IconId, string> = {
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    encounter: '<path d="M4 18 16 6M8 6l12 12"/>',
    dice: '<path d="M12 2 21 7.5v9L12 22 3 16.5v-9L12 2z"/><path d="M12 2v7.5M3 7.5l9 2 9-2M12 22v-8"/>',
    characters:
      '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3 2.8-4.6 5.5-4.6S13.8 16 14.5 19"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.7c2.6.1 4.3 1.6 4.9 4.3"/>',
    log: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    chat: '<path d="M20 12a8 8 0 1 0-3.1 6.3L21 20l-1.3-3.6A7.9 7.9 0 0 0 20 12z"/>',
    assets:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-4 4 3 4-4 5 5"/>',
    session:
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    tools: '<path d="M14.5 4.5a4 4 0 0 0 5 5L9.5 19.5a2.1 2.1 0 0 1-3-3z"/><path d="M5 5l3 3"/>',
    room: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 12h.01"/>',
    tables: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    fullscreen:
      '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',
    'fullscreen-exit':
      '<path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4"/>',

    // ---- map tool group icons (`map/tool-groups.ts`) ----
    cursor: '<path d="M5 3l14 8-6 1.6L10.4 19 5 3z"/>',
    // A viewfinder frame: the View group reads the map, it doesn't change it.
    viewfinder:
      '<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="2"/>',
    // Overlapping rectangle + circle: the click-and-drag shape family.
    shapes:
      '<rect x="3" y="3" width="11" height="11" rx="1"/><circle cx="15.5" cy="15.5" r="5.5"/>',
    // A polyline with its vertices called out: click a point, then another.
    multipoint:
      '<path d="M4 18l6-9 5 4 5-8"/><circle cx="4" cy="18" r="1.8" fill="currentColor"/><circle cx="10" cy="9" r="1.8" fill="currentColor"/><circle cx="15" cy="13" r="1.8" fill="currentColor"/><circle cx="20" cy="5" r="1.8" fill="currentColor"/>',
    // A stamp pressing down: the overlay tools place a finished object.
    stamp: '<path d="M9 3h6l-1.2 6H10.2L9 3z"/><path d="M5 12h14v3H5z"/><path d="M6 18h12"/>',

    // ---- individual tools inside the groups ----
    // Select: the three things you can grab. A corner handle, a highlighted
    // edge, a whole shape with its bounding box.
    vertex:
      '<path d="M4 20V7a3 3 0 0 1 3-3h13"/><rect x="8" y="12" width="8" height="8" rx="1"/><circle cx="8" cy="12" r="2.4" fill="currentColor"/>',
    edge: '<path d="M5 18L19 6"/><circle cx="5" cy="18" r="2.2" fill="currentColor"/><circle cx="19" cy="6" r="2.2" fill="currentColor"/>',
    object:
      '<path d="M8 8h8v8H8z"/><path d="M4 4h3M17 4h3M4 20h3M17 20h3M4 4v3M20 4v3M4 17v3M20 17v3"/>',
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5A6.5 6.5 0 0 1 5 13.5V11a1.5 1.5 0 0 1 3 0"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    // A ruler laid on the diagonal, with its tick marks.
    ruler:
      '<path d="M14.5 2.8 21.2 9.5a1.2 1.2 0 0 1 0 1.7L11.2 21.2a1.2 1.2 0 0 1-1.7 0L2.8 14.5a1.2 1.2 0 0 1 0-1.7L12.8 2.8a1.2 1.2 0 0 1 1.7 0z"/><path d="M8 8l2 2M11.5 11.5l2 2M15 15l2 2"/>',
    ping: '<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
    rect: '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/>',
    corridor: '<path d="M4 4v10a4 4 0 0 0 4 4h12"/><path d="M9 4v7a1 1 0 0 0 1 1h10"/>',
    ngon: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9L12 3z"/>',
    brush:
      '<path d="M6 21c-1.7 0-3-1.3-3-3 0-1.4 1-2 1-3.5a2.5 2.5 0 1 1 5 0C9 16 9 21 6 21z"/><path d="M8.5 14.5 19 4"/>',
    wall: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M9 6v6M15 12v6M9 18v3M15 3v3"/>',
    path: '<path d="M4 19c3-8 6 3 9-4s4-6 7-6"/>',
    polygon: '<path d="M12 3l9 7-3.5 10h-11L3 10l9-7z"/>',
    label: '<path d="M3 8a2 2 0 0 1 2-2h8l8 6-8 6H5a2 2 0 0 1-2-2V8z"/><path d="M7 12h.01"/>',
    symbol: '<rect x="4" y="9" width="16" height="10" rx="1.5"/><path d="M4 13h16M8 9V6h8v3"/>',
    door: '<path d="M6 3h9a2 2 0 0 1 2 2v16H6V3z"/><path d="M13.5 12h.01"/><path d="M4 21h16"/>',
  };
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconId; size?: number } = $props();
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html MARKUP[name]}
</svg>

<style>
  .icon {
    display: block;
  }
</style>
