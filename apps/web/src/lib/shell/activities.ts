import type { MainViewDef, MainViewId, QuickSheetDef, QuickSheetId } from './types';

/** The three main views — one full-screen stage at a time. Assets stays
 * referee-only; Map and Encounter are open to every seat. */
export const MAIN_VIEWS: MainViewDef[] = [
  { id: 'map', title: 'Map', icon: 'map', group: 'world', availability: 'all' },
  { id: 'encounter', title: 'Encounter', icon: 'encounter', group: 'play', availability: 'all' },
  { id: 'assets', title: 'Assets', icon: 'assets', group: 'world', availability: 'gm' },
];

/** The quick sheets, in rail order. Almost none is GM-gated — map drawing and
 * room notes are player-accessible; the few referee-only *controls* inside a
 * sheet carry their own `isGM` gate. Random tables are the exception: they are
 * referee prep rather than shared play (a player who can read the wandering-
 * monster table is reading the referee's notes), so that one is gated the same
 * way the Assets main view is. */
export const QUICK_SHEETS: QuickSheetDef[] = [
  { id: 'maptools', title: 'Map tools', icon: 'tools', group: 'world' },
  { id: 'character', title: 'Character', icon: 'characters', group: 'records' },
  { id: 'roll', title: 'Roll', icon: 'dice', group: 'play' },
  { id: 'room', title: 'Room', icon: 'room', group: 'referee' },
  {
    id: 'tables',
    title: 'Random tables',
    icon: 'tables',
    group: 'referee',
    availability: 'gm',
  },
];

export function mainViewsFor(isGM: boolean): MainViewDef[] {
  return MAIN_VIEWS.filter((v) => v.availability === 'all' || isGM);
}

/** The quick sheets a given seat can see. Mirrors `mainViewsFor` — everything
 * downstream (the rail, the docked stack, the digit shortcuts) works off this
 * rather than `QUICK_SHEETS` so a player never gets a dead button or a dead
 * key where a referee-only sheet would be. */
export function quickSheetsFor(isGM: boolean): QuickSheetDef[] {
  return QUICK_SHEETS.filter((s) => (s.availability ?? 'all') === 'all' || isGM);
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

/** The leading digits switch the main view (indexing the *visible* list, so
 * players never hit a gap where the referee-only Assets view would be); the
 * rest toggle quick sheets in rail order (R1.7's digit shortcuts, re-pointed
 * at the new registries). */
export function mainViewForDigit(digit: number, isGM: boolean): MainViewId | null {
  const visible = mainViewsFor(isGM);
  const idx = digit - 1;
  return idx >= 0 && idx < visible.length ? visible[idx]!.id : null;
}

/**
 * Quick sheets continue the digit run immediately after the *visible* main
 * views — so a player (who can't see the referee-only Assets view) gets
 * 1-2 for views and 3-6 for sheets, with no dead key in between.
 *
 * This used to subtract `MAIN_VIEWS.length` unconditionally, so for a player
 * digit `3` hit neither a view nor a sheet and simply did nothing. The sheet
 * list is filtered by role for the same reason.
 */
export function quickSheetForDigit(digit: number, isGM: boolean): QuickSheetId | null {
  const sheets = quickSheetsFor(isGM);
  const idx = digit - 1 - mainViewsFor(isGM).length;
  return idx >= 0 && idx < sheets.length ? sheets[idx]!.id : null;
}

/** The digit ranges to advertise in the shortcut sheet, which used to hardcode
 * "1 – 3" / "4 – 7" regardless of role. */
export function digitRanges(isGM: boolean): { views: string; sheets: string } {
  const views = mainViewsFor(isGM).length;
  const sheets = quickSheetsFor(isGM).length;
  return {
    views: `1 – ${views}`,
    sheets: `${views + 1} – ${views + sheets}`,
  };
}
