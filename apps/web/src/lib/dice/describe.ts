import { resolveSeparate, type PlayerSeat, type Roll } from '@osr-vtt/shared';

/** Plain-text summary of a settled Roll for the Action Log — a display
 * concern only; the authoritative data is the Roll doc itself. Solo rolls
 * only — a shared roll's grouped entry is built by `describeSharedRoll`. */
export function describeRoll(roll: Roll): string {
  const advNote =
    roll.advantage === 'advantage' ? ' (adv)' : roll.advantage === 'disadvantage' ? ' (dis)' : '';
  const diceLabel = roll.dice.map((d) => `${d.die}:${d.kept}`).join(', ');

  if (roll.mode === 'summed') {
    const modLabel = roll.modifier !== 0 ? ` ${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}` : '';
    return `Rolled ${diceLabel}${modLabel}${advNote} = ${roll.total}`;
  }

  const flagged = roll.dice.map((d) => `${d.kept} (${resolveSeparate(d.kept)})`).join(', ');
  return `Rolled ${flagged}${advNote}`;
}

/** Grouped log entry for a resolved shared roll (Master Plan v2, R3.6.4) —
 * one header line plus a per-part line indented beneath it, each naming the
 * seat's display name (falling back to its raw slot id for a GM-staged side
 * that isn't a player seat). */
export function describeSharedRoll(roll: Roll, players: PlayerSeat[]): string {
  const header = roll.label ? `Shared roll — ${roll.label}` : 'Shared roll';
  const lines = (roll.parts ?? []).map((part) => {
    const name = players.find((p) => p.uid === part.seatId)?.displayName ?? part.seatId;
    const diceLabel = part.dice.map((d) => `${d.die}:${d.kept}`).join(', ');
    const modLabel =
      part.modifier !== 0 ? ` ${part.modifier > 0 ? '+' : '−'} ${Math.abs(part.modifier)}` : '';
    return `  ${name}: ${diceLabel}${modLabel} = ${part.total}`;
  });
  return [header, ...lines].join('\n');
}
