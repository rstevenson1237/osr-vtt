import { UndoStack } from '../map/undo';

/** A single entry on the shared undo stack (DEC-108) — the closures a pusher
 * supplies to reverse and reapply whatever it just committed. Op-agnostic on
 * purpose: `VectorMapView`'s vector-geometry edits and `RoomsPanel`'s Keys
 * (map-room) edits push onto the same stack without sharing an op type, each
 * carrying its own store calls. */
export interface UndoEntry {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/**
 * One undo/redo stack per client (DEC-108, SPEC-056 §2.1). Created once per
 * `RoomShell` instance and shared through context — the same lifetime as
 * `MapToolController` — rather than living inside `VectorMapView` and being
 * discarded on its `{#key}` remount, with the Keys (map-room) sheet keeping a
 * second stack of its own. `RoomShell` clears it explicitly whenever the
 * viewed map changes, so an entry never points at a map this client can no
 * longer see. Undo only ever reverses this client's own actions; every write
 * it replays goes through the same store calls the original edit did, so a
 * conflicting remote edit resolves last-writer-wins like any other write.
 */
export class UndoController {
  private stack = new UndoStack<UndoEntry>();
  canUndo = $state(false);
  canRedo = $state(false);

  private sync(): void {
    this.canUndo = this.stack.canUndo();
    this.canRedo = this.stack.canRedo();
  }

  push(entry: UndoEntry): void {
    this.stack.push(entry);
    this.sync();
  }

  async undo(): Promise<void> {
    const entry = this.stack.undo();
    if (!entry) return;
    await entry.undo();
    this.sync();
  }

  async redo(): Promise<void> {
    const entry = this.stack.redo();
    if (!entry) return;
    await entry.redo();
    this.sync();
  }

  /** Cleared whenever the viewed map changes (DEC-108) — called by
   * `RoomShell`'s active-map effect, not by either pusher. */
  clear(): void {
    this.stack.clear();
    this.sync();
  }
}
