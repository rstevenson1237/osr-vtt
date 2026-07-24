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
