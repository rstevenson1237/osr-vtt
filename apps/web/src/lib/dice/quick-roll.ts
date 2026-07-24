import {
  createSeed,
  expandDiceExprs,
  resolveSeparate,
  rollTray,
  type CampaignStore,
  type Roll,
} from '@osr-vtt/shared';
import { describeRoll } from './describe';

/**
 * Rolls a single die and publishes it, for the one-tap die buttons on the Roll
 * quick sheet and the Character sheet's quick attack (Shell UI Redesign).
 *
 * Deliberately the *same* pipeline the full tray uses — seed, `rollTray`,
 * `writeRoll` + `writeLog` — so a quick roll is indistinguishable downstream
 * from a staged one: every client re-derives the faces from `seed` (Plan §4),
 * the dice overlay animates it, and it lands in the log like any other roll.
 * Always Separate mode with no modifier: a one-die tap has nothing to sum.
 */
export async function quickRollDie(
  store: CampaignStore,
  roomId: string,
  authorUid: string,
  sides: number,
): Promise<void> {
  if (!authorUid) return;
  const slots = expandDiceExprs([`d${sides}`]);
  if (slots.length === 0) return;

  const seed = createSeed();
  const dice = rollTray(seed, slots, 'normal');
  const roll: Omit<Roll, 'id'> = {
    ts: Date.now(),
    authorUid,
    seed,
    dice,
    modifier: 0,
    advantage: 'normal',
    mode: 'separate',
  };
  await store.writeRoll(roomId, roll);
  await store.writeLog(roomId, {
    ts: Date.now(),
    authorUid,
    type: 'roll',
    text: describeRoll({ ...roll, id: '' }),
    resultClass: resolveSeparate(dice[0]!.kept),
  });
}
