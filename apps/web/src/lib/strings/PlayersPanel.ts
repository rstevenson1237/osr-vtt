/** User-facing copy for PlayersPanel (SPEC-055 §5). */
export const PlayersPanelStrings = {
  gm: 'gm',
  inactive: 'inactive',
  player: 'player',
  viewer: 'viewer',
  cancel: 'Cancel',
  noOtherPlayersHaveJoined: 'No other players have joined yet.',
  renameTitle: 'Rename player',
  renameLabel: 'Display name',
  renameConfirm: 'Rename',
  transferTitle: 'Transfer referee?',
  transferMessage: (name: string) =>
    `${name} will become the Referee. You will be demoted to a player.`,
  transferContinue: 'Continue',
  transferSureTitle: 'Are you sure?',
  transferSureMessage: 'This takes effect immediately. Only the new Referee can transfer it back.',
  transferConfirm: 'Transfer referee',
} as const;
