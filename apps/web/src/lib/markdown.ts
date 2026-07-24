/**
 * Minimal markdown renderer for the two long-form shared text fields in the
 * shell (design handoff "Markdown editing"): the party Notes panel and the
 * per-room players' notes. Deliberately *not* a library — the supported
 * surface is fixed and tiny:
 *
 *   `#` / `##` / `###` headings, `**bold**`, `*italic*`, `- ` bullet lists,
 *   and blank-line-separated paragraphs.
 *
 * Everything else is literal text. The input is player-authored and rendered
 * with `{@html}`, so every character that isn't part of a recognised construct
 * is HTML-escaped *before* any tag is emitted — the output can only ever
 * contain the small tag set this module writes itself.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
}

/** `**bold**` / `*italic*` within one line of already-block-classified text. */
export function renderInline(text: string): string {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      if (/^\*[^*]+\*$/.test(part)) return `<em>${escapeHtml(part.slice(1, -1))}</em>`;
      return escapeHtml(part);
    })
    .join('');
}

/** Renders `text` to a safe HTML fragment. Never returns tags other than
 * `<h3>`/`<h4>`/`<h5>`/`<p>`/`<ul>`/`<li>`/`<strong>`/`<em>`. */
export function renderMarkdown(text: string): string {
  const lines = (text ?? '').split('\n');
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushPara = (): void => {
    if (para.length === 0) return;
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = (): void => {
    if (list.length === 0) return;
    out.push(`<ul>${list.map((li) => `<li>${renderInline(li)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const raw of lines) {
    if (/^#{1,3}\s/.test(raw)) {
      flushPara();
      flushList();
      // `#` → h3 so a notes field never injects an h1/h2 into the page outline.
      const level = raw.match(/^#+/)![0].length;
      const tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      out.push(`<${tag}>${renderInline(raw.replace(/^#+\s*/, ''))}</${tag}>`);
    } else if (/^-\s/.test(raw)) {
      flushPara();
      list.push(raw.replace(/^-\s*/, ''));
    } else if (raw.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(raw);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}
