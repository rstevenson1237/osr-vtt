import { describe, expect, it } from 'vitest';
import {
  clearDice,
  EMPTY_TRAY,
  loadMacro,
  removeDie,
  setAdvantage,
  setMode,
  setModifier,
  stageDie,
} from './tray';

describe('stageDie / removeDie', () => {
  it('appends a staged die with a fresh id', () => {
    const tray = stageDie(EMPTY_TRAY, 'd6');
    expect(tray.dice).toHaveLength(1);
    expect(tray.dice[0]!.die).toBe('d6');
  });

  it('removes a staged die by id, leaving the rest', () => {
    let tray = stageDie(EMPTY_TRAY, 'd6');
    tray = stageDie(tray, 'd20');
    const [first, second] = tray.dice;
    tray = removeDie(tray, first!.id);
    expect(tray.dice).toEqual([second]);
  });
});

describe('clearDice', () => {
  it('clears staged dice but keeps modifier/advantage/mode', () => {
    let tray = stageDie(EMPTY_TRAY, 'd6');
    tray = setModifier(tray, 3);
    tray = setAdvantage(tray, 'advantage');
    tray = setMode(tray, 'summed');
    tray = clearDice(tray);
    expect(tray.dice).toEqual([]);
    expect(tray.modifier).toBe(3);
    expect(tray.advantage).toBe('advantage');
    expect(tray.mode).toBe('summed');
  });
});

describe('setModifier / setAdvantage / setMode', () => {
  it('each sets exactly its own field', () => {
    expect(setModifier(EMPTY_TRAY, 5).modifier).toBe(5);
    expect(setAdvantage(EMPTY_TRAY, 'disadvantage').advantage).toBe('disadvantage');
    expect(setMode(EMPTY_TRAY, 'summed').mode).toBe('summed');
  });
});

describe('loadMacro', () => {
  it('replaces the tray contents with the macro snapshot', () => {
    const tray = loadMacro({
      dice: ['d20', 'd6'],
      modifier: 2,
      mode: 'summed',
      advantage: 'advantage',
    });
    expect(tray.dice.map((d) => d.die)).toEqual(['d20', 'd6']);
    expect(tray.modifier).toBe(2);
    expect(tray.mode).toBe('summed');
    expect(tray.advantage).toBe('advantage');
  });

  it('gives each loaded die a fresh id, independent of prior tray state', () => {
    const tray = loadMacro({ dice: ['d6'], modifier: 0, mode: 'separate', advantage: 'normal' });
    expect(tray.dice[0]!.id).toBeTruthy();
  });
});
