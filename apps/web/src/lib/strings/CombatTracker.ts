/** User-facing copy for CombatTracker (SPEC-055 §5). */
export const CombatTrackerStrings = {
  none: '\u2014 none \u2014',
  toggleAGroupSActive: "Toggle a group's [Active] switch to add it to the initiative pool.",
  rollInitiative: 'Roll initiative',
  removeFromInitiative: 'Remove from initiative',
  resolvesWithTheSeatsThat:
    'Resolves with the seats that have staged; unstaged seats are left out of the order',
  cancelsTheCallNothingIs: 'Cancels the call \u2014 nothing is rolled, the tracker is untouched',
} as const;
