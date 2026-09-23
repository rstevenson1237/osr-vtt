## SPEC-055 — What ships, and when it loads

**Status: Active**

_(New with the 2026-09-18 introspective's architecture lens — IN-178, IN-180, IN-181,
IN-182, IN-195, all classified Simple (user, 2026-09-23). No `R`-number predecessor.)_

Every section here changes **when** code loads, **which** build carries it, or **where** an
answer is computed — never the answer itself. A section that finds its output differs from
today's stops and logs the difference as its own item.

### §1 — The dice renderer and hex art load on demand (IN-178)

`DiceOverlay`'s renderer (three.js, Rapier WASM, `dice/scene.ts`, `geometry.ts`,
`textures.ts`) is a dynamic `import()`, fetched on the first roll or when the dice tray first
opens, whichever comes first. The hex terrain art loader is a dynamic import fetched when a
hex map first renders. Dice authority is the seed (RULE-013): a roll that lands before the
renderer has loaded still has its result; the animation catches up or is skipped.

### §2 — A bundle-size budget in CI (IN-178)

CI asserts the main entry chunk of both `pnpm build` and `pnpm build:local` is under a stated
budget, beside the local build's Firebase-strip check. The budget is set by the executing
work item from the measured post-§1 size plus 10%, and recorded in `README.md`. Raising it is
a one-line change that must be named in the pull request that needs it.

### §3 — E2E readouts are not shipped to production (IN-180)

The hidden introspection readouts Playwright reads (`token-pos-*`, `selection-count`, …)
render only when `import.meta.env.VITE_E2E_READOUTS` is truthy. It is on in `vite` dev and
test modes — which is what Playwright runs against (`apps/web/playwright.config.ts`
`webServer`) — and off in `pnpm build` and `pnpm build:local`. No spec's testids move. A new
readout added later goes behind the same flag.

### §4 — One snap resolver; one actor-presentation resolver (IN-181, IN-182)

- **Snap.** Token snapping (`tokens/drag.ts`, `SnapMode`) and tool snapping
  (`map/vector/snap.ts`, `VectorSnapMode`) resolve through one `snapFor(kind, mode, point)`.
  Both mode types survive as the vocabulary of their selector; what a snapped point means
  (SPEC-028 §2, RULE-006) does not change. Unit tests assert identical outputs for every
  mode on square and hex maps before the callers switch.
- **Actor presentation.** `creatureLabel`, `creatureDisplayName`, `tokenLabel`/`refLabel`,
  `resolveCharacterColor`/`assignedCharacterColor` and `letterStyleFor` become callers of,
  or are replaced by, one `actorPresentation(actor, players, groups)` returning
  `{ name, letter, color, portrait }`. Where two of them disagree today, the disagreement is
  logged as an intake item and today's per-surface answer is kept.

### §5 — User-facing strings live in one module (IN-195)

User-facing string literals move to `apps/web/src/lib/strings.ts` (or one file per component
group under `lib/strings/`), keyed by surface. Rendered text is byte-for-byte unchanged and
no testid moves. Test-only strings, log messages and code identifiers stay where they are.
No translation mechanism is added; this only makes one possible.
