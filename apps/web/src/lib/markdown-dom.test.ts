// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.js';
import { domToMarkdown } from './markdown-dom.js';

function surfaceFrom(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

/** What the WYSIWYG editor actually does on every keystroke: paint the stored
 * markdown, read the surface back. */
function roundTrip(markdown: string): string {
  return domToMarkdown(surfaceFrom(renderMarkdown(markdown)));
}

describe('domToMarkdown', () => {
  it('serializes headings back to their hash levels', () => {
    expect(domToMarkdown(surfaceFrom('<h3>Vault</h3>'))).toBe('# Vault');
    expect(domToMarkdown(surfaceFrom('<h4>Vault</h4>'))).toBe('## Vault');
    expect(domToMarkdown(surfaceFrom('<h5>Vault</h5>'))).toBe('### Vault');
  });

  it('serializes bold and italic', () => {
    expect(domToMarkdown(surfaceFrom('<p>a <strong>b</strong> <em>c</em></p>'))).toBe(
      'a **b** *c*',
    );
  });

  it('accepts the b/i tags execCommand may produce', () => {
    expect(domToMarkdown(surfaceFrom('<p><b>b</b> <i>c</i></p>'))).toBe('**b** *c*');
  });

  it('serializes a list, one dash per item', () => {
    expect(domToMarkdown(surfaceFrom('<ul><li>one</li><li>two</li></ul>'))).toBe('- one\n- two');
  });

  it('treats a contenteditable `div` block as a paragraph', () => {
    expect(domToMarkdown(surfaceFrom('<div>one</div><div>two</div>'))).toBe('one\n\ntwo');
  });

  it('treats a bare text node as a paragraph', () => {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode('just typing'));
    expect(domToMarkdown(el)).toBe('just typing');
  });

  it('flattens unsupported markup to its text', () => {
    expect(domToMarkdown(surfaceFrom('<p><span style="color:red">red</span></p>'))).toBe('red');
  });

  it('drops empty blocks rather than emitting blank markdown', () => {
    expect(domToMarkdown(surfaceFrom('<p></p><p>real</p><p>  </p>'))).toBe('real');
  });

  it('never emits markers around an empty run', () => {
    expect(domToMarkdown(surfaceFrom('<p><strong></strong>text</p>'))).toBe('text');
  });

  it('collapses the non-breaking spaces contenteditable inserts', () => {
    expect(domToMarkdown(surfaceFrom('<p>a  b</p>'))).toBe('a b');
  });

  it('is empty for an empty surface', () => {
    expect(domToMarkdown(surfaceFrom(''))).toBe('');
  });
});

describe('markdown round trip (render then serialize)', () => {
  it.each([
    '# Vault',
    '## Vault',
    '### Vault',
    'a plain paragraph',
    'text with **bold** and *italic*',
    '- one\n- two',
    '# Heading\n\nA paragraph.\n\n- a\n- b',
  ])('is stable for %j', (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('is idempotent — a second pass changes nothing', () => {
    const once = roundTrip('# Vault\n\nSome **notes**.\n\n- a\n- b');
    expect(roundTrip(once)).toBe(once);
  });

  it('normalizes a soft-wrapped paragraph onto one line (documented lossiness)', () => {
    expect(roundTrip('one\ntwo')).toBe('one two');
  });

  it('normalizes runs of blank lines down to a single block break', () => {
    expect(roundTrip('a\n\n\n\nb')).toBe('a\n\nb');
  });
});
