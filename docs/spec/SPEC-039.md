## SPEC-039 — Background lock, canvas selection, and free resize

**Status: Active**

_(New with the 2026-08-17 batch — IN-061, IN-062, IN-063. Supersedes SPEC-038 §3, which is
annotated in place, never deleted (RULE-019). SPEC-038 §§1–2 and §4 stand unchanged and this
spec builds on them. No `R`-number predecessor.)_

The problem this spec exists to solve, stated once: a background image is the only object on
the map that is **large**. A floor plan fitted to the grid covers every cell, so any gesture
that can grab "the image under the pointer" can grab it from anywhere, and any selection
model that arms that gesture from another activity arms it invisibly. SPEC-038 §3 handled
that by keeping the gesture behind an explicit Assets-panel selection; the cost was that
while a background was selected **no map tool worked anywhere on the map**. This spec moves
the guard from *when the gesture is armed* to *what the object permits*.

### §1 — `locked` is a property of the background

`MapBackground` gains `locked?: boolean` — absent ⇒ unlocked (DEC-068). It is a stored field
on the document, not per-viewer client state: a lock is a statement about the asset, and two
referees must see the same one.

This is a store schema change and ships schema **v27**, a migration, and a `.vttcamp`
round-trip test (RULE-007). **The migration writes `locked: true` on every background that
already exists** (DEC-069) — existing placements are overwhelmingly full-grid, and migrating
them unlocked would hand every Select click on the whole map to the background. A newly
added background starts **unlocked**, because a referee who has just placed an image wants
to position it.

`setBackgroundLocked(roomId, mapId, backgroundId, locked)` joins the shared contract suite
against both `MemoryStore` and `FirebaseStore` (RULE-001). The existing `backgrounds`
subcollection rule already covers the path — per-room member write, no new boundary — and
gets a rule test for the new field alongside the others (RULE-004).

The control is a per-row toggle in the Assets activity's `BackgroundsPanel`
(`background-lock-{id}`), beside Fit and Remove, GM-only like every other control in that
panel (DEC-063 unchanged). The panel keeps add / lock / Fit / remove and **loses "Adjust on
map"** (DEC-070): `background-adjust-{id}` and the `MapToolController.selectedBackgroundId`
bridge are retired, and `backgrounds.spec.ts`'s assertions on them move to canvas gestures
in the same change (RULE-005).

### §2 — Select picks up an unlocked background

The ordinary **Select** tool (SPEC-037) gains one object kind. A `pointerdown` inside an
**unlocked** background's rect selects it; a drag moves it; a drag on one of its handles
(§3) resizes it. A **locked** background is not an object as far as Select is concerned —
the press falls through to whatever Select would otherwise have picked, exactly as a press
outside every rect does today.

Ordering against the rest of Select's picking is the substantive part, and it inverts what
SPEC-038 §3 did. A background is the **last** thing Select considers, not the first: vertex
handles, then objects, then the lasso, and only then the backgrounds under the pointer,
lowest priority because they are the largest and the most likely to be underneath something
the referee actually meant. Where two unlocked backgrounds overlap, the one with the highest
`order` — the one painted last, and so the one visibly on top — wins.

Selection is exclusive with Select's other selections: picking a background clears any
vertex/object selection and vice versa. Escape clears it, as it already does.

Everything SPEC-038 §3 said about **committing** the gesture is unchanged and remains
binding: the rect follows the pointer by moving the Pixi sprite directly, and exactly one
`setBackgroundTransform` is written on release (RULE-003), with no write at all when the
rect did not change.

GM-only stays GM-only (DEC-063). A non-GM seat's Select tool never sees a background as an
object, whatever its `locked` value.

### §3 — Eight handles: corners keep the ratio, edges free it

**This reverses SPEC-038 §3** (DEC-071). A selected background carries eight resize handles
— four corners and four edge midpoints:

- **A corner** scales `w` and `h` together from the image's **native** width:height, with
  the opposite corner as the fixed anchor. This is the old single-handle behaviour, now one
  of two, and it is what a referee uses to size an image without distorting it.
- **An edge** moves one dimension only, with the opposite edge as the fixed anchor: left and
  right change `w` alone, top and bottom change `h` alone. The image stretches. This is the
  capability that did not exist before, and it exists because a scanned or photographed
  floor plan is frequently already distorted relative to the grid it has to match — with
  only a ratio-locked handle there is no gesture in the app that can correct it.

The stored shape is untouched — `x, y, w, h` already admit any rect — so **§3 ships no
migration**. `MIN_BACKGROUND_CELLS` and the no-inversion rule apply **per axis**: a pointer
dragged past the anchor clamps that axis to the minimum rather than inverting the rect, and
a corner clamps the driven axis and derives the other through the native ratio.

The arithmetic stays in the pure, unit-tested `apps/web/src/lib/map/background-transform.ts`
(SPEC-038 §3's one surviving structural commitment): `resizeBackground` becomes
handle-parameterised, `backgroundHitTest` grows from one handle to eight plus the body, and
the canvas stays a thin wrapper over both. The eight-way hit test resolves handle-before-
body and corner-before-edge where they overlap, and each handle keeps the fixed on-screen
grab radius converted through the live zoom.

Handles are drawn on the never-persisted `tools` layer with the alignment overlay
(SPEC-038 §4), so they stay absent from PNG exports, and the overlay's role grows: with free
stretching available it is the only way to see whether the result matches the grid.

### §4 — What must be true when this ships

- A locked background cannot be moved or resized by any gesture. There is no modifier key
  that overrides the lock; unlocking is the override.
- With **no** background selected, every map tool behaves exactly as it does today,
  everywhere on the map, including over a placed image.
- With an unlocked background selected, a press outside its rect still falls through to the
  active tool.
- An upgraded room looks and behaves identically to how it did before the upgrade, because
  every background it already had is locked.
