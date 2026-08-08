<script lang="ts">
  import { renderMarkdown } from '../markdown';
  import { domToMarkdown } from '../markdown-dom';

  /** A long-form shared text field, edited WYSIWYG (Shell UI Redesign,
   * "Markdown editing"). Used by the party Notes panel and the per-room
   * players' notes.
   *
   * This used to be an Edit ⇄ Preview toggle over a raw-markdown textarea.
   * It is now a single formatted surface with a small toolbar: what you type
   * is what you see, and the markdown syntax stays out of the way.
   *
   * The *stored* value is still plain markdown — both callers are CRDT-backed
   * and their Yjs docs hold text, so `applyTextDiff` keeps working unchanged.
   * `renderMarkdown` paints the surface, the browser edits it, and
   * `domToMarkdown` serializes it straight back on every keystroke. The caller
   * still owns the value and the change handler.
   *
   * Re-rendering the surface on every keystroke would destroy the caret, so
   * `innerHTML` is only rewritten when the incoming `value` differs from what
   * this editor last emitted — i.e. on a *remote* edit or an external reset.
   * When that happens while the user is typing, the caret is saved and
   * restored by its character offset in the *rendered* text (see
   * `caretOffset`/`restoreCaret`). A concurrent remote insertion earlier in
   * the document can still nudge the caret by the length of that insertion;
   * the textarea it replaced mapped this exactly through the Yjs delta, but
   * that delta is in markdown coordinates and the surface is in rendered
   * ones, so an exact mapping is not available here. The bounded drift beats
   * the alternative of the caret jumping to the start of the field.
   */
  let {
    label,
    value,
    placeholder = '',
    minHeight = '6rem',
    testidPrefix,
    empty,
    readOnly = false,
    onchange,
    onblur,
  }: {
    label?: string;
    value: string;
    placeholder?: string;
    minHeight?: string;
    testidPrefix: string;
    empty?: string;
    readOnly?: boolean;
    /** Receives the surface's content as markdown. */
    onchange: (markdown: string) => void;
    onblur?: () => void;
  } = $props();

  let surfaceEl = $state<HTMLDivElement | undefined>();
  /** The last markdown this editor emitted. Anything else arriving in `value`
   * came from elsewhere and has to be painted. */
  let lastEmitted = $state<string | null>(null);

  const isEmpty = $derived(value.trim().length === 0);

  /** The caret's offset in the surface's plain text, or null when the caret
   * isn't in this surface. */
  function caretOffset(el: HTMLElement): number | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const before = range.cloneRange();
    before.selectNodeContents(el);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString().length;
  }

  /** Places the caret at `offset` characters into the surface's text, clamped
   * to its end — the repainted DOM may be shorter than it was. */
  function restoreCaret(el: HTMLElement, offset: number): void {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let seen = 0;
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (seen + len >= offset) {
        const range = document.createRange();
        range.setStart(node, offset - seen);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
      seen += len;
      node = walker.nextNode();
    }
    // Past the end (or an empty surface): collapse to the very end.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  $effect(() => {
    const el = surfaceEl;
    const incoming = value;
    if (!el) return;
    if (incoming === lastEmitted) return;
    const focused = document.activeElement === el;
    const offset = focused ? caretOffset(el) : null;
    el.innerHTML = renderMarkdown(incoming);
    lastEmitted = incoming;
    if (offset !== null) restoreCaret(el, offset);
  });

  function emit(): void {
    if (!surfaceEl) return;
    const markdown = domToMarkdown(surfaceEl);
    lastEmitted = markdown;
    onchange(markdown);
  }

  /** The toolbar drives the browser's own editing commands. `execCommand` is
   * formally deprecated but is the only built-in way to apply inline styles
   * across a selection without hand-rolling range surgery; every target
   * browser still implements the handful used here, and the result is
   * normalized back to markdown by `domToMarkdown` regardless of the exact
   * markup it produces. */
  function exec(command: string, arg?: string): void {
    surfaceEl?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  /** `#`/`##`/`###` render as h3/h4/h5 (see `markdown.ts` — a notes field never
   * injects an h1 into the page outline), so the buttons name the markdown
   * level while the command names the tag. */
  const HEADINGS: Array<{ level: string; tag: string; title: string }> = [
    { level: 'H1', tag: 'h3', title: 'Heading' },
    { level: 'H2', tag: 'h4', title: 'Subheading' },
    { level: 'H3', tag: 'h5', title: 'Sub-subheading' },
  ];
</script>

<div class="md-editor">
  <div class="head">
    {#if label}<span class="label">{label}</span>{/if}
    {#if !readOnly}
      <div
        class="toolbar"
        role="toolbar"
        aria-label="Formatting"
        data-testid={`${testidPrefix}-toolbar`}
      >
        <button
          type="button"
          class="tbtn bold"
          title="Bold"
          aria-label="Bold"
          data-testid={`${testidPrefix}-bold`}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => exec('bold')}>B</button
        >
        <button
          type="button"
          class="tbtn italic"
          title="Italic"
          aria-label="Italic"
          data-testid={`${testidPrefix}-italic`}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => exec('italic')}>I</button
        >
        {#each HEADINGS as h (h.tag)}
          <button
            type="button"
            class="tbtn"
            title={h.title}
            aria-label={h.title}
            data-testid={`${testidPrefix}-${h.tag}`}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => exec('formatBlock', h.tag)}>{h.level}</button
          >
        {/each}
        <button
          type="button"
          class="tbtn"
          title="Bulleted list"
          aria-label="Bulleted list"
          data-testid={`${testidPrefix}-list`}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => exec('insertUnorderedList')}>•</button
        >
        <button
          type="button"
          class="tbtn"
          title="Plain paragraph"
          aria-label="Plain paragraph"
          data-testid={`${testidPrefix}-paragraph`}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => exec('formatBlock', 'p')}>¶</button
        >
      </div>
    {/if}
  </div>

  <div class="surface-wrap" style={`min-height:${minHeight}`}>
    <div
      bind:this={surfaceEl}
      class="surface"
      class:read-only={readOnly}
      contenteditable={!readOnly}
      role="textbox"
      tabindex="0"
      aria-multiline="true"
      aria-label={label ?? 'Notes'}
      data-testid={`${testidPrefix}-input`}
      oninput={emit}
      onblur={() => onblur?.()}
    ></div>
    {#if isEmpty}
      <!-- Placeholder sits behind the surface rather than inside it, so it can
      never be selected, styled, or serialized into the stored markdown. -->
      <span class="placeholder" data-testid={`${testidPrefix}-placeholder`}>
        {readOnly ? (empty ?? '') : placeholder}
      </span>
    {/if}
  </div>
</div>

<style>
  .md-editor {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .label {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .toolbar {
    margin-left: auto;
    display: flex;
    gap: 2px;
  }
  .tbtn {
    min-width: 1.5rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.75rem;
    line-height: 1.4;
  }
  @media (hover: hover) {
    .tbtn:hover {
      color: var(--text);
      background: var(--bg-inset);
      border-color: var(--line);
    }
  }
  .tbtn.bold {
    font-weight: 700;
  }
  .tbtn.italic {
    font-style: italic;
  }

  .surface-wrap {
    position: relative;
    display: flex;
  }
  .surface {
    flex: 1;
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font-size: 0.84rem;
    overflow-y: auto;
  }
  .surface:focus {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }
  .surface.read-only {
    border-color: var(--line);
  }
  .placeholder {
    position: absolute;
    left: 0.5rem;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 0.84rem;
    color: var(--text-dim);
    pointer-events: none;
  }

  /* The rendered markdown, kept compact enough to live inside a quick sheet. */
  .surface :global(h3),
  .surface :global(h4),
  .surface :global(h5) {
    margin: 0.6rem 0 0.25rem;
    line-height: 1.25;
  }
  .surface :global(h3) {
    font-size: 1rem;
  }
  .surface :global(h4) {
    font-size: 0.9rem;
  }
  .surface :global(h5) {
    font-size: 0.84rem;
  }
  .surface :global(:first-child) {
    margin-top: 0;
  }
  .surface :global(p) {
    margin: 0 0 0.5rem;
  }
  .surface :global(ul) {
    margin: 0 0 0.5rem;
    padding-left: 1.2rem;
  }
  .surface :global(li) {
    margin: 0.1rem 0;
  }
</style>
