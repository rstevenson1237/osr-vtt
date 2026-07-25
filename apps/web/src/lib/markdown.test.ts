import { describe, expect, it } from 'vitest';
import { renderInline, renderMarkdown } from './markdown';

describe('renderInline', () => {
  it('renders bold and italic', () => {
    expect(renderInline('a **b** c *d*')).toBe('a <strong>b</strong> c <em>d</em>');
  });

  it('escapes html in plain and emphasised runs', () => {
    expect(renderInline('<img> **<b>**')).toBe('&lt;img&gt; <strong>&lt;b&gt;</strong>');
  });
});

describe('renderMarkdown', () => {
  it('renders the three heading levels as h3/h4/h5', () => {
    expect(renderMarkdown('# One\n## Two\n### Three')).toBe(
      '<h3>One</h3><h4>Two</h4><h5>Three</h5>',
    );
  });

  it('groups consecutive dash lines into one list', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('joins wrapped lines into a paragraph and splits on blank lines', () => {
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one two</p><p>three</p>');
  });

  it('closes a paragraph before a list and a list before a paragraph', () => {
    expect(renderMarkdown('intro\n- a\ntail')).toBe('<p>intro</p><ul><li>a</li></ul><p>tail</p>');
  });

  it('never emits tags from the source text', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n- <b>x</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders empty input as an empty fragment', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
