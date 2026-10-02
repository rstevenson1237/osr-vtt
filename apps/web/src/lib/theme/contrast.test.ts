import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.1 contrast over the real pairs the app renders (WI-209 – WI-212, from the
 * WI-175 audit). Reads `tokens.css` itself, so a token change that drops a pair
 * under AA fails here rather than in a reviewer's eye. 4.5:1 is the normal-text
 * threshold; every pair below is rendered as text.
 */

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('\n}', start);
  const vars = new Map<string, string>();
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars.set(m[1]!, m[2]!.trim());
  }
  return vars;
}

const dark = block(':root');
const blue = new Map([...dark, ...block(":root[data-theme='keyed-blue']")]);

/** Resolves a token to `#rrggbb`, following `var(--x)` aliases within a theme. */
function color(theme: Map<string, string>, token: string): string {
  let v = theme.get(token);
  for (let i = 0; i < 8 && v?.startsWith('var('); i++) {
    v = theme.get(v.slice(4, -1).trim());
  }
  if (!v || !/^#[0-9a-f]{6}$/i.test(v))
    throw new Error(`${token} does not resolve to a hex colour`);
  return v;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const AA = 4.5;

function expectAA(theme: Map<string, string>, fg: string, bg: string): void {
  expect(ratio(color(theme, fg), color(theme, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA);
}

describe('contrast helper', () => {
  it('matches the WCAG reference ratios', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('presence-chip initials (WI-209)', () => {
  it.each([
    ['parchment-dark', dark],
    ['keyed-blue', blue],
  ] as const)('Referee and Records seats read in %s', (_name, theme) => {
    expectAA(theme, '--chip-referee-ink', '--chip-referee-bg');
    expectAA(theme, '--chip-records-ink', '--chip-records-bg');
  });
});

describe('--accent-text in keyed-blue (WI-210)', () => {
  it.each(['--bg-panel', '--bg-inset'])('is AA on %s', (bg) => expectAA(blue, '--accent-text', bg));
});

describe('feedback colours (WI-211)', () => {
  it('--complication and --failure are AA on their strong chip fills in keyed-blue', () => {
    expectAA(blue, '--complication', '--complication-bg-strong');
    expectAA(blue, '--failure', '--failure-bg-strong');
  });

  it('--danger is AA on --bg-panel in parchment-dark', () => {
    expectAA(dark, '--danger', '--bg-panel');
  });
});

describe('--text-dim on --bg-panel-alt in keyed-blue (WI-212)', () => {
  it('is AA', () => expectAA(blue, '--text-dim', '--bg-panel-alt'));
});
