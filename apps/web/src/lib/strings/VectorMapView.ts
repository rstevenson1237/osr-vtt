/** User-facing copy for VectorMapView (SPEC-055 §5). */
export const VectorMapViewStrings = {
  roomName: 'Room name\u2026',
  addCreatureTitle: 'Add creature',
  addCreatureConfirm: 'Add',
  addTextTitle: 'Add text',
  addTextLabel: 'Text',
  addTextConfirm: 'Place',
  floorExtentBlocked: (max: number) =>
    `Carve blocked — the floor would exceed the ${max}-unit max extent. Undo or carve a smaller area.`,
} as const;
