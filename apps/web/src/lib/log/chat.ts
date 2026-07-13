import {
  createSeed,
  expandDiceExprs,
  parseDieExpr,
  rollTray,
  summedTotal,
  type CampaignStore,
  type Roll,
} from '@osr-vtt/shared';
import { describeRoll } from '../dice/describe';

/**
 * Chat input pipeline (Master Plan v2, R5.3). A submitted line is either plain
 * chat (`{type:'chat'}`) or a slash command. `/r <expr>` runs a *real* roll
 * through the same engine the Dice tray uses (`expandDiceExprs`/`rollTray`),
 * writing a `Roll` doc (which drives the overlay + roll strip via the existing
 * subscriptions) plus a `roll` log entry — so `/r 2d6` is indistinguishable
 * from a tray roll on every client. Unknown commands post nothing and return a
 * `hint` the caller shows inline.
 */

export interface ChatResult {
  /** True when something was written (chat line or roll). */
  ok: boolean;
  /** Inline feedback for an unknown/unparseable command — never logged. */
  hint?: string;
}

/** Splits a `/r` argument into die expressions + a flat modifier. Accepts the
 * same forms the tray produces: `2d6`, `d20+3`, `2d6 d8 -1`, `d6+d6`. */
function parseRollArg(arg: string): { exprs: string[]; modifier: number } | null {
  // Pull out die expressions and signed integers; ignore surrounding noise.
  const tokens = arg.match(/[+-]?\d*d\d+|[+-]?\d+/gi) ?? [];
  const exprs: string[] = [];
  let modifier = 0;
  for (const token of tokens) {
    if (/d/i.test(token)) {
      const expr = token.replace(/^\+/, '');
      if (!parseDieExpr(expr)) return null;
      exprs.push(expr);
    } else {
      modifier += Number(token);
    }
  }
  if (exprs.length === 0) return null;
  return { exprs, modifier };
}

async function runRollCommand(
  store: CampaignStore,
  roomId: string,
  authorUid: string,
  arg: string,
): Promise<ChatResult> {
  const parsed = parseRollArg(arg);
  if (!parsed) return { ok: false, hint: 'Usage: /r 2d6  (e.g. /r d20+3)' };

  const slots = expandDiceExprs(parsed.exprs);
  if (slots.length === 0) return { ok: false, hint: 'Usage: /r 2d6  (e.g. /r d20+3)' };

  const seed = createSeed();
  const dice = rollTray(seed, slots, 'normal');
  const total = summedTotal(dice, parsed.modifier);

  // Summed mode: a chat roll wants a single total, matching the "= N" a tray
  // Summed roll writes. Identical Roll shape ⇒ identical overlay + strip.
  const roll: Omit<Roll, 'id'> = {
    ts: Date.now(),
    authorUid,
    seed,
    dice,
    modifier: parsed.modifier,
    advantage: 'normal',
    mode: 'summed',
    total,
  };
  await store.writeRoll(roomId, roll);
  await store.writeLog(roomId, {
    ts: Date.now(),
    authorUid,
    type: 'roll',
    text: describeRoll({ ...roll, id: '' }),
  });
  return { ok: true };
}

/** Handles one submitted chat line. Returns `{ ok:false }` (with an optional
 * `hint`) without writing anything for blanks and unknown commands. */
export async function submitChat(
  store: CampaignStore,
  roomId: string,
  authorUid: string,
  raw: string,
): Promise<ChatResult> {
  const text = raw.trim();
  if (!text || !authorUid) return { ok: false };

  if (text.startsWith('/')) {
    const match = /^\/(\w+)\s*([\s\S]*)$/.exec(text);
    const command = match?.[1]?.toLowerCase() ?? '';
    const arg = match?.[2] ?? '';
    if (command === 'r' || command === 'roll') {
      return runRollCommand(store, roomId, authorUid, arg);
    }
    return { ok: false, hint: `Unknown command: /${command || '?'}` };
  }

  await store.writeLog(roomId, { ts: Date.now(), authorUid, type: 'chat', text });
  return { ok: true };
}
