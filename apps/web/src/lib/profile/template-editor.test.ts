import type { ProfileTemplateField } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { addField, coerceDefault, moveField, removeField, togglePinned } from './template-editor';

const template: ProfileTemplateField[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'torches', label: 'Torches', type: 'counter', default: 3 },
];

describe('addField', () => {
  it('appends a field with a slugified id derived from the label', () => {
    const next = addField(template, { label: 'AC', type: 'number' });
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ id: 'ac', label: 'AC', type: 'number' });
  });

  it('de-duplicates ids that collide with an existing field', () => {
    const next = addField(template, { label: 'Name', type: 'text' });
    expect(next[2]!.id).toBe('name-2');
  });

  it('includes a default only when one is provided', () => {
    const next = addField(template, { label: 'Combat', type: 'roll', default: 'd6' });
    expect(next[2]).toEqual({ id: 'combat', label: 'Combat', type: 'roll', default: 'd6' });
  });
});

describe('removeField', () => {
  it('drops the field with the given id, leaving the rest untouched', () => {
    const next = removeField(template, 'torches');
    expect(next).toEqual([template[0]]);
  });

  it('is a no-op if the id is not present', () => {
    expect(removeField(template, 'nope')).toEqual(template);
  });
});

describe('moveField', () => {
  it('swaps a field with its neighbor', () => {
    const next = moveField(template, 'torches', -1);
    expect(next.map((f) => f.id)).toEqual(['torches', 'name']);
  });

  it('is a no-op past either end', () => {
    expect(moveField(template, 'name', -1)).toEqual(template);
    expect(moveField(template, 'torches', 1)).toEqual(template);
  });
});

describe('togglePinned', () => {
  it('flips only the targeted field, from unset to true', () => {
    const next = togglePinned(template, 'name');
    expect(next[0]).toEqual({ id: 'name', label: 'Name', type: 'text', pinned: true });
    expect(next[1]).toEqual(template[1]);
  });

  it('flips a pinned field back off', () => {
    const pinned: ProfileTemplateField[] = [{ id: 'hp', label: 'HP', type: 'number', pinned: true }];
    expect(togglePinned(pinned, 'hp')[0]!.pinned).toBe(false);
  });

  it('is a no-op if the id is not present', () => {
    expect(togglePinned(template, 'nope')).toEqual(template);
  });
});

describe('coerceDefault', () => {
  it('parses numbers for number/counter fields, falling back to 0', () => {
    expect(coerceDefault('number', '7')).toBe(7);
    expect(coerceDefault('counter', 'nope')).toBe(0);
  });

  it('parses booleans for checkbox fields', () => {
    expect(coerceDefault('checkbox', 'true')).toBe(true);
    expect(coerceDefault('checkbox', 'false')).toBe(false);
  });

  it('passes text/longtext/roll through unchanged', () => {
    expect(coerceDefault('text', 'hello')).toBe('hello');
    expect(coerceDefault('roll', '2d6')).toBe('2d6');
  });
});
