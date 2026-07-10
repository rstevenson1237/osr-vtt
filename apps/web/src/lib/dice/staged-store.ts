import { writable } from 'svelte/store';
import type { AdvantageMode, DiceMacro, RollMode } from '@osr-vtt/shared';
import {
  clearDice,
  EMPTY_TRAY,
  loadMacro,
  removeDie,
  setAdvantage,
  setMode,
  setModifier,
  stageDie,
  type TrayState,
} from './tray';

/** Svelte-store wrapper around the pure tray logic in `tray.ts`. */
function createDiceTrayStore() {
  const { subscribe, update, set } = writable<TrayState>(EMPTY_TRAY);
  return {
    subscribe,
    stage(die: string): void {
      update((tray) => stageDie(tray, die));
    },
    remove(id: string): void {
      update((tray) => removeDie(tray, id));
    },
    clearDice(): void {
      update((tray) => clearDice(tray));
    },
    reset(): void {
      set(EMPTY_TRAY);
    },
    setModifier(modifier: number): void {
      update((tray) => setModifier(tray, modifier));
    },
    setAdvantage(advantage: AdvantageMode): void {
      update((tray) => setAdvantage(tray, advantage));
    },
    setMode(mode: RollMode): void {
      update((tray) => setMode(tray, mode));
    },
    loadMacro(macro: Pick<DiceMacro, 'dice' | 'modifier' | 'mode' | 'advantage'>): void {
      set(loadMacro(macro));
    },
  };
}

export const diceTray = createDiceTrayStore();
