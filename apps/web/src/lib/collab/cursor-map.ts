export interface YTextDeltaOp {
  retain?: number;
  insert?: string | object;
  delete?: number;
}
export type YTextDelta = YTextDeltaOp[];

/**
 * Maps a cursor position in the pre-change text through a Quill-style delta
 * (as produced by `Y.Text`'s `observe` event) to its corresponding position
 * in the post-change text. Used to keep the local user's caret stable when a
 * *remote* Yjs update rewrites the textarea's value out from under them —
 * without this, the browser's native cursor position desyncs from the new
 * content, and the next local keystroke lands at the wrong offset (words
 * get split/interleaved even though no data is actually lost in the CRDT
 * merge itself).
 */
export function mapCursorThroughDelta(delta: YTextDelta, pos: number): number {
  let oldIndex = 0;
  let newPos = pos;
  for (const op of delta) {
    if (oldIndex >= pos) break;
    if (op.retain !== undefined) {
      oldIndex += op.retain;
    } else if (op.insert !== undefined) {
      const len = typeof op.insert === 'string' ? op.insert.length : 1;
      newPos += len;
    } else if (op.delete !== undefined) {
      const removed = Math.min(op.delete, pos - oldIndex);
      newPos -= removed;
      oldIndex += op.delete;
    }
  }
  return Math.max(0, newPos);
}
