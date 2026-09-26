import { describe, expect, it } from 'vitest';
import { ModalStack } from './modal-stack.svelte';

describe('ModalStack', () => {
  it('starts empty', () => {
    const stack = new ModalStack();
    expect(stack.depth).toBe(0);
  });

  it('a single entry is its own top', () => {
    const stack = new ModalStack();
    const id = stack.open();
    expect(stack.depth).toBe(1);
    expect(stack.isTop(id)).toBe(true);
  });

  it('the most recently opened entry is top; the one below it is not', () => {
    const stack = new ModalStack();
    const bottom = stack.open();
    const top = stack.open();
    expect(stack.depth).toBe(2);
    expect(stack.isTop(top)).toBe(true);
    expect(stack.isTop(bottom)).toBe(false);
  });

  it('closing the top entry restores the one below it to top', () => {
    const stack = new ModalStack();
    const bottom = stack.open();
    const top = stack.open();
    stack.close(top);
    expect(stack.depth).toBe(1);
    expect(stack.isTop(bottom)).toBe(true);
  });

  it('closing empties the stack and isTop is false for the closed id', () => {
    const stack = new ModalStack();
    const id = stack.open();
    stack.close(id);
    expect(stack.depth).toBe(0);
    expect(stack.isTop(id)).toBe(false);
  });

  it('closing out of order still leaves the correct entry on top', () => {
    const stack = new ModalStack();
    const first = stack.open();
    const second = stack.open();
    const third = stack.open();
    stack.close(second);
    expect(stack.depth).toBe(2);
    expect(stack.isTop(third)).toBe(true);
    stack.close(third);
    expect(stack.isTop(first)).toBe(true);
  });
});
