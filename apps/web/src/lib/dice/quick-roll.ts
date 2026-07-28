import { publishRoll, type CampaignStore, type RollConvention } from '@osr-vtt/shared';

/**
 * Rolls a single die and publishes it, for the one-tap die buttons on the Roll
 * quick sheet.
 *
 * A thin wrapper over the shared `publishRoll` pipeline, so a quick roll is
 * indistinguishable downstream from a staged one: every client re-derives the
 * faces from `seed` (Plan §4), the dice overlay animates it, and it lands in
 * the log like any other roll. Always Separate mode with no modifier — a
 * one-die tap has nothing to sum.
 *
 * (The old doc comment here claimed a Character-sheet quick-attack caller;
 * `CharacterSheet.svelte` says that was deliberately not built, and the Roll
 * quick sheet's die buttons are the only call site.)
 */
export async function quickRollDie(
  store: CampaignStore,
  roomId: string,
  authorUid: string,
  sides: number,
  conventions: RollConvention[] | undefined,
): Promise<void> {
  await publishRoll(
    store,
    roomId,
    authorUid,
    { exprs: [`d${sides}`], mode: 'separate' },
    conventions,
  );
}
