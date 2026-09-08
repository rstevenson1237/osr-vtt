# PLAN

Active & upcoming work-item ledger.

Every change to this repository originates from an item in this file that has cleared its approval gate (RULE-015).
See `INTAKE.md` for intake triage & request classification.
See `PLAN-COMPLETED.md` for historical completion records of closed work items.

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                                                                          | Spec           | From   | Agent         | Model    | Effort | Gate                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | ------ | ------------- | -------- | ------ | --------------------------------------------------------------------------- |
| **WI-111** | The hex terrain tool — one click, one hex | SPEC-047 §7 | IN-091 | claude-code | `sonnet` | S–M | ✅ **Gate cleared — user, 2026-09-07.** Unblocked by DEC-082 the same day ((b), narrowed). Ships the tool only: **no union, no border colour (IN-105 Denied), no scatter (IN-106 stays Open, not bundled).** |
| **WI-112** | Eye and Ping aimed at a token — click-time resolution, dropped when the token moves | SPEC-046 §2 | IN-087 | claude-code | `sonnet` | S–M | ✅ **Gate cleared — user, 2026-09-07.** Unblocked by DEC-084 the same day ((b) + drop-on-move). Nothing about the target is published — if the execution session finds itself changing `PingPos` or `publishPing`, it has left the answer and must stop. |
| **WI-118** | A dragged token's ring, disc and badges follow it — re-sync decorations on the drag frame | — (defect fix) | IN-112 | claude-code | `sonnet` | S | ✅ **Gate cleared — user, 2026-09-08.** Confirmed live defect (user, 2026-09-08). **Runs before WI-115**, which then needs no Deviation. |
| **WI-113** | `Token.letter`/`ProfileInstance.letter`, `imageRef` optional, schema v30 — the backfill migration | SPEC-048 §§1–2 | IN-109 | claude-code | `opus`   | M   | ✅ **Gate cleared — user, 2026-09-08.** Shape A phase 1 of 4. Unblocked by DEC-087 (a). **No visible change** — refs are left in place. |
| **WI-114** | Letter assignment reads the field instead of parsing the ref | SPEC-048 §3 | IN-109 | claude-code | `sonnet` | S–M | ✅ **Gate cleared — user, 2026-09-08.** Phase 2. Blocked on WI-113. Behaviour unchanged; mechanism changed. |
| **WI-115** | The letter is drawn over any art, two-tone by seat, with a real glyph outline | SPEC-048 §4 | IN-110 | claude-code | `opus`   | M   | ✅ **Gate cleared — user, 2026-09-08.** Phase 3, and the first visible change. Render pass (CLAUDE.md's `opus` trigger). Blocked on WI-113. DEC-086 (a). |
| **WI-116** | Retire the `gen:disc:` scheme — writers move to fields, refs cleared, `gen:` branch deleted | SPEC-048 §5 | IN-109 | claude-code | `sonnet` | M   | ✅ **Gate cleared — user, 2026-09-08.** Phase 4. Blocked on WI-114 **and** WI-115. Deleting the `gen:` branch is the acceptance test. |
| **WI-117** | The letter input in the character sheet, capped at 3 | SPEC-048 §5 | IN-111 | claude-code | `sonnet` | S   | ✅ **Gate cleared — user, 2026-09-08.** Blocked on WI-113 (the store method). Simple only because WI-113 owns the contract change. |
| **WI-119** | Terrain pack reference sheet — trace all 41 candidates, propose every `color`/`ink` pair, render the sheet | SPEC-047 §8    | IN-114 | `claude-code` | `sonnet` | M      | ✅ **Gate cleared — user, 2026-09-08.** No border colour — IN-105 Denied by DEC-082 |
| **WI-120** | The Worldographer terrain art pack — land the approved roster into `HEX_TERRAIN_CATALOG`, record Inkwell Ideas provenance | SPEC-047 §8    | IN-114 | `claude-code` | `sonnet` | M      | ⛔ **Blocked on WI-119** — takes its approved sheet as input                   |

**Eleven items queued, and every gate is cleared.** WI-109 – WI-112's four went in one
disposition (user, 2026-09-07), WI-113 – WI-118's six in another ("let's get everything we
have so far scheduled", user, 2026-09-08), and WI-119's on 2026-09-08 with WI-120 blocked
behind it — see `PLAN-COMPLETED.md` §3 for what has run and closed. **WI-109 has run and closed
(2026-09-08)** — `docs/completed/WI-109.md` — so WI-110 – WI-112 now run the e2e specs it makes
honest. WI-110 – WI-112 are mutually independent and may run in any order. **WI-119 and WI-120
are independent of all ten**, touch no code the others touch, and run in that order. **The next
free id is WI-121.**

**Clearing these gates is permission to start, not permission to bundle** — the same constraint
the 2026-08-17 batch carried. RULE-016 still means **one session, one work item**, and each item's
model target in the table is binding on its execution session. Two of the eleven are `opus`
(WI-113, WI-115) or otherwise schema/render work; the rest are `sonnet`, and running a `sonnet`
item on `opus` spends the month's allocation several times over for no gain.

**The execution order, with the two hard constraints made explicit:**

1. **WI-118** — the confirmed drag lag. A live defect, and **it must precede WI-115**.
2. **WI-110, WI-111, WI-112** — mutually independent, any order.
3. **WI-113 → WI-114 → WI-115 → WI-116**, in that order, with **WI-117** any time after WI-113.
   The sequence is what keeps every intermediate state shippable.
4. **WI-119 → WI-120** — independent of everything above, run in that order (WI-120 is blocked
   on WI-119's sheet).

Only two orderings are load-bearing — WI-118 before WI-115, and WI-113 first within the
token-letter programme. Everything else is preference.

**WI-113 – WI-117 are the token-letter programme (SPEC-048), and their order is load-bearing.**
IN-109 was rescoped on 2026-09-08 from "add a field" to "retire the `gen:disc:` mechanic", which
makes it **Shape A — a reversal** of SPEC-040 §4 (DEC-072 is *not* reopened: what the letter *is*
survives; only where it lives changes). DEC-086 and DEC-087 are both answered (a).

The split exists so that **every intermediate state is shippable**. WI-113 backfills the new
fields and **leaves every `gen:disc:` ref in place**, so nothing changes visibly; WI-114 moves
assignment onto the field; WI-115 adds the render pass, which is where a letter first appears on
an image token; only then does WI-116 clear the refs and delete the `gen:` branch. Landing WI-116
early would leave tokens with no letter and no art. **Three constraints ride along.** WI-115's
outline must be a genuine stroke on the glyph, never the disc's ring, or it ships worse
legibility than it replaces. **WI-113 owns the store method**, which is the only reason WI-117
is Simple — re-dividing them makes WI-117 Deceptive on RULE-001. And **WI-115 must not run before WI-118**. A token is
drawn as five separate display objects with no container, kept together only by the convention
that each reads its position from the sprite — and the drag handler re-syncs exactly one of
them, so a dragged token leaves its ring, disc and badges behind. **That lag is confirmed
against a running table** (user, 2026-09-08), it exists today with no letter involved, and it is
fixed on its own terms as **WI-118**. With WI-118 landed, WI-115's letter joins a drag that
already works and needs no Deviation; without it, WI-115 has to fix the drag itself and record
the repair as one, because a letter sliding off its own token is not shippable. The container
refactor that would make the convention structural is **IN-113**, kept out of both on purpose.

**The 2026-09-02 hex-tools batch: triaged, decided, and now specified.** Eleven items
(IN-084 – IN-094). Two shipped straight to work items (WI-098, WI-099, both gate-cleared); **both have since run and closed** — see below.
Nine were **Deceptive** and raised five decisions; **three were answered by the user on
2026-09-02, as recommended** — DEC-080 (the `hex` snap mode), DEC-081 (the axial overlay
space) and DEC-083 (the art pack) — and the hex programme is specified as **SPEC-047 §§1–6**
and scheduled as **WI-100 – WI-106**. WI-100 – WI-106 have all run and closed (see below).

**DEC-081 is the one that changed the shape of the work.** Working the geometry out found
that every hex corner is an exact integer multiple of ⅓ of an axial coordinate — the same six
offsets at every hex and every `hex.size`, with adjacent hexes agreeing exactly on shared
corners. Three proposed address kinds collapsed into one (`HexPoint`, in thirds), and the
standalone `RULE-AMENDMENT:` change the first draft expected came off the critical path
entirely: thirds *are* axial coordinates, and RULE-006 never said integer. What needs saying
is said by annotating SPEC-030 §1 inside WI-102 — done, 2026-09-04.

**Both of the items that were waiting on a decision are now scheduled (2026-09-07).** DEC-082
and DEC-084 were the last two Open entries in `DECISIONS.md`; both were answered, and **neither
took its recommendation.**

- **IN-091 (the terrain tool) → WI-111, SPEC-047 §7.** DEC-082 answered **(b), narrowed**: the
  investigation's recommendation, with the drag removed as well. **Terrain is locked to single
  hexes** — one click, one hex — and the whole free-snap / free-drawing conversation (brush,
  organic edge, region layer) is **postponed** as a body of work alongside IN-084, not denied
  piece by piece. The union outline and the border colour are **dropped** (IN-105 Denied), which
  costs 40 painted hexes their 40 visible seams; that is accepted. §7 is far smaller than the
  first draft assumed — no collection, no migration, no rules block, no contract change — and
  **IN-091 reclassifies Deceptive → Simple.**
- **IN-087 (Eye/Ping aimed at a token) → WI-112, SPEC-046 §2.** DEC-084 answered **(b), with a
  drop-on-move rider**: the target resolves at click time, nothing about it is published, and
  the mark is **dropped once the token moves** — decided locally by each client — because a ping
  aimed at a token only means anything while the token stays put. `PingPos` and `publishPing`
  are unchanged, so RULE-001's trigger is never reached and **IN-087 reclassifies Deceptive →
  Simple.** DEC-084 (d) stays deferred and is no longer additive: with no published target,
  widening later is a fresh design.

**IN-106 (per-hex seeded scatter) survives DEC-082 and stays Open.** It stores nothing and never
needed a region, so it is wanted under §7's click-per-hex tool exactly as it was under a brush.
Deliberately not bundled into WI-111.

**IN-084 (`snap = grid`) is Postponed** (user, 2026-09-02) — listed here, not scheduled, not
removed. **As of 2026-09-07 it has company:** DEC-082's answer postpones the free-snap /
free-drawing conversation as a whole (the hex terrain brush, the organic edge, the region
layer), and the two sit together as the deferred half of the snapping story. Reviving either
revives DEC-082 with it. It was the square-map half of DEC-080; DEC-080 answered only the hex half, and its
recommendation was written so `grid` slots into the same mechanism later without redesigning
what WI-104 builds.

**WI-101 has run and closed (2026-09-04)** — the hex art pack. Provenance was answered (user,
2026-09-02): the 37 `.svg` files have **no third-party source**, generated by Claude in a
separate session for the owner's own separate project and supplied here — nothing cloned,
traced or copied from a licensed pack. The files moved out of `docs/intake/hex-symbols/` into
`apps/web/public/assets/hex/{terrain,contents}/*.svg`, re-authored white, and are wired into
`HEX_TERRAIN_CATALOG`/`HEX_CONTENTS_CATALOG`. Ten superseded an existing kind's `ref` under an
unchanged `kind` string (`hills`, `desert`, `water`, `camp`, `castle`, `cave`, `fort`, `temple`,
`town`, `village`); the other 27 became new kinds. See `docs/completed/WI-101.md`.

**This did not close IN-078 by itself.** WI-101 wrote the hex pack's entry into the existing
`apps/web/public/assets/ATTRIBUTION.md` (RULE-018's "does not yet exist" premise was already
stale — the file has existed since WI-040); IN-078's full scope is that same file owing an
entry for the dice work's prior-art posture too. IN-078 stays Open for that remainder.

**WI-102 has run and closed (2026-09-04)** — the thirds lattice. `HexPoint` lives at
`packages/shared/src/map/hex/point.ts` with the six corner offsets, the mod-3
classification, the key form, the conversions and `snapHexPoint`; `HexPoint` and `Axial`
are branded so mixing the two spaces is a type error. SPEC-030 §1 and `axial.ts`'s header
are annotated as DEC-081 said they would be, and no rule was amended. **No storage, no UI:
WI-103 – WI-106 are unblocked.** See `docs/completed/WI-102.md`.

**WI-103 verification, 2026-09-04 — green, after one confirmed flake.** `pnpm verify`
green (lint, typecheck, unit). `pnpm verify:all`: `test:unit`, `test:rules` and `test:store`
all passed — the three suites carrying this item's coverage, and the `&&` chain means e2e
only ran because they did — and **one e2e failed**, `hex-map.spec.ts:176`, timing out for
the full 180s on a `vector-tool-select` that was still `disabled` because the map never left
view mode. **Re-running that spec alone passed all four of its cases.** WI-103's diff
contains no `apps/web` file, and the only behaviour it puts in front of the running app is
`CURRENT_SCHEMA_VERSION` 29 plus two collections nothing subscribes to — neither can gate an
Edit/View toggle. The cause is in the test helper and is logged as **IN-107**, not fixed
here (RULE-015): `switchToEditMode` reads `aria-pressed` once, clicks conditionally, and
never asserts the mode it exists to establish, so a swallowed click fails three minutes later
at an unrelated locator. Worth settling before WI-104 – WI-106, which run these same specs.

**WI-103 has run and closed (2026-09-04)** — hex overlay storage. Two map-scoped
collections exist and nothing draws into them yet: `maps/{mapId}/hexSymbols`
(`HexSymbol { id, point, kind }`) and `maps/{mapId}/hexLines`
(`HexLine { id, kind, points, shade, width, join }`), both positioned in WI-102's thirds
lattice. `HEX_LINE_CATALOG` (three browns, three blues, each kind's starting join) and
`HEX_LINE_WIDTHS` (three multiples of `hex.size`) join `catalog.ts` — a document carries
the kind and an **index**, never a colour and never a pixel width.
`CURRENT_SCHEMA_VERSION` is **29**, with a no-op migration and its tests; both names are
in `EXPORTED_MAP_COLLECTIONS` with a `.vttcamp` round trip that pins the vertices exactly;
both have a `firestore.rules` block copying `hexTiles`', with rule tests; six methods join
the contract and pass against `MemoryStore`, `FirebaseStore` and **`LocalStore`**, which
inherited them and needed no change.

**One place §2's wording had to be read rather than followed literally: the document id.**
§2 says each document is "positioned by a `HexPoint`", and keying it by `hexPointKey` —
the obvious `hexTiles` analogy — cannot hold: a Free-snap point is fractional and has no
key (SPEC-047 §1 rejects a fractional string rather than rounding it onto the lattice),
and a coordinate id would collapse two symbols in one hex to one document. The id is
minted, as `placeSymbol`'s is, and the point is a stored field. SPEC-047 §2 is annotated in
place. **No UI, no tool, no visible change** — the palette is WI-104 and WI-105. See
`docs/completed/WI-103.md`.

**WI-104 has run and closed (2026-09-04)** — the `hex` snap mode and the authored hex
palette. `VectorSnapMode` grows `'hex'`; `DEFAULT_BAND_WIDTH` answers for it (never read
for a real band, since neither Corridor nor Path is a hex tool); `HEX_TOOL_IDS` is now a
plain authored array (`select`, `pan`, `eye`, `measure`, `ping` — content unchanged) in
place of a filter over the square map's own `TOOL_GROUPS`; `MapToolbar`'s `SNAP_MODES` is
now a function of grid kind (a new `isHexMap` prop) — Hex/Free for a hex map, Cell/Half/Free
otherwise. **No visible behaviour change** — no current hex tool shows the Snap selector.
**DEC-085 was closed first** (2026-09-04, this item), under the RULE-015 unblock exception,
so SPEC-047 §4's tools (WI-105) inherit a settled zero-length-gesture rule instead of
inventing a sixth; DEC-085's own Corridor/SPEC-028 consequences are logged as **IN-108**,
not implemented here. **WI-105 and WI-106 are unblocked.** See `docs/completed/WI-104.md`.

**WI-105 has run and closed (2026-09-04)** — the Symbol, Road and River tools. Three new
`MapToolId`s (`hexSymbol`, `road`, `river`) join `HEX_TOOL_IDS`, not `TOOL_GROUPS` — they
are not square-map tools wearing a hex hat, so `MapToolbar` renders them in their own
hex-only row, gated on `isHexMap`. Symbol places a `HEX_CONTENTS_CATALOG` kind: Hex snap
lands it on the hex the pointer is inside, Free snap leaves it exactly where clicked. Road
and River reuse the Wall/Path/Polygon click-to-click, double-click(or Enter)-to-finish
gesture, collecting into a new `hexCollecting: HexPoint[]` kept apart from the lattice
`collecting` (RULE-006); each vertex resolves through `snapHexPoint` under Hex snap (the
nearest corner or centre), raw under Free. A one-point line commits nothing — the same
`>= 2` guard Wall already uses, which is DEC-085's rule satisfied with nothing new to add.
`pnpm verify` and `pnpm verify:all` both green, including two new `hex-map.spec.ts` cases.
**Not built, deliberately: hex-object selection/removal** — `removeHexSymbol`/
`removeHexLine` exist (WI-103) and stay unused; §4 describes placement only. See
`docs/completed/WI-105.md`.

**WI-106 has run and closed (2026-09-04)** — the hex Label gesture, the smallest item in
the programme. `hexLabel` joins `MapToolId` and `HEX_TOOL_IDS`, reachable through
`MapToolbar`'s hex-only row (testid `hex-tool-label`), not `TOOL_GROUPS`. Its click resolves
through `hexAt` — the same `pixelToAxial` Select's own gesture already uses — and sets
`MapToolController.selectedHex`, opening the same `HexTile.note` field the hex-tile sheet
already edits; both snap modes agree, so the Snap selector is not shown for it, the way it
isn't for Select. **No new schema, no new collection, no migration** — it writes nothing
`setHexNote` didn't already write. SPEC-030 §§1 and 5 are annotated in place: "Label is
doubly out" still holds, since this tool invents no name and places no anchor.
`pnpm verify` and `pnpm verify:all` both green, including one new `hex-map.spec.ts` case.
See `docs/completed/WI-106.md`.

**The next free id is WI-121** — WI-109 – WI-112 were scheduled 2026-09-07, WI-113 – WI-118
on 2026-09-08, and WI-119/WI-120 the same day (see §2's table).

**WI-120 and WI-119 are queued (2026-09-08)** — the Worldographer terrain art pack. The
project owner supplied two public-domain Inkwell Ideas icon sets to replace the **terrain**
half of what WI-101 landed four days earlier; contents are untouched. Triaged as **IN-114**,
**Deceptive**, and specified as **SPEC-047 §8** — numbered 8 because §7 stays reserved for
IN-091's terrain tool. **DEC-083's three rules carry over unchanged** (extend and alias,
re-author white, single-tone only) and the supplied art satisfies them more comfortably than
WI-101's pack did: all 37 B&W files are a single flat `#484848` ink with the antialiasing
entirely in the alpha channel, so white re-authoring is a substitution, and no file is
two-tone. Of the 60 multicoloured files only six are single-tone and usable; the other 55
would be a redraw. **No migration, no schema change, no store contract, no rules block.**
**DEC-088 was answered the same day** (user, 2026-09-08): trace to SVG; take all 37 B&W
shapes; add four single-tone files from the colour set (`cultivatedfarmland`, `snowfields`,
`deadforest`, `reefs`); kinds with no equivalent leave the palette but keep resolving, so
there is still no migration; `water` becomes three shades of blue with **no glyph**, which is
how Worldographer itself draws Ocean and Sea; names come from the filenames minus `bw-`; and
`volcano` stays in both catalogs deliberately — the terrain kind says *volcanic country*, the
contents kind says *that volcano, there*.

**That answer raised DEC-089, answered the same day.** The colour model changed with it: contents stay
black, terrain background is a colour, and **terrain ink becomes a colour contrasting with that
background rather than one of two greys**. `sprite.tint` is a multiply, so this needs no
pipeline change and the art is *still authored white* — white is the multiply identity, which
is what makes ink a render-time decision at all. What is open is where the ink comes from:
**the user answered (a)** (2026-09-08): an authored `color`/`ink` pair on each row, guarded by
a unit test asserting a minimum contrast ratio. The *mechanism* is settled; the ~42 concrete
pairs remain WI-119's deliverable, judged on the sheet. It retires
`HEX_OVERLAY_DARK`/`HEX_OVERLAY_LIGHT` and amends SPEC-030 §2, a Completed spec.

**IN-105's border colour is out, twice over.** The user excluded it from DEC-089 on
2026-09-08 as needing more design work. **DEC-082 had already Denied it** the day before
(user, 2026-09-07) — the union outline and the border colour are dropped together and
`HexTerrainEntry` gains no border field. The two rulings agree; the stronger one stands.
`HexTerrainEntry` gains `ink` and nothing else.

**`badlands` vs `brokenlands` is not a blocker.** The user's call: the two shapes are close
enough that the wrong decision is invisible to anyone but us. WI-119 proposes one and moves on;
it does not stop for an answer. **The next free id is WI-111.**

**WI-100 has run and closed (2026-09-03)** — the terrain investigation. Findings only, no
code changes (DEC-027, RULE-015). **It recommends (b)**: Free mode writes hex tiles at
sub-hex resolution, and the region layer, the migration and the rules block are not bought.
Four rendered figures and one benchmark are in `docs/completed/wi-100/`. The four questions
came back: (b) preserves a painted region's **extent** to within ~4% at every hex size and
loses only its **edge**, all of it within one `hex.size` of the boundary; the union is
confirmed render-time, is O(n) with **no float geometry** — every hex corner is an exact
integer axial *thirds* pair, which is SPEC-047 §1's `HexPoint` arriving from a second
direction — and costs 0.18 ms at 300 painted hexes against a pass `renderAll` already runs
on every pointer move; the seeded scatter reads as texture at every size tried and needs
**no region**, seeded per hex from its own axial key; and erase has one meaning under (b)
against an invisible split under (a). **A fifth finding moved the answer**: (a)'s two layers
do not compose — a map painted entirely in Free mode *looks* like a forest and answers "no
terrain" for every hex, which is DEC-082's own objection to alternative (c) applied to (a).
**DEC-082 stays Open for the user's answer**; IN-091 stays blocked on it, and SPEC-047 §7
still waits. Two intake items raised: **IN-105** (like-terrain hexes have no drawn boundary,
and `HexTerrainEntry` has no border colour) and **IN-106** (per-hex seeded scatter as the
terrain texture). See `docs/completed/WI-100.md`.

**In flight (2026-09-03): a CI unblock on WI-098's branch, under RULE-015's exception.**
`test-emulators` was red on PR #138 and no docs change could land past it. Root cause found
and it is not what the last two fixes assumed: `packages/shared/vitest.config.ts` excluded
`src/rules/**` and the contract suite from the emulator-free `test:unit` suite, but **not**
the `*.emulator.test.ts` files, and `vitest.store.config.ts` listed
`account-recovery.emulator.test.ts` by name while nothing listed
`room-uploads.emulator.test.ts`. So that file ran in `test:unit` — failing
`auth/network-request-failed` for anyone running `pnpm verify` without an emulator, and
running in CI **without** the 60s timeout and `retry: 2` its sibling gets, which is the
config comment's own documented mitigation for the exact `RESOURCE_EXHAUSTED` Listen
failure it was dying on. Both configs now use a glob. Verification running.

**WI-098 has run and closed (2026-09-03)** — the snap audit. Findings only, no code
changes (DEC-027, RULE-015). Ten geometry-placing tools × three snap modes, tabulated from
`vector-tools.ts`, the `buildFloorStroke` path, `VectorMapView`'s collectors and
`primitives.ts`. Two results matter here. **The code has three anchor families, not §2's
two** — lattice vertex (`snapPoint`: Wall, Door, Polygon), cell **centre**
(`snapCellCenter`: Corridor, Path, N-gon, Carve) and cell **corner** (`snapCell`, floored:
Room, Symbol, Label) — and only the first attracts to a vertex under Free. **Only two tools
change shape class with the mode**, and both changes were already cited: Path's caps
(SPEC-028 §7) and Carve's brush (DEC-032); everything else that differs per mode is
quantization. Nine uncited differences were found and logged as **IN-095 – IN-103**
(`INTAKE.md` §1.1), including a correction to one of the three "known" outliers — the
Corridor never rounds its caps, so §7's flat-vs-round split is Path's alone, and the
Corridor's Free indicator draws a circle in front of a rectangle. **Symbol and Label should
not join the vertex-attracting set** (IN-103). See `docs/completed/WI-098.md`; its §4 is
the handoff to DEC-080, and **IN-102 should be settled with DEC-080 rather than twice**.
IN-095 – IN-103 carry *proposed* classifications only and are **not** counted among the
triaged-and-unscheduled items below. (**The next free `IN-` id is IN-114** — IN-105 and IN-106 came from WI-100, IN-107 from
WI-103's verification, IN-108 from DEC-085's closure ahead of WI-104, IN-109 – IN-111 from
the 2026-09-08 token-letter request, IN-112/IN-113 from that request's render-path findings, and
IN-114 from the 2026-09-08 terrain art replacement; the next free `WI-` id is **WI-121**, WI-109 – WI-112
having been scheduled on 2026-09-07, WI-113 – WI-118 on 2026-09-08 and WI-119/WI-120 the same day;
the next free `DEC-` id is **DEC-090**. DEC-082 and DEC-084
were both answered on 2026-09-07, and **DEC-086** was raised on 2026-09-08 by IN-110 and answered
(a) the same day; **DEC-087** was raised on 2026-09-08 by IN-109's rescoping and
answered (a) the same day; **DEC-088** and **DEC-089** were raised and answered on 2026-09-08 by
IN-114, so **no `DECISIONS.md` entry is Open**. The next free `DEC-` id is **DEC-090**.)

**The audit's findings were classified and scheduled the same day (user, 2026-09-03).** All
ten intake items are approved as proposed, and they land as **two work items and one
decision** rather than nine of anything:

- **WI-107 — reconcile SPEC-028 with the code** (IN-095 – IN-098, IN-100, IN-101, IN-103,
  IN-104). Eight items, one story: the spec says something the code does not do, or the
  reverse. Exactly **one line of behaviour** changes — `targetedBandFor`'s predicate, so the
  Corridor stops drawing a Free-snap circle advertising a round cap it never draws — and
  everything else is documentation plus one extension to `vector-tools.test.ts:918`.
  **Its most important line is IN-104**: SPEC-028 §2 frames the world as cell-anchored versus
  vertex-snapped, but the code has *three* anchor families — lattice vertex (`snapPoint`),
  cell centre (`snapCellCenter`) and cell corner (`snapCell`, floored). §2 is a **standing
  constraint on any new floor tool** (DEC-012) and is the text WI-103 – WI-106 will be read
  against, which is why WI-107 was worth running before WI-102 even though nothing blocked on
  it. **IN-097 is answered in place** — keep the Euclidean disc of cells and document it,
  rather than reshaping the brush footprint; that ruling is what keeps the item Simple.
- **WI-108 — Symbol and Label get Room's targeted-cell indicator** (IN-099). **Has run and
  closed (2026-09-05)** — see `docs/completed/WI-108.md`. The only finding a referee would
  actually notice: two tools offer a Snap selector and give no snap feedback at all, neither
  dot nor highlight. Its own gate and its own diff because it changes visible behaviour and
  rewrites §6's "Room highlights the cell".
- **DEC-085 — what does a zero-length gesture commit?** (IN-102, raised not scheduled).
  **Closed 2026-09-04**, answered by the user as recommended, ahead of executing WI-104 — see
  `docs/decisions/DEC-085.md`. One rule in SPEC-028 §2: under Cell/Half, one cell (as today);
  under Free, the tool's own end primitive at its snap anchor, nothing for a tool with no
  governed width. This endorses Room/N-gon/Path/Carve unchanged and moves the Corridor from
  "nothing" to a `bandWidth` `cornerBlock` square. **The Corridor code change and the SPEC-028
  §2 rewrite are not part of WI-104** (a square-grid tool, RULE-015) — logged as **IN-108**,
  which folds in IN-095's matching Free-indicator fix. WI-104 inherits the settled rule
  directly for the hex tools it adds.

> **A correction worth stating.** WI-098's record and IN-102's entry both said this should be
> settled "alongside DEC-080". That was wrong: **DEC-080 was answered and closed on
> 2026-09-02**, before WI-098 ran, so it could not absorb it. DEC-085 carries the question
> instead. `docs/completed/WI-098.md` §4 is annotated in place rather than rewritten.

**WI-093 has run and closed (2026-09-02)** — numeral orientation no longer reads face-table
winding. `faceGlyphUp` projects the die-local `+Y` axis onto each face and snaps it to a
direction the face's own symmetry admits; `Polyhedron.faceUp` is promoted from the d10's
exemption to the declared override, applied without the snap; SPEC-045 §1's binding test —
rotating a face's index list must not change its glyph-up — holds for every shape, and two
further tests pin the corner-apex placement and the shared-axis family reading. UVs only: face
count, material groups, `locators`, `hullPoints`, the face→value remap and `topFaceIndex` are
untouched. See `docs/completed/WI-093.md`.

**WI-094 has run and closed (2026-09-02)** — die proportion. `SCALE` is retuned so real
circumradius (the farthest `hullPoints` vertex from centre, not the raw table entry — the
cube's corners sit at radius √3, uncorrected before) follows SPEC-045 §2's ordering
`d4 ≤ d6 < d8 < d10 ≈ d12 < d20`, pinned by a new test; `apexZ` is unchanged at 0.85, checked
against a headless render and found neither spiked nor squat. See `docs/completed/WI-094.md`.

**WI-095 has run and closed (2026-09-02)** — incised numerals. `textures.ts`'s canvas
emboss pass is gone; each numeral label gets a generated normal map (cached per-label,
independent of theme/face color, dropped alongside the material cache) hung on
`normalMap`, so the incision is lit by the real key light rather than a fixed offset copy.
`MATERIAL_PARAMS` is retuned (roughness 0.34, metalness 0.09, `envMapIntensity` 0.6) and
`scene.ts` bakes a PMREM `RoomEnvironment` onto `scene.environment` once per mount, disposed
on `dispose()`. Face texture color and `flatShading` are untouched; face count, material
groups, `locators` and the face→value remap are untouched. See `docs/completed/WI-095.md`.

**WI-096 has run and closed (2026-09-02)** — dice meet each other. `simulate()`'s spawn now
clusters each roll's dice within a shared arc (`SPAWN_ARC`) on a tighter ring
(`SPAWN_RADIUS_MIN`/`SPAN`), with a stronger inward launch (`INWARD_VELOCITY`); collisions
were already on and no physics-architecture or collision-group change was needed.
`MAX_STEPS` raised 300 → 360 for the extra contacts. A die resting on another die is
documented as an accepted outcome — `topFaceIndex` reads correctly regardless of tilt — not
nudged apart. See `docs/completed/WI-096.md`.

**WI-097 has run and closed (2026-09-03) — and with it the whole dice batch, and
SPEC-045, which is now Completed.** Every value face is inset in its own plane by a constant
world-space width and the band that opens up is filled with an edge strip per edge and a
corner patch per vertex, all of it in **one** material group past the value range
(`DieGeometry.bodyGroupIndex`, always `faceCount`), so the `faceIndex → value` 1:1 relation
is untouched and `scene.ts`'s materials array is the single place that grew. `flatShading`
splits per material over an **authored** `normal` attribute — `computeVertexNormals()` cannot
express the split, since it makes every vertex of a triangle carry that triangle's own
normal. Both judgements §4 deferred were made by looking, in a headless render: the seam is
clean, and **`hullPoints` stays the un-bevelled cloud** (worst-case recession 9.4%, the d4's
apex; no gap at all on a face-first contact). See `docs/completed/WI-097.md`. The previous
batch (WI-091, WI-092) had landed before it; see §3 for the completion records.

**IN-077 (selectable 3D die models) was Denied (user, 2026-09-02).** DEC-077 answered
alternative (c): decline the imported model, spend the effort on the generated dice set
instead. No `WI-` id was ever reserved, so none is retired. The row moved to `INTAKE.md` §1.2, and
the ids it did not take went to the replacement batch above. (That note read "the next free id
is now WI-100" when it was written; WI-100 – WI-106 went to the hex programme and WI-107/WI-108
to the 2026-09-03 snap-audit batch, so **the next free id is WI-109** — see the note above
§2's table.)

**Corrected 2026-09-07 — this count was stale, and badly.** It read *"Fifteen items remain
triaged and unscheduled — the six below, plus the nine Deceptive items of the 2026-09-02
hex-tools batch (IN-084, IN-087 – IN-094)"*. Of those nine, **seven have since closed**
(IN-088 – IN-090, IN-092 – IN-094 via WI-101 – WI-106; IN-091 is now scheduled as WI-111), and
IN-087 is scheduled as WI-112 — leaving **IN-084 alone**, Postponed. The six below have also
moved: IN-079 – IN-083 all closed with the dice batch (WI-093 – WI-097), leaving **IN-078**.

**What actually remains triaged and unscheduled, as of 2026-09-07:** IN-078
(`ATTRIBUTION.md`'s remaining entry) and IN-084 (Postponed). Everything else on the board is
either scheduled (WI-109 – WI-112) or awaiting first triage (IN-106, plus the older untriaged
rows in `INTAKE.md` §1.1).

**~~Six items remain triaged and unscheduled from before that batch.~~ Stale, annotated in
place 2026-09-07** (RULE-019 — the passage is corrected here rather than deleted). It listed
IN-078 plus IN-079 – IN-083, and described the conversations IN-079 and IN-082 needed. **All
five of the dice items have since closed**: IN-079 → WI-093, IN-080 → WI-094, IN-081 → WI-095,
IN-082 → WI-097 (via DEC-079), IN-083 → WI-096 — the whole batch landed 2026-09-02/03 and
SPEC-045 is Completed. **Only IN-078 is left of the six**, still Open for `ATTRIBUTION.md`'s
remaining entry: WI-101 wrote the hex pack's entry into that file, and the dice work's
prior-art posture still owes one. See `INTAKE.md` § "Dice presentation and die-to-die collision
(2026-09-02)".

**WI-091 has run and closed (2026-08-30)** — `dice`, `tools` and `ruler` redrawn per
SPEC-043 §4 (a d20 hexagon with centred-vertex spokes, a latched toolbox, a flat graduated
straightedge), `stroke-width` 1.75 across the set, and the README icon-system section this
batch's constraint 1 called for. See `docs/completed/WI-091.md`.

**WI-092 has run and closed (2026-08-31)** — a `:focus-visible` ring (`outline: 2px solid
var(--focus)`, `outline-offset: 2px`) added to every icon-only control in the eight
components SPEC-044 §2 names; the disabled state SPEC-044 §3 confirmed already correct was
left alone. See `docs/completed/WI-092.md`.

**WI-089 has run and closed (2026-08-18)** — local mode exists. `LocalStore` is
`MemoryStore` plus a debounced, whole-file `.vttcamp` write-back and passes the full
contract suite as the third implementation (RULE-001); `pnpm build:local` builds the
`local-build` Vite mode, which aliases the store touchpoint to a Firebase-free
`client.local.ts` **in the resolver**, so the output greps zero matches for
`firebase|firestore|osr-vtt|appspot|identitytoolkit|firebaseio` (main chunk 4.38 MB →
3.62 MB); one `SESSION_MODE_KEY` flag, read in six containers, removes SPEC-041 §3's list
by not rendering it; the local lobby offers Open campaign… / New campaign… and nothing
else. **SPEC-041 is Completed.** Three unblocking changes were needed and are recorded
under Deviations — `MemoryStore.importRoom` was dropping document ids, and the local
bundle only stops carrying the Firebase SDK once `FirebaseStorageAssetStore` leaves
`asset-store.ts` and `@osr-vtt/shared` is marked side-effect-free. One item of §3's
removed list, **shared rolls and roll readiness**, could not be removed by not rendering:
the encounter board's Call for initiative is the only way to open one and its Roll/Apply
actions live in the readiness panel, so removing it would remove a feature §3 keeps. See
`docs/completed/WI-089.md`.

WI-066 closed 2026-08-14 and was the last item in the previous ledger; this batch starts at
**WI-083** (RULE-019 — ids are never reused).

**WI-084 has run and closed (2026-08-18)** — `MapBackground.locked`, schema v27, the
lock backfill, `setBackgroundLocked` and the Assets-panel toggle (`docs/completed/WI-084.md`).

**WI-085 has run and closed (2026-08-18)** — Select picks up an unlocked background on the
canvas, lowest priority behind vertex handles, whole objects and the lasso; move and resize
(the existing single ratio-locked handle) in one gesture; `background-adjust-{id}` and the
`MapToolController.selectedBackgroundId` bridge are retired (`docs/completed/WI-085.md`).
PR #123's CI caught an unrelated `room-uploads.emulator.test.ts` timeout flake (Storage
emulator jar still downloading when the test ran); user-approved deviation bumped it to
15s, re-verified against the emulator, and pushed (see Deviations, `docs/completed/WI-085.md`).
**WI-086 has run and closed (2026-08-18)** — `background-transform.ts`'s `resizeBackground`
is now handle-parameterised (`BgHandle`), `backgroundHitTest` grows to all eight handles
plus the body (corner-before-edge, handle-before-body), and `vector-engine.ts` draws all
eight; the stored `x, y, w, h` shape is untouched, so no migration ships
(`docs/completed/WI-086.md`). PR #124's first CI run hit the same
`room-uploads.emulator.test.ts` Storage-emulator-jar-download flake WI-085's PR #123 hit
(the 15s bump wasn't enough on a second cold run); user-approved deviation bumped it to
30s and pushed (see Deviations, `docs/completed/WI-086.md`).

**All eight gates cleared (user, 2026-08-17)** — "schedule everything as approved", the
whole batch in one disposition. Clearing a gate does not lift a constraint: **WI-088 was
still a standalone `RULE-AMENDMENT:` change on its own branch (RULE-017), WI-089 was still
blocked on it, and WI-090 on WI-089.** Approval is permission to start in the stated order,
not permission to bundle. **WI-088 landed 2026-08-18 on exactly that shape**, unblocking
WI-089, which landed the same day and unblocked WI-090 in turn — all three now closed.

### Ordering and constraints

**The dice batch runs in table order, and the order is load-bearing (2026-09-02).**

1. **WI-093 and WI-094 first** — the two defects the user actually reported (numerals
   oriented wrong, shapes off). They are independent of each other and of everything below.
   **Both have landed.**
2. **WI-095 next. Landed.** SPEC-045 §4 turns on judging bevels only after the normal map
   ships: most of a bevel's contribution is the edge highlight, which §3 produces with no
   geometry change and no contract impact.
3. **WI-096 before WI-097.** Once dice actually strike one another, a collider larger than
   its mesh shows as a gap at contact — which is the question WI-097 has to answer about
   `hullPoints`. It is answered by looking, so the looking must be possible first.
4. **WI-097 last**, and it did not start on the schedule alone: SPEC-045 §4 required the
   user to have seen WI-095's result, because the remaining silhouette work might have been
   smaller than it looked. **Clearing a gate is permission to start in the stated order, not
   permission to bundle or to skip a blocked-on constraint.** The user starting the item
   cleared that last constraint, with §3 and §5 both shipped. **Landed; the batch is
   closed.** The scope did not shrink: §3's normal map supplied the edge highlight as
   predicted, and the silhouette work it could not touch was exactly what remained.

**Model targets.** `opus` on WI-093 and WI-097 because both change what a face or a material
group *is* to every consumer of `DieGeometry` — the render-pass contract RULE-013's remap
addresses. `sonnet` on WI-094, WI-095 and WI-096, which tune proportion, material and throw
**within** a fixed contract. The target is binding on the execution session (RULE-016: one
session, one work item).

**No `RULES.md` amendment is in this batch, and none may be added to it.** RULE-013 is
satisfied throughout by construction — the headless sim runs first and the face→value remap
is applied to its result, so no section can make a displayed face depend on physics. Any work
item that finds itself needing to weaken that stops and flags (RULE-017).


**Gate cleared 2026-08-28 (user).** Approval is permission to start on the scope as
specified — SPEC-043's 34 glyphs plus the documentation — and is not permission to widen
it. See constraint 3 below, raised at the gate itself.

**WI-091 has no predecessor and blocks nothing.** It touches one file's `MARKUP` record
plus documentation, so it neither waits on nor holds up any other item, and it can be run
against `main` whenever it is scheduled.

**Two constraints the execution session must not lose.**

1. **`README.md` is part of this work item, not of this plan.** Nothing has been written to
   it here, deliberately — `README.md` documents *present-day* behaviour, and until the
   glyphs are actually redrawn the depiction rule is intent, which is what SPEC-043 is for.
   The execution PR adds the icon-system paragraph to README's "Session shell — quick
   sheets (II.1)" section and cross-references SPEC-043 §3 from the map-palette prose
   around the `tool-groups.ts` description. RULE-018 is satisfied by that PR, not by this
   one.
2. **34 glyphs, not 33.** The design canvas drew 33 — `fullscreen-exit` was not among them,
   being the mirror of `fullscreen`. It is still an `IconId` and it is still in scope; it
   is drawn during execution, mirroring whatever `fullscreen` becomes.
3. **The focus state is NOT in this work item — it is WI-092** (IN-075, SPEC-044). The
   design canvas showed five button states; only three — rest, hover, active — exist in the
   shell icon chrome, and those three are what SPEC-043 §5 documents as unchanged. The focus
   ring on that board was a proposal drawn without being labelled as one. WI-091 must not
   add it; WI-092 does, under its own spec. The disabled state on that board turned out to
   need no work at all — see SPEC-044 §3.

**WI-091 and WI-092 are independent and may run in either order or concurrently.** They
touch overlapping files (`QuickSheetRail`, `MainViewTabs`, `MapToolbar`, `MobileTopBar`,
`PresentationToggle`, `ActivityDrawer`, `SessionTab`, `RoomShell`) but never the same lines:
WI-091 edits the `MARKUP` record in `Icon.svelte` and nothing else in those files, WI-092
adds a `:focus-visible` block to each `<style>` and touches no markup. If both are in flight
the second to land merges its base branch first (there is no ordering constraint to preserve,
only a textual one to resolve).


**WI-083 has run and closed (2026-08-17), ahead of WI-084 – WI-086 as planned.** It
live-reproduced one runtime error (a second GM removing a background the first GM is
mid-drag on throws an uncaught `FirebaseError`, IN-067) and confirmed two more by code
reading (`applyBackgrounds`'s all-or-nothing texture load, IN-068; backgrounds placeable
on hex maps in an undefined coordinate space, IN-069) — see `docs/completed/WI-083.md`.
None of the three changes WI-084 – WI-086's scope: they are independent of the
lock/select/handle rewrite these items make, and none of them is the Fit-to-grid
canvas-swallowing defect that IN-060 already knew WI-084 – WI-086 exist to fix. All three
are logged as their own intake items (DEC-027) and await triage rather than being fixed
here.

**WI-084 → WI-085 → WI-086 is a hard chain.** Select cannot ask whether a background is
unlocked until the field exists, and the handle model is only reachable through the
selection that WI-085 builds. WI-086 could technically land before WI-085 (the math is pure
and testable on its own) but would then be unreachable from the UI, which is how WI-039
ended up shipping a renderer with no producer.

**WI-087 has run and closed (2026-08-18)**, independent of the background chain as
planned — `Token.name` and schema **v28** (the migration deliberately backfills nothing:
`creatureLabel`'s output is the very ref fragment IN-064 is about), `setTokenName` on the
contract suite, the picker's Name + Quantity fields, and generated symbols that are
uppercase and **per group**, restarting at A. The board card, the quick sheet header and
the initiative order all resolve one name through `creatureDisplayName`; the last of those
was printing a whole `gen:disc:` ref. SPEC-040 §5's "the map token's label" is annotated in
place rather than built — a map token renders no text label and §4 defines its on-map
identity as the letter; giving it one is a new intake item. **SPEC-040 is Completed.** See
`docs/completed/WI-087.md`.

**WI-088 → WI-089 → WI-090 is a hard chain, and the first link is a rule.** RULE-009 stated
the backend as fact, so a backend-less build contradicted it as written; RULE-017 required
the amendment to be its own change, its own branch, its own `RULE-AMENDMENT:`-prefixed
commit and its own approval, landing **before** any implementation. This is the same shape
WI-037 and WI-065 took.

**WI-088 closed 2026-08-18** — the amendment landed on its own branch and its own
`RULE-AMENDMENT:`-prefixed commit. RULE-009 is now **"Backend, per build"**: the hosted
Firebase/Spark backend is restated word for word and unchanged, a local build with no
backend, no identity and no network is admitted beside it, RULE-003, RULE-004, RULE-011 and
RULE-012 are **scoped to the hosted build** (none weakened), and RULE-001 and RULE-014 are
recorded as binding *harder* locally. SPEC-041's blocking note is cleared. See
`docs/completed/WI-088.md`. **WI-089 then closed on 2026-08-18** and built the local
runtime, so **WI-090 was unblocked**: it had a real bundle to package, a real
`pnpm build:local` to run, and a measured Firebase-free result to mechanise in CI rather
than a hypothesis (`docs/completed/WI-089.md`).

**WI-090 closed 2026-08-18** — investigation only (RULE-015), no product code. Built and
grepped both bundles fresh (0 Firebase/project hits in `dist-local` vs 179 in `dist`,
matching WI-089's numbers exactly); built and live-ran a real no-install launcher (a Node
22 Single Executable Application — 0 installed dependencies, but 119 MB raw / 44 MB zipped
per platform); zipped, unzipped and served the bundle to simulate a real downloaded
release, and drove it in headless Chromium through a full create → render → save →
download round-trip with zero console errors and zero non-localhost requests; and live-
reproduced a real gap — a `.vttcamp` with a `schemaVersion` newer than the running build's
opens silently, with no guard, unlike the (correctly guarded) older-archive direction. Four
new intake items logged (IN-070 – IN-073), awaiting triage. See `docs/completed/WI-090.md`
and `INTAKE.md`'s "Findings from the IN-066 packaging investigation".

**Suggested execution order:** WI-083, WI-084, WI-085, WI-086, WI-087, WI-088, WI-089,
WI-090 — all landed. The local-runtime trio was last because it was the largest and because the four
background items were playtest findings against shipped behaviour — the same reasoning as the
2026-08-02, 2026-08-03 and 2026-08-11 priority rulings.

### Schema versions in this batch

Two schema bumps land in order: **v27** (WI-084, `MapBackground.locked` — landed
2026-08-18) then **v28** (WI-087, `Token.name` — landed 2026-08-18,
`CURRENT_SCHEMA_VERSION = 28`). Both took the numbers the spec text predicted. If the execution order changes, the numbers follow the order they
actually land in — the spec text names the version each work item is expected to take, and
the execution session is responsible for reconciling it against
`CURRENT_SCHEMA_VERSION` rather than trusting the spec's number (RULE-007).

Execution order: — (WI-029, WI-031, WI-032, WI-033, WI-034, WI-035, WI-036, WI-037, WI-038, WI-039, WI-040, WI-041, WI-042, WI-043, WI-044,
WI-045, WI-046, WI-047, WI-048, WI-049, WI-050, WI-051, WI-052, WI-053, WI-054, WI-055, WI-056,
WI-057, WI-058, WI-059, WI-060, WI-061, WI-062, WI-063, WI-064, WI-065, WI-066, WI-067, WI-068, WI-070, WI-071, WI-073,
WI-074, WI-075, WI-076, WI-077, WI-078, WI-079, WI-080, WI-081, WI-082, WI-083, WI-084, WI-085, WI-086, WI-087, WI-088, WI-089, WI-090 completed; see §3.)

---

One ordering constraint, the rest is preference:

- **WI-054 → WI-055 → {WI-056, WI-057}** is a hard chain: the ownership predicate needs
  the actor key to exist, and both consumers need the predicate. WI-056 and WI-057 were
  independent of each other and could swap. **All four have landed** — WI-054, WI-055,
  WI-056 and now WI-057, which gates `pointerdown` on `canActOnToken`. SPEC-032 is
  Completed.

**WI-054 had to account for WI-050**, which landed first: both touch `ProfileInstance`.
WI-050 took the schema to **v20** and made `color` a value every character always has,
resolved through `assignedCharacterColor(seatId)` rather than stored on every document
(DEC-040). WI-054 re-keys the document id from a seat id to an actor id — so its migration
started from v20, and its actor key became the input to that colour derivation for a
creature, which its gate had to answer rather than inherit. **Answered: DEC-042** — the
colour guarantee stays a _character_ guarantee and does not follow the key. **WI-056
resolved the consequence for the quick sheet:** a creature's colour swatches start with
none selected, and picking one is what gives it a colour for the first time.

**Priority (user, 2026-08-02).** Every item raised in this session — **WI-046 – WI-057** —
runs **before** the Battle Map (WI-033 – WI-036) and Hex Crawl (WI-037 – WI-041) series:
they are more impactful for gameplay today. Both large series keep their internal order
and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041** and is still a standalone `RULE-AMENDMENT:` change on its own branch
(RULE-017) whenever it is reached.

**Priority (user, 2026-08-03).** The mobile, carve-artifact and credits items —
**WI-058 – WI-064** — run **before** the Battle Map (WI-033 – WI-036) and Hex Crawl
(WI-037 – WI-041) series, on the same reasoning as the 2026-08-02 ruling: they are
playtest findings against shipped behaviour. The **Blaze** pair (WI-065, WI-066) runs
**last, after both large series** — the user's words were "schedule it after the battle
map and hex crawl wi, everything else comes before". Both large series keep their internal
order and their cleared gates; only their position moves. **WI-037 remains the gate on
WI-038 – WI-041.**

Three of the seven new items are Simple and mutually independent — **WI-058, WI-059 and
WI-060** — and between them cover the two most visible complaints (Safari clipping the
toolbars, thin paths going triangular) plus the credits. None of them waited on an open
decision except WI-059, whose DEC-047 was the least contentious of the batch. **WI-058 and
WI-059 have both landed** (2026-08-04); WI-060 remains. The four Deceptive items each
carry an Open decision and must not start before it is answered.

**Two ordering constraints inside the new batch.** **WI-061 → WI-062**. The bend-axis latch
rewrites which leg is built first, and WI-061 rewrites how a leg is built at all; doing
them in the other order means building the latch against geometry that is about to change.
**Both landed 2026-08-04, in that order**, and the constraint paid off: §9's
interior/terminal rule was already in `bandRect` when the latch arrived, so the latch is
read in gesture order over it rather than duplicated per axis. And **WI-067 → WI-063**: while `isMobile` answered both "is this touch?" and "is this the
mobile layout?", a hover equivalent could not be specified for one without silently binding
the other (DEC-052). **WI-067 landed 2026-08-04**, giving WI-063 two separable signals to
specify against — `ShellMedia.isNarrow` for the layout and `isCoarsePointer` (plus
`theme/sizing.css`'s `(pointer: coarse)` block) for touch — and **WI-063 landed 2026-08-08**
on exactly that split, taking `isCoarsePointer` as a prop into `VectorMapView` and leaving
`isNarrow` untouched. **WI-064 landed 2026-08-08**, last of the batch — it sequenced after
WI-058 because it extends that viewport baseline, and it closes SPEC-033.

**IN-014's item shipped as WI-068** (2026-08-03), ahead of WI-058 in execution order, per
its own gate; see §3.

**Cleared gates.** **WI-058** (user, 2026-08-03) — landed 2026-08-04; see §3. **WI-059**
— landed 2026-08-04; see §3. **DEC-046, DEC-047 and DEC-048 were ratified
as recommended** in the same turn, which unblocked WI-059, WI-061 and WI-062 — **all
three landed 2026-08-04**; see §3. **DEC-049 was answered (c)** and **DEC-052 (b)** later the same day; WI-066
stays blocked on WI-065 alone, which RULE-017 requires to land on its own. Nothing from
this batch is now waiting on a decision.

**WI-069 landed 2026-08-07** — the token-optimization refactor (SPEC-035); see
`docs/completed/WI-069.md`. It is the reason `SPEC.md`, `DECISIONS.md` and
`PLAN-COMPLETED.md` are now indexes over `docs/spec/`, `docs/decisions/` and
`docs/completed/`, and the reason execution sessions run `sonnet` by default.

**All remaining gates cleared** (user, 2026-08-08): **WI-033–WI-036, WI-038–WI-041,
WI-065, WI-066, WI-070** — approved and scheduled. **WI-033 landed 2026-08-09**, first of
the Battle Map series — `GameMap.battle`, schema v22, and the rule that a battle map never
survives a `.vttcamp` (SPEC-029 §3); see `docs/completed/WI-033.md`. **WI-070 landed
2026-08-09** — the `portability.spec.ts` un-quarantine (SPEC-036); see
`docs/completed/WI-070.md`. The e2e battery now carries no `test.fixme`. **WI-034 landed
2026-08-09** — the capture tool (SPEC-029 §1): `vectorMap.captureRect`, the `capture`
`MapToolId` in the `shapes` group (referee-only, filtered out of `MapToolbar` for a
non-GM seat), its own `theme.battleCapture` preview colour, and
`MapToolController.pendingBattleCapture` as the commit target — still no document write,
so WI-035 – WI-036 inherit a schema with no producer; see `docs/completed/WI-034.md`.
**WI-035 landed 2026-08-09** — the §4 render differences: a bounded camera
(`VectorMapEngine.setCameraBounds`, geometry in `map/pan-zoom.ts`), the doubled grid and
halved per-square display value, and the `toolSubset` prop threaded
`MapToolsSheet → MapToolPalette → MapToolbar` that leaves a battle map with the View tools
only; all three derived from `GameMap.battle`, none stored. See `docs/completed/WI-035.md`.
**WI-036 landed 2026-08-10** — the §5 quick sheet: `CampaignStore.createBattleMap`/
`exitBattleMap` (RULE-001, both new to the contract suite), the preview thumbnail
(`VectorMapEngine.exportPng` reused with an explicit frame, `hideGrid` and background-colour
compositing — SPEC-029 §2), and Start/Exit. This is the producer WI-035's differences and
WI-034's capture were waiting on; SPEC-029 is now Completed. See `docs/completed/WI-036.md`.
**WI-071 closed 2026-08-11** — ledger repairs: SPEC-028 index cell, hex-grid "Deferred"
entries annotated as stale, IN-041 moved from §1.1 to §1.2; see `docs/completed/WI-071.md`.
**WI-082 closed 2026-08-13** — group card "Tidy" (DEC-067): `tidyGroupUpdates` grid-
arranges a group's members on demand, a batched `moveTokens` write that never touches
`memberOffsets`; see `docs/completed/WI-082.md`. The map-tools/backgrounds playtest
batch (WI-072 – WI-082) is now fully closed.
**WI-037 closed 2026-08-13** — the `RULE-AMENDMENT` that scopes RULE-006's
single-coordinate-space guarantee per grid kind, on its own branch and its own
`RULE-AMENDMENT:`-prefixed commit (RULE-017); SPEC-030's blocking warning is cleared and
WI-038 – WI-041 may begin. See `docs/completed/WI-037.md`. **WI-065 carried the same
standalone-`RULE-AMENDMENT`-commit requirement and closed 2026-08-14.**
**WI-038 closed 2026-08-13** — the first of the Hex Crawl implementation items and the
one WI-037 gated: SPEC-030 §1's axial space (`packages/shared/src/map/hex/`, exported as
the `hexMap` namespace beside `vectorMap`), `GameMap.hex` as the map's grid kind, schema
**v24** and its migration, `createMap({ gridKind })` as the only producer, and the
RULE-007 `.vttcamp` round-trip. See `docs/completed/WI-038.md`.
**WI-039 closed 2026-08-13** — the renderer WI-038 left missing, completing SPEC-030 §1:
`VectorMapEngine.renderHexGrid`, mutually exclusive with `renderGrid` because one map has
one coordinate space; the pure viewport culling in `packages/shared/src/map/hex/grid.ts`;
the `axialKey` coordinate pill on every hex; and a camera that opens on `0,0`. It also
carries the two things that made the renderer reachable and safe, both recorded as
**Deviations**: the UI producer WI-038 explicitly left unbuilt (**"+ New hex crawl"** in
`MapsPanel`), and the blunt form of §5's tool filtering — a hex map offers the **View
tools only**, through the same `toolSubset` path a battle map uses, so a square-lattice
carve gesture cannot write cell-space geometry onto an axial map (RULE-006). **WI-041
still owns §5 proper** — the overlay tools a hex map should keep, plus the hex-tile quick
sheet — and replaces that subset rather than inheriting it. See
`docs/completed/WI-039.md`.
**WI-040 closed 2026-08-14** — SPEC-030 §§2–3 as a model, a store and a renderer: the
`hexTiles` collection (one sparse document per painted hex, **keyed by its own
`axialKey`** so the coordinate is stored once and `HexTile.hex` is parsed back out of the
id), schema **v25** and its no-op migration, three store methods on the contract
(`subscribeHexTiles`/`setHexTerrain`/`setHexContents`, RULE-001), member-or-GM
`firestore.rules` with rule tests (RULE-004 — §3's "any seat" read literally), the
terrain/contents catalogs on the symbol-catalog pattern with 20 original white-authored
SVGs, and `VectorMapEngine.renderHexTiles` — **the renderer's first per-region fill**,
where a square map paints one themed colour under its whole floor. Clearing a hex's last
field deletes its document: an infinite plane is only storable sparsely. **Nothing
authors these yet** — no UI sets a terrain, because SPEC-030 §5's hex-tile quick sheet is
WI-041, which is the one remaining Hex Crawl item. See `docs/completed/WI-040.md`.
**WI-066 closed 2026-08-14** — the second half of the Blaze pair and the last item in the
ledger: SPEC-034 §§2–4 as `firebase/storage.rules` (per-object size, an image content-type
allowlist, the `rooms/{roomId}/uploads/{uid}/{objectId}` path shape and a cross-service
membership check) with 26 rule tests (RULE-004), the client-side usage readout and soft cap
in `upload-containment.ts` — **friction, labelled as such**, because an aggregate quota
needs a trusted writer RULE-010 forbids — `deleteRoom`'s object sweep (§4), and the
`[HUMAN]` runbook at `docs/runbooks/blaze-billing.md`. **Nothing changes in any build that
exists today:** uploads stay off until `VITE_ENABLE_STORAGE_UPLOADS=true`, and that flag
must not be set before the runbook's console steps. SPEC-034 is Completed. See
`docs/completed/WI-066.md`.
**WI-065 closed 2026-08-14** — the `RULE-AMENDMENT` DEC-049 (c) called for: RULE-010's
economic premise is now stated per tier, the no-Cloud-Functions clause stands unchanged,
and the Blaze consequences (per-write containment only, App Check no longer optional, a
billing budget that warns rather than caps, and the exposure beyond Storage) are recorded
in the rule itself. WI-066 is unblocked. See `docs/completed/WI-065.md`.
**WI-041 closed 2026-08-14** — the last of the Hex Crawl series and the authoring half
of WI-040: `HexTile.note` (schema **v26** and its no-op migration) with `setHexNote` on
the contract and the hover tooltip §4 asks for, plus the hex-tile body of the Map tools
sheet — Select picks a hex, the sheet paints its terrain, its contents and its note.
`HEX_TOOL_IDS` replaces WI-039's View-only subset with **Select plus the View tools**,
and is **narrower than SPEC-030 §5's own wording**: every overlay tool stores
square-lattice geometry, so admitting one would put a second coordinate space on an
axial map (RULE-006). §5 is annotated in place rather than the rule bent; giving an
overlay tool an axial-space form is a new intake item. **SPEC-030 is Completed** and the
Hex Crawl series (WI-037 – WI-041) is fully closed. See `docs/completed/WI-041.md`.

**Priority (user, 2026-08-11).** The map-tools/backgrounds playtest batch — **WI-072 –
WI-082** — runs **before** the Hex Crawl series (WI-037 – WI-041), on the same reasoning
as the 2026-08-02 and 2026-08-03 rulings: these are playtest findings against shipped
behaviour. WI-037 keeps its own cleared gate; only its position moves, again. The Blaze
pair (WI-065, WI-066) stays last, per the 2026-08-03 ruling.

Three of the twelve are Simple and mutually independent — **WI-072, WI-073 and WI-075** —
covering ledger bookkeeping, the seed defaults, and the Label/Symbol snap selector. (WI-071
landed 2026-08-11; WI-072 is the next.) The remaining nine each carried an Open decision
(DEC-060 – DEC-067, all eight answered in the same planning session) before they could
schedule.

**One hard chain: WI-080 → WI-081 — both landed.** The background transform UI had
nothing to write to until the `backgrounds` subcollection and its Firestore rules existed
— **WI-080 landed 2026-08-11** (schema v23, the subcollection, its rules and the five
store methods), and **WI-081 landed 2026-08-12** on top of them: the Assets-activity
`BackgroundsPanel`, the GM-only canvas move/resize with the native ratio locked, and the
alignment overlay. SPEC-038 is complete and every `session-background-*` testid is
retired; see `docs/completed/WI-080.md` and `docs/completed/WI-081.md`. WI-078 ran before
WI-079 (preference, not a hard chain) because the lasso's vertex index is a natural place
to hang the vertex-attraction hit-test against — **WI-078 landed 2026-08-11**, so that
index (`vertexHandles`, now carrying each floor vertex's ring position) is in place; see
`docs/completed/WI-078.md`. The preference paid off: **WI-079 landed 2026-08-11** reading
that same catalog at the same `PICK_PX` radius, so free-snap attraction and Select's
picking agree on what counts as "on" a vertex by construction rather than by a second
hit-test — and it closes SPEC-028's third reopening, taking the spec to Completed; see
`docs/completed/WI-079.md`. Everything else in the batch is independent and could run in
any order; the table above states one, for reproducibility.

**Edge-dragging was retired with WI-078** (landed 2026-08-11). `selectEdge` — the ability
to grab a wall, door, or floor-ring edge and drag both endpoints together — went away when
Select consolidated (DEC-060); moving a wall now means dragging each endpoint. Recorded
here because it is the one capability loss in this batch and does not show up anywhere
else in the ledger.
