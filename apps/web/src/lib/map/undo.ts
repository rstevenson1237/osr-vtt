/**
 * Generic undo/redo stack (Plan §7 Phase 1 "single-key undo/redo"). Holds
 * forward-applied ops; `undo()` hands back the last one for the caller to
 * invert-and-reapply, `redo()` hands back the next one to reapply as-is.
 * Framework/domain-agnostic — `Op` is whatever `tools.ts` defines.
 */
export class UndoStack<Op> {
  private undoStack: Op[] = [];
  private redoStack: Op[] = [];

  push(op: Op): void {
    this.undoStack.push(op);
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Pops the last applied op and moves it to the redo stack. The caller is
   * responsible for inverting and reapplying it. */
  undo(): Op | undefined {
    const op = this.undoStack.pop();
    if (op !== undefined) this.redoStack.push(op);
    return op;
  }

  /** Pops the next redo-able op and moves it back to the undo stack. The
   * caller reapplies it forward (unchanged). */
  redo(): Op | undefined {
    const op = this.redoStack.pop();
    if (op !== undefined) this.undoStack.push(op);
    return op;
  }
}
