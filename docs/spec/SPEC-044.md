## SPEC-044 — Keyboard focus is visible on every shell icon control

**Status: Active**

_(New with the 2026-08-28 icon batch — IN-075. Companion to SPEC-043, which governs the
glyph inside the button and explicitly disclaims the button; this spec governs one state of
the button. No `R`-number predecessor.)_

Every icon-only control in the shell is a `<button>` with `border: 1px solid transparent`
on a dark panel and no focus rule of its own, so a keyboard user tabbing through the rail,
the view tabs or the map palette sees whatever outline the user agent decides to paint over
a transparent border — which on `parchment-dark` is close to nothing. The controls announce
themselves correctly to a screen reader; they are simply invisible to a sighted person
navigating by keyboard.

The token for this already exists and has never been used for it. `--focus` appears in two
places: `EncounterBoard.svelte`'s `.card.selected { outline: 3px solid var(--focus) }`,
which is a **selection** outline rather than a focus one, and the `--group-world` alias in
`tokens.css`. Nothing in the application draws a focus ring.

### §1 — One treatment, applied everywhere

A single `:focus-visible` rule, identical across every shell icon control:

```css
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
```

`:focus-visible`, never `:focus` — a pointer user clicking a tool must not be left with a
ring on it. The offset is what keeps the ring outside the 1px border and the 8px radius
rather than fighting them, and it is why the ring is drawn as an `outline` rather than as a
`box-shadow` or a border colour: an outline does not participate in layout, so no control
moves or reflows when it takes focus.

`--focus` is `#6fa8dc` on `parchment-dark` and `#2f6fb0` on `keyed-blue`. Both are the same
hue family as `--group-world`, which is deliberate and is the one thing to check by eye
during execution: a focused **Map** button (world group, blue border, blue wash) must still
read as focused. If it does not, the fix is the offset, not a new colour.

### §2 — Which controls

Every component that renders `Icon.svelte` inside a control:

`shell/QuickSheetRail.svelte` · `shell/MainViewTabs.svelte` · `shell/ActivityDrawer.svelte`
· `shell/MobileTopBar.svelte` · `shell/PresentationToggle.svelte` · `shell/SessionTab.svelte`
· `MapToolbar.svelte` · `RoomShell.svelte`

The rule belongs to each component rather than to a global stylesheet, matching how the rest
of the button anatomy is already owned (`QuickSheetRail` owns the 8px radius, the transparent
border and the group wash; nothing global styles a shell button today). A global rule would
be fewer lines and would silently restyle every `<button>` in every panel body, dialog and
form in the application — a far larger change than this spec, wearing a smaller diff.

### §3 — The disabled state is already correct, and is not work

Recorded because IN-075 raised it as a possible second half and the answer is no:

- **`MapToolbar.svelte` disables and styles.** Tool buttons carry `disabled={locked}` under
  the Edit/View soft lock, and `button:disabled { opacity: 0.4; cursor: default }` covers
  them.
- **`QuickSheetRail.svelte` and `MainViewTabs.svelte` never disable.** Neither file contains
  the word, so there is no unstyled disabled state to find — a view or sheet that should not
  be reachable is not rendered at all (the `availability: 'gm'` gate), which is the correct
  treatment and not one this spec changes.

No disabled styling is added by this spec. If a future change disables a rail or tab control,
that change owns the style.

### §4 — What this spec does not govern

Not a general accessibility pass. Focus order, skip links, landmark roles, contrast ratios
and the dialog focus trap are all out of scope; this spec adds one visible state to one
family of controls. It also does not touch `EncounterBoard.svelte`'s use of `--focus` as a
selection outline — that is a separate (and arguably mis-named) use of the token, left alone
rather than renamed, since renaming it is a change with no user-visible benefit.
