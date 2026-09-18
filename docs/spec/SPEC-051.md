## SPEC-051 — Chrome verbs are glyphs from the record, and the set renders at three sizes

**Status: Active**

_(New with the 2026-09-18 icon audit — IN-134 – IN-139, DEC-098, DEC-099. Takes up exactly
where SPEC-043 §5 stops: that spec governs the glyph inside the button and disclaims the
button, the chrome and the sizing; this one governs the controls SPEC-043 never reached. No
`R`-number predecessor.)_

SPEC-043 settled what a glyph depicts and SPEC-044 settled one state of the button around it.
Neither reached the **panels**, and the audit
(`docs/mockups/icon-audit-2026-09-18.html`) is a read of what happened there in the
meantime: roughly forty controls across seventeen components draw their icon by typing a
Unicode character into a `<button>`. They are not part of the icon set, they were never
drawn, and nothing has ever said they should be.

This is not a style preference. A typed character is rendered by whatever font the platform
resolves, so:

- **the same control is a different shape on every operating system** — the close cross is
  one width on Windows, another on macOS, another on Android;
- **six of them are emoji-presentation code points** — `📌 🔒 🔓 🎲 ◀ ▶` — and render as
  full-colour emoji on iOS, against the `MARKUP` record's own standing comment ("no
  multicolour art, no emoji in UI chrome");
- **three have no glyph in common system fonts** — `⤢ ⤦ ⋮⋮` — and fall back to a notdef box;
- **none of them is drawn at 1.75 stroke**, so a typed cross beside a drawn icon is visibly
  lighter or heavier than it at the same nominal size.

### §1 — No typed character is an icon

**A control whose meaning is a verb or a state takes its glyph from `Icon.svelte`'s `MARKUP`
record.** Close, expand, collapse, confirm, undo, redo, reorder, pin, lock, unlock, step,
navigate, add, remove and roll are verbs; none of them may be a literal in a component's
markup.

Two exclusions, both deliberate:

- **Letters that are typographic convention stay letters.** `MarkdownEditor`'s **B**, _I_ and
  H1–H3 are how every editor in the world labels those commands, and drawing them would be
  the "abstraction of an act" SPEC-043 §2 forbids. Its `•` and `¶` are *not* in this
  exclusion: a bulleted list and a paragraph are objects, and both get glyphs.
- **Content is not chrome.** A `—` standing for an empty value, a `×` between two dimensions
  (`3 × 3`), a `·` separating two facts, and the `⅛ ¼ ½` snap fractions are text *about*
  something, not controls. They stay.

### §2 — Three render sizes, chosen by pointer coarseness

Per DEC-098. `theme/sizing.css` owns them beside `--hit`:

| Token       | Precise pointer | Coarse pointer | Used by                                              |
| ----------- | --------------- | -------------- | ---------------------------------------------------- |
| `--icon`    | 20px            | 24px           | Standalone square controls: rail toggles, view tabs, map palette, frame chrome |
| `--icon-sm` | 16px            | 20px           | Controls inside an already-dense row: panel rows, log entries, inline actions |

`Icon.svelte`'s `size` prop remains, and its default becomes `--icon`. A caller passes a
number only where the size is genuinely fixed by something other than the device, and the
six ad-hoc numbers in use today (14, 15, 18, 19 and two uses of 16) resolve to one of the two
tokens.

**Every glyph in the record is drawn to survive its smallest stop, 16px.** That is the
assertion a redraw is checked against: no counter narrower than 3 units on the 24-unit grid,
no two parallel strokes closer than 2.5 units, and a filled detail is a dot of radius 1.3–1.8
rather than a shape.

### §3 — A control that loses its character gains a name

This is SPEC-043 §5's existing requirement — "no glyph in this set may be shipped into a
control that has no `aria-label`, `title` or visible label" — becoming work, because the
audit found controls that would fail it the moment their character is replaced.

`Icon.svelte` renders `aria-hidden="true"`. A button whose entire content is `▲` has the
accessible name "▲" today, which is poor; a button whose entire content is an `aria-hidden`
SVG has **no accessible name at all**, which is a regression. The controls in this state —
`TensionBar`'s two step buttons, `ProfileTemplateEditor`'s two move buttons,
`CharacterDock`'s two counter buttons, and every other control the execution audit finds —
gain an `aria-label` in the same change that takes their character away. **A glyph swap that
leaves a button nameless is a defect, not a partial delivery.**

### §4 — The mobile quick-sheet chips are labelled

Per DEC-099. `QuickSheetRail`'s `chips` variant renders the sheet's title under its glyph,
matching `MainViewTabs`, which sits directly above it and has always done so. The glyph rises
to `--icon`'s coarse value in the taller chip.

The desktop rail is unchanged: it is a 34px square column where a word does not fit, and it
has `ActivityDrawer` and `title` hover, neither of which a phone has.

### §5 — Named glyphs

The record grows from 34 entries to 75: 41 new ids, and the six redraws of §6 keep theirs.
The new ids, by the control they serve:

**Hex tools** (each borrows another tool's glyph today, which SPEC-043 §3 keeps apart):
`road`, `river`, `terrain`, `hex`.

**Chrome verbs**: `close`, `expand`, `collapse`, `check`, `undo`, `redo`, `grip`,
`chevron-up`, `chevron-down`, `chevron-left`, `chevron-right`, `arrow-up`, `arrow-down`,
`arrow-left`, `pin`, `lock`, `unlock`, `person`, `crown`, `panel-left`, `panel-right`,
`list`, `paragraph`, `plus`, `minus`.

**Actions that are text-only buttons today**: `link`, `copy`, `download`, `upload`, `rotate`,
`flip`, `fog`, `eye-off`, `add-person`, `save`, `search`, `note`.

**Mirror pairs share one geometry, flipped** — `undo`/`redo`, `expand`/`collapse`,
`lock`/`unlock`, `panel-left`/`panel-right`, `upload`/`download`, and the four chevrons — so a
pair reads as a pair. This is a drawing rule, not a code one: there is no shared-path
mechanism and none is wanted.

**One id per meaning.** A glyph is reused only where the meaning is identical (Rename takes
the existing `pencil`; every roll shortcut takes the existing `dice`). Two controls that mean
different things never share one, which is the specific failure §5's hex block fixes.

### §6 — Six redraws

Recorded the way SPEC-043 §4 recorded its three, because "the old one was bad" is not a
specification:

| Glyph       | What fails                                                                                              | What replaces it                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `encounter` | Two bare crossed strokes are an X — the same silhouette as the new `close`, one row away in the same bar. | Crossed swords with guards and grips: the implement (SPEC-043 §2 rule 1). |
| `session`   | A circle with eight detached ticks reads as a sun or an asterisk at the 14px the mobile bar renders it at. | A toothed cog outline with a hub, teeth wide enough to stay open at 16px. |
| `room`      | A tall rectangle with one dot is a door with a knob, and the palette has a `door` two buttons away.       | A plan-view room: four walls, a doorway, the leaf swung in.               |
| `corridor`  | Two nested L-curves read as a return arrow or a bracket, not a passage.                                   | The resulting shape (rule 3): a closed L-shaped run of fixed width.       |
| `ngon`      | A regular hexagon — the same silhouette as the `dice` d20 one rail over.                                  | A regular pentagon with the centre dot and one radius, which is also the tool's drag gesture. |
| `polygon`   | A regular pentagon, for a tool that is click-each-vertex and produces irregular shapes.                   | An irregular hexagon, so regular (`ngon`) and irregular (`polygon`) tell apart. |

### §7 — What this spec does not govern

**Button anatomy, group colour and hit sizing are unchanged** — the same disclaimer SPEC-043
§5 makes, for the same reason. The 8px radius, the 1px border, the active border-plus-wash,
the 2px chip underline and `--hit` are untouched; `--icon` is a new token beside `--hit`, not
a change to it.

**No `data-testid` moves, is renamed or is removed.** Every affected control keeps the testid
it has; what changes is the content inside it. The e2e suite selects these controls by testid
alone — its only text-based selectors match user-authored names (room names, group names, the
"Hex" map badge), never a glyph or a toolbar verb — so this spec's changes are invisible to it
(RULE-005).

**Catalogue art stays out of scope**, exactly as SPEC-043 §5 leaves it: `public/assets/symbols/`,
the 13 door variants, the hex terrain and contents tiles, and the Pixi dice renderer are
content, and keep their `--art-filter` inversion path.

**The map toolbar's words stay words.** §5 adds glyphs for Undo, Redo, fog, rotate, export and
add-creature so they *may* be used beside their labels; it does not make any of those buttons
icon-only. A labelled button that gains a glyph keeps its label.
