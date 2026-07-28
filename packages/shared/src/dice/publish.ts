import type { CampaignStore } from '../store/campaign-store.js';
import type { AdvantageMode, Roll, RollConvention, RollMode } from '../types.js';
import { describeRoll, overallResultClass, summarizeRoll } from './describe.js';
import { createSeed, expandDiceExprs, rollSummedPool, rollTray, summedTotal } from './engine.js';

/**
 * The single roll pipeline: seed → expand → roll → `Roll` doc → log entry.
 *
 * Every roll in the app goes through here — the tray, the one-tap quick dice,
 * `/r` in chat, initiative, and random tables. Before this, each of those
 * open-coded the same five steps, and two of them (initiative and tables)
 * skipped the pipeline entirely with a bare `Math.random()`: no seed, no
 * `Roll` doc, no log entry, no animation, and nothing broadcast to the other
 * players. Routing them all through one function is what makes a roll
 * *visible* by construction rather than by each caller remembering to.
 *
 * The seed-authoritative invariant is preserved: the RNG decides the faces,
 * the `Roll` doc carries the seed, and every client (including the author, who
 * reacts to its own snapshot) re-derives and animates the same result.
 */
export interface PublishRollRequest {
  /** Die expressions in `NdM` form, as `parseDieExpr` accepts them. */
  exprs: string[];
  modifier?: number;
  advantage?: AdvantageMode;
  mode: RollMode;
  /** Optional origin tag — a macro name, a profile field label, `'Initiative'`,
   * a random table's name. Purely descriptive; never interpreted. */
  label?: string;
}

/**
 * Rolls and publishes, returning the settled `Roll` (with its id) so a caller
 * can route the result — e.g. initiative dropping `dice[0].kept` into a
 * tracker row. Returns `null` when `exprs` expands to nothing, which is a UI
 * no-op rather than an error (matching `expandDiceExprs`' own contract).
 */
export async function publishRoll(
  store: CampaignStore,
  roomId: string,
  authorUid: string,
  req: PublishRollRequest,
  conventions: RollConvention[] | undefined,
): Promise<Roll | null> {
  if (!authorUid) return null;
  const slots = expandDiceExprs(req.exprs);
  if (slots.length === 0) return null;

  const modifier = req.modifier ?? 0;
  const advantage = req.advantage ?? 'normal';
  const seed = createSeed();

  // Advantage behaves differently per resolution mode (Master Plan v2, R20):
  // Summed rolls each die once and drops one whole die from the pool; Separate
  // rolls each die twice and keeps the better face of every pair.
  const dice =
    req.mode === 'summed'
      ? rollSummedPool(seed, slots, advantage)
      : rollTray(seed, slots, advantage);
  const total = req.mode === 'summed' ? summedTotal(dice, modifier) : undefined;

  const body: Omit<Roll, 'id'> = {
    ts: Date.now(),
    authorUid,
    seed,
    dice,
    modifier,
    advantage,
    mode: req.mode,
    ...(total !== undefined ? { total } : {}),
    ...(req.label ? { label: req.label } : {}),
  };

  const id = await store.writeRoll(roomId, body);
  const roll: Roll = { ...body, id };

  const summary = summarizeRoll(roll, conventions);
  const resultClass = overallResultClass(summary);
  await store.writeLog(roomId, {
    ts: Date.now(),
    authorUid,
    type: 'roll',
    text: describeRoll(roll, conventions),
    // Lets the log row re-render the structured result (band chips, dimmed
    // dropped dice) from the `Roll` instead of the baked string.
    rollId: id,
    ...(resultClass ? { resultClass } : {}),
  });

  return roll;
}
