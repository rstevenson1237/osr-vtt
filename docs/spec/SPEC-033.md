## SPEC-033 — Mobile viewport, touch input, full-screen presentation, and credits

**Status: Active** — §§1–3 shipped as WI-058 (IN-033), §6 as WI-060 (IN-041), and §7 as
WI-067 (IN-036). WI-063 and WI-064 (§§4–5, IN-034 and IN-035) remain scheduled.

_(New with WI-058; no `R`-number predecessor.)_

The four sections below were one investigation request. §§1–3 are the reported defects and
ship together; §4 and §5 are separate pieces of design that build on them; §6 is unrelated
to the rest and rides this spec only because it arrived in the same batch.

### §1 — One viewport unit, and it is the small one

Every element that claims the full height of the app measures against the **small
viewport** (`dvh`), not the large one. Mobile Safari sizes `100vh` to the viewport _with
the URL bar collapsed_, so any ancestor asserting `100vh` makes the document taller than
what is actually on screen, the page becomes scrollable, and whatever the layout pinned to
the bottom — here the quick-sheet chip rail and the main-view tab bar — leaves the screen.

`.mshell` already gets this right and is not the problem; `App.svelte`'s `min-height:
100vh` wrapper above it is, and `.shell` (desktop) carries the same bare `100vh`. The rule
is stated as an invariant rather than a list of two fixes because the failure is silent:
a single `100vh` anywhere in the ancestor chain reintroduces it.

The app frame does not scroll. Scrolling belongs to panes inside it, and the document
itself is pinned (`overscroll-behavior` on the root) so a drag that misses a scrollable
pane cannot rubber-band the whole frame.

### §2 — The map canvas owns its gestures

The Pixi map host declares `touch-action: none`. The map implements its own pan, pinch-zoom
and drag on the stage's federated pointer events (`map/pan-zoom.ts`, whose comments already
assume this), and leaving the browser's native gestures live means every map drag races a
page pan or a page pinch — non-deterministically, since which wins depends on the angle
and speed of the first few pointer samples. That race is the reported inconsistency.

This is a presentation-layer declaration only: no pointer handler, no coordinate
transform, and no committed geometry changes.

### §3 — Safe areas

`index.html` declares `viewport-fit=cover`, and the app frame's bottom edge — the mobile
activity bar, and any element pinned to the bottom of the frame — pads by
`env(safe-area-inset-bottom)`. Left and right insets apply in landscape. Without
`viewport-fit=cover` the insets are all reported as zero, so the meta tag and the padding
are one change and are meaningless apart.

### §4 — Coarse pointers get an equivalent, not a hover

**Every affordance reachable only by hovering has a coarse-pointer equivalent, or is
deliberately recorded as desktop-only.** Today none do: `@media (hover: hover)` appears
nowhere in the app, so the map's room-label tooltip, the Select tool's handle highlight,
and every `:hover` style are unreachable on touch — and worse than unreachable, since iOS
latches `:hover` on tap and leaves it lit.

Three affordances, and they do not get one answer:

- **Room-label tooltip.** The hardest, and the one that must be designed rather than
  patched: the map canvas already binds tap and drag to the active tool, so a touch
  gesture for "show me this label" cannot be either. Deciding this is the substance of
  the work item.
- **Select-tool handle highlight.** A feedback affordance for a drag that touch performs
  anyway; the answer is likely to show handles unconditionally on a coarse pointer rather
  than to invent a gesture.
- **Plain `:hover` styling.** Guarded behind `@media (hover: hover)` so it stops latching.
  Mechanical, and the only part of §4 that is.

**The rule, as decided _(WI-063, DEC-059)_.** **A coarse pointer never gets a gesture. It
gets a visible target it can tap, or a target big enough to hit.** Every touch gesture on
the map canvas is already spoken for — one finger is the active tool, two fingers are
pan/pinch — so an affordance that needs a new gesture cannot have one, and the three
affordances resolve as follows.

**Room-label tooltip — a note dot, not a gesture.** On a coarse pointer, a `MapRoom` whose
players' notes are non-empty renders a small **note dot** anchored to its label cell. A
`pointerdown` inside the dot is consumed before the per-tool dispatch — the same
"before the tool" position `handleCollabPointerDown` already occupies — and **pins** the
tooltip open for that room. A pinned tooltip is dismissed by a second tap on the same dot,
a tap elsewhere on the stage, the label entering its editor, or anything that moves the
camera (which already invalidates the tooltip's screen-space anchor). No tool loses its tap
anywhere outside the dot, and the dot renders only where a tooltip would have something to
say — the same non-empty-notes test that gates the tooltip itself.

**Select-tool handle highlight — desktop-only, and the equivalent is size.** The highlight
is pre-aim feedback, and touch has no pre-aim phase: the press _is_ the aim, `beginSelectDrag`
re-picks the handle under the finger independently of the hover state, and a fingertip covers
what a highlight would show. It is therefore **deliberately recorded as desktop-only** under
this section's own carve-out. What a coarse pointer gets instead is the ability to hit the
handle: the canvas pick radius becomes a single constant, **`PICK_PX` — 9px on a fine
pointer, 22px on a coarse one** — and vertex handles render at their enlarged radius
unconditionally on a coarse pointer, so the target you aim at is the size you can hit. This
is the canvas analogue of §7's `--hit` floor: the Pixi stage is a bitmap, so a CSS token
cannot reach it and the coarse floor is re-expressed in lattice units. `PICK_PX` replaces
every `latticeThreshold(9)` site — the two Select handle picks, the door click, and the
object picks — because one canvas with two pick radii and no rule for which applies where
is worse than the wider scope.

**Plain `:hover` styling — wrapped.** Every `:hover` rule under `apps/web/src` (23 rules,
17 files) is guarded by `@media (hover: hover)`, so a tap on iOS no longer leaves a control
lit until the next tap elsewhere.

**The fine-pointer path does not change.** No dot renders, the hover tooltip behaves exactly
as it does today, `PICK_PX` evaluates to the same 9, and every wrapped rule still matches — a
mouse-driven desktop is pixel-identical. `map-label-tooltip` keeps its testid (RULE-005);
the dot, being drawn in Pixi, is mirrored into `VectorMapView`'s `vf-readouts` block as a new
per-room testid so the e2e suite can see it.

**The signal.** `isCoarsePointer` (§7) reaches the map as a **prop from `RoomShell`**, which
already owns the single `createShellMedia()` instance and already derives `isNarrow` from it.
This is `isCoarsePointer`'s first behavioural consumer — §7 shipped it with none, for exactly
this section.

### §5 — Full-screen and standalone are one presentation model

Full-screen (the Fullscreen API, desktop and mobile browser) and standalone (an installed
PWA, launched from the home screen with no browser chrome) are two routes to the same
state: the app frame owning the whole display. They are specified together because they
must produce the _same_ layout, and because each independently changes the viewport height
that §1 pins the frame to.

- A full-screen control is available on both desktop and mobile, and toggles the app
  frame — not the map canvas alone, which would strand the toolbars the request is about.
- The Pixi stage sizes from its host, so entering or leaving either state resizes the
  stage and the camera must survive the transition rather than resetting.
- Standalone requires a web app manifest and the iOS meta tags; both are additive files.

**Neither is a new authority boundary.** Full-screen and standalone change presentation
only: they gate no tool, hide no information, and carry no relation to `isGM`.

### §6 — Credits

The lobby carries a credits section at the bottom of the page, listing third-party
content bundled with the app: the work, its author, its source URL, and its licence.

First entry, and the reason the section exists now: the **Classic Dungeon Map Symbols**
pack by **Mark Gosbell** — the 73 symbol icons and 13 door variants under
`apps/web/public/assets/symbols/` and `.../doors/`, catalogued in
`map/vector/symbol-catalog.ts` — from `https://markgosbell.itch.io/classic-dungeon-map-symbols`,
licensed **CC0 1.0 Universal** (user, 2026-08-03).

`apps/web/public/assets/ATTRIBUTION.md` is corrected in the same change. Its
`symbols/*.svg, doors/*.svg` section currently carries a standing TODO — "source/license
not yet recorded… fill in this section (author, source URL, license) before any public
release/distribution build" — and this is that fill-in. The two must not disagree: the
lobby is what a player sees and the attribution file is what a distribution build is
audited against.

### §7 — Layout and input are two signals _(IN-036, DEC-052)_

**Screen width picks the layout. Pointer coarseness picks the hit-target size. They are
independent and are never read as one boolean.**

`MOBILE_MEDIA_QUERY = '(max-width: 899px), (pointer: coarse)'` currently switches the
whole shell on either condition, so a touchscreen laptop at 1920 px and an iPad Pro in
landscape both get the phone layout — single stage, chip rail, no docked sheet column —
with most of the screen unused. The clause conflates two genuinely different needs.

- **Layout** — which shell renders, `.shell` or `.mshell` — follows width alone.
- **Hit targets** — control sizing, spacing, and anything §4 adds for a coarse pointer —
  follow `(pointer: coarse)` alone, in either shell.

So a touchscreen laptop runs the desktop shell with touch-sized controls; a phone is
unchanged; an iPad runs the desktop shell in landscape and the mobile shell in portrait.

**This is a contract change, not a media-query edit.** `isMobile` is read in nine places
across `RoomShell.svelte` and `shell/shell-state.svelte.ts`, and `shell-state`'s
`isSheetOpen`, `toggleSheet` and `expandSheet` each take it as a parameter — so the split
reaches the quick-sheet state machine, not only CSS. Every consumer must be assigned
deliberately to one signal or the other; none may be left reading "whichever one still
exists".

**§4 and §5 depend on this section.** While one boolean answers both questions, "is this
touch?" and "is this the mobile layout?" cannot be asked apart, and a hover equivalent or
a full-screen affordance cannot be specified for one without silently binding the other.
WI-067 therefore lands **before** WI-063.

**As shipped (WI-067).** `shell/layout.svelte.ts` exports `createShellMedia()` over two
`matchMedia` queries — `NARROW_LAYOUT_QUERY` (`max-width: 899px`) → `isNarrow`, and
`COARSE_POINTER_QUERY` (`pointer: coarse`) → `isCoarsePointer`. Every one of the nine
former `isMobile` reads took `isNarrow`, including `ShellState`'s
`isSheetOpen`/`toggleSheet`/`expandSheet`, whose parameter is renamed to match: the
bottom-sheet state machine belongs to the mobile _layout_, not to touch input.

The hit-target half is **CSS, not a component prop**: `theme/sizing.css` declares `--hit`
(34 → 44px), `--hit-inline` (18 → 34px) and `--hit-gap` (8 → 10px), bumped under the same
`(pointer: coarse)` query, and the shell frame's chrome sizes from them — the icon rail,
the rail's view tabs, the desktop grid's rail column and two bar rows, the mobile chips
row, and the quick-sheet card header buttons. `--hit` is applied as a **size**;
`--hit-inline` only ever as a **floor** (`min-height`/`min-width`) whose precise-pointer
value sits below the natural height of every row it guards. So a mouse-driven desktop is
pixel-identical: the shell's `56px`/`44px`/`40px`/`38px` literals became `--hit` offsets
that evaluate to those same numbers, and no floor binds. So
`isCoarsePointer` has no consumer yet — it exists for §4's behavioural half, where an
affordance must _become_ something else rather than merely grow.

Panel bodies, the map toolbar and dialog internals are **not** covered by the tokens and
keep their own sizing. That is a bounded scope, not an omission: widening it is additive
and needs no rework here (DEC-054).
