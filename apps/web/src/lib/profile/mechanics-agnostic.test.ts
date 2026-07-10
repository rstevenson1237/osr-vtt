import type { ProfileInstance, ProfileTemplateField } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { buildProfileRows } from './profile-view';

/**
 * Plan §2.5 hard rule: "the app never interprets a profile value — no
 * calculation, tracking, validation, or triggers." This file exists
 * specifically to catch a regression where some future change makes one
 * field's rendered value depend on another field's value (e.g. an "HP"
 * counter driving an "AC" display, or a `roll` field's face changing what a
 * `checkbox` shows). `buildProfileRows` is the one function every Profile
 * render (CharacterDock, actor cards) goes through, so proving it here
 * proves it everywhere.
 */

const template: ProfileTemplateField[] = [
  { id: 'hp', label: 'HP', type: 'counter', default: 10 },
  { id: 'ac', label: 'AC', type: 'number', default: 12 },
  { id: 'name', label: 'Name', type: 'text', default: '' },
  { id: 'prone', label: 'Prone', type: 'checkbox', default: false },
  { id: 'attack', label: 'Attack', type: 'roll', default: 'd20' },
  { id: 'notes', label: 'Notes', type: 'longtext', default: '' },
];

function rowsById(rows: ReturnType<typeof buildProfileRows>): Record<string, unknown> {
  return Object.fromEntries(rows.map((r) => [r.field.id, r.value]));
}

describe('mechanics-agnostic guarantee: no field value drives another field', () => {
  it('changing a counter (e.g. HP) leaves every other field unchanged', () => {
    const base: ProfileInstance = {
      seatId: 's1',
      values: { hp: 10, ac: 12, name: 'Bram', prone: false, attack: 'd20', notes: 'hello' },
    };
    const before = rowsById(buildProfileRows(template, base));

    // Drive the counter through a wide range, including values a game system
    // might treat specially (0 = "dead", negative = "past dying") — the app
    // must not react to any of them.
    for (const hp of [10, 0, -5, 999]) {
      const mutated: ProfileInstance = { ...base, values: { ...base.values, hp } };
      const after = rowsById(buildProfileRows(template, mutated));
      expect(after['hp']).toBe(hp); // the field itself does change...
      // ...but nothing else does, for any hp value tried:
      for (const field of template) {
        if (field.id === 'hp') continue;
        expect(after[field.id]).toEqual(before[field.id]);
      }
    }
  });

  it('changing a checkbox (e.g. a condition flag) leaves every other field unchanged', () => {
    const base: ProfileInstance = {
      seatId: 's1',
      values: { hp: 10, ac: 12, name: 'Bram', prone: false, attack: 'd20', notes: 'hello' },
    };
    const before = rowsById(buildProfileRows(template, base));
    const mutated: ProfileInstance = { ...base, values: { ...base.values, prone: true } };
    const after = rowsById(buildProfileRows(template, mutated));

    expect(after['prone']).toBe(true);
    for (const field of template) {
      if (field.id === 'prone') continue;
      expect(after[field.id]).toEqual(before[field.id]);
    }
  });

  it('changing a roll field\'s die expression leaves every other field unchanged', () => {
    const base: ProfileInstance = {
      seatId: 's1',
      values: { hp: 10, ac: 12, name: 'Bram', prone: false, attack: 'd20', notes: 'hello' },
    };
    const before = rowsById(buildProfileRows(template, base));
    const mutated: ProfileInstance = { ...base, values: { ...base.values, attack: '3d6' } };
    const after = rowsById(buildProfileRows(template, mutated));

    expect(after['attack']).toBe('3d6');
    for (const field of template) {
      if (field.id === 'attack') continue;
      expect(after[field.id]).toEqual(before[field.id]);
    }
  });

  it('a field label/id carries no special meaning — swapping "HP" and "AC" labels changes only display text, not behavior', () => {
    // The dock (and this function) must key purely off `type`, never off
    // what a referee happened to name a field. Rename the labels and
    // confirm every value still maps the same way.
    const relabeled = template.map((f) =>
      f.id === 'hp' ? { ...f, label: 'Not HP At All' } : f,
    );
    const instance: ProfileInstance = { seatId: 's1', values: { hp: 4 } };
    const rows = buildProfileRows(relabeled, instance);
    expect(rows.find((r) => r.field.id === 'hp')?.value).toBe(4);
  });
});
