import { resolveSeparate, type PlayerSeat, type Roll } from '@osr-vtt/shared';

/** Plain-text summary of a settled Roll for the Action Log — a display
 * concern only; the authoritative data is the Roll doc itself. Solo rolls
 * only — a shared roll's grouped entry is built by `describeSharedRoll`. */
export function describeRoll(roll: Roll): string {
  const summed = roll.mode === 'summed';
  // Advantage reads differently by mode (Master Plan v2, R20): Summed drops one
  // whole die from the pool; Separate keeps the better face of each die's pair.
  const advNote =
    roll.advantage === 'advantage'
      ? summed
        ? ' (drop lowest)'
        : ' (adv)'
      : roll.advantage === 'disadvantage'
        ? summed
          ? ' (drop highest)'
          : ' (dis)'
        : '';

  if (summed) {
    const kept = roll.dice.filter((d) => !d.poolDropped);
    const diceLabel = kept.map((d) => `${d.die}:${d.kept}`).join(', ');
    const droppedDie = roll.dice.find((d) => d.poolDropped);
    const dropLabel = droppedDie ? `, dropped ${droppedDie.die}:${droppedDie.kept}` : '';
    const modLabel =
      roll.modifier !== 0 ? ` ${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}` : '';
    return `Rolled ${diceLabel}${dropLabel}${modLabel}${advNote} = ${roll.total}`;
  }

  const flagged = roll.dice
    .map((d) => {
      const drop = d.dropped !== undefined ? ` [dropped ${d.dropped}]` : '';
      return `${d.kept} (${resolveSeparate(d.kept)})${drop}`;
    })
    .join(', ');
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
