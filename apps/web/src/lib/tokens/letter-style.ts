import { GEN_TOKEN_LABEL_CAP, type Token } from '@osr-vtt/shared';

/**
 * The token letter's render style (SPEC-048 §4).
 *
 * The letter is a **render pass on the token layer** rather than a shape baked
 * into the token's texture, which is what lets a token with an uploaded image
 * carry one. This module is the pure half — what glyphs are drawn, in what
 * colours, at what size — so the two-tone rule and the cap are testable without
 * a Pixi renderer. `VectorMapView` owns the display objects themselves.
 */

/** Two-tone by seat (DEC-086, answered (a)).
 *
 * The rule is named for what it tests: *"is this somebody's character?"* — not
 * *"who created it"*, which nothing records (`createToken` stores no author,
 * and `tokens` is `isMember() || isGM()`, so a player may create a creature and
 * that creature reads as a creature). Accurate for the question a referee
 * scanning a map is asking, inaccurate about authorship, and said out loud
 * rather than left for the code to imply. */
export type LetterMode = 'character' | 'creature';

export interface LetterStyle {
  /** The glyphs actually drawn — capped, Unicode-aware. */
  glyphs: string;
  mode: LetterMode;
  /** Glyph fill, `0xrrggbb`. */
  fill: number;
  /** Outline colour, `0xrrggbb`. */
  stroke: number;
  /** Outline width in the same px space as `fontSize`. */
  strokeWidth: number;
  fontSize: number;
}

const WHITE = 0xf6f1e6;
const BLACK = 0x1a1a1a;

/** Base token diameter in px, before `Token.size` — `VectorMapView`'s
 * `TOKEN_PX`, restated here so the pure sizing below needs no renderer. */
export const LETTER_BASE_PX = 48;

/** Glyph height as a fraction of the token's diameter, by glyph count. The
 * three ratios are `renderGenTokenSvg`'s 30/24/18 over its 64px viewBox, so a
 * drawn letter is the same size as the disc letter it replaces. */
function fontRatio(glyphCount: number): number {
  if (glyphCount > 2) return 18 / 64;
  if (glyphCount > 1) return 24 / 64;
  return 30 / 64;
}

/** The glyphs a letter actually renders as: capped at `GEN_TOKEN_LABEL_CAP`
 * (3, unchanged — user, 2026-09-08) and counted in Unicode code points, so one
 * emoji is one glyph and not the 2+ UTF-16 code units it occupies. Exactly the
 * cap and the counting `renderGenTokenSvg` has always applied. */
export function letterGlyphs(letter: string): string {
  return Array.from(letter).slice(0, GEN_TOKEN_LABEL_CAP).join('');
}

/**
 * The style for one token's letter, or `null` when there is nothing to draw —
 * an absent letter, or one that is empty/whitespace-only. Absence is a
 * legitimate state (SPEC-048 §1): bundled art, a saved URL and an upload all
 * have no letter to hold.
 *
 * **The outline is load-bearing, not decoration.** Because the colours key off
 * the seat rather than the disc's lightness, this rule *replaces*
 * `discStyle`'s contrast flip (R7.1) rather than extending it, so
 * black-on-a-dark-disc and white-on-a-light-disc are both reachable. The
 * outline is the only thing keeping the glyph legible, which is why it is a
 * genuine stroke on the glyph — Pixi paints the stroke first and the fill over
 * it, so the letterform keeps its full weight — and never the disc's ring.
 */
export function letterStyleFor(token: Token): LetterStyle | null {
  const raw = token.letter;
  if (raw === undefined) return null;
  const glyphs = letterGlyphs(raw);
  if (glyphs.trim() === '') return null;
  const mode: LetterMode = token.ownerSeatId === undefined ? 'creature' : 'character';
  const fontSize = Math.round(LETTER_BASE_PX * token.size * fontRatio(Array.from(glyphs).length));
  return {
    glyphs,
    mode,
    fill: mode === 'character' ? WHITE : BLACK,
    stroke: mode === 'character' ? BLACK : WHITE,
    // Wide enough to survive a busy uploaded image behind it, and scaled with
    // the glyph so a size-2 token's outline is not hairline by comparison.
    strokeWidth: Math.max(3, Math.round(fontSize / 6)),
    fontSize,
  };
}
