import { resolveSeparate, type Roll } from '@osr-vtt/shared';

/** Plain-text summary of a settled Roll for the Action Log — a display
 * concern only; the authoritative data is the Roll doc itself. */
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
