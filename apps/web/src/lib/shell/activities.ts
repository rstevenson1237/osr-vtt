import type { MainViewDef, MainViewId, QuickSheetDef, QuickSheetId } from './types';

/** The three main views — one full-screen stage at a time. Assets stays
 * referee-only; Map and Encounter are open to every seat. */
export const MAIN_VIEWS: MainViewDef[] = [
  { id: 'map', title: 'Map', icon: 'map', group: 'world', availability: 'all' },
  { id: 'encounter', title: 'Encounter', icon: 'encounter', group: 'play', availability: 'all' },
  { id: 'assets', title: 'Assets', icon: 'assets', group: 'world', availability: 'gm' },
];

/** The four quick sheets, in rail order. None is GM-gated — map drawing and
 * room notes are player-accessible; the few referee-only *controls* inside a
 * sheet carry their own `isGM` gate. */
export const QUICK_SHEETS: QuickSheetDef[] = [
  { id: 'maptools', title: 'Map tools', icon: 'tools', group: 'world' },
  { id: 'character', title: 'Character', icon: 'characters', group: 'records' },
  { id: 'roll', title: 'Roll', icon: 'dice', group: 'play' },
  { id: 'room', title: 'Room', icon: 'room', group: 'referee' },
];

export function mainViewsFor(isGM: boolean): MainViewDef[] {
  return MAIN_VIEWS.filter((v) => v.availability === 'all' || isGM);
}

export function mainViewById(id: MainViewId): MainViewDef {
  const found = MAIN_VIEWS.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown main view: ${id}`);
  return found;
}

export function quickSheetById(id: QuickSheetId): QuickSheetDef {
  const found = QUICK_SHEETS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown quick sheet: ${id}`);
  return found;
}

/** `1`–`3` switch the main view (indexing the *visible* list, so players never
 * hit a gap where the referee-only Assets view would be); `4`–`7` toggle quick
 * sheets in rail order (R1.7's digit shortcuts, re-pointed at the new
 * registries). */
export function mainViewForDigit(digit: number, isGM: boolean): MainViewId | null {
  const visible = mainViewsFor(isGM);
  const idx = digit - 1;
  return idx >= 0 && idx < visible.length ? visible[idx]!.id : null;
}

export function quickSheetForDigit(digit: number): QuickSheetId | null {
  const idx = digit - 1 - MAIN_VIEWS.length;
  return idx >= 0 && idx < QUICK_SHEETS.length ? QUICK_SHEETS[idx]!.id : null;
}
