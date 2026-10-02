/** User-facing copy for RoomsPanel (SPEC-055 §5). */
export const RoomsPanelStrings = {
  name: 'Name',
  cells: 'Cells',
  jumpToRenameRenumberDelete:
    '\u2922 jump-to \u00b7 \u270e rename/renumber \u00b7 \u2715 delete \u00b7 \u22ee\u22ee drag to reorder',
  undo: 'Undo',
  redo: 'Redo',
  key: 'Key',
  save: 'Save',
  cancel: 'Cancel',
  jumpToKey: 'Jump to key',
  renameRenumber: 'Rename / renumber',
  deleteKey: 'Delete key',
  dragToReorder: 'Drag to reorder',
  longFormNotesAnyPlayer: 'Long-form notes any player can add or read on hover\u2026',
  deleteKeyTitle: 'Delete key',
  deleteKeyMessage: (name: string) => `Delete "${name}"? Its label is removed from the map.`,
  deleteConfirm: 'Delete',
} as const;
