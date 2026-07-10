import type { ProfileInstance, ProfileTemplateField } from '@osr-vtt/shared';
import { describe, expect, it } from 'vitest';
import { buildProfileRows } from './profile-view';

const template: ProfileTemplateField[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'torches', label: 'Torches', type: 'counter', default: 3 },
  { id: 'combat', label: 'Combat', type: 'roll', default: 'd6' },
];

describe('buildProfileRows', () => {
  it('fills in an unset field from its template default', () => {
    const rows = buildProfileRows(template, undefined);
    expect(rows).toEqual([
      { field: template[0], value: '' },
      { field: template[1], value: 3 },
      { field: template[2], value: 'd6' },
    ]);
  });

  it('prefers the stored instance value over the template default', () => {
    const instance: ProfileInstance = { seatId: 's1', values: { torches: 1, name: 'Bram' } };
    const rows = buildProfileRows(template, instance);
    expect(rows.find((r) => r.field.id === 'torches')?.value).toBe(1);
    expect(rows.find((r) => r.field.id === 'name')?.value).toBe('Bram');
  });

  it('shows a newly-added template field as empty/default even with an older instance doc', () => {
    const instance: ProfileInstance = { seatId: 's1', values: { name: 'Bram' } };
    const rows = buildProfileRows(template, instance);
    expect(rows.find((r) => r.field.id === 'combat')?.value).toBe('d6');
  });

  it('hides a field removed from the template even if stale data exists for it', () => {
    const instance: ProfileInstance = {
      seatId: 's1',
      values: { name: 'Bram', ghostField: 'should not appear' },
    };
    const shrunkTemplate = template.filter((f) => f.id !== 'combat');
    const rows = buildProfileRows(shrunkTemplate, instance);
    expect(rows.some((r) => r.field.id === 'combat')).toBe(false);
    expect(rows.some((r) => (r.field.id as string) === 'ghostField')).toBe(false);
  });
});
