# Encounter Screen Specification (Theater-of-the-Mind Board)

**Authoritative for Plan §7 Phases 0, 2, 3 & 4 — the Encounter Board half of the Main Stage.** Parallel to `VTT_Map_Tooling_Spec.md`. Claude Code implements this exactly and **must not infer game rules**. Where a term below is unfamiliar, *this document is the definition* — do not fill gaps from general "combat tracker" assumptions.

---

## 0. What this is — and is not

The Main Stage toggles between **Map View** (tactical grid — see the map spec) and the **Encounter Board** (this doc). The Encounter Board is a **theater-of-the-mind** surface: it shows *who is present in a scene and the state of tension*, with **no grid, positions, movement, line-of-sight, or fog**. When the GM runs a scene in description rather than on a battlemap, this is the screen.

It is **NOT** a map (no coordinates/movement) and **NOT a rules engine**. **Hard limit (unchanged): the app tracks and displays; it never computes, resolves, or automates any rule.** It orders actors, counts rounds, shows dice, and displays tension widgets — *humans apply the rules.*

**Define the unfamiliar terms up front (Claude Code will not know these):**
- **Theater of the mind** — running an encounter through spoken description instead of miniatures on a grid. This board is a shared "cast list + scoreboard," not a map.
- **Initiative** — the agreed order in which sides/actors take turns within a round.
- **Round** — one full cycle through the initiative order.
- **Side / Group** — a team of actors (e.g. "Party", "Goblin Ambush"), sourced from the shared Groups roster (toggles `[Map]/[Board]/[Active]`).
- **Caller** — an OSR role: one player who declares the party's collective intent each round. Here it is only a movable marker.
- **Difficulty Die / Danger Die** — referee-controlled tension widgets shown to everyone (§7).

---

## 1. The Model (primitives)

- **Actor card** — one board entry = a token/portrait optionally linked to a Profile (Plan §2.5). The actors shown are the members of Groups toggled **[Board]**-visible.
- **Sides** — groups act as sides; a scene has ≥1 side (often Party vs one or more foe groups).
- **Initiative order** — an ordered list of sides (Side mode) or actors (Individual mode), or none (Free/Caller mode).
- **Round state** — a round number + a pointer to whose turn/side is currently up.
- **Roll strip** — an ephemeral row where simultaneous dice results collect and sort (§6).
- **Tension widgets** — the global Difficulty Die + Danger Die (§7).
- **Caller marker** — an assignable, rotatable highlight showing who is declaring for the party.

All of this is mechanics-agnostic scaffolding: numbers are **entered or dropped in from a dice roll, never derived from stats.**

---

## 2. Primary UX Loop

GM frames a scene → toggles the relevant Groups to **[Board]** (and **[Active]** if it's a turn-based fight) → optionally sets/rolls initiative → steps rounds while players declare (often through the **Caller**) and roll. Hidden foes are revealed by flipping their group's **[Board]** toggle.

Optimize for: **fast reveal**, **one-tap round advance**, **one-tap "this side/actor is up"**, and **dropping dice results onto the board**. Works for combat *and* non-combat standoffs — initiative is optional; the cast display + tension widgets stand alone.

---

## 3. Components (the "catalog")

| Region | Purpose | Controls | Notes |
|---|---|---|---|
| **Cast area** | The visual "who's here" — actor cards grouped by side | all view; GM also sees hidden | reveals via `[Board]` |
| **Initiative tracker** | Ordered list + round counter + current pointer | GM sets mode/order, advances | optional per scene |
| **Tension bar** | Difficulty Die + Danger Die | GM controls, all see | §7 |
| **Roll strip** | Simultaneous dice results, sorted + flagged | anyone rolling contributes | §6 |
| **Actor card** | Portrait, name, side, pinned fields, status tags, roll shortcut, turn highlight | owner/GM | select → raises the Dock |
| **GM controls** | Add/remove actor, reveal group, set/clear initiative, assign Caller, mark acted/defeated | GM | never edits values via logic |

Selecting any card raises the **Active Character Dock** (bottom) showing the full Profile (Plan §2.5).

---

## 4. Initiative Modes (mechanics-agnostic)

Three ways to order a scene. The app **arranges and steps; it never computes order from a stat.**

| Mode | How it works | Fits |
|---|---|---|
| **Side / Group** *(default)* | Each side is one row; **set or roll one number per side**; sides sort high→low; advance side-by-side; a side's actors act together | OSE / group initiative |
| **Individual** | Each actor gets a slot; set or roll a number each; sort; step actor-by-actor | per-actor init systems |
| **Free / Caller** | No fixed order; GM marks who's acting; the **Caller** marker rotates | pure theater-of-mind |

- Initiative numbers are **typed** or **pulled from a dice roll** (roll a die → drop it in the slot). Never auto-derived.
- **Round counter** increments on manual advance or when the order wraps; GM can also set it directly.
- Sides/actors can be flagged **acted** (dimmed) and **defeated/removed** (a flag — **not** an HP calculation).

---

## 5. Actor Cards

- **Anatomy:** portrait + name + side; a few **referee-pinned Profile fields** (a stat the GM wants always visible, pinned in the template or on the card); **status tags** (dumb free-text flags like "prone", "burning" — display only, no effect); a **roll shortcut** surfacing the Profile's `roll` fields; a **turn highlight** when it's their turn.
- **Selection** raises the Active Character Dock with the full profile.
- **GM-only actors** (unrevealed foes) render only to the GM until their group is toggled `[Board]`; backed by `gmPrivate`.
- Cards can be reordered (Individual mode), marked acted, or removed. None of this reads or writes a value as a rule.

---

## 6. Simultaneous Dice Resolution (the roll strip)

The board's signature dice behavior — "everyone rolls at once":
- Multiple actors roll into a shared **strip**; results **sort highest→lowest** and each die is **flagged** by the active convention.
- **Separate mode** *(default, custom system):* each die flagged **Success (4+) / Complication (2–3) / Failure (1)** via CSS class (thresholds referee-configurable per the Plan note).
- **Summed mode** *(OSE):* dice + modifiers add to a single total.
- Rolls stream ephemerally via **RTDB** during the moment, then the outcome is written to the Action Log.
- Uses the Phase 3 dice engine and the `roll` fields on cards. **The app flags dice faces; it never decides what a Success *does*.**

---

## 7. Tension Widgets (Difficulty Die & Danger Die)

Referee-controlled, **globally visible** — the point is shared, mounting tension everyone can see.
- **Difficulty Die:** a single die value the GM sets to signal how hard the situation is. *(The custom system treats a **smaller** die as **more** dangerous — but the app only **displays** whatever die the GM picks; it encodes no such rule.)*
- **Danger Die:** a GM-advanced **countdown** for looming threat. Render as a die value the GM steps **and/or** an optional **segmented clock** the GM fills. Advancing it **triggers nothing automatically** — any reveal or escalation is the GM's manual call.
- Both are shared state: **GM-writable, all-readable.**

---

## 8. Visibility & Referee Secrets

- Hidden foes (a group not yet toggled `[Board]`) are **GM-only** until revealed; backed by `gmPrivate` + the group's `[Board]` toggle.
- GM sees the full cast, hidden notes, and any unrevealed tension state; players see only the revealed board.
- Revealing = flipping `[Board]` on a group (and optionally `[Active]` to add it to initiative).

---

## 9. Relationship to Map View & Groups

- The **same Groups roster** drives both surfaces: `[Map]` = on the grid, `[Board]` = on this screen, `[Active]` = in the current initiative pool. An actor can be on both surfaces at once.
- **Initiative is shared:** the `[Active]` pool is one and the same whether the fight is on the grid or on the board. Toggling Main Stage mode mid-fight preserves the single initiative order + round.
- Switching Main Stage mode never loses encounter state.

---

## 10. Data Model (Firestore + RTDB)

Under `rooms/{roomId}`:
```
encounter: {
  mode: "side" | "individual" | "free",
  round: int,
  order: [ { refType:"side"|"actor", refId, init?, acted:bool } ],
  currentIndex: int,
  callerSeatId?: string,
  difficultyDie?: string,                 # e.g. "d8" — display only
  dangerDie?: { value?: string, clock?: { filled:int, size:int } }
}
# actor cards read [Board]-visible members of existing Groups/tokens; no new actor store
```
- **RTDB (ephemeral):** the live roll strip and any in-progress reveal animation. **Firestore** holds settled encounter state.
- Rules: `encounter` (order/round/dice) is **GM-writable, all-readable**; hidden actors live in `gmPrivate`.

---

## 11. Explicitly OUT of Scope
Auto-rolling or computing initiative from stats · HP/damage/condition automation · enforced turn timers · monster AI · positioning, range, movement, LoS (that's the Map) · any outcome resolution beyond flagging dice faces. **The board *tracks* a fight; it does not *run* one.**

---

## 12. Phase Mapping
- **Phase 0:** minimal board — one actor card (portrait) + the Main Stage toggle, synced.
- **Phase 2:** Groups → cast area; **Side + Individual** initiative modes; round counter; current pointer; reveal via `[Board]`; shared `[Active]` pool.
- **Phase 3:** the **roll strip** (simultaneous Separate/Summed resolution) + card roll shortcuts; Active Character Dock link.
- **Phase 4:** **Difficulty + Danger Die** tension widgets; **Free/Caller** mode + Caller marker.
