import { describe, expect, it, vi } from 'vitest';
import { UndoController } from './undo-controller.svelte';

describe('UndoController', () => {
  it('canUndo/canRedo reflect pushed entries', () => {
    const ctrl = new UndoController();
    expect(ctrl.canUndo).toBe(false);
    ctrl.push({ undo: vi.fn(), redo: vi.fn() });
    expect(ctrl.canUndo).toBe(true);
    expect(ctrl.canRedo).toBe(false);
  });

  it('undo() calls the popped entry undo closure and moves it onto the redo side', async () => {
    const ctrl = new UndoController();
    const entry = { undo: vi.fn(), redo: vi.fn() };
    ctrl.push(entry);
    await ctrl.undo();
    expect(entry.undo).toHaveBeenCalledOnce();
    expect(ctrl.canUndo).toBe(false);
    expect(ctrl.canRedo).toBe(true);
  });

  it('redo() calls the popped entry redo closure', async () => {
    const ctrl = new UndoController();
    const entry = { undo: vi.fn(), redo: vi.fn() };
    ctrl.push(entry);
    await ctrl.undo();
    await ctrl.redo();
    expect(entry.redo).toHaveBeenCalledOnce();
    expect(ctrl.canUndo).toBe(true);
    expect(ctrl.canRedo).toBe(false);
  });

  it('two different pushers share one history, in the order either pushed (DEC-108)', async () => {
    const ctrl = new UndoController();
    const fromCanvas = { undo: vi.fn(), redo: vi.fn() };
    const fromKeysSheet = { undo: vi.fn(), redo: vi.fn() };
    ctrl.push(fromCanvas);
    ctrl.push(fromKeysSheet);
    await ctrl.undo();
    expect(fromKeysSheet.undo).toHaveBeenCalledOnce();
    expect(fromCanvas.undo).not.toHaveBeenCalled();
    await ctrl.undo();
    expect(fromCanvas.undo).toHaveBeenCalledOnce();
  });

  it('clear() discards history and resets the flags', async () => {
    const ctrl = new UndoController();
    ctrl.push({ undo: vi.fn(), redo: vi.fn() });
    await ctrl.undo();
    ctrl.clear();
    expect(ctrl.canUndo).toBe(false);
    expect(ctrl.canRedo).toBe(false);
  });
});
