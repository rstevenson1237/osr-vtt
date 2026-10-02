/** User-facing copy for TurnStrip (SPEC-055 §5). */
export const TurnStripStrings = {
  initiativeCalled: (ready: number, total: number) =>
    `Initiative called — ${ready} of ${total} ready`,
} as const;
