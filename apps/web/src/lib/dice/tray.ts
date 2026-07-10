import type { AdvantageMode, DiceMacro, RollMode } from '@osr-vtt/shared';

/**
 * The dynamic dice tray (Plan §7 Phase 3): purely local UI state, never
 * written to Firestore/RTDB directly — only the eventual `rolls` doc
 * (written by DiceTray.svelte) and `macros` docs (explicit "save") are
 * shared state. Tapping a Profile `roll` field just stages a die here
 * (Plan §2.5: "a UI shortcut, not a mechanic").
 */

export interface StagedDie {
  id: string;
  /** The raw expression as staged, e.g. "d6" or "2d6" — expanded into
   * individual dice only at roll time (see `dice/engine.ts`). */
  die: string;
}

export interface TrayState {
  dice: StagedDie[];
  modifier: number;
  advantage: AdvantageMode;
  mode: RollMode;
}

export const EMPTY_TRAY: TrayState = {
  dice: [],
  modifier: 0,
  advantage: 'normal',
  mode: 'separate',
};

function freshId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stageDie(tray: TrayState, die: string): TrayState {
  return { ...tray, dice: [...tray.dice, { id: freshId(), die }] };
}

export function removeDie(tray: TrayState, id: string): TrayState {
  return { ...tray, dice: tray.dice.filter((d) => d.id !== id) };
}

/** Clears the staged dice but keeps the modifier/advantage/mode settings —
 * a roll-after-roll convenience, not a rule. */
export function clearDice(tray: TrayState): TrayState {
  return { ...tray, dice: [] };
}

export function setModifier(tray: TrayState, modifier: number): TrayState {
  return { ...tray, modifier };
}

export function setAdvantage(tray: TrayState, advantage: AdvantageMode): TrayState {
  return { ...tray, advantage };
}

export function setMode(tray: TrayState, mode: RollMode): TrayState {
  return { ...tray, mode };
}

/** Replays a saved macro (Plan §7 Phase 3) — replaces the tray's contents
 * with the macro's snapshot, ready to roll. */
export function loadMacro(macro: Pick<DiceMacro, 'dice' | 'modifier' | 'mode' | 'advantage'>): TrayState {
  return {
    dice: macro.dice.map((die) => ({ id: freshId(), die })),
    modifier: macro.modifier,
    advantage: macro.advantage,
    mode: macro.mode,
  };
}
