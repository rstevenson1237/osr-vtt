import type { ProfileInstance, ProfileTemplateField, ProfileValue } from '@osr-vtt/shared';

export interface ProfileFieldRow {
  field: ProfileTemplateField;
  value: ProfileValue;
}

function defaultForType(type: ProfileTemplateField['type']): ProfileValue {
  switch (type) {
    case 'checkbox':
      return false;
    case 'number':
    case 'counter':
      return 0;
    case 'roll':
      return 'd6';
    case 'text':
    case 'longtext':
    default:
      return '';
  }
}

/**
 * Renders a profile instance against the room's *current* template,
 * generically (Plan §2.5) — the dock must render any template without
 * bespoke per-field code, and instances must tolerate template drift:
 * - a field the GM just added reads as its default/empty (not an error)
 * - a field the GM removed is simply absent from the output, even if the
 *   instance document still has stale stored data for it
 *
 * This function contains no per-field-id logic and inspects no value for
 * game meaning — it only maps { id, type } -> a display value (hard rule,
 * §2.5: the app never interprets a profile value).
 */
export function buildProfileRows(
  template: ProfileTemplateField[],
  instance: ProfileInstance | undefined,
): ProfileFieldRow[] {
  return template.map((field) => {
    const stored = instance?.values?.[field.id];
    const value = stored ?? field.default ?? defaultForType(field.type);
    return { field, value };
  });
}
