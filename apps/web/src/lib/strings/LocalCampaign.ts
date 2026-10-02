/** User-facing copy for LocalCampaign (SPEC-055 §5). */
export const LocalCampaignStrings = {
  close: 'Close',
  notSaved: (error: string) => `Not saved — ${error}`,
  saving: 'Saving…',
  unsavedAuto: 'Unsaved changes',
  unsavedManual: 'Unsaved — press Save',
} as const;
