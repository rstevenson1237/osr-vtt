/**
 * In-memory map state + snapshot undo/redo (SPEC §8.5 / REVIEW R1). No
 * Firestore, no store contract — this whole module is the "local-memory only"
 * of §9.1. Undo is snapshot-based because regions merge/split (§2.4): a delta
 * is not well-defined across a split, so we snapshot {floor, walls, doors} —
 * exactly the batch-of-snapshots the codebase already uses for entity ops.
 */
import type { Door, MultiPoly, Segment } from './geometry/types.js';

export interface Snapshot {
  floor: MultiPoly;
  walls: Segment[];
  doors: Door[];
}

export class MapState {
  floor: MultiPoly = [];
  walls: Segment[] = [];
  doors: Door[] = [];

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  private snapshot(): Snapshot {
    return {
      floor: structuredClone(this.floor),
      walls: structuredClone(this.walls),
      doors: structuredClone(this.doors),
    };
  }

  /** Call BEFORE mutating, to capture the pre-op state as one undo step. */
  checkpoint(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  private restore(s: Snapshot): void {
    this.floor = s.floor;
    this.walls = s.walls;
    this.doors = s.doors;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshot());
    this.restore(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.restore(next);
  }

  reset(): void {
    this.checkpoint();
    this.floor = [];
    this.walls = [];
    this.doors = [];
  }
}

let doorSeq = 0;
export function nextDoorId(): string {
  return `door-${++doorSeq}`;
}
