# SPEC

Reference specs, cited by work items in `PLAN.md`. Source: `docs/VTT_Master_Plan.md`
Part III (archived verbatim at `docs/archive/VTT_Master_Plan.ORIGINAL.md`).

**Do not improvise behaviour a spec defines.** Specs that were later overtaken carry a
**superseded** annotation in place, pointing at what replaced them. Annotations are
never deleted — the history of a reversal is often the reason the current design is
right.

**When `README.md` and this file disagree about present-day behaviour, `README.md`
wins.** This file is a record of intent at the time each item was specified.

## Status vocabulary

| Status         | Meaning                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Active**     | Governs work not yet fully discharged. Something in it is still outstanding.                          |
| **Completed**  | The behaviour it specifies has shipped. Present-day behaviour is described in `README.md`.            |
| **Superseded** | Replaced. Retained permanently, marked superseded, naming its successor. Never deleted, never reused. |

A **Completed** spec may still carry a clause marked _standing constraint_ — a rule
that binds future work even though the spec itself has shipped (SPEC-003 §5's licence
discipline is the clearest case).

## Crosswalk — Master Plan `R` numbers → `SPEC` IDs

The Master Plan cited specs as `R1`–`R26`. Those citations still appear in git history,
PR titles and code comments. IDs are never reused; this table is the permanent mapping.

| Old  | New          | Old  | New          | Old  | New          |
| ---- | ------------ | ---- | ------------ | ---- | ------------ |
| R1   | **SPEC-001** | R10  | **SPEC-011** | R19  | **SPEC-020** |
| R2   | **SPEC-002** | R11  | **SPEC-012** | R20  | **SPEC-021** |
| R3   | **SPEC-003** | R12  | **SPEC-013** | R21  | **SPEC-022** |
| R4   | **SPEC-004** | R13  | **SPEC-014** | R22  | **SPEC-023** |
| R5   | **SPEC-005** | R14  | **SPEC-015** | R23  | **SPEC-024** |
| R6   | **SPEC-006** | R15  | **SPEC-016** | R24  | **SPEC-025** |
| R7   | **SPEC-007** | R16  | **SPEC-017** | R25  | **SPEC-026** |
| R8   | **SPEC-008** | R17  | **SPEC-018** | R26  | **SPEC-027** |
| R9   | **SPEC-009** | R18  | **SPEC-019** |      |              |
| R9′  | **SPEC-010** |      |              |      |              |

Sub-numbers are preserved: `R24.1` → `SPEC-025 §1`, `R13.3` → `SPEC-014 §3`, and so on.

## Index

| ID           | Title                                            | Status         |
| ------------ | ------------------------------------------------ | -------------- |
| SPEC-001     | The Activity Shell                               | **Superseded** |
| SPEC-002     | Design tokens & theming                          | Completed      |
| SPEC-003     | Dice renderer v2                                 | Completed      |
| SPEC-004     | Session configuration & player management        | Completed      |
| SPEC-005     | Log activity & chat                              | Completed      |
| SPEC-006     | Accounts, out-of-session management & maintenance| Completed      |
| SPEC-007     | Asset management & default tokens                | Completed      |
| SPEC-008     | Encounter Board v2                               | Completed      |
| SPEC-009     | Map geometry & tooling pack (cellular)           | **Superseded** |
| SPEC-010     | Vector Map System                                | Completed      |
| SPEC-011     | Wall line-type system                            | Completed      |
| SPEC-012     | Door type system                                 | Completed      |
| SPEC-013     | Dimension HUD                                    | Completed      |
| SPEC-014     | Labels v3                                        | Completed      |
| SPEC-015     | Shell collapse & token-config contextualization  | Completed      |
| SPEC-016     | Background management                            | Completed      |
| SPEC-017     | Settings navigation                              | Completed      |
| SPEC-018     | Asset removal & multi-room management            | Completed      |
| SPEC-019     | Generate-default token customization             | Completed      |
| SPEC-020     | Dice renderer v2.1                               | Completed      |
| SPEC-021     | Advantage/disadvantage by mode                   | Completed      |
| SPEC-022     | Token status ring                                | Completed      |
| SPEC-023     | Group ownership                                  | Completed      |
| SPEC-024     | Map ⇄ character sheet                            | Completed      |
| SPEC-025     | Access control & abuse containment               | Completed      |
| SPEC-026     | Room lifecycle & dead data                       | Completed      |
| SPEC-027     | Presence & seat lifecycle                        | Completed      |
| SPEC-028     | Snap-aware carve tool geometry                   | Completed      |
| SPEC-029     | Battle Map                                       | **Active**     |
| SPEC-030     | Hex Crawl map type                               | **Active**     |

---

## SPEC-001 — The Activity Shell

**Status: Superseded** (2026-07-24) — successor: `README.md` §
"Session shell — quick sheets (II.1)", which is authoritative.
**Retained clauses still in force: §4 (colour groups), §5 (layering), §6 (dialog
primitives).**

> **⚠️ Structure superseded (2026-07-24) by the Quick Sheets shell** — see
> `README.md` § "Session shell — quick sheets (II.1)", which is authoritative. The
> seven-activity, four-rail shell (§1–§4, §7, §8) is gone: the Activities rail, Tools
> rail, Log drawer and mini-cards no longer exist.
> **§5 (layering), §6 (dialog primitives) and §4's colour palette still stand.**

**§1–§3 (retired).** The room UI was a near-fullscreen stage hosting one Activity
at a time, framed by four slim edge tabs (top Session, left Activities rail with
colour-coded group boxes and mini-cards, right context-sensitive Tools rail, bottom
Chat/Log tab). Each rail tab moved `collapsed` → `mini-card` → `stage`; exactly one
mini-card open per rail; shell state persisted per room in `localStorage`. The
registry (`ActivityDef` with `id/title/icon/group/stage/miniCard/tools/availability`)
registered Map, Encounter, Dice, Characters, Assets, Log, Session. Existing panels were
re-housed, never rewritten. **WI-000 locked Option A (docked flyouts)** as the shell
choice.

**§4 Colour groups & icons (still in force).** Groups and their design-token colours:
**world** (Map, Assets) — map blue; **play** (Encounter, Dice) — rust red; **records**
(Log/Chat, Characters/Notes) — moss green; **referee** (Session) — violet, GM-only.
Icons are simplistic single-colour stroke SVGs drawn as `currentColor`.

**§5 Layering (still in force).** Z-order, top last: stage → rails/flyouts → bottom
drawer → **dice overlay** → dialogs/toasts. The dice overlay canvas is
`position:fixed`, full-viewport, `pointer-events:none`.

**§6 Dialog primitives (still in force).** A shell-owned `<Dialog>` (focus-trapped,
Esc-dismiss, token-styled). **Every `window.prompt`/`confirm` is retired.** (The
companion `<Popover>` was later deleted with the mini-card model.)

**§7 Keyboard map.** Revised by `README.md` § "Session shell — quick sheets (II.1)" —
see the current shortcut list there.

**§8 Mobile / tablet mode.** Trigger: viewport `< 900px` **or** a coarse-pointer
media query. The bottom activity bar and touch input survive; the tool bottom-sheet
became "any quick sheet, as a bottom sheet". Touch: one-finger = active tool,
two-finger drag = pan, pinch = zoom.

---

## SPEC-002 — Design tokens & theming

**Status: Completed**

Shipped as described in `README.md` § "Tokens, assets & theming (II.7)". The
deliverable was the _system_: the token sheet, `data-theme`,
`readMapTheme()`/`engine.setTheme()`, and two themes. No further theme design work is
in scope. (Whether a fuller theme _authoring_ engine — editing/creating custom token
sets — is wanted remains open; see `DECISIONS.md` → Open.)

---

## SPEC-003 — Dice renderer v2

**Status: Completed** — with §5 as a permanent standing constraint.

Shipped as described in `README.md` § "Dice (II.6)". §1 (no-flip settle), §2 (real
polyhedra), §3 (presentation quality), §4 (overlay lifecycle), §6 (shared rolls) are
all live.

**§5 Prior art — license discipline (BINDING, permanently · standing constraint).**
`owlbear-rodeo/dice` (GPL-3.0) was examined as reference _during planning only_. Its
techniques informed §1 (threshold settle, locator-based face detection, rest locking,
world-per-roll, throw-toward-center feel), all restated in our own terms. Its
architecture also validates our divergence: Owlbear is physics-authoritative (remote
clients render **static** dice); our seed-authoritative invariant requires every client
to animate, which is exactly what pre-rotation provides.

- Claude Code must **not** clone, fetch, open, or otherwise place the Owlbear repo (or
  any GPL-3.0 code) in its context. This spec section is the sole channel for its
  ideas.
- **No assets** (GLB meshes, textures, materials, audio) from that repo may be copied
  or traced — geometry and number textures are generated procedurally. See
  `ATTRIBUTION.md`.

---

## SPEC-004 — Session configuration & player management

**Status: Completed**

Shipped; see `README.md` § "Log, session config & accounts (II.8)". Note the
grid-shrink guard described here was **removed** — a vector floor has no cell-grid
ceiling to shrink against (`DECISIONS.md` → vector map decision log, D3).

---

## SPEC-005 — Log activity & chat

**Status: Completed**

Shipped; see `README.md` § "Log, session config & accounts (II.8)".

---

## SPEC-006 — Accounts, out-of-session management & maintenance

**Status: Completed**

Shipped; see `README.md` § "Log, session config & accounts (II.8)". **§4's maintenance
table is the standing answer** to "do we need a DB-admin UI?" — mostly no. SPEC-025 to
SPEC-027 extend it with access control, room lifecycle and presence.

---

## SPEC-007 — Asset management & default tokens

**Status: Completed**

Shipped; see `README.md` § "Tokens, assets & theming (II.7)". The `gen:` scheme's
determinism contract (the ref fully describes the SVG) is binding.

---

## SPEC-008 — Encounter Board v2

**Status: Completed**

Shipped; see `README.md` § "Encounter board (II.3)". §3's "GM controls move to the
right tools rail" is superseded — the rail is gone and every referee control now sits
on the thing it acts on (group card, Roll sheet, `tables` quick sheet).

---

## SPEC-009 — Map geometry & tooling pack (cellular)

**Status: Superseded** (2026-07-20) — successor: **SPEC-010** (Vector Map System).

> **⚠️ Superseded (2026-07-20) by the Vector Map System (SPEC-010).** This spec was
> designed against the cellular model and was overtaken wholesale rather than extended.
> §1's premise (preserve the cellular model), §2 (vector walls as an extension of
> edge-walls) and §4 (rasterize-to-cells "natural" rendering) are moot. §5 (Labels
> v2) was superseded again by SPEC-014.

**§3 Measurement units, §6 half-size grid, §7 token snapping, §8 PNG export**
describe behaviour that **survived** the cutover largely as specified, re-implemented
against `GameMap`/the vector engine:

- **§3** — `room.settings.measure = { perSquare: 10, unit: 'feet' }`, defaults 10/feet
  (a deliberate change from the previous implicit 5 ft, applied to existing rooms by
  migration).
- **§6** — `room.settings.grid.subdivide: boolean`; rendering only, half-spacing lines
  at reduced alpha/weight (10′/5′ dual-mark style). No model change.
- **§7** — tokens snap to full-cell centers on drop. **Alt** ⇒ half-grid
  intersections; **Alt+Shift** ⇒ free placement. Snap honours token size (2×2 snaps to
  cell corners so it covers whole cells).
- **§8** — "Download map as PNG" for all users, via Pixi v8
  `renderer.extract.image(world)` over the carved bbox + margin, downloaded via
  object-URL. The GM-only "include hidden layer" checkbox was replaced by an
  **"up to layer" selector available to every seat** (`map/export-layers.ts`).

---

## SPEC-010 — Vector Map System

**Status: Completed** — non-goals below are a standing constraint.

*(Cited in the Master Plan as `R9′`.)*

**The authoritative map spec.** Its full content is `README.md` § "Map system — vector
(II.2)" (data model, walls/doors/LoS, six-layer stack, carve pipeline, tools, fog,
schema versioning), which is written descriptively because the system shipped. The
decision log behind it is `DECISIONS.md` → vector map decision log.

Explicit non-goals, still binding:

- No change to dice, encounter, session, account or logging systems from map work.
- No per-frame point-in-polygon in any hot path.
- No dual-live bitmask+polygon representation — the bitmask model is gone.
- No custom polygon clipping/offsetting math — use a vetted library.

---

## SPEC-011 — Wall line-type system

**Status: Completed**

`WallStyle` is the union `'solid' | 'masonry' | 'natural' | 'dashed'`; a wall carries
its **own** optional `style`, falling back to the hosting room's default when absent.
Effective style resolves as `wall.style ?? hostingRoom?.wallStyle ?? 'masonry'`, then
dispatches: `solid` → single stroke; `masonry` → solid + masonry treatment; `dashed` →
`strokeDashed(…, 5, 3)`; `natural` → `naturalizePolyline` + `drawSmoothCurve`, so a
single natural wall reads irregular even in a masonry room. The chaining seed is
`hashSeed(roomId + runKey)` for cross-client determinism. Displacement is clamped to
≤0.25 cell so the art never visibly disagrees with the true geometry LoS uses.

**Angled/diagonal walls default to `solid`**, not dashed. Dashed is produced only when
the effective style is explicitly `dashed`. The Wall tool's style select is a 4-way.

> **⚠️ Circular walls (§5) superseded.** The dedicated `CircleWall` doc — with its
> `gaps: Arc[]`, reserved `doors: ArcDoor[]`, and circle→N-gon LoS sampling that skipped
> gap arcs — **is not a storage type in the vector system** (successor: **SPEC-010**). A
> circular room is a `FloorRegion` with a circular ring; a standalone circular blocker
> is an `explicit` closed segment loop from the regular-polygon primitive. The
> ring→segment sampling helper survives as a draw-time utility. "A circular room must
> never be dead-sealed" is satisfied natively: an opening is just floor geometry.

---

## SPEC-012 — Door type system

**Status: Completed**

```ts
DoorType = 'none' | 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred';
```

`secret` is a **type**, not a flag. `facing` is meaningful only for `oneWay`.
`type: 'none'` is the removal sentinel. The Door tool does not cycle a fixed sequence:
clicking opens a type picker (or uses the palette's selected type) and sets it centered
on the nearest segment. State (open/closed) is a separate toggle.

**Rendering:** draw the wall stroke as normal, then stamp a **centered** type glyph at
the segment midpoint — single = door leaf; double = two leaves; secret = "S"; trapped =
hazard mark; one-way = arrow along `facing`; barred = double bar. Icons come from theme
tokens; no external art.

**LoS:** `open` passes; `closed`, `secret`, `barred`, `trapped(closed)` block. `oneWay`
blocks like a normal door for sight — per-side blocking is out of scope; the arrow is a
GM annotation.

> **Amended:** in the vector system doors are free-endpoint overlay objects with their
> own geometry, reconciled against walls at build time (`README.md` § "Map system —
> vector (II.2)"), not flags on a grid edge. Every door renders identically to every
> viewer — no `isGM`-gated branch (`DECISIONS.md` → vector map decision log, D5). The
> type/state/facing model above is unchanged.

---

## SPEC-013 — Dimension HUD

**Status: Completed**

While dragging a shape, show a centered readout of the size that updates live and
disappears on commit — no persistence, no draft doc, purely local like the ruler label.
Shipped as `strokeMeasureText` → `ToolPreviewInput.measure`, in the map's `RoomMeasure`
units (`w × h`, or `radius:` for the N-gon), reused by the Measure tool via
`measureSpanText`.

---

## SPEC-014 — Labels v3

**Status: Completed**

- **§1 Inline edit.** Double-clicking a placed label opens an inline text editor
  positioned over it (an absolutely-positioned input in the map overlay, **not** a
  modal). Commit on blur or Enter; Escape cancels. Writes a `mapRoom` replace op
  (undoable).
- **§2 Delete.** The inline editor (and a context affordance) exposes Delete →
  `mapRoom` delete op (undoable).
- **§3 Renumber.** The room manager offers drag-to-reorder and direct `key` edit;
  keys must stay unique (`nextMapRoomKey` / a validator). Reordering rewrites affected
  keys in one batch op. Shipped in the Room quick sheet (`README.md` § "Session shell —
  quick sheets (II.1)").

---

## SPEC-015 — Shell collapse & token-config contextualization

**Status: Completed**

- **§1** A collapsed rail must shrink its grid track to a thin spine so the stage
  grows. (Satisfied structurally by the Quick Sheets shell, whose docked sheets sit in
  a pointer-transparent margin and whose rail is a fixed 56px.)
- **§2** Snap is a **global drop default** → always visible under a clearly-labeled
  group. Scale is **per-selected-token** → gated behind a selection, showing nothing (or
  a muted "Select a token to resize" hint) when none. (Snap defaults now live on the
  character quick sheet.)
- **§3** `select` holds exactly one token: a new single click clears the prior
  selection. No marquee/multi-select.

---

## SPEC-016 — Background management

**Status: Completed**

The background is a managed room/map property, not a hard-coded sprite:
`GameMap.background` is either an image ref or a solid `#rrggbb` colour, rendered by
the `background` layer. GM controls (Assets view + Session settings) offer **Change
background** (picking from Bundled / Saved URL via the asset picker) and **Remove
background**. There is no selection-on-canvas of the background sprite — management
lives in the GM UI, which avoids accidental drags.

---

## SPEC-017 — Settings navigation

**Status: Completed** — standing constraint, easy to regress.

**Binding, and easy to regress.** Section-nav jump-links must be **buttons calling
`el.scrollIntoView({behavior:'smooth'})`**, never raw `<a href="#id">` anchors. The app
uses hash routing (`routes.ts`); `parseHash` matches only `^/r/([^/]+)` and returns
`{name:'lobby'}` for anything else, so a raw anchor sets `location.hash`, fires
`hashchange`, fails the match, and navigates the whole app to the Lobby. With this
fixed, `session-theme-select` (wired to `room.settings.theme` and `applyTheme`) is
reachable and applies live to every client.

---

## SPEC-018 — Asset removal & multi-room management

**Status: Completed**

- **§1 Removal — resolved, no work needed.** The saved-asset ✕ per tile (with a
  confirm) is sufficient. Bundled starter assets stay non-removable by design.
- **§2 Multi-room manager.** A **Rooms** panel listing every `MapRoom` (key, name,
  cell-count) with rename, renumber/reorder (feeding SPEC-014 §3), jump-to (center the
  viewport) and delete, reading the existing `mapRooms` subscription and writing
  undoable `mapRoom` ops. Shipped as the Room quick sheet, which also gained per-room
  players' notes (`README.md` § "Session shell — quick sheets (II.1)").

---

## SPEC-019 — Generate-default token customization

**Status: Completed**

Shipped; see `README.md` § "Tokens, assets & theming (II.7)".

---

## SPEC-020 — Dice renderer v2.1

**Status: Completed**

Shipped; see `README.md` § "Dice (II.6)". The visual target is
`docs/mockups/dice-reference.png`, tuned through `docs/mockups/dice-preview.html` —
**SPEC-003 §5-safe**: it tunes material/colour/numeral proportions by eye and is
**never traced into geometry**; the polyhedra stay procedural.

Live parameters: no tray mesh (§1); glossy plastic, roughness ~0.30, metalness
~0.10, `flatShading: true`, soft key-light specular, no harsh rim (§2); `SCALE`
reduced ~10% (§4); single-digit face font ~0.50 of the face, two-digit ~0.38, 6/9
underlined, UV U-axis derived from a face **edge** (`pts[0]→pts[1]`) rather than a
corner so numerals sit square to their faces (§5); d4 corner glyphs re-anchored
inboard so all three sit within the visible triangle and read upright, value read at
the up-apex (§6).

> **⚠️ §1's shadow clause superseded (2026-07-27).** The "whisper of grounding" held
> in reserve was taken up — a soft contact shadow now casts from the key light onto an
> invisible `ShadowMaterial` plane at the physics floor. Successor: `README.md` §
> "Dice (II.6)". The **tray removal still stands**; there is no tray mesh, only the
> shadow.

> **⚠️ §3 (per-die-kind colours) superseded (2026-07-27) — the veto in its own last
> sentence was exercised.** Successor: `README.md` § "Dice (II.6)". The
> `DICE_KIND_COLOR` palette (d4 crimson, d6 green, d8 blue, d10 gold, d12 orange, d20
> purple), the `--dice-d4`…`--dice-d20` theme override hook and the seat-id hash
> fallback were all deleted. Die colour has exactly one source: the roller's character
> colour, baked into the face texture.

> **⚠️ §5 amended (2026-07-30) — the d10 is exempt from the edge rule and reshaped.**
> See `README.md` § "Dice (II.6)" for the shipped geometry.

---

## SPEC-021 — Advantage/disadvantage by mode

**Status: Completed**

Shipped; see `README.md` § "Dice (II.6)". Seed-authoritative determinism is preserved:
the RNG stream is consumed in a documented, stable order for the pool case so
re-derivation matches across clients.

---

## SPEC-022 — Token status ring

**Status: Completed**

Shipped; see `README.md` § "Tokens, assets & theming (II.7)".

> **Superseded in part (SPEC-023).** "Owned by the viewing player" still means
> `token.ownerSeatId === myUid` — the ring is unchanged — but `ownerSeatId` no longer
> means authority. The ring marks "my own character's token", not "a token I may move".
> **§3 (optional split):** because _selected_ and _owned_ both map to white, a player
> selecting their own token sees no change. The cheapest split, if ever wanted, is
> owned = solid white ring, selected = solid white **+ a subtle glow/thicker stroke**.
> Not built.

---

## SPEC-023 — Group ownership

**Status: Completed**

Shipped; the model is `README.md` § "Group ownership (II.4)". It **supersedes the
token-ownership reading** that SPEC-007/SPEC-008 and SPEC-022 §2 assumed: the GM-only
Actor Ownership panel that set `Token.ownerSeatId` is retired, and `CharacterDock`'s
"My token" is now its only writer.

---

## SPEC-024 — Map ⇄ character sheet

**Status: Completed**

Shipped; see `README.md` § "Map ⇄ character sheet (II.5)".

---

> **Numbering note.** The source addendum for the three specs below proposed them as
> R22–R24. Those numbers were already taken (R22 group ownership → SPEC-023, R23 map ⇄
> sheet → SPEC-024), so they were **renumbered R24–R26** in the Master Plan, and are
> **SPEC-025–SPEC-027** here. The work-item numbers WI-025–WI-027 are unchanged.

---

## SPEC-025 — Access control & abuse containment

**Status: Completed** — §2's console flip from monitoring to enforcement landed via
`PLAN.md` → WI-029 (2026-08-02). §5's quota headroom monitoring remains a standing
`[HUMAN]` console practice, not a discrete outstanding item.

**Motivation:** widening the release from private testing to a friends-and-acquaintances
group. Three exposures, in priority order: unbounded room creation by anonymous uids; no
signal distinguishing a live room from an abandoned one; no presence model at all.

**Threat model (stated explicitly, because it bounds every decision here):** the
population is friends and acquaintances, not attackers. The realistic failure is
_accidental_ quota exhaustion and accumulated dead data, not a determined adversary. On
Spark, quota exhaustion denies requests rather than generating a bill — **the downside
is an outage for the group, not a charge.** Tune for availability and containment, not
cryptographic guarantees.

### SPEC-025 §1 — GM creation gate (non-anonymous provider)

Room creation currently succeeds for a freshly-minted anonymous uid, so any browser that
loads the app can create unlimited rooms, at no cost and with no attribution. Require a
non-anonymous sign-in provider **on the room-create rule only**:

```
match /rooms/{roomId} {
  allow create: if signedIn()
    && request.auth.token.firebase.sign_in_provider != 'anonymous'
    && request.resource.data.gmUid == request.auth.uid;
  // read / update / delete unchanged
}
```

This converts "any browser" into "any Google account", which is what makes every
downstream containment measure meaningful — an abusive creator becomes identifiable and
blockable in the console.

**It does not touch the join path.** SPEC-006 §1 already builds the full
`linkWithGoogle` / `signInWithGoogle` / `signOutToAnonymous` flow; this only requires a
would-be _GM_ to use it. The zero-prompt anonymous join invariant (RULE-011) stays
green.

**Lobby UX consequence:** the Create Room form must handle the anonymous case. An
anonymous visitor sees the Create control with an inline "Sign in with Google to create
a room" affordance rather than a failed write. Joining via link, and My Rooms for an
already-linked account, are unaffected. This is the one place in the app where sign-in
is load-bearing rather than optional, and **the copy should say why** (rooms are yours,
they follow your account across devices) rather than presenting it as a gate.

**Migration note:** any existing room whose `gmUid` is an unlinked anonymous uid keeps
working — the gate is on `create`, not on `update`/`delete`. Those GMs should be nudged
to link via the existing SPEC-006 §1 affordance, but nothing breaks if they don't.

### SPEC-025 §2 — App Check enforcement

The highest-leverage anti-abuse lever available without Cloud Functions. App Check
(reCAPTCHA v3 provider) attests that requests originate from your actual app, and
enforcement on Firestore and RTDB is **free — it does not require Blaze.**

- **[HUMAN]** register the app in the Firebase console under App Check, obtain the
  reCAPTCHA v3 site key, add the Pages/Hosting hostnames.
- **[HUMAN]** run in _monitoring_ mode first and watch the metrics for at least one full
  session with real players before switching to enforcement — enforcing early will lock
  out legitimate clients that haven't shipped the SDK yet.
- **[AGENT]** initialize App Check in `apps/web/src/lib/firebase/client.ts` (the sole
  concrete-store touchpoint, per RULE-001) with a debug token path for local
  development and the emulator suite.
- Emulator and e2e runs must continue to work — the debug provider is set when
  `import.meta.env.DEV` or the emulator host is configured.

§1 handles attribution; §2 handles volume, blocking the scripted-client vector
that could actually exhaust quota.

### SPEC-025 §3 — Soft room cap (client-side, deliberately not rules-enforced)

**A rules-enforced per-user cap is not achievable here, and this plan does not pretend
otherwise.** Any counter document the user can write, the user can forge; any counter
they cannot write cannot be maintained without a trusted writer. A real cap means App
Check plus a Cloud Function, which crosses the no-functions/no-card line (RULE-010).

Given the threat model, the correct response is a **soft cap in the Lobby**: once a
user's My Rooms index holds `MAX_ROOMS_SOFT` (default **12**) entries with
`role: 'gm'`, the Create form disables with "You have 12 rooms. Delete or export one to
make space." It is honest friction for honest users, which is the entire population.

Document the limitation in the code comment so a future reader doesn't mistake it for a
security boundary — the same way the `password` field is documented as unenforced and
group ownership is documented as client-side-only.

### SPEC-025 §4 — Room id entropy audit

The trust model is "the roomId is the capability" (RULE-012) — room reads are
`signedIn()`, not membership-gated — and that cannot change until the pre-join subscribe
problem is solved (documented at length in `firestore.rules` and
`firestore.rules.test.ts`: a listener denied at subscribe time never recovers, which
previously left clients with empty groups, permanently revealing hidden tokens). Room id
entropy is therefore **the only barrier against a stranger reading an arbitrary room.**
Audit what `createRoom` generates.

- **Required:** ≥ 128 bits of CSPRNG-derived entropy (`crypto.getRandomValues`),
  rendered in a URL-safe alphabet. Firestore auto-ids qualify (20 chars, 62-symbol
  alphabet ≈ 119 bits) and are acceptable.
- **Unacceptable:** anything sequential, timestamp-derived, `Math.random()`-derived, or
  short enough to enumerate.

If the current generator falls short, replacing it is in scope for WI-025; existing rooms
keep their ids (no migration — old ids stay valid, new ones are stronger).

### SPEC-025 §5 — Quota headroom monitoring

- **[HUMAN]** in the Firebase console, confirm the Spark daily quotas and note the
  current steady-state consumption per active session. Target remains "comfortably
  inside 20k Firestore writes/day".
- **[HUMAN]** set a calendar reminder to check usage after the first wide session. The
  console _is_ the admin UI (SPEC-006 §4); no custom panel.

---

## SPEC-026 — Room lifecycle & dead data

**Status: Completed**

### SPEC-026 §1 — `lastActivityAt` on the room doc

**The missing input to every automatic cleanup decision.** Today nothing can distinguish
a live room from an abandoned one. `users/{uid}/rooms/{roomId}.lastSeenAt` exists but is
per-user, self-owned, rules-denied to every other user, and explicitly best-effort —
nothing can scan it.

Add `lastActivityAt: number` to the room doc (`schemaVersion` bump + migration +
round-trip test, per RULE-007).

**Write policy — this must not undermine write discipline:**

- Written only on **settled** writes (the same moments that already produce a Firestore
  write: drag-end, stroke release, roll resolution, profile save, token add/remove).
- **Throttled client-side to at most once per 5 minutes per client**
  (`ROOM_ACTIVITY_THROTTLE_MS`). An in-memory timestamp guard in `FirebaseStore`, not a
  stored one.
- Never written from RTDB paths, never from cursor movement, never on a timer
  independent of real activity.

Net cost is at most 12 additional writes per client-hour, and in practice far fewer.

**Migration:** pre-migration rooms get `lastActivityAt` seeded to the **migration
timestamp**, not to zero — otherwise every existing room appears instantly abandoned and
the reaper offers to delete a live campaign.

### SPEC-026 §2 — Stale-room surfacing + GM-run reaper

With §1 in place, add to the Lobby's My Rooms section: entries where `role === 'gm'`
and `lastActivityAt` is older than `STALE_ROOM_DAYS` (default **90**) render with a
"dormant" affordance offering **Export**, **Delete**, or **Keep** (dismiss for another
90 days, stored in the user's own index entry).

This is a _surface_, not an automatic deletion. **Nothing deletes a room without the GM
pressing the button.** It reuses the existing, well-tested `deleteRoom` recursive delete
(SPEC-006 §3) and the existing export path — no new destructive code.

Rooms where the user is a player, not GM, are out of scope: they aren't the user's to
delete, and a dangling entry already renders as a "room gone — remove?" row
(SPEC-006 §2).

### SPEC-026 §3 — RTDB leak closure

Two concrete leaks in the ephemeral layer, both the exact class `onDisconnect` exists
for:

1. **Pings** self-expire via `setTimeout(() => remove(pingRef), PING_TTL_MS)`. If the tab
   closes inside that 3-second window the timer dies with it and the node leaks
   permanently. **Fix:** arm `onDisconnect(pingRef).remove()` at push time, alongside the
   existing timeout. The timeout stays as the normal path; `onDisconnect` is the crash
   path.
2. **Drag frames** are cleared by an explicit `clearDrag`, with no fallback. A client
   that crashes or closes mid-drag leaves the node behind. **Fix:** arm
   `onDisconnect(dragRef).remove()` in `publishDrag`, guarded per room+token with the
   same `Set`-based one-time pattern `publishCursor` already uses for cursors — the hot
   per-frame path must arm it only once.

### SPEC-026 §4 — Firestore TTL on `rolls` — verification · **✅ VERIFIED (2026-08-01): no policy, and none wanted**

> **Outcome.** The console was checked: **no TTL policy exists on `rolls`**, and the
> decision is to leave it that way (outcome 1 below). The SPEC-006 §4 prune button
> (`pruneEntriesBefore`, Session → Maintenance) stays the only expiry mechanism —
> referee-driven, visible, and already tested. §4 is closed; nothing further to
> configure and no code to write.
>
> Anyone reopening this must read the finding below first: pointing a policy at `Roll.ts`
> would be accepted by the console and then silently delete nothing.

SPEC-006 §4 lists a TTL policy on a `ts`-derived field as optional belt-and-braces,
console-only setup. **[HUMAN]** verify in the console whether this was ever actually
configured. If not, configure it now (behind the SPEC-006 §4 prune button, which remains
the primary mechanism).

> **Finding (WI-027).** As shipped, **a TTL policy cannot be pointed at `Roll.ts`**:
> Firestore TTL requires the named field to be of type **Timestamp**, and `Roll.ts` is a
> plain `number` (epoch ms) — the same representation every other `ts` in the schema uses,
> chosen so the dice engine's determinism and the log pager's `where('ts', '<', …)`
> comparisons work on ordinary numbers. A policy naming a non-Timestamp field is accepted
> by the console and then silently deletes nothing, which is worse than no policy at all.
>
> So §4's verification has three possible outcomes, and the choice is a `[HUMAN]` one:
>
> 1. **No policy exists → leave it that way.** The SPEC-006 §4 prune button
>    (`pruneEntriesBefore`, Session → Maintenance) already deletes log and roll docs older
>    than a chosen date, is referee-driven, and is the documented primary mechanism. TTL
>    was only ever belt-and-braces.
> 2. **No policy exists → make TTL possible.** That is a code change, not a console one: add
>    a companion `expiresAt: Timestamp` written alongside `ts` in `writeRoll`, point the
>    policy at it, and accept that existing roll docs (which have no such field) are never
>    swept and remain the prune button's job.
> 3. **A policy already exists naming `ts`.** Then it has been deleting nothing since the day
>    it was created and should be removed, to avoid the standing false belief that rolls
>    expire on their own.

---

## SPEC-027 — Presence & seat lifecycle

**Status: Completed**

### SPEC-027 §1 — RTDB presence channel

There is currently **no presence model.** `players/{uid}` is a durable Firestore doc with
no liveness field, removed only by explicit GM action. The only liveness signal in the
system is the cursor node, and it is unusable as presence: cursors publish on pointer
movement over the map, so a player reading their character sheet for ten minutes is
indistinguishable from one who closed the tab.

Add a proper channel at `rooms/{roomId}/presence/{uid} = { uid, name, ts }`.

- **RTDB, not Firestore** — high-frequency ephemeral state, exactly what RULE-003
  assigns to RTDB. It costs nothing meaningful.
- **Heartbeat every 45 s** (`PRESENCE_HEARTBEAT_MS`), refreshing `ts`.
- **`onDisconnect(presenceRef).remove()` armed once per room+uid**, using the same
  guarded one-time pattern as `publishCursor`.
- Armed on join and on room re-entry; torn down on `RoomShell` unmount.

**Rules** (`database.rules`) mirror the cursor guards exactly:

- `rooms/$roomId/presence/$uid` — write only where `$uid === auth.uid`; the own-uid-only
  guard is the whole point and must have a test asserting a client cannot write someone
  else's presence.
- **An explicit `.read` at the parent `presence` collection node.** This is the
  documented trap: `onValue()` listens at the parent, RTDB rules cascade _down_ and not
  up, so a `.read` declared only on the `$uid` wildcard leaves `subscribePresence`
  silently never firing. `database.rules.test.ts` already has a "parent-collection reads"
  describe block — add `presence` to it.
- The existing `$roomId` delete-only allowance (`.write: !newData.exists()`) must
  continue to cover the presence subtree so `deleteRoom` still removes the whole node.
  The Gate 10 e2e assertion that the RTDB node is gone after deletion must stay green.

**Store interface** (contract tests on both `MemoryStore` and `FirebaseStore`, per
RULE-001):

```ts
/** Live presence for a room (SPEC-027 §1). Own-uid-only writes, RTDB-backed,
 *  self-cleaning via onDisconnect. Heartbeat is managed internally. */
publishPresence(roomId: string, name: string): void;
clearPresence(roomId: string): void;
subscribePresence(roomId: string, cb: (present: PresenceEntry[]) => void): Unsubscribe;
```

### SPEC-027 §2 — Two distinct states: disconnected vs. abandoned

The critical distinction — conflating these leads either to seats vanishing mid-session
or to seats never being cleaned up at all.

| State            | Signal                                                                         | Effect                                                                                             | Reversible                   |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Present**      | presence node exists, `ts` within 2× heartbeat                                 | normal                                                                                             | —                            |
| **Disconnected** | presence node absent (or `ts` stale)                                           | row dimmed in `PlayersPanel`; token rendered at reduced opacity on the map; **seat doc untouched** | yes, instantly, on reconnect |
| **Abandoned**    | seat exists and has had no presence for `ABANDONED_SEAT_DAYS` (default **30**) | listed in Session → Maintenance for GM review                                                      | via GM action only           |

Disconnection is a _display_ state and carries **no data consequence whatsoever**. A
player who closes their laptop for a week and comes back finds their seat, their
character, and their tokens exactly as they left them.

**Tracking "abandoned" requires a durable field**, since presence itself is ephemeral by
construction: add `lastPresentAt: number` to the `PlayerSeat` doc, written on the _first_
presence publish of a session and then at most once per hour thereafter (same throttle
discipline as SPEC-026 §1). Seeded on join. Pre-migration seats get the migration
timestamp, not zero.

> **⚠️ Amended in implementation (WI-026).** `lastPresentAt` is **not** backfilled,
> contrary to the sentence above. It cannot be: `migrateRoom` only ever sees the room
> doc, and this is a field on `players/{uid}`. The _intent_ (existing seats must not read
> as abandoned) is met more robustly by absence itself. Successor: `README.md` §
> "Presence & seat lifecycle (II.10)".

### SPEC-027 §3 — Prune inactive seats (GM)

New block in Session → Maintenance, alongside the existing prune and delete-room
controls: lists seats whose `lastPresentAt` exceeds `ABANDONED_SEAT_DAYS`, with per-seat
checkboxes and a confirm step. Reuses the existing seat-removal path, including its "also
delete character sheet" option — a player who has been gone a month may still have a
character the GM wants to keep.

**Never automatic. Always GM-confirmed. Never touches a seat with live presence.**

---

## SPEC-028 — Snap-aware carve tool geometry

**Status: Completed** — the cell-anchoring rule below is a standing constraint on any
new floor tool.

*(New with WI-030; no `R`-number predecessor.)*

### §1 — The problem: vertices are not cells

Every floor tool routed its pointer through `snapPoint`, which rounds to the nearest
lattice **vertex** — a grid intersection. A referee laying out a dungeon thinks in
**cells**. The two disagree by half a cell in each axis, and the disagreement is not
cosmetic:

- A snapped n-gon centres on a grid corner, so a "3-cell circle" straddles four cells
  evenly instead of sitting in one.
- A snapped corridor's band is quantized against the centerline's vertex, so it hugs a
  grid line rather than filling the cell the pointer was in.
- A Room click that never moves produces a zero-area rectangle, which `rectPoly` rejects
  — the tool does nothing at all.

Vertex snapping remains correct for **Wall** and **Door**, whose geometry genuinely runs
*between* intersections, and for **Polygon**, where the gesture is placing corners.

### §2 — Cell anchoring (standing constraint)

Room, Corridor, N-gon and Carve are **cell-anchored**. They receive raw lattice points
and do their own snapping, because "which cell is the pointer in" is not recoverable from
a point that has already been rounded to the nearest vertex.

> **WI-042 correction.** Carve was omitted from this list at WI-030 and kept taking
> vertex-snapped points: under cell/half snap, a cell's centre sits `0.707 × step` from
> every vertex regardless of where inside the cell the pointer actually was, so a brush
> width ≤ 1 (radius = `step / 2`) never reached any cell's centre and a dab committed
> nothing (IN-012), and a wider brush painted a block centred on the nearest corner
> instead of the cell aimed at (IN-013). WI-042 added Carve here and anchors each raw
> sample to `snapCellCenter` before the brush's radius test, matching Room/Corridor/N-gon.

Three shared helpers express the rule (`packages/shared/src/map/vector/snap.ts`):

| Helper | Meaning |
| --- | --- |
| `snapCellCenter(p, mode)` | The centre of the cell (half-cell) containing `p`. The anchor. |
| `snapAngle(theta, mode)` | A direction at the mode's compass resolution: 4 points at cell snap, 8 at half, raw when free. |
| `snapSpan(v, mode)` | A measurement across a shape, quantized and **never below one step** — a zero span is not a shape. |

`snapSpan`'s floor is what makes "a click with no drag is one cell" fall out of the
geometry rather than needing a special case in each tool.

### §3 — Room

The whole-cell rectangle spanning the cells the two drag points are in, **both ends
inclusive** (`cellRectPoly`). A click with no drag is exactly 1×1; the rect grows a whole
cell at a time from there. Free snap keeps corner-to-corner `rectPoly`, where a partial
cell is the point.

### §4 — Corridor

Fixed widths: **½, 1, 2** cells. The default follows the snap mode — ½ under half snap,
1 under cell and free — because half snap *is* half-cell work.

Snapped, each leg's band is centred on the pointed-at cell and then quantized to
`min(step, width)`: a quantum never coarser than the band itself, so a ½-wide corridor
can still sit on a half-cell line under full snap. Width 1 under cell snap fills exactly
the pointed-at cell; width ½ under half snap fills exactly the pointed-at half-cell;
width 2 straddles the pointed-at cell evenly. Leg *length* follows the same inclusive
whole-cell rule as a Room, so the flat caps land on grid lines.

Which legs exist is decided from the **snapped cells**, not the raw endpoints — a
corridor dragged straight along a row carries a few hundredths of cross-axis drift, and
comparing raw coordinates would read that as a turn and grow a one-cell stub off the end.

### §5 — N-gon

Sides: **circle, 3, 4, 5, 6, 7, 8**, defaulting to **circle**. Above 8 a polygon reads as
a circle anyway.

The drag vector carries three things at once:

- **Centre** — the cell centre the drag started in.
- **Size** — its length is the radius **across the flats**; the diameter (`2 × length`)
  snaps to whole cells. Across-flats, not across-vertices: it is what makes a snapped
  polygon sit flush inside a whole number of cells. The circumscribed measure would leave
  a square's edges off the grid by a factor of `cos(π/n)`.
- **Orientation** — its direction is where one flat face's outward normal points, snapped
  to the nearest cardinal under cell snap, the nearest of eight under half, and left raw
  when free. A square dragged east is grid-aligned; the same square dragged north-east is
  a diamond.

The circle is its own inscribed circle and takes the same diameter, so "diameter" means
one thing across every side count.

### §6 — The targeted-cell indicator

Room and Corridor highlight the cell (half-cell) under the pointer, filled faintly and
outlined, in the same `snapCursorColors` palette the snap dot uses — so a subtract-mode
highlight reads as rock and an add-mode one as floor. It follows the pointer **before**
any button is pressed, which is what makes it an indicator rather than a drag readout.
Absent under free snap, where there is no cell to target.

Not the N-gon or Carve: both anchor to a cell but extend well past it, so a centre-cell
highlight would advertise the wrong extent. Their live ghosts already show the real one.

The snap **dot** moves with the anchor for every cell-anchored tool — pointing it at a
vertex that no longer means anything to them would be worse than not drawing it.

### §7 — The dimension chip

Reports the shape that will commit, not the distance the hand travelled: under snap, a
drag inside one cell still reads `1 × 1`. The N-gon reports `⌀ <diameter>` rather than a
radius, since the diameter is now the number being steered.

---

## SPEC-029 — Battle Map

**Status: Active** — specified, not built. Work items WI-033 – WI-036.

A smaller-scale, bounded map the referee cuts out of the main map for a single fight,
pulls the table into, and drops when the fight ends.

### §1 — Authoring

Referee-only, and only while the **Map** main view is on stage. A new capture tool takes
a click-and-drag (or click, then second click) bounding box over the map, rendered like a
Room carve but in a distinct colour. **Full cells only** — this tool ignores the snap
mode and always snaps to whole cells, because the derived grid must divide evenly.

### §2 — What is captured

The **rect**, in lattice units — not a raster (DEC-025). Firebase Storage is unavailable
on the Spark tier, so there is nowhere to put a PNG; and since every client already holds
the geometry, re-rendering from it keeps the battle map live rather than frozen.

The battle map renders the source map's **background, floor and overlay** layers
(labels, symbols, doors, pen strokes) clipped to that rect. It does **not** render the
source grid — see §4.

The existing `exportPng` (`vector-engine.ts`) already renders an arbitrary `world`-space
frame with a per-layer cutoff, and is reused for the quick sheet's local preview
thumbnail. **The PNG path stays wired** so that a future `[HUMAN]` Blaze upgrade can
persist a real capture with no re-architecture; until then the blob is local and
throwaway. Note `exportPng`'s standing gotcha: a solid background *colour* lives on the
renderer clear colour, not in `layers.background`, so it is not in the extract and must
be composited.

### §3 — Lifecycle

A **temporary `GameMap` in the same room** (DEC-026), switched into view for everyone
through the existing `Room.activeMapId` — so seats, tokens, encounter, dice and log all
carry across unchanged, which is the entire point of a battle map. Exactly one may exist
at a time. "Exit" switches `activeMapId` back to the source map and deletes the temporary
one.

This is a `GameMap` schema change and therefore ships a migration and a `.vttcamp`
round-trip test (RULE-007). A battle map must never survive an export.

### §4 — Rendering differences

- **Bounded, not infinite.** The camera clamps to the captured rect.
- **Grid at double density.** The source grid is not drawn; a fresh grid is drawn at half
  the cell size, so a 10′ main map reads as 5′ squares. `RoomMeasure.perSquare` halves to
  match.
- **View tools only.** Pan, Eye, Measure, Ping. Every carve, overlay and select tool is
  hidden — the map is a snapshot, and editing it would desynchronize it from its source.
  `MapToolbar` renders `TOOL_GROUPS` unconditionally today, so this needs a tool-subset
  filter threaded `MapToolsSheet → MapToolPalette → MapToolbar`.

### §5 — The quick sheet

Referee-only (`QuickSheetDef.availability: 'gm'`), self-disabling when the Map view is
off stage the way `MapToolsSheet` already does. Holds the preview, the **Start** button
that performs the map change for all players, and the **Exit** button that returns to the
main map.

---

## SPEC-030 — Hex Crawl map type

**Status: Active** — specified, not built. Work items WI-037 – WI-041.

An overworld exploration map the referee can pull players into, replacing the square
lattice with an infinite hex grid.

> **⚠️ This spec creates a second coordinate space.** RULE-006 fixes one canonical space
> — square-cell lattice units, floats — and every consumer from LoS to token snapping
> reads it. A hex map does not merely re-skin the grid; axial hex coordinates are a
> different space with different neighbours, different distance, and no meaningful
> `pointInFloorUnion`. **The rule must be amended before implementation begins**, in its
> own standalone change (RULE-017), to scope the square-lattice guarantee to
> square-grid map types. Do not begin WI-037 without that amendment.

### §1 — Coordinates

Axial hex coordinates, integer. **`0,0` is the map's centre**; both axes run positive and
negative from there. Every hex shows its own `x,y` in a small translucent pill at its
bottom edge.

These coordinates **supersede map labels as the addressing scheme** — a hex is identified
by its coordinate, not by a name a referee has to invent and place.

### §2 — Terrain

Each hex carries a terrain kind: plains, forest, hills, mountain, swamp, jungle, … Each
kind is a **background colour plus an SVG overlay** drawn in a contrasting light/dark
tone, following the existing symbol-catalog pattern
(`packages/shared/src/map/vector/symbol-catalog.ts`) rather than inventing a second art
pipeline.

There is no per-region fill concept in the renderer today — the whole floor is painted
one themed colour — so this is genuinely new rendering, not a parameter.

### §3 — Contents

Icons overlaid in black — castle, town, fort, cave, danger, temple, … — reusing the
symbol catalog's authoring and rendering path. Any seat may select a hex and change its
contents, consistent with the existing member write scope (`DECISIONS.md` → Postponed,
"Member write scope inside a room").

### §4 — Notes

The label-notes feature carries over as **per-hex notes**, visible on mouseover through
the existing `map-label-tooltip` path. **Only hexes with a note attached are tracked** —
there is no "add a label" step, because §1's coordinates already name every hex.

### §5 — Tools

View and overlay tools only, plus a new hex-tile quick sheet for editing the selected
hex's terrain, contents and note. Every carve tool is meaningless here: a hex map has no
carved floor.
