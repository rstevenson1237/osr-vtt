import type { ProfileTemplateField } from '@osr-vtt/shared';

/** Seeded onto every new room (Plan §8.7): proves the mechanics-agnostic
 * profile pipeline end to end with one field of each of the three types
 * this phase's dock needs to handle. */
export const STARTER_PROFILE_TEMPLATE: ProfileTemplateField[] = [
  { id: 'name', label: 'Name', type: 'text', default: '' },
  { id: 'torches', label: 'Torches', type: 'counter', default: 3 },
  { id: 'combat', label: 'Combat', type: 'roll', default: 'd6' },
];
