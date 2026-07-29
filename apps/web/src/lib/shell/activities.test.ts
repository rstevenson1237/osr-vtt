import { describe, expect, it } from 'vitest';
import {
  MAIN_VIEWS,
  QUICK_SHEETS,
  digitRanges,
  mainViewForDigit,
  mainViewsFor,
  quickSheetForDigit,
  quickSheetsFor,
} from './activities';

describe('shell registries', () => {
  it('hides referee-only main views and quick sheets from players', () => {
    expect(mainViewsFor(false).map((v) => v.id)).not.toContain('assets');
    expect(mainViewsFor(true).map((v) => v.id)).toEqual(MAIN_VIEWS.map((v) => v.id));

    expect(quickSheetsFor(false).map((s) => s.id)).not.toContain('tables');
    expect(quickSheetsFor(true).map((s) => s.id)).toEqual(QUICK_SHEETS.map((s) => s.id));
  });

  it('treats a sheet with no availability as open to everyone', () => {
    const open = QUICK_SHEETS.filter((s) => s.availability === undefined);
    expect(open.length).toBeGreaterThan(0);
    const playerIds = quickSheetsFor(false).map((s) => s.id);
    for (const def of open) expect(playerIds).toContain(def.id);
  });
});

describe('digit shortcuts', () => {
  it('runs views then sheets with no dead key in between, for either role', () => {
    for (const isGM of [true, false]) {
      const views = mainViewsFor(isGM);
      const sheets = quickSheetsFor(isGM);
      const hit: string[] = [];
      for (let digit = 1; digit <= views.length + sheets.length; digit++) {
        const id = mainViewForDigit(digit, isGM) ?? quickSheetForDigit(digit, isGM);
        expect(id, `digit ${digit} (isGM=${isGM})`).not.toBeNull();
        hit.push(id!);
      }
      expect(hit).toEqual([...views.map((v) => v.id), ...sheets.map((s) => s.id)]);
    }
  });

  it('stops at the end of the visible run', () => {
    const last = mainViewsFor(false).length + quickSheetsFor(false).length;
    expect(mainViewForDigit(last + 1, false)).toBeNull();
    expect(quickSheetForDigit(last + 1, false)).toBeNull();
  });

  it('advertises ranges matching what the keys actually do', () => {
    for (const isGM of [true, false]) {
      const views = mainViewsFor(isGM).length;
      const sheets = quickSheetsFor(isGM).length;
      expect(digitRanges(isGM)).toEqual({
        views: `1 – ${views}`,
        sheets: `${views + 1} – ${views + sheets}`,
      });
    }
  });
});
