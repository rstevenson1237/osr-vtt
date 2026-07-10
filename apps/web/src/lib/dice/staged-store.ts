import { writable } from 'svelte/store';

/**
 * Staged dice tray (Plan §2.5): tapping a `roll` profile field "stages that
 * die in the dice tray — a UI shortcut, not a mechanic." This is purely
 * local UI state, never written to Firestore/RTDB; only the eventual
 * `rolls` doc (written by DiceTray) is shared state.
 */
export interface StagedDie {
  id: string;
  die: string;
}

function createStagedDiceStore() {
  const { subscribe, update, set } = writable<StagedDie[]>([]);
  return {
    subscribe,
    stage(die: string): void {
      update((list) => [
        ...list,
        { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, die },
      ]);
    },
    remove(id: string): void {
      update((list) => list.filter((d) => d.id !== id));
    },
    clear(): void {
      set([]);
    },
  };
}

export const stagedDice = createStagedDiceStore();
