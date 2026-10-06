## SPEC-059 — Placed backgrounds: concurrent edits, unloadable images, hex maps

**Status: Active** — DEC-123, DEC-124, DEC-125 (user, 2026-10-06); scheduled as WI-215,
WI-216, WI-217.

_(New with IN-067, IN-068 and IN-069, the WI-083 findings. It **amends** SPEC-038 §2
(rendering) and extends SPEC-038/SPEC-039's placement to hex maps. Square-map behaviour is
otherwise unchanged.)_

### §1 — An edit to a removed background is a no-op (DEC-123, WI-215)

`setBackgroundTransform`, `setBackgroundOrder` and `setBackgroundLocked` **resolve without
effect** when the background document does not exist, in every `CampaignStore`
(`MemoryStore`, `LocalStore`, `FirebaseStore`). `FirebaseStore` treats a `not-found`
rejection from its `updateDoc` as success and must not create the document; any other
rejection still propagates. The guarantee is written on the three methods' doc comments
and asserted by `campaign-store.contract.ts` against all three stores (RULE-001): add, then
remove, then each of the three writes resolves and the background stays absent.

Consequence: a GM whose background is removed by another client mid-drag sees the image
disappear and the release do nothing — no console error.

Out of scope: the same missing-doc divergence on the store's other update methods (IN-226).

### §2 — Each image renders independently (DEC-124, WI-216)

Replaces SPEC-038 §2's single-pass guarantee:

1. **Per-image settling.** One image failing to load never blocks another. Every background
   whose texture loads is placed, moved, restacked or removed exactly as its document says,
   on every change; a superseded pass still drops its stale results (the `bgLoadSeq` guard).
2. **An unloadable image draws nothing** on the canvas, for anyone, and does not stop the
   rest of the layer. Its row in the Backgrounds panel carries a visible "image could not be
   loaded" note (new testid `background-error-{id}`; copy in `strings/BackgroundsPanel.ts`)
   while the failure lasts. Its other controls (Lock, Fit, Remove, restack) still work, so
   the referee can remove it. The note clears when a later pass loads it.
3. **A local drag is not overridden.** While the local GM is dragging background `B`, an
   incoming backgrounds snapshot does not reset `B`'s sprite from its stored rect; `B` keeps
   the live rect until pointer-up, when the normal settled write lands (last write wins
   against a concurrent remote move). Every other sprite updates normally. If `B` was
   removed meanwhile, its sprite goes and the release is a no-op (§1).

### §3 — Hex-native placement on hex maps (DEC-125, WI-217)

RULE-006 is unamended: a hex map keeps exactly one space, DEC-081's thirds of an axial
step, origin at the map centre, with `hex.size` the render-time multiplier.

1. **Stored form.** `MapBackground` gains an optional `hex: { tl: HexPoint; br: HexPoint }`
   — the top-left and bottom-right corners of the image's (screen-axis-aligned) rect, as
   free-valued `HexPoint`s. On a hex-map background it is present and is the only placement
   read; `x, y, w, h` are written as `0` and never read there. On a square-map background it
   is absent and nothing changes. Render: each corner goes through `hexPointToPixel(…,
hex.size)` once; the sprite spans the two.
2. **Migration** (schema v34 → v35, RULE-007). For every background on a hex map with no
   `hex` field, compute today's pixel corners (`x·cellSize, y·cellSize` and
   `(x+w)·cellSize, (y+h)·cellSize`, `cellSize` from that map's `grid`) and convert each with
   `pixelToHexPoint(…, hex.size)`, so the image appears exactly where it did. Idempotent;
   square maps untouched. `.vttcamp` round-trips the new field identically (RULE-014).
3. **Gesture.** Select's move and eight-handle resize (SPEC-039 §§2–3) work on hex maps as
   on square: the gesture runs in pixels and converts to `HexPoint` once at the settled
   write, which is `setBackgroundTransform` carrying the hex corners (the method's argument
   widens to accept them — a contract change on the shared suite, RULE-001). No snapping:
   background corners are free-valued.
4. **Add and Fit on a hex map** place the image at its native aspect, centred on the current
   view and filling its shorter side, since a hex crawl has no fixed grid extent to fit to.
5. **No square alignment overlay on hex maps.** `renderBackgroundAlignment` is not drawn
   there (it is a square-lattice consumer, RULE-006); the hex grid already shows.
