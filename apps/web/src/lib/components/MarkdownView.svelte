<script lang="ts">
  import { renderMarkdown } from '../markdown';

  /** Renders the app's lightweight markdown (headings, bold, italic, bullets)
   * for the shared party notes and the per-room players' notes.
   *
   * `renderMarkdown` HTML-escapes every character of the source that isn't
   * part of a recognised construct and only ever emits its own small tag set,
   * so the `{@html}` below cannot render player-authored markup. */
  let {
    text,
    empty = 'Nothing written yet.',
    testid,
  }: {
    text: string;
    empty?: string;
    testid?: string;
  } = $props();

  const html = $derived(renderMarkdown(text));
</script>

<div class="md" data-testid={testid}>
  {#if html}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html html}
  {:else}
    <p class="empty">{empty}</p>
  {/if}
</div>

<style>
  .md {
    font-size: 0.84rem;
    line-height: 1.5;
    word-break: break-word;
  }
  .md :global(p) {
    margin: 0 0 0.5rem;
  }
  .md :global(ul) {
    margin: 0 0 0.5rem;
    padding-left: 1.25rem;
  }
  .md :global(h3),
  .md :global(h4),
  .md :global(h5) {
    margin: 0.6rem 0 0.35rem;
    color: var(--accent-text);
  }
  .md :global(h3) {
    font-size: 0.95rem;
  }
  .md :global(h4) {
    font-size: 0.86rem;
  }
  .md :global(h5) {
    font-size: 0.8rem;
  }
  .md :global(> :last-child) {
    margin-bottom: 0;
  }
  .empty {
    margin: 0;
    color: var(--text-dim);
    font-style: italic;
  }
</style>
