import { describe, expect, it } from 'vitest';
import { mapCursorThroughDelta } from './cursor-map.js';

describe('mapCursorThroughDelta', () => {
  it('shifts the cursor forward when text is inserted before it', () => {
    // "Hello" -> "XX Hello", cursor was at the end (5).
    const delta = [{ insert: 'XX ' }, { retain: 5 }];
    expect(mapCursorThroughDelta(delta, 5)).toBe(8);
  });

  it('leaves the cursor untouched when text is inserted after it', () => {
    // "Hello" -> "HelloXX", cursor was right after "Hel" (3).
    const delta = [{ retain: 5 }, { insert: 'XX' }];
    expect(mapCursorThroughDelta(delta, 3)).toBe(3);
  });

  it('does not move the cursor past text inserted exactly at it', () => {
    // Cursor at position 2 in "Hello"; a remote insert lands exactly there.
    const delta = [{ retain: 2 }, { insert: 'XX' }, { retain: 3 }];
    expect(mapCursorThroughDelta(delta, 2)).toBe(2);
  });

  it('shifts the cursor back when text is deleted before it', () => {
    // "Hello World" -> "World", cursor was after "Hello " (6).
    const delta = [{ delete: 6 }];
    expect(mapCursorThroughDelta(delta, 6)).toBe(0);
  });

  it('clamps a deletion that only partially precedes the cursor', () => {
    // Cursor at 3 ("Hel|lo"); a delete of 5 chars starting at 0 overlaps
    // only the first 3 chars before the cursor.
    const delta = [{ delete: 5 }];
    expect(mapCursorThroughDelta(delta, 3)).toBe(0);
  });

  it('leaves the cursor untouched when text is deleted after it', () => {
    const delta = [{ retain: 3 }, { delete: 2 }];
    expect(mapCursorThroughDelta(delta, 3)).toBe(3);
  });

  it('is a no-op for an empty delta', () => {
    expect(mapCursorThroughDelta([], 4)).toBe(4);
  });

  it('never returns a negative position', () => {
    const delta = [{ delete: 100 }];
    expect(mapCursorThroughDelta(delta, 2)).toBe(0);
  });
});
