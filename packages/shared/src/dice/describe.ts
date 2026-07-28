import { classify } from '../resolution.js';
import type {
  PlayerSeat,
  ResultClass,
  RolledDie,
  Roll,
  RollConvention,
  RollMode,
} from '../types.js';

/**
 * The one place a settled `Roll` is turned into something presentable.
 *
 * Before this module the overlay chip, the encounter roll strip and the log
 * line each flattened a `Roll` themselves — three implementations that
 * recomputed totals, drop annotations and author names independently and had
 * already drifted apart (the strip sorted a separate-mode roll by its highest
 * face while the log listed every face with a class, and the overlay showed
 * neither). `summarizeRoll` is now the single source all three render from.
 *
 * It is also where referee-authored `RollConvention` bands are applied, so
 * classification is consistent everywhere by construction. A roll no
 * convention matches simply carries no `band` — faces and totals render bare.
 */

/** One physical die, ready to render. */
export interface DieView {
  die: string;
  sides: number;
  kept: number;
  /** Separate mode: the companion face rolled but not kept (render dimmed). */
  dropped?: number;
  /** Summed mode: this whole die was dropped from the pool (render dimmed). */
  poolDropped?: boolean;
  /** The band this face falls in, when a convention applies (Separate mode). */
  band?: { class: ResultClass; label: string };
}

/** One roller's contribution: the whole roll for a solo roll, or one seat's
 * part of a shared roll. */
export interface RollSummaryPart {
  /** The author's uid (solo) or the shared-roll slot id (a seat, or a groupId
   * for a referee-staged side). */
  slotId: string;
  dice: DieView[];
  modifier: number;
  total?: number;
  /** The band the *total* falls in, when a convention applies (Summed mode). */
  band?: { class: ResultClass; label: string };
}

export interface RollSummary {
  label?: string;
  /** True when totals are the headline (Summed mode, and every shared roll —
   * a shared roll's parts each carry a `total`). */
  summed: boolean;
  parts: RollSummaryPart[];
}

/**
 * The die size a pool should be classified against: the shared size when every
 * die in the pool agrees, otherwise `undefined` (see `RollContext.sides`).
 */
function poolSides(dice: RolledDie[]): number | undefined {
  const first = dice[0];
  if (!first) return undefined;
  return dice.every((d) => d.sides === first.sides) ? first.sides : undefined;
}

function viewDice(
  dice: RolledDie[],
  mode: RollMode,
  conventions: RollConvention[] | undefined,
): DieView[] {
  return dice.map((d) => {
    // Only Separate mode classifies individual faces; in Summed mode the
    // total is the result and a per-face band would be meaningless.
    const band =
      mode === 'separate' ? classify(conventions, { mode, sides: d.sides }, d.kept) : null;
    return {
      die: d.die,
      sides: d.sides,
      kept: d.kept,
      ...(d.dropped !== undefined ? { dropped: d.dropped } : {}),
      ...(d.poolDropped ? { poolDropped: true } : {}),
      ...(band ? { band } : {}),
    };
  });
}

/** Flatten a settled `Roll` — solo or shared — into one renderable shape. */
export function summarizeRoll(roll: Roll, conventions: RollConvention[] | undefined): RollSummary {
  if (roll.parts && roll.parts.length > 0) {
    // A shared roll has no per-roll mode toggle; every part carries a total,
    // so parts are always presented the summed way (R3.6.4).
    return {
      ...(roll.label ? { label: roll.label } : {}),
      summed: true,
      parts: roll.parts.map((part) => {
        const band =
          part.total !== undefined
            ? classify(conventions, { mode: 'summed', sides: poolSides(part.dice) }, part.total)
            : null;
        return {
          slotId: part.seatId,
          dice: viewDice(part.dice, 'summed', conventions),
          modifier: part.modifier,
          ...(part.total !== undefined ? { total: part.total } : {}),
          ...(band ? { band } : {}),
        };
      }),
    };
  }

  const summed = roll.mode === 'summed';
  const band =
    summed && roll.total !== undefined
      ? classify(conventions, { mode: 'summed', sides: poolSides(roll.dice) }, roll.total)
      : null;
  return {
    ...(roll.label ? { label: roll.label } : {}),
    summed,
    parts: [
      {
        slotId: roll.authorUid,
        dice: viewDice(roll.dice, roll.mode, conventions),
        modifier: roll.modifier,
        ...(roll.total !== undefined ? { total: roll.total } : {}),
        ...(band ? { band } : {}),
      },
    ],
  };
}

/** The single overall class for a roll, when there is exactly one — what the
 * log row tints on. A multi-die Separate roll has several bands and no single
 * answer, so it deliberately gets none. */
export function overallResultClass(summary: RollSummary): ResultClass | undefined {
  if (summary.parts.length !== 1) return undefined;
  const part = summary.parts[0]!;
  if (part.band) return part.band.class;
  if (part.dice.length === 1) return part.dice[0]?.band?.class;
  return undefined;
}

function modLabel(modifier: number): string {
  if (modifier === 0) return '';
  return ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`;
}

/**
 * Plain-text projection of a `RollSummary` for `LogEntry.text`.
 *
 * The log entry stores this baked string, so it stays searchable and readable
 * on its own; a row that also carries a `rollId` re-renders the structured
 * summary instead when the `Roll` is still in the loaded window.
 */
export function describeRoll(roll: Roll, conventions: RollConvention[] | undefined): string {
  const summary = summarizeRoll(roll, conventions);
  if (roll.parts && roll.parts.length > 0) {
    throw new TypeError('describeRoll is for solo rolls — use describeSharedRoll');
  }
  const part = summary.parts[0];
  if (!part) return 'Rolled nothing';

  // Advantage reads differently by mode (Master Plan v2, R20): Summed drops one
  // whole die from the pool; Separate keeps the better face of each die's pair.
  const advNote =
    roll.advantage === 'advantage'
      ? summary.summed
        ? ' (drop lowest)'
        : ' (adv)'
      : roll.advantage === 'disadvantage'
        ? summary.summed
          ? ' (drop highest)'
          : ' (dis)'
        : '';

  const prefix = roll.label ? `${roll.label} — ` : '';

  if (summary.summed) {
    const kept = part.dice.filter((d) => !d.poolDropped);
    const diceLabel = kept.map((d) => `${d.die}:${d.kept}`).join(', ');
    const droppedDie = part.dice.find((d) => d.poolDropped);
    const dropLabel = droppedDie ? `, dropped ${droppedDie.die}:${droppedDie.kept}` : '';
    const bandLabel = part.band ? ` (${part.band.label})` : '';
    return `${prefix}Rolled ${diceLabel}${dropLabel}${modLabel(part.modifier)}${advNote} = ${part.total}${bandLabel}`;
  }

  const flagged = part.dice
    .map((d) => {
      const drop = d.dropped !== undefined ? ` [dropped ${d.dropped}]` : '';
      // A face no convention classifies prints bare, rather than borrowing
      // some other die size's bands the way the old hardcoded path did.
      const band = d.band ? ` (${d.band.label})` : '';
      return `${d.kept}${band}${drop}`;
    })
    .join(', ');
  return `${prefix}Rolled ${flagged}${advNote}`;
}

/** Grouped log entry for a resolved shared roll (Master Plan v2, R3.6.4) —
 * one header line plus a per-part line indented beneath it, each naming the
 * seat's display name (falling back to its raw slot id for a GM-staged side
 * that isn't a player seat). */
export function describeSharedRoll(
  roll: Roll,
  players: PlayerSeat[],
  conventions: RollConvention[] | undefined,
): string {
  const summary = summarizeRoll(roll, conventions);
  const header = summary.label ? `Shared roll — ${summary.label}` : 'Shared roll';
  const lines = summary.parts.map((part) => {
    const name = players.find((p) => p.uid === part.slotId)?.displayName ?? part.slotId;
    const diceLabel = part.dice.map((d) => `${d.die}:${d.kept}`).join(', ');
    const bandLabel = part.band ? ` (${part.band.label})` : '';
    return `  ${name}: ${diceLabel}${modLabel(part.modifier)} = ${part.total}${bandLabel}`;
  });
  return [header, ...lines].join('\n');
}
