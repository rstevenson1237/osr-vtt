import type { ProfileFieldType, ProfileTemplateField, ProfileValue } from '@osr-vtt/shared';

/**
 * Pure GM edits to a room's `profileTemplate` (Plan §2.5): "the GM may add/
 * remove/reorder fields anytime; instances tolerate changes." These
 * functions only rearrange the field *list* — they never touch a stored
 * profile value.
 */

function slugify(label: string, existing: ProfileTemplateField[]): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const root = base || 'field';
  const ids = new Set(existing.map((f) => f.id));
  if (!ids.has(root)) return root;
  let n = 2;
  while (ids.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

export function addField(
  template: ProfileTemplateField[],
  input: { label: string; type: ProfileFieldType; default?: ProfileValue },
): ProfileTemplateField[] {
  const field: ProfileTemplateField = {
    id: slugify(input.label, template),
    label: input.label,
    type: input.type,
    ...(input.default !== undefined ? { default: input.default } : {}),
  };
  return [...template, field];
}

export function removeField(
  template: ProfileTemplateField[],
  fieldId: string,
): ProfileTemplateField[] {
  return template.filter((f) => f.id !== fieldId);
}

export function moveField(
  template: ProfileTemplateField[],
  fieldId: string,
  direction: -1 | 1,
): ProfileTemplateField[] {
  const index = template.findIndex((f) => f.id === fieldId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= template.length) return template;
  const next = [...template];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Flip a field's `pinned` flag (Master Plan v2, R8.1) — pinned fields render
 * read-only on the Encounter Board actor card. A pure list edit, like the
 * others here; it never touches a stored profile value. */
export function togglePinned(
  template: ProfileTemplateField[],
  fieldId: string,
): ProfileTemplateField[] {
  return template.map((f) => (f.id === fieldId ? { ...f, pinned: !f.pinned } : f));
}

/** Best-effort coercion of a plain-text default-value input into the shape
 * `ProfileValue` needs for the field's declared type — display convenience
 * only, never a validation gate (Plan §2.5: the app never validates a
 * value). */
export function coerceDefault(type: ProfileFieldType, raw: string): ProfileValue {
  if (type === 'number' || type === 'counter') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === 'checkbox') return raw.trim().toLowerCase() === 'true';
  return raw;
}
