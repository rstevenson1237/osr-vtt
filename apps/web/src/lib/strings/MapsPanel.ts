/** User-facing copy for MapsPanel (SPEC-055 §5). */
export const MapsPanelStrings = {
  active: 'Active',
  anInfiniteHexGridFor: 'An infinite hex grid for overland travel, with 0,0 at its centre',
  aNewMapOfA:
    "A new map of a Universal VTT file's walls and doors \u2014 its image and lights are not imported",
  mapName: 'Map name',
  rename: 'Rename',
  deleteMapTitle: 'Delete map',
  deleteMapMessage: (name: string) =>
    `Delete "${name}"? Its background, floor, walls, and everything else on it are gone for good.`,
  deleteConfirm: 'Delete',
} as const;
