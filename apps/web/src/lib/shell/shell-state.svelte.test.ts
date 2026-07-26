import { beforeEach, describe, expect, it } from 'vitest';
import { ShellState } from './shell-state.svelte';

/** `ShellState` persists to `localStorage` and nowhere else (R1.3), so a tiny
 * in-memory stand-in is all these need. */
function installStorage(): Map<string, string> {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  return backing;
}

describe('ShellState.railSide', () => {
  let backing: Map<string, string>;

  beforeEach(() => {
    backing = installStorage();
  });

  it('defaults to the left edge', () => {
    expect(new ShellState('room-1').railSide).toBe('left');
  });

  it('persists a side change and restores it in a fresh instance', () => {
    const shell = new ShellState('room-1');
    shell.setRailSide('right');
    expect(new ShellState('room-1').railSide).toBe('right');
  });

  it('toggles between the two edges', () => {
    const shell = new ShellState('room-1');
    shell.toggleRailSide();
    expect(shell.railSide).toBe('right');
    shell.toggleRailSide();
    expect(shell.railSide).toBe('left');
  });

  it('keeps the preference per room, like the rest of the shell state', () => {
    new ShellState('room-1').setRailSide('right');
    expect(new ShellState('room-2').railSide).toBe('left');
  });

  it('falls back to the left edge for a payload written before the field existed', () => {
    backing.set('vtt-shell:room-1', JSON.stringify({ mainView: 'encounter', sheets: {} }));
    const shell = new ShellState('room-1');
    expect(shell.railSide).toBe('left');
    expect(shell.mainView).toBe('encounter');
  });

  it('ignores a garbage side rather than throwing', () => {
    backing.set('vtt-shell:room-1', JSON.stringify({ railSide: 'sideways', sheets: {} }));
    expect(new ShellState('room-1').railSide).toBe('left');
  });
});
