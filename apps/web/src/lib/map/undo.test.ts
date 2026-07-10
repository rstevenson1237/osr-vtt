import { describe, expect, it } from 'vitest';
import { UndoStack } from './undo.js';

describe('UndoStack', () => {
  it('undo hands back the last pushed op; redo hands back the same op', () => {
    const stack = new UndoStack<string>();
    stack.push('a');
    stack.push('b');
    expect(stack.undo()).toBe('b');
    expect(stack.redo()).toBe('b');
  });

  it('a new push clears the redo stack (Spec: forgiving, but no branching history)', () => {
    const stack = new UndoStack<string>();
    stack.push('a');
    stack.undo();
    stack.push('c');
    expect(stack.canRedo()).toBe(false);
  });

  it('canUndo/canRedo reflect stack occupancy', () => {
    const stack = new UndoStack<number>();
    expect(stack.canUndo()).toBe(false);
    stack.push(1);
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
    stack.undo();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);
  });

  it('undo/redo on an empty stack returns undefined without throwing', () => {
    const stack = new UndoStack<number>();
    expect(stack.undo()).toBeUndefined();
    expect(stack.redo()).toBeUndefined();
  });
});
