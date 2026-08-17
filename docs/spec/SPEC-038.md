## SPEC-038 — Multiple background assets

**Status: Active**

_(New with the 2026-08-11 playtest batch; supersedes SPEC-016's single-background model and
management location, per DEC-062. No `R`-number predecessor.)_

### §1 — Storage: a subcollection, not a single field

`rooms/{roomId}/maps/{mapId}/backgrounds/{bgId} = { ref: string, x: number, y: number, w:
number, h: number, order: number }` — a sparse subcollection, the same edit-locality pattern
`floorRegions` already uses. `x, y, w, h` place the image in the map's lattice-unit
coordinate space (RULE-006); `order` breaks stacking ties when two backgrounds overlap,
lowest painted first.

`GameMap.background` narrows to `{ color: string } | null` — a solid colour is not an image
and is unaffected by this spec. It remains the renderer's clear colour
(`setBackgroundColor`), not a `layers.background` sprite, exactly as SPEC-029 §2 already
documents; a background image and a background colour may coexist, the colour showing
through anywhere no image covers it.

This is a `GameMap`/store schema change and ships schema **v23**, a migration, and a
`.vttcamp` round-trip test (RULE-007). The migration folds an existing `{ ref }` into one
`backgrounds` document sized to the full map grid, so an existing room's background does
not visibly move. New `CampaignStore` methods (add / update transform / remove / reorder a
background) join the shared contract suite against both `MemoryStore` and `FirebaseStore`
(RULE-001). The new subcollection path needs a Firestore rule and a rule test (RULE-004) —
the existing per-room member-write model extends to it with no new boundary.

### §2 — Rendering

Every `backgrounds` document renders as its own sprite in `engine.layers.background`, in
`order`, each independently positioned and scaled to its stored `x, y, w, h` rect — a
straightforward generalization of today's single native-size, origin-anchored sprite
(`VectorMapView.applyBackground`).

### §3 — Move, resize, and the locked aspect ratio

> **Superseded by SPEC-039 §§2–3 (2026-08-17, DEC-071, IN-062/IN-063).** Two things in this
> section were reversed and the original text is kept verbatim below, per RULE-019.
> **(a)** The ratio is no longer always locked: SPEC-039 §3 gives the rect eight handles,
> four ratio-locked corners and four free edges. **(b)** The gesture is no longer armed by
> selecting a row in the Assets panel: SPEC-039 §2 makes the ordinary **Select** tool the
> way a background is picked up, and only an **unlocked** background (SPEC-039 §1) can be
> picked up at all. §§1–2 and §4 of this spec are unaffected, and §4's alignment overlay
> becomes more load-bearing, not less — it is now the only way to see whether a freely
> stretched image lines up.

_Original text, superseded:_

> Each background image can be dragged to reposition (`x, y` move together) and resized by a
> handle (`w, h` change). A resize **always preserves the image's native aspect ratio** —
> dragging one resize handle scales both `w` and `h` together from the image's own
> width:height, never producing a stretched image. There is exactly one resize handle
> interaction, not independent width/height handles.

### §4 — The alignment grid overlay

While a background is selected (DEC-063 — not only mid-drag), the map's current grid is
drawn over the image in translucent yellow, at the theme's map-grid line weight and a fixed
reduced opacity, so the referee can see exactly how the image's own art lines up against the
grid while adjusting `x, y, w, h` to match. The overlay is a render-time addition — it draws
no differently than the map's ordinary grid otherwise, and disappears the moment nothing is
selected.

### §5 — Management moves to the Assets activity

Background selection, addition, and per-asset transform controls move from Session
config's `session-background-*` block into the Assets activity, alongside `MapsPanel`'s
per-map management (`README.md` → "Map management"). This supersedes SPEC-016's statement
that management "lives in Session settings"; SPEC-016 is annotated as superseded in place
(RULE-019), never deleted. Every `session-background-*` testid this replaces is retired in
the same PR that adds its Assets-activity successor, and `session-config.spec.ts`'s
background assertions move with it (RULE-005).

GM-only, per DEC-063 — matching every background control today and `MapsPanel`'s existing
gate.
