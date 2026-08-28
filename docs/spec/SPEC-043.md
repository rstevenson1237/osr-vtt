## SPEC-043 — The icon system: what a glyph depicts

**Status: Active**

_(New with the 2026-08-28 icon revamp — IN-074, DEC-076. Extends SPEC-001 §4, which is
still in force and is not changed by this spec. No `R`-number predecessor.)_

The icon set has always had a **technique** rule and never a **subject** rule. SPEC-001 §4
says icons are "simplistic single-colour stroke SVGs drawn as `currentColor`", which
settles how a glyph is drawn and says nothing about what it is a picture of. Thirty-four
glyphs were then drawn one at a time, each answering "what should this look like" on its
own, and the set drifted: `dice` answered it as a solid, `tools` as an implement seen at an
angle, `ruler` as a silhouette. Nothing was wrong against the rule in force, because the
rule in force could not be violated. This spec adds the missing half.

### §1 — Technique (inherited, unchanged)

Every glyph is one entry in the `MARKUP` record inside
`apps/web/src/lib/components/shell/Icon.svelte`, keyed by `IconId`:

- a `viewBox="0 0 24 24"` fragment — no `<svg>` wrapper, no `width`/`height`, no `xmlns`;
- `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round cap and join, all
  set once on the wrapping `<svg>` and never per path;
- **no hard-coded colour anywhere inside a glyph.** A filled detail (a door knob, a vertex
  dot) sets `fill="currentColor" stroke="none"` on that path alone;
- no files, no sprite sheet, no icon dependency. The set is a TypeScript record, and
  swapping it is a swap of that record.

`stroke-width` moves from 1.8 to **1.75**. That is the only technique change in this spec,
and it is a consequence of the redraw rather than a goal of it: the new glyphs carry more
interior detail at 16px and 1.8 closed the counters on `wall` and `tables`.

### §2 — The subject rule, in precedence order

A glyph depicts, preferring the earliest of these that applies:

1. **The implement** — the object a person holds or points at. `dice` is a die, `ruler` is
   a straightedge, `pencil` is a pencil, `brush` is a brush, `tools` is a toolbox, `eye` is
   an eye, `hand` is a hand.
2. **The thing itself**, where the subject *is* an object rather than an act — `door`,
   `wall`, `map`, `symbol`, `label`, `room`, `tables`.
3. **The resulting shape**, where neither exists because the tool's whole subject is a
   geometry — `rect`, `corridor`, `ngon`, `polygon`, `path`.

Two things a glyph is never a picture of: **a piece of this application** (no panels, no
dialogs, no palettes, no cursors-drawn-as-chrome) and **an abstraction of an act** (no
motion arcs standing in for a verb, no diagrammatic before/after). Both were live options
in the design exploration and both are excluded here, deliberately: the value of rule 1 is
that a referee who has never opened the app can name most of the palette on sight, and that
value is spent the moment a glyph requires the app to explain it.

### §3 — The map-tool family

The five **group** icons in `apps/web/src/lib/map/tool-groups.ts` are the one exception to
§2, and the rule for them is stated separately:

> **A group icon names the gesture. A tool icon follows §2.**

A group has no implement, because a group is not a thing — it is *what your hand does*:
point, read, drag, run, place. `tool-groups.ts` already organises the palette on exactly
that basis, on the reasoning that "what kind of thing am I about to do" is the distinction
a referee needs at the moment of picking a tool. Until now the icons have not carried that
reasoning, and this section is what makes them.

The consequence to hold on to: **family resemblance lives in the group icon, not in the
tool icons.** Two tools in the same group are not required to look alike, and two tools in
different groups are not required to look different.

That second clause is not a loophole; it is this spec paying a known cost. Under §2, **Pen
and Carve cannot be told apart by their glyphs** — both are strokes, and rule 1 gives one a
pencil and the other a brush, which are the same kind of object. The acts are not the same
kind of act: Pen lays a `Drawing` on top of the map and Carve cuts floor out from under it.
The disambiguation is structural rather than pictorial — Pen is in **Overlay**, Carve is in
**Shapes**, and §3 is the reason a reader can trust that placement to mean something. If
this turns out to bite in play, it is a fresh intake item against this section, not a bug
in a glyph.

### §4 — The three glyphs this spec was written for

Recorded because "the old one was bad" is not a specification, and a future redraw needs to
know what failure looked like:

| Glyph   | What failed                                                                                                                        | What replaces it                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `dice`  | The d20's visible facet sat at the **top** of the hexagon, which is where a cube's top face goes. It read as a crate.                | Hexagon, **centred** up-facet, three spokes to the outer points. |
| `tools` | A chisel drawn on the diagonal. At 20px the head and the shaft merged into an unidentifiable wedge.                                  | A latched toolbox with a carry handle.                   |
| `ruler` | A rhombus on the diagonal with three tick pairs — the silhouette of a ruler with every cue that reads as *ruler* removed.            | A straightedge lying flat, with graduations off one edge.|

### §5 — What this spec does not govern

**Chrome is untouched.** Button anatomy (8px radius, 1px border, transparent at rest;
active takes the group colour as border plus a 15% wash; the mobile flat chip with a 2px
group underline), the `--hit` sizing in `theme/sizing.css`, and the four group colours in
`tokens.css` are all unchanged. This spec changes the glyph inside the button and nothing
around it.

> **Annotated 2026-08-28 (IN-075, SPEC-044).** "Chrome is untouched" scopes *this* spec and
> is not a claim that the chrome is finished. SPEC-044 adds a `:focus-visible` treatment to
> the same controls; the two do not overlap — SPEC-043 owns the glyph inside the button,
> SPEC-044 owns one state of the button around it.

**Accessible names are unchanged and non-negotiable.** `Icon.svelte` renders
`aria-hidden="true"`; the name lives on the control that wraps it. No glyph in this set may
be shipped into a control that has no `aria-label`, `title` or visible label.

**Catalogue art is out of scope.** `public/assets/symbols/` (the 73 map symbols),
the 13 door variants, the hex terrain and contents tiles, and the Pixi dice renderer are
*content*, not chrome. They keep their `--art-filter` / `--art-filter-on` inversion path
and are not redrawn here.
