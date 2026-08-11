import type { ProfileTemplateField } from '@osr-vtt/shared';

/** Seeded onto every new room (Plan §8.7): proves the mechanics-agnostic
 * profile pipeline end to end with one field of each of the three types
 * this phase's dock needs to handle. */
export const STARTER_PROFILE_TEMPLATE: ProfileTemplateField[] = [
  { id: 'hp', label: 'HP', type: 'number' },
  { id: 'toHit', label: 'To Hit', type: 'roll', default: 'd20' },
  { id: 'initiative', label: 'Initiative', type: 'initiative', default: 'd6' },
];
