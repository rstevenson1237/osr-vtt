/**
 * The other half of `markdown.ts`: turning the rendered DOM back into markdown.
 *
 * The notes fields are WYSIWYG — the user edits formatted text directly — but
 * the *stored* value stays plain markdown, because that is what the Yjs docs
 * hold and what `applyTextDiff`/`mapCursorThroughDelta` operate on. So the
 * editor renders markdown to HTML with `renderMarkdown`, lets the browser edit
 * that, and serializes it straight back here on every keystroke.
 *
 * The supported surface is exactly `renderMarkdown`'s, so the round trip is
 * closed over the tag set it can emit: `h3`/`h4`/`h5` (from `#`/`##`/`###`),
 * `p`, `ul`/`li`, `strong`, `em`. Anything else a paste drags in is flattened
 * to its text.
 *
 * One deliberate normalization: `renderMarkdown` joins a paragraph's soft-
 * wrapped source lines with spaces, so a multi-line paragraph comes back as a
 * single line. Blank-line block separation is preserved, which is what the
 * markup actually depends on.
 */

const HEADING_HASHES: Record<string, string> = { H3: '#', H4: '##', H5: '###' };

/** Serializes one block's inline content (`strong`/`em`/text) to markdown. */
function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const inner = Array.from(el.childNodes).map(inlineToMarkdown).join('');
  switch (el.tagName) {
    case 'STRONG':
    case 'B':
      // `**` can't nest or wrap an empty run in this dialect — emitting the
      // markers around nothing would round-trip as literal asterisks.
      return inner.trim() ? `**${inner}**` : inner;
    case 'EM':
    case 'I':
      return inner.trim() ? `*${inner}*` : inner;
    case 'BR':
      return ' ';
    default:
      return inner;
  }
}

/** Collapses the whitespace `contenteditable` sprinkles into the source, so an
 * idle edit doesn't churn the CRDT with invisible changes. */
function tidy(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Serializes an editor surface's children back to markdown. Blocks are joined
 * by a blank line, matching what `renderMarkdown` expects to parse.
 */
export function domToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      // A bare text node — the browser's default when the surface is emptied
      // and retyped. Treat it as a paragraph.
      const text = tidy(child.textContent ?? '');
      if (text) blocks.push(text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;

    const hashes = HEADING_HASHES[el.tagName];
    if (hashes) {
      const text = tidy(inlineToMarkdown(el));
      if (text) blocks.push(`${hashes} ${text}`);
      continue;
    }

    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const items = Array.from(el.querySelectorAll(':scope > li'))
        .map((li) => tidy(inlineToMarkdown(li)))
        .filter((t) => t.length > 0)
        .map((t) => `- ${t}`);
      if (items.length > 0) blocks.push(items.join('\n'));
      continue;
    }

    // `p`, `div` (what contenteditable produces on Enter), and anything else:
    // one paragraph of inline content.
    const text = tidy(inlineToMarkdown(el));
    if (text) blocks.push(text);
  }

  return blocks.join('\n\n');
}
