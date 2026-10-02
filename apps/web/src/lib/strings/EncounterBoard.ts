/** User-facing copy for EncounterBoard (SPEC-055 §5). */
export const EncounterBoardStrings = {
  noOneIsOnThe: 'No one is on the board yet.',
  ready: 'READY',
  hidden: 'hidden',
  showThisGroupSTokens: "Show this group's tokens on the map",
  showThisGroupSCards: "Show this group's cards to the players",
  includeThisGroupInThe: 'Include this group in the initiative pool',
  collapseTheGroupToA: 'Collapse the group to a single stacked token on the map',
  gridArrangeThisGroupS: "Grid-arrange this group's members",
  deleteThisGroupAndIts: 'Delete this group and its cards',
  addACreatureToThis: 'Add a creature to this group',
  deleteGroupTitle: 'Delete group',
  deleteGroupMessage: (name: string, count: number) =>
    count === 0
      ? `Delete "${name}"?`
      : `Delete "${name}" and its ${count} ${count === 1 ? 'card' : 'cards'}? The tokens are removed from the session for good.`,
  deleteGroupConfirm: 'Delete',
  addCreatureTitle: 'Add creature',
  addCreatureConfirm: 'Add',
} as const;
