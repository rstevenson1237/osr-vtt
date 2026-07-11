import type * as Y from 'yjs';

/**
 * Applies a plain-text edit (from a `<textarea>`'s input event) to a
 * `Y.Text` as a minimal common-prefix/common-suffix diff, rather than
 * clearing and re-inserting the whole document on every keystroke — smaller
 * Yjs updates over the RTDB transport, and it doesn't clobber a concurrent
 * remote edit sitting in an unrelated part of the text.
 */
export function applyTextDiff(ytext: Y.Text, oldValue: string, newValue: string): void {
  let start = 0;
  const maxStart = Math.min(oldValue.length, newValue.length);
  while (start < maxStart && oldValue[start] === newValue[start]) start++;

  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  if (oldEnd > start) ytext.delete(start, oldEnd - start);
  if (newEnd > start) ytext.insert(start, newValue.slice(start, newEnd));
}
