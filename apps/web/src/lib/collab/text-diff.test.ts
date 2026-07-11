import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { applyTextDiff } from './text-diff.js';

function textFrom(value: string): Y.Text {
  const doc = new Y.Doc();
  const ytext = doc.getText('t');
  ytext.insert(0, value);
  return ytext;
}

describe('applyTextDiff', () => {
  it('appends to the end', () => {
    const ytext = textFrom('Hello');
    applyTextDiff(ytext, 'Hello', 'Hello, GM');
    expect(ytext.toString()).toBe('Hello, GM');
  });

  it('inserts at the start', () => {
    const ytext = textFrom('Hello');
    applyTextDiff(ytext, 'Hello', '>> Hello');
    expect(ytext.toString()).toBe('>> Hello');
  });

  it('deletes a middle range (backspace)', () => {
    const ytext = textFrom('Room 3: trapped');
    applyTextDiff(ytext, 'Room 3: trapped', 'Room 3: ');
    expect(ytext.toString()).toBe('Room 3: ');
  });

  it('replaces a middle range', () => {
    const ytext = textFrom('Room 3: empty');
    applyTextDiff(ytext, 'Room 3: empty', 'Room 3: trapped');
    expect(ytext.toString()).toBe('Room 3: trapped');
  });

  it('is a no-op for identical strings', () => {
    const ytext = textFrom('Same');
    applyTextDiff(ytext, 'Same', 'Same');
    expect(ytext.toString()).toBe('Same');
  });
});
