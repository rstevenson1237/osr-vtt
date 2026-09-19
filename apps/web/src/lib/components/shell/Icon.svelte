<script lang="ts" module>
  import type { IconId } from '../../shell/types';

  /** Single-colour stroke icons drawn as `currentColor` (Master Plan v2, R1.4)
   * so the group / hover / active colour is pure CSS. What each glyph depicts
   * follows SPEC-043's subject rule (the implement, then the thing itself,
   * then the resulting shape; group icons under `map/tool-groups.ts` name the
   * gesture instead — SPEC-043 §3). No multicolour art, no emoji in UI chrome.
   * The markup below is a fixed constant (never user input), so the `{@html}`
   * render is safe. */
  const MARKUP: Record<IconId, string> = {
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    // Crossed swords with guards and grips (SPEC-051 §6 — two bare crossed
    // strokes were an X, the same silhouette as `close` one row away).
    encounter:
      '<path d="M4 4l11 11M4 4h3.5M4 4v3.5"/><path d="M13.5 17.5l4-4M16.5 16.5 20 20"/><path d="M20 4 9 15M20 4h-3.5M20 4v3.5"/><path d="M6.5 13.5l4 4M7.5 16.5 4 20"/>',
    // A true d20: hexagon outline, top vertex centred between two mirrored
    // facets, three spokes from the centre to alternating outer points
    // (SPEC-043 §4 — the old facet sat at the top like a cube's, and read as
    // a crate).
    dice: '<path d="M12 2 21 7.5v9L12 22 3 16.5v-9L12 2z"/><path d="M12 12V2M12 12 21 16.5M12 12 3 16.5"/>',
    characters:
      '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3 2.8-4.6 5.5-4.6S13.8 16 14.5 19"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.7c2.6.1 4.3 1.6 4.9 4.3"/>',
    log: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    chat: '<path d="M20 12a8 8 0 1 0-3.1 6.3L21 20l-1.3-3.6A7.9 7.9 0 0 0 20 12z"/>',
    assets:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-4 4 3 4-4 5 5"/>',
    // A toothed cog outline with a hub (SPEC-051 §6 — a circle with eight
    // detached ticks read as a sun or an asterisk at 14px; the teeth here are
    // wide enough — 13° of 45° — to stay open at 16px).
    session:
      '<path d="M19.52 10.33L21.94 10.87L21.94 13.13L19.52 13.67L18.49 16.14L19.83 18.23L18.23 19.83L16.14 18.49L13.67 19.52L13.13 21.94L10.87 21.94L10.33 19.52L7.86 18.49L5.77 19.83L4.17 18.23L5.51 16.14L4.48 13.67L2.06 13.13L2.06 10.87L4.48 10.33L5.51 7.86L4.17 5.77L5.77 4.17L7.86 5.51L10.33 4.48L10.87 2.06L13.13 2.06L13.67 4.48L16.14 5.51L18.23 4.17L19.83 5.77L18.49 7.86z"/><circle cx="12" cy="12" r="2.7"/>',
    // A latched toolbox with a carry handle (SPEC-043 §4 — the old diagonal
    // chisel merged head into shaft at palette size).
    tools:
      '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/><rect x="10.5" y="11" width="3" height="4" rx="0.5" fill="currentColor" stroke="none"/>',
    // A plan-view room: four walls, a doorway, the leaf swung in (SPEC-051
    // §6 — a tall rectangle with one dot was a door with a knob, and the
    // palette already has a `door`).
    room: '<path d="M4 20V4h16v16h-9"/><path d="M11 20v-6"/><path d="M11 14a6 6 0 0 0-6 6"/>',
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
    // Select has no glyph of its own: it is one tool again (SPEC-037), so the
    // `cursor` group icon above is its button.
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5A6.5 6.5 0 0 1 5 13.5V11a1.5 1.5 0 0 1 3 0"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    // A straightedge lying flat, with graduations off one edge (SPEC-043 §4
    // — the old diagonal rhombus read as a silhouette, not a ruler).
    ruler:
      '<rect x="2" y="9" width="20" height="6" rx="1"/><path d="M6 9V6M10 9V7M14 9V6M18 9V7"/>',
    ping: '<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/>',
    rect: '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/>',
    // The resulting shape: a closed L-shaped run of fixed width (SPEC-051 §6
    // — two nested L-curves read as a return arrow, not a passage).
    corridor: '<path d="M4 3h6v10h10v7H4V3z"/>',
    // A regular pentagon with the centre dot and one radius — also the
    // tool's drag gesture (SPEC-051 §6 — a regular hexagon was the same
    // silhouette as the `dice` d20 one rail over).
    ngon: '<path d="M12 3l9.04 6.56-3.46 10.63H6.42L2.96 9.56 12 3z"/><path d="M12 12.5 21.04 9.56"/><circle cx="12" cy="12.5" r="1.6" fill="currentColor" stroke="none"/>',
    brush:
      '<path d="M6 21c-1.7 0-3-1.3-3-3 0-1.4 1-2 1-3.5a2.5 2.5 0 1 1 5 0C9 16 9 21 6 21z"/><path d="M8.5 14.5 19 4"/>',
    wall: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M9 6v6M15 12v6M9 18v3M15 3v3"/>',
    path: '<path d="M4 19c3-8 6 3 9-4s4-6 7-6"/>',
    // An irregular hexagon, so the click-each-vertex tool (irregular) and
    // `ngon` (regular) tell apart at a glance (SPEC-051 §6 — the old glyph
    // was a regular pentagon, which is what `ngon` draws today).
    polygon: '<path d="M4 6l9-2 7 5-2 8-10 3-4-6z"/>',
    label: '<path d="M3 8a2 2 0 0 1 2-2h8l8 6-8 6H5a2 2 0 0 1-2-2V8z"/><path d="M7 12h.01"/>',
    symbol: '<rect x="4" y="9" width="16" height="10" rx="1.5"/><path d="M4 13h16M8 9V6h8v3"/>',
    door: '<path d="M6 3h9a2 2 0 0 1 2 2v16H6V3z"/><path d="M13.5 12h.01"/><path d="M4 21h16"/>',
    // Battle map capture (SPEC-029 §1): a crop frame's corner brackets.
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',

    // ---- hex-only tools (SPEC-051 §5) ----
    // Two edges and a dashed centre line: the thing itself, not `path`
    // borrowed.
    road: '<path d="M6 3v18M18 3v18"/><path d="M12 4v3M12 10.5v3M12 17v3"/>',
    // Two wave courses, distinct from `path`'s single free curve.
    river: '<path d="M3 9c3-3 6 3 9 0s6-3 9 0"/><path d="M3 15c3-3 6 3 9 0s6-3 9 0"/>',
    // A mountain range, distinct from the `shapes` group icon it borrowed.
    terrain: '<path d="M2.5 19l6.5-11 4 6.5 2.5-4 6 8.5z"/>',
    // A flat-top hexagon, distinct from the pointy `dice` d20 and `ngon`.
    hex: '<path d="M7 4h10l4.5 8L17 20H7L2.5 12 7 4z"/>',

    // ---- chrome verbs (SPEC-051 §5) — replace a typed character ----
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
    collapse: '<path d="M20 10h-6V4M14 10l6-6M4 14h6v6M10 14l-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    undo: '<path d="M8 6 4 10l4 4"/><path d="M4 10h10a5 5 0 0 1 0 10h-4"/>',
    redo: '<path d="M16 6l4 4-4 4"/><path d="M20 10H10a5 5 0 0 0 0 10h4"/>',
    grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    'arrow-up': '<path d="M12 20V4M5 11l7-7 7 7"/>',
    'arrow-down': '<path d="M12 4v16M5 13l7 7 7-7"/>',
    'arrow-left': '<path d="M20 12H4M11 5l-7 7 7 7"/>',
    pin: '<path d="M9 3h6l-.8 6 2.8 3v2H7v-2l2.8-3L9 3z"/><path d="M12 14v7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.4-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    crown: '<path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/>',
    'panel-left': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    'panel-right': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
    paragraph: '<path d="M18 4h-7.5a4 4 0 0 0 0 8H13"/><path d="M13 4v16M17 4v16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',

    // ---- actions that are text-only buttons today (SPEC-051 §5) ----
    link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1.5 1.5"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1.5-1.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 19h16"/>',
    rotate: '<path d="M19.88 13.39A8 8 0 1 1 17.14 5.87"/><path d="M16.35 2.15L17.14 5.87L13.34 5.74"/>',
    flip: '<path d="M12 3v18"/><path d="M9 7 4 12l5 5M15 7l5 5-5 5"/>',
    fog: '<path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 8.6a4.8 4.8 0 0 1-.5 9.4H7z"/>',
    'eye-off': '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><path d="M5 5l14 14"/>',
    'add-person':
      '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c.8-3.6 3.4-5.5 7-5.5 1.2 0 2.3.2 3.2.6"/><path d="M18 14v6M15 17h6"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
    note: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  };
</script>

<script lang="ts">
  /** `size` picks one of the two render stops `theme/sizing.css` owns
   * (SPEC-051 §2): the default `--icon` for a standalone square control, or
   * `'sm'` for `--icon-sm`, a control inside an already-dense row. Both track
   * pointer coarseness on their own. A caller passes a literal pixel number
   * only where the size is genuinely fixed by something other than the
   * device — no caller in the shell needs that today. */
  let { name, size }: { name: IconId; size?: number | 'sm' } = $props();
  const dim = $derived(
    typeof size === 'number' ? `${size}px` : size === 'sm' ? 'var(--icon-sm)' : 'var(--icon)',
  );
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  style={`width:${dim};height:${dim}`}
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
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
