# PLAN

Work-item ledger. Source: `docs/VTT_Master_Plan.md` Part IV (archived verbatim at
`docs/archive/VTT_Master_Plan.ORIGINAL.md`).

Every change to this repository originates from an item in this file that has cleared
its approval gate (RULE-015). The workflow that fills these tables is in `CLAUDE.md`.

**ID schemes.** `IN-nnn` intake, `WI-nnn` work items. Numbers are permanent and never
reused (RULE-019). Historical work items keep their Master Plan numbers, zero-padded:
`WI-0` → `WI-000`, `WI-25` → `WI-025`; the vector series keeps its letters,
`WI-A`–`WI-D`. New work items start at **WI-028**.

**Pattern for every WI:** send the prompt → review PR → check the gate → `[HUMAN]`
Chromebook playtest → merge green → only then start the next.

---

## 1. Intake triage

Classified, not yet scheduled. Classification is itself an approval gate: nothing
advances out of this table until the user approves the classifications.

| IN     | Raw user request                                                                                                                                                                     | Classification         | Rationale                                                                                                                                                                                                                                        | Proposed disposition                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| IN-001 | "Refactor this repository's planning and instruction documentation." (Phases 0–4: baseline, split the Master Plan into five files, write CLAUDE.md, apply decided configuration, reconcile.) | **Complex (Shape A)**  | Large refactor spanning every planning document, plus new harness configuration (hooks, slash command, settings). Not a playtest item, so Simple/Deceptive triage does not apply; it arrived already discussed and multi-phase.                     | → **WI-028**. Phases 1–3 executed; Phase 4 reconciliation gates deletion of the source document. |
| IN-002 | Carried from the WI-025 ledger: "the remaining step is watching metrics through at least one full real session and then flipping to **enforcement**."                                    | **Deceptive**          | Touches **auth** — a Deceptive trigger by name. SPEC-025 §2 states outright that enforcing early "will lock out legitimate clients". Zero code changes, but the failure mode is a total outage for every player, and there is no in-app reversal path. | → **WI-029**, `[HUMAN]`. Its multi-phase plan already exists as SPEC-025 §2's monitoring-first rollout; the gate is your explicit go-ahead after reviewing console metrics. |

### Map-tools playtest batch (2026-08-01)

A nine-item batch: four restatements of one geometry problem, an investigation, two
small fixes, and two large new map types. `IN-003` was the next unused id (RULE-019).

| IN     | Raw user request | Classification | Rationale | Proposed disposition |
| ------ | ---------------- | -------------- | --------- | -------------------- |
| IN-003 | "Ngon drop down — select between: circle, 3, 4, 5, 6, 7, 8. Direction of the drag changes the orientation… snap the flat face… Snap diameter… Default to circle. Center the ngon in the middle of the selected cell." | **Deceptive** | Touches the **carve pipeline and lattice coordinates** — a RULE-006 trigger by name. Changes what "snap" means for an existing tool, which is a reversal, not an addition. | → **WI-030**, under new **SPEC-028** |
| IN-004 | "Corridor drop down — select between: ½, 1, 2. Default to ½ when snap = half and 1 when snap = cell or free. Center the corridor in the selected cell or half cell." | **Deceptive** | Same trigger: `corridorPoly`'s band quantization is carve-pipeline geometry, and the width control is shared with two other tools. | → **WI-030** / SPEC-028 |
| IN-005 | "Room carve should snap to the cell (or half cell) when in snap mode, starting with a 1x1 carve and then grow as the user moves the mouse." | **Deceptive** | Same trigger. Also turns a currently-degenerate case (a click that never moves) into a committing one. | → **WI-030** / SPEC-028 |
| IN-006 | "Snap indicator for room and corridor tool when in cell snap should be the highlighted cell that is targeted (and half cell when in half)." | **Deceptive** | A new draw call on the Pixi `tools` layer — **the layer stack** is a named trigger. | → **WI-030** / SPEC-028 |
| IN-007 | "Evaluate other carving tools for inconsistencies." | **Investigation** | Not a change at all. It produces findings, not edits, so Simple/Deceptive does not apply. | Audited inside **WI-030**; findings logged as IN-012 – IN-014 below (DEC-027) |
| IN-008 | "When a url derived token is used, click dragging from the character sheet does not display the token on the map." | **Simple** | The change is contained to texture loading inside `VectorMapView`; it adds no store method, no schema field, no rules change, and moves no `data-testid`. | → **WI-032** |
| IN-009 | "Move token scale from map tools to character quick sheet, underneath map defaults." | **Simple** | The control, its three testids and its callback move verbatim between two components that both already hold `MapToolController` in context; nothing about the underlying `resizeToken` call changes. | → **WI-031** |
| IN-010 | "Battle Map quick sheet…" (full text in SPEC-029) | **Complex (Shape A)** | A new map type ⇒ `GameMap` schema change ⇒ migration (RULE-007), new store methods (RULE-001), toolbar filtering, a new quick sheet, a bounded camera. | → **SPEC-029**, phased **WI-033 – WI-036** |
| IN-011 | "Hex Crawl Map Type…" (full text in SPEC-030) | **Complex (Shape A)** | Replaces the square lattice with a hex one — **a second coordinate space, which RULE-006 forbids** — plus a terrain model the renderer has no concept of. Needs a rule amendment before it can start. | → **SPEC-030**, phased **WI-037 – WI-041** |

### Findings from the IN-007 carve-tool audit

Reported, not fixed (DEC-027). All three were verified against the code, and the first
two were reproduced by probing `buildFloorStroke` directly.

| IN     | Finding | Classification | Rationale | Proposed disposition |
| ------ | ------- | -------------- | --------- | -------------------- |
| IN-012 | **A single Carve dab paints nothing at widths ≤ 1 under cell snap.** The brush is handed *vertex*-snapped points, then paints every cell whose **centre** is within `radius = max(width/2, step/2)` of them. A cell centre is always `0.707` from the nearest vertex, so at radius `0.5` no cell qualifies and the stroke commits nothing. Verified: widths 0.5 and 1 → nothing; 1.5, 2 and 3 → a 2×2 block. | **Deceptive** | Carve pipeline (RULE-006). The fix is to feed the brush raw points like the other cell-anchored tools, which changes every snapped brush stroke, not just the failing case. | Own work item, after WI-032 |
| IN-013 | **A snapped Carve stroke is centred on a grid intersection, not on the cell under the pointer.** Same root cause: clicking at `(3.9, 5.1)` — well inside cell `(3,5)` — paints cells `(3,4)`, `(4,4)`, `(3,5)`, `(4,5)`, a block symmetric about the corner rather than about the cell aimed at. | **Deceptive** | Same trigger and same fix as IN-012; they should land together. | Merge into IN-012's work item |
| IN-014 | **The Symbol tool ignores the snap mode.** `anchorCellFor` (`symbol-catalog.ts:207`) hardcodes `Math.floor`, so a symbol always lands on a whole cell even under Half or Free snap — the only tool whose snap control does nothing. | **Simple** | One pure function plus its call site; no schema, no store, no rules, no testid move. But it changes stored `MapSymbol.cell` values from integers to halves, so it wants its own gate. | Own work item |

**Not findings, deliberately.** Wall, Door and Polygon keep vertex snapping: a wall runs
*between* intersections and a polygon's gesture is placing corners, so a vertex is the
right anchor for all three. The Path tool keeps its free-form ribbon — it is the organic
counterpart to the Corridor, and cell-aligning it would remove the only tool that is not
grid-true. The Label tool already floors to the clicked cell (`snapCell`), matching the
new rule.

**Note on IN-002's classification.** Triage says Deceptive items "do not get scheduled;
they stop and become a conversation with the user, then a multi-phase plan with its own
specs." That conversation and that plan already happened — SPEC-025 §2 _is_ the
multi-phase plan, and monitoring mode is phase one, already live. WI-029 is phase two.
It is listed below rather than withheld because withholding it would lose the only
record that the rollout is half-finished.

---

## 2. Upcoming work items

In execution order.

| WI         | Description                                                           | Spec        | From   | Agent   | Effort | Gate                                                           |
| ---------- | --------------------------------------------------------------------- | ----------- | ------ | ------- | ------ | -------------------------------------------------------------- |
| **WI-029** | Flip App Check from monitoring to enforcement in the Firebase console | SPEC-025 §2 | IN-002 | `human` | low    | **Gate 029** — see below. Console-only; no code change, no PR. |
| **WI-031** | Move Token scale from the map toolbar to the Character quick sheet, under Map defaults | — | IN-009 | `claude-code` | low | Four-section gate. Note the control is dead while `VectorMapView` is unmounted (`onResizeToken` is nulled in `release()`), so a sheet-hosted slider needs a direct-store fallback. |
| **WI-032** | URL-derived token renders as a blank square on the map | — | IN-008 | `claude-code` | medium | Four-section gate. Must state which half of the root cause it fixes — see the brief below. |
| **WI-033** | Battle map: `GameMap` schema + migration + `.vttcamp` round-trip | SPEC-029 §3 | IN-010 | `claude-code` | high | Four-section gate. Schema change ⇒ RULE-007 applies. |
| **WI-034** | Battle map: the capture tool (full-cell bounding box, distinct preview colour) | SPEC-029 §1 | IN-010 | `claude-code` | medium | Four-section gate. |
| **WI-035** | Battle map: bounded camera, doubled grid density, view-tools-only toolbar filter | SPEC-029 §4 | IN-010 | `claude-code` | high | Four-section gate. Needs a tool-subset prop threaded `MapToolsSheet → MapToolPalette → MapToolbar`. |
| **WI-036** | Battle map: the referee quick sheet, Start and Exit | SPEC-029 §5 | IN-010 | `claude-code` | medium | Four-section gate. |
| **WI-037** | **`RULE-AMENDMENT`** — scope RULE-006's single-coordinate-space guarantee to square-grid map types | SPEC-030 | IN-011 | `claude-code` | low | **Standalone change, its own commit, `RULE-AMENDMENT:` prefix (RULE-017).** Nothing in WI-038+ may begin until this lands. |
| **WI-038** | Hex crawl: axial coordinates, schema, migration | SPEC-030 §1 | IN-011 | `claude-code` | high | Four-section gate. Blocked on WI-037. |
| **WI-039** | Hex crawl: infinite hex grid rendering + coordinate pills | SPEC-030 §1 | IN-011 | `claude-code` | high | Four-section gate. |
| **WI-040** | Hex crawl: terrain model (background colour + SVG overlay) and contents icons | SPEC-030 §§2–3 | IN-011 | `claude-code` | high | Four-section gate. First per-region fill in the renderer. |
| **WI-041** | Hex crawl: per-hex notes, the hex-tile quick sheet, tool filtering | SPEC-030 §§4–5 | IN-011 | `claude-code` | medium | Four-section gate. |

Execution order: **WI-031 → WI-032 → IN-012/IN-013's item → IN-014's item → WI-033 – WI-036
→ WI-037 – WI-041**. WI-029 is `[HUMAN]` and independent of all of it.

### WI-032 — brief

The root cause is identified but the fix is not one-sided, which is why this is not a
one-line item.

`loadTokenTexture` (`VectorMapView.svelte`) has no `try`/`catch` and is called as `void`,
and `refsByToken.set(...)` runs **before** the load. So a rejected `PIXI.Assets.load`
leaves the sprite on `PIXI.Texture.WHITE` — a plain white square — permanently, with no
retry on any later `syncSprites` pass or reconnect. Two distinct causes reach that state:

1. **No recognised image extension.** Pixi 8's loader only claims a URL whose extension it
   knows. A saved URL like `…/img?id=123`, or any extensionless CDN or redirect URL,
   matches no parser and rejects. **Fixable** — build the texture from an `Image` with an
   explicit `crossOrigin`, or register the URL with an explicit format.
2. **No CORS headers.** Pixi fetches image *bytes* rather than assigning to `Image.src`,
   so a third-party host without `Access-Control-Allow-Origin` fails on the map even
   though the character sheet's plain `<img>` displays it fine. **Not fixable
   client-side** — a texture whose pixels cannot be read cannot be uploaded to WebGL.

So the deliverable is: fix (1), and make (2) **fail visibly** — a placeholder token and a
surfaced error — rather than silently as a white square. Do not promise a fix for (2).

Related, same code path, not in scope unless it falls out: `onCanvasDrop`'s create branch
passes `imageRef` and `ownerSeatId` but not `color`, so a dropped token has no background
disc.

### Gate 029 — App Check enforcement

Console metrics reviewed across at least one full session with real players; the
verified-request ratio is high enough that flipping to enforcement will not lock out a
legitimate client. Nothing in the codebase changes.

### WI-029 — step-by-step (`[HUMAN]`)

Written for someone unfamiliar with the Firebase console. App Check is already
registered and running in **monitoring** mode; this only changes the enforcement switch.

1. Open <https://console.firebase.google.com> and select the OSR VTT project.
2. In the left sidebar, scroll to the **Build** section and click **App Check**.
3. Click the **Apps** tab. You should see the web app listed with a reCAPTCHA v3
   provider already attached. If it is not there, stop — registration was not completed,
   and that is SPEC-025 §2's first `[HUMAN]` step, not this one.
4. Click the **APIs** tab. You will see rows for **Cloud Firestore** and **Realtime
   Database**, each showing a percentage of **verified requests** over the last period.
5. **Read those percentages before changing anything.** You are looking for verified
   requests to be at or very near 100% across a period that includes at least one full
   session with real players on their own devices. If the number is meaningfully below
   100%, some legitimate client is not sending a valid App Check token, and enforcing
   now will lock that person out of the app entirely.
   - If it is below 100%, **stop here.** Note the percentage and which API, and report
     back. Do not enforce.
6. If both APIs read ~100%: click **Cloud Firestore**, then **Enforce**, then confirm.
7. Repeat for **Realtime Database**: click it, then **Enforce**, then confirm.
8. Verify immediately: open the deployed app in a normal browser window, create a room,
   join it from a second browser (or a phone), move a token, and roll a die. All four
   must work. If anything fails with a permission error, return to the same **APIs** tab
   and click **Unenforce** on both — the switch is reversible and takes effect within
   minutes.
9. Report the outcome so WI-029 can be closed and SPEC-025 moved from **Active** to
   **Completed**.

**Do not** change the reCAPTCHA site key, add or remove app registrations, or touch any
other console section while doing this. Nothing here requires a billing card; App Check
enforcement is free on Spark (RULE-010).

---

## 3. Completed work items — current milestone (`docs-refactor`)

Each completed entry carries the four-section completion summary: **Changes made**,
**Visible behavior changes**, **How to verify**, **Deviations**.

| WI         | Description                                             | Spec        | From   | Agent         | Effort | Closed     |
| ---------- | ------------------------------------------------------- | ----------- | ------ | ------------- | ------ | ---------- |
| **WI-028** | Split the Master Plan into five documents; write CLAUDE.md; add hooks, `/work-item`, settings pre-approvals | — (process) | IN-001 | `claude-code` | high   | 2026-08-01 |
| **WI-030** | Snap-aware carve geometry: n-gon, corridor, room, and a cell snap indicator | SPEC-028 | IN-003 – IN-007 | `claude-code` | high | 2026-08-01 |

#### WI-030 — Snap-aware carve geometry

**Changes made.**

- `packages/shared/src/map/vector/snap.ts` — added `snapCellCenter`, `snapAngle` and
  `snapSpan`. `snapSpan` deliberately floors at one step where `snapScalar` may return
  zero; that floor is what makes "a click with no drag is one cell" fall out of the
  geometry instead of needing a special case per tool. Existing helpers untouched.
- `packages/shared/src/map/vector/primitives.ts` — added `cellRectPoly` (inclusive
  whole-cell rectangle, free mode falling through to `rectPoly`) and `ngonPoly`
  (across-flats sizing, face-normal rotation, layered on `regularPoly`, which is
  unchanged because it is also the circular-wall utility). Rewrote `bandLo` to centre a
  corridor band on the targeted cell quantized to `min(step, width)`; added `bandSpan` so
  a snapped corridor's length is whole cells too; `corridorPoly` now takes a
  `VectorSnapMode` instead of a boolean and decides leg existence from the **snapped
  cells** rather than raw coordinates. Exported `NGON_SIDE_OPTIONS` and
  `CORRIDOR_WIDTH_OPTIONS`.
- `apps/web/src/lib/map/vector-tools.ts` — `FloorToolOptions` gained `corridorWidth`
  (separate from the Path/Carve `width`). `buildFloorStroke` dispatches room/corridor/ngon
  onto the new builders. Added `CELL_ANCHORED_TOOLS` / `isCellAnchoredTool` and the pure
  `targetedCellFor` (extracted so the indicator is unit-testable without Pixi).
  `strokeMeasureText` takes the snap mode and reports the committed size; the n-gon now
  reads `⌀ <diameter>` rather than `radius: <r>`.
- `apps/web/src/lib/components/VectorMapView.svelte` — added `dragStartRaw`/`dragCurRaw`/
  `hoverRaw` alongside the existing snapped points, threaded raw points through
  `onPointerDown`/`Move`/`Up`, and reset them everywhere the snapped pair is reset.
  `movedFar` now measures the raw pointer. The snap dot follows the real anchor for
  cell-anchored tools. New hidden `snap-cell-readout` mirror.
- `apps/web/src/lib/map/vector-engine.ts` — `ToolPreviewInput.cursorCell`, drawn in
  `renderToolPreview` as a faint fill plus outline in the existing `snapCursorColors`
  palette, under the snap dot.
- `apps/web/src/lib/shell/map-tool-controller.svelte.ts` — `DEFAULT_CORRIDOR_WIDTH`,
  `corridorWidth` state, `setSnapMode()`; `sides` default changed `6 → 1` (circle).
- `apps/web/src/lib/components/MapToolbar.svelte` + `shell/MapToolPalette.svelte` — the
  two selects (`ngon-sides`, `corridor-width`), a `map-snap-mode` testid on the snap
  select, `onSetSnapMode` in place of a direct binding, and `showWidth` narrowed to
  Path/Carve.
- Docs: `SPEC.md` (SPEC-028 Completed, SPEC-029 and SPEC-030 Active, index updated),
  `README.md` (carve pipeline + tools), `DECISIONS.md` (DEC-021 – DEC-028), `PLAN.md`
  (IN-003 – IN-014, WI-030 – WI-041).
- Tests: `snap.test.ts` (+13), `primitives.test.ts` (+18), `vector-tools.test.ts` (+13),
  `map-tool-controller.test.ts` (+2), `map-draw-feedback.spec.ts` (+3 e2e).

**Visible behavior changes.**

- Snapped Room, Corridor and N-gon strokes land on **cells** rather than grid
  intersections. Every snapped stroke of those three tools moves by up to half a cell
  compared with before.
- Room: a click with no drag starts a 1×1 cell instead of a zero-area rect; the shape
  grows a whole cell at a time.
- Corridor: the free-form Width number input is replaced by a **½ / 1 / 2** select whose
  value resets when the snap mode changes.
- N-gon: the Sides number input (1–24) is replaced by a **Circle / 3–8** select, and the
  default is now **Circle**, not a hexagon. Sides 9–24 are no longer reachable (DEC-023).
- N-gon orientation now follows the drag direction, snapped to the cardinals (cell), the
  eight compass points (half), or left raw (free).
- Room and Corridor highlight the targeted cell on hover, before any button is pressed.
- The dimension chip reports the committed size under snap, and the n-gon reads
  `⌀ 30 feet` where it used to read `radius: 15 feet`.
- Path and Carve are unchanged; Wall, Door and Polygon still snap to grid intersections.

**How to verify.**

`pnpm lint && pnpm typecheck`, then `pnpm test:all:emulators`. By hand in `pnpm dev`, on
the Map view with the Map tools sheet open:

1. N-gon, Circle, snap Cell, drag: a circle centred in the cell you started in with a
   whole-cell diameter. Switch to 4 and drag east — a grid-aligned square. Drag north-east
   under snap Half — the flat face lands on the diagonal.
2. Corridor, snap Half: the width select shows ½ and the corridor fills exactly the
   half-cell under the pointer. Switch to Cell — the width resets to 1 and it fills exactly
   one cell.
3. Room, snap Cell: click without moving, and the chip reads `10 × 10 feet`; click again to
   commit a single cell. Drag instead, and it grows a cell at a time.
4. Hover with Room or Corridor selected under Cell or Half snap — the targeted cell is
   highlighted before any button is pressed. Under Free snap it is absent.

**Deviations.**

- **`strokeMeasureText` was changed beyond the approved plan.** The plan did not mention
  it. Left alone, the chip would have reported the raw drag distance while the tool
  committed a cell-quantized shape — a readout that disagrees with what lands. Taking the
  snap mode and reporting the committed size was required to avoid shipping that
  regression (RULE-015 exception).
- **The snap dot was moved, not just supplemented.** The plan had the cell highlight drawn
  under an unchanged dot. But for the three cell-anchored tools the dot was sitting on a
  grid corner that no longer means anything to them, so it now follows the real anchor.
  The N-gon has no cell highlight, so this is its only corrected affordance.
- **`movedFar` now measures the raw pointer** rather than the snapped one. Under cell
  anchoring the snapped comparison answers the wrong question — it reads false for a
  deliberate drag inside one cell and true for a twitch across a cell line.
- **`corridorPoly` decides leg existence from snapped cells.** Not in the plan, but
  required: once the tool hands over raw points, a corridor dragged "straight" carries a
  little cross-axis drift, and the old raw comparison read that as a turn and grew a
  spurious one-cell stub off the end.
- **A `map-snap-mode` testid was added** to the previously untestid'd snap select, so the
  e2e specs can drive it (RULE-005 is unaffected — nothing moved).
- **`publishDraft` sends raw endpoints for the cell-anchored tools.** The RTDB draft
  carries the centerline, never the resolved shape (WI-B call B4), and the snapped pair
  can now sit half a cell off the shape it is previewing — so peers were being shown a
  worse approximation than the raw pointer gives.
- **`NGON_SIDE_OPTIONS` / `CORRIDOR_WIDTH_OPTIONS` live in `primitives.ts`**, not
  `vector-tools.ts` as planned. The geometry owns what it can build, and the toolbar,
  the controller and the tests then read one list through the `vectorMap` namespace.
- The IN-007 audit found three real defects. Per DEC-027 they are logged as IN-012 – IN-014
  and **not fixed here**.

#### WI-028 — Documentation refactor

**Changes made.**

- `docs/archive/VTT_Master_Plan.ORIGINAL.md` — **new.** Byte-identical copy of the
  pre-split Master Plan (md5 `e75d27b3d3e1a7bb30bb7f1e1efcda75`). Immutable (RULE-020).
- `RULES.md` — **new.** Part I §1 (golden rules) and §2 (trust/backend) as
  `RULE-001`…`RULE-014`, plus `RULE-015`…`RULE-020` covering process (out-of-chain
  changes, one-session-one-item, amendment separation, docs-with-code, ID reuse, archive
  immutability). Carries the mandated amendment-ceremony header.
- `README.md` — **new.** Part II verbatim (11 subsystem sections, source order kept, Part
  II numbers retained in headings), plus Part I §3 repo map, §4 dev commands and the
  proxy trap, plus front-matter provenance and the companion-asset list.
- `SPEC.md` — **new.** Part III as `SPEC-001`…`SPEC-027`, each with a status of Active /
  Completed / Superseded, a status vocabulary, an index, and a permanent `R`-number
  crosswalk. Superseded specs retained in place naming their successors.
- `PLAN.md` — **new.** Intake triage (`IN-001`, `IN-002`), upcoming work items, completed
  work items, milestone archive index, and templates for `external-agent` briefs and
  completion summaries.
- `DECISIONS.md` — **new.** Parts V and VI as Open / Closed / Postponed, `DEC-001`…
  `DEC-020`. Locked defaults and the vector-map decision log preserved verbatim as
  tables (format exception, DEC-014).
- `docs/archive/PLAN-COMPLETED-{v2-core,vector-map,addendum-c,access-lifecycle}.md` —
  **new.** Four closed milestones (DEC-007).
- `CLAUDE.md` — **rewritten.** `@`-imports `RULES.md` and `DECISIONS.md`; routes to
  `README.md`/`SPEC.md`/`PLAN.md` as on-demand reads; documents the eight-step intake→gate
  →execute chain, ID schemes, and Part 0's work-item conventions.
- `docs/VTT_Master_Plan.md` — **replaced with a stub** pointing at the five files, with
  guidance for resolving old `R`/`WI`/"Part II §n" citations.
- `.claude/settings.json`, `.claude/hooks/guard-protected-paths.sh`,
  `.claude/hooks/guard-git-push.sh`, `.claude/commands/work-item.md` — **new.**
- `.prettierignore` — added `docs/archive/` (see Deviations).

**Visible behavior changes.**

- **Documentation locations moved.** `docs/VTT_Master_Plan.md` is now a stub; its content
  lives in five root files. Any bookmark, link or habit pointing at the Master Plan lands
  on the signpost.
- **New harness behaviour in Claude Code sessions.** Two `PreToolUse` hooks now deny:
  edits to `docs/archive/**`; `git commit` touching `RULES.md` without a
  `RULE-AMENDMENT:` prefix; `git push --force` in any spelling; and any `git push`
  targeting `main`. A `/work-item` slash command is available. Ten read-mostly git/`gh`
  commands no longer prompt.
- **No application behaviour changed.** No file under `apps/`, `packages/`, `firebase/`
  or `scripts/` was touched. No schema, rule, test or build change.

**How to verify.**

- `md5sum docs/archive/VTT_Master_Plan.ORIGINAL.md` → `e75d27b3d3e1a7bb30bb7f1e1efcda75`,
  matching `git show 440c01d:docs/VTT_Master_Plan.md | md5sum`.
- `ls RULES.md README.md SPEC.md PLAN.md DECISIONS.md` — all five present.
- Open `SPEC.md` and confirm the crosswalk resolves a citation you remember, e.g.
  `R24.1` → `SPEC-025 §1`.
- Test the hooks:
  `echo '{"cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"'"$PWD"'/docs/archive/x.md"}}' | .claude/hooks/guard-protected-paths.sh`
  → prints a `deny` decision;
  `echo '{"cwd":"'"$PWD"'","tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | .claude/hooks/guard-git-push.sh`
  → prints a `deny` decision.
- Run `/work-item` with a trivial request and confirm it stops at the four-section gate
  without editing anything.
- `pnpm lint && pnpm typecheck && pnpm build` — unaffected; no source file changed.

**Deviations.**

1. **The `RULES.md` write-guard could not be implemented literally.** A `PreToolUse` hook
   on `Write`/`Edit` cannot see a commit message. The guard is split: `docs/archive/**` is
   denied at write time unconditionally; `RULES.md` is denied at *commit* time without the
   prefix. Full reasoning in DEC-016.
2. **`.prettierignore` gained `docs/archive/`** — an out-of-chain change made under the
   RULE-015 exception. Without it, `pnpm format` rewrites the immutable baseline through
   Bash, bypassing the write-time hook and corrupting the reconciliation reference.
3. **Milestone boundaries were an agent judgement** within the user's delegation
   ("as it makes sense based on the shape and size"). Four boundaries drawn on the
   document's own structural seams; DEC-007.
4. **Two additions beyond the specified scope:** `RULE-015`…`RULE-020` derive from the
   workflow instructions rather than Part I; and a fifth ID scheme, `DEC-`, was added
   (DEC-019) because three files needed to cite specific decisions.
5. **Phase 4 found five fidelity defects in the Phase 1 output**, all reverted before
   this work item closed: a dropped requirement-scope statement, a softened
   `claude-opus-4-8` model pin with its `claude-sonnet-4-6` parenthetical dropped, two
   dropped words ("Claude Code", "Chromebook"), and Part VI §1 paraphrased rather than
   preserved. Post-fix: 676/676 backticked identifiers present, 60/60 sections mapped,
   22 residual altered units — all heading renames, structural splits or cross-reference
   remaps.
6. **The Phase 0 inventory was not presented for approval**, and Phase 2 began without
   explicit sign-off on Phase 1, because the user directed "complete phase 1 through 3
   and then stop." The inventory was built and used as the Phase 4 checklist regardless.

---

## 4. Milestone archive index

`PLAN.md` retains completed items for the **current** milestone only. On milestone
close, they move to `docs/archive/PLAN-COMPLETED-<milestone>.md` and leave a one-line
index entry here. See `DECISIONS.md` (archiving policy) for the rationale and for how
these four boundaries were drawn.

| Milestone            | Items                                 | Closed     | Archive                                        |
| -------------------- | ------------------------------------- | ---------- | ---------------------------------------------- |
| **v2-core**          | WI-000 – WI-012 (15 items, incl. WI-004b/005a/005b) | 2026-07-19 | `docs/archive/PLAN-COMPLETED-v2-core.md`          |
| **vector-map**       | WI-A – WI-D (4 items)                 | 2026-07-24 | `docs/archive/PLAN-COMPLETED-vector-map.md`       |
| **addendum-c**       | WI-013 – WI-024 (12 items) + 6 unnumbered follow-on passes | 2026-07-30 | `docs/archive/PLAN-COMPLETED-addendum-c.md`       |
| **access-lifecycle** | WI-025 – WI-027 (3 items)             | 2026-08-01 | `docs/archive/PLAN-COMPLETED-access-lifecycle.md` |
| **docs-refactor**    | WI-028 – (open)                       | —          | current (§3 above)                             |

---

## 5. Templates

### Upcoming entry — `external-agent`

An item assigned to `external-agent` must carry a **self-contained brief** immediately
below the table: the spec text **inline** rather than by reference, the acceptance
criteria, and the file paths in scope. Write it assuming the external agent cannot read
this repository's docs at all.

```md
### WI-nnn — <title> · brief for external agent

**Spec (inline, do not follow references):**
> <the full spec text, pasted — not "see SPEC-0nn">

**Acceptance criteria:**
1. <observable, checkable statement>
2. …

**Files in scope:**
- `path/to/file.ts` — <what may change in it>
- …

**Out of scope:** <everything else, named explicitly>
```

### Completion summary

```md
#### WI-nnn — <title>

**Changes made.** Every file touched and what changed in each.
**Visible behavior changes.** What the user can observe differently — UI, CLI output,
build behavior, file locations. State "none" explicitly if there are none.
**How to verify.** Specific steps, commands, or screens to confirm the work landed.
**Deviations.** Anything done differently from the approved plan, including unblocking
changes made under the RULE-015 exception, and why.
```
