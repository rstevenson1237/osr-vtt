## SPEC-049 — Measurement is a property of the grid kind

**Status: Active**

From IN-123 and DEC-093, answered (a) with a backfill (user, 2026-09-11).

`GameMap.measure` is a `RoomMeasure` — `{ perSquare, unit }` — and the app has always treated
it as an uninterpreted referee-chosen label: it formats `n × perSquare unit` and never reasons
about what a foot is (RULE-002's spirit). That holds. What this spec settles is the thing the
field's name quietly assumed and a hex map falsifies: **that every map measures in squares.**

---

### §1 The Measure tool currently does not measure a hex map

This is the half of IN-123 that is not cosmetic, and it is a live RULE-006 breach.

`VectorMapView`'s `toLatticeRaw` is `world / cellSize`, where `cellSize` is
`map.grid.cellSize`. On a hex map that divisor is a **square-lattice multiplier the map does
not declare** — RULE-006 as amended by WI-037 fixes a hex map's space as axial with `hex.size`
as its render-time multiplier, and says in as many words that a square-lattice consumer is
undefined on a hex map and must not be reached from one. The Measure tool reaches one, on every
pointer-down and every pointer-move, and `measureSpanText` then multiplies the result by
`perSquare`. The number on the chip is a span in units of a lattice the map does not have.

**A hex map's ruler reports hex steps.** `axialDistance` (`packages/shared/src/map/hex/axial.ts`)
is the hex-crawl travel distance and the only distance a hex map has; its own doc comment
already states that it is not the square lattice's Euclidean distance and that the `perSquare`
arithmetic does not carry over to it. The tool resolves both ends of the drag to hexes the way
Select already does, and the span is `axialDistance` between them, multiplied by the map's
`perSquare` and labelled with its `unit`.

**Relabelling without this would be worse than doing nothing**: it would put a correct unit on
an incorrect number, which is harder to notice than a control that was never wired up.

### §2 The label and the default follow the grid kind

**The label.** Session settings → Grid & measurement reads "Per square". On a hex map it reads
**"Per hex"**. The field behind it is the same field; `perSquare` is a name, not a meaning, and
grid kind is already the thing that decides which coordinate space, which snap set (SPEC-047
§3) and which palette (§11) a map gets. Letting it decide a label is the rule this codebase
already follows, not a new one.

**The default.** `DEFAULT_MEASURE` is `{ perSquare: 10, unit: 'feet' }` for every map. A hex
map's default becomes **`{ perSquare: 6, unit: 'miles' }`** — the standard hex-crawl scale, and
the value the request named. A square map's default is unchanged.

**`RoomMeasure` does not grow a field.** DEC-093 considered a distinct `perHex` (option (b))
and did not take it: it buys a precision the app cannot use, on a field nothing computes with,
at the price of a structural schema change. One field, read against the map's kind.

### §3 The backfill, and the one thing it must not do

Existing hex maps carry `{ perSquare: 10, unit: 'feet' }`, because that is what every map has
carried. **They are backfilled to the hex default** (DEC-093, user).

That makes this a **RULE-007 item**: `CURRENT_SCHEMA_VERSION` + 1, a migration, a migration
test, and a `.vttcamp` round-trip test. The field's *shape* is unchanged — what migrates is
values, not structure — but a migration that rewrites stored values is a migration, and under
RULE-009's amendment the `.vttcamp` is the database in a local build, so a round-trip that
mangles this drops a real campaign's scale.

**The guard.** The migration touches a map only when **both** hold: the map is a hex crawl,
**and** its `measure` is still exactly the square default `{ perSquare: 10, unit: 'feet' }`. A
referee who deliberately set a hex map to 24 leagues, or to 6 miles already, keeps what they
set. This is the one case where the backfill could cost the user something they chose, and
"cannot distinguish never-touched from set-to-that-value" is the reason the condition is
written down rather than left to the implementer. RULE-007's seed-to-the-migration-timestamp
clause does not apply and is not the analogue: that clause governs fields that are *absent*,
and this field is present on every map ever created.

### §4 What this spec does not touch

- **RULE-006 is not amended and needs no amendment.** This spec removes a breach of it. No new
  coordinate space appears, nothing stores a pixel, and `hex.size` stays a render-time-only
  multiplier crossed once.
- **RULE-002 holds.** The unit stays an uninterpreted referee-chosen string. Nothing here makes
  the app reason about miles, and "6" is a default a referee overwrites, not a rule.
- **The square map is unchanged** in label, default, arithmetic and stored value.
- **The Measure tool stays in the hex palette.** Unlike the Eye (SPEC-047 §11), it has a real
  answer to give on a hex crawl — how many hexes is it to the mountains — which is the whole
  reason this spec exists rather than a second removal.
- **No `data-testid` moves, is renamed or is removed** (RULE-005). `measure-per-square` keeps
  its id; only its visible label is a function of grid kind.

> **Work item: WI-131.** From IN-123, unblocked by DEC-093. `opus` — a schema/migration item.
> Independent of every SPEC-047 section.
