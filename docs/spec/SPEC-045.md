## SPEC-045 — Dice renderer v3: orientation, proportion, material and contact

**Status: Completed** — all five sections have shipped: §1 WI-093, §2 WI-094, §3 WI-095,
§5 WI-096, §4 WI-097 (2026-09-03).

The generated dice set is the one every player looks at on every roll, and it is staying
generated: DEC-077 declined imported meshes (IN-077) and redirected the effort here.
`3d-dice/dice-box` (MIT, with CC0 companion models) was examined **as a reference point
only** — no code read beyond its README and licence, nothing cloned, no asset taken. It is
not a dependency and never becomes one; SPEC-003 §5's posture is kept uniform regardless of
licence.

This spec has five independent sections, each with its own work item. They share a subject
and nothing else; any one may ship without the others, and §4 is deliberately last.

**What does not move, in any section.** The seed is authority (RULE-013): the headless sim
runs first, the face→value remap is applied to whatever it produced, and the die lands on
the value the Roll doc already fixed. No section here may make the displayed face depend on
physics. Die colour keeps exactly one source — the roller's character colour, baked into the
face texture rather than applied as `material.color` (SPEC-031; the `pick × texture` bug).

---

### §1 Numeral orientation is a property of the die, not of a table's typing order

**The defect.** SPEC-020 §5 sets a numeral's in-plane rotation from the face's first edge,
`pts[0]→pts[1]`. Which edge that is comes from the order a vertex-index list happens to
carry in `geometry.ts`'s hand-written tables, and those orders are incoherent across a
shape's faces:

- **d20 / d8** — the icosahedron table reads `[0,11,5]`, `[0,5,1]`, `[0,1,7]`…, each face
  starting from whichever vertex was written first. A triangle admits three orientations;
  each face gets one of them arbitrarily.
- **d12** — pentagon corners come from `orderRing`, whose first corner falls out of an
  `atan2` sort against a basis selected by `Math.abs(n.x) < 0.9`. Up to 72° of variation.
- **d6** — `+x` is `[1,2,6,5]`, giving a U axis of `+y`; `-x` is `[0,4,7,3]`, giving `+z`.
  Two adjacent faces, two unrelated orientations.

The rule's *form* was right — a numeral should sit square to an edge. Its *selection* was
accidental.

**The rule (DEC-078).** For each face with unit normal `n`:

1. `up₀ = A − n(A·n)`, where `A` is the die-local `+Y` axis — the same axis `topFaceIndex`
   scans, so a die has one reference direction rather than two. If `|up₀|` is below an
   epsilon (the normal is parallel to `A`), retry with `B = +X`. Deterministic; no
   randomness and no dependence on table order.
2. Candidate directions, in-plane, from the face centroid:
   - **centroid → each vertex** for triangular and pentagonal faces. A numeral's apex points
     at a corner, so its baseline lies parallel to the opposite edge — what a machined die
     does.
   - **centroid → each edge midpoint** for the d6's square faces.
3. **glyph-up = the candidate with the greatest dot product against `up₀`**, normalised
   in-plane. `uAxis = vAxis × n`, as today.

Step 3's snap is what makes this robust: the projection need only be roughly right, because
the result is quantised to one of the three or five orientations the face actually admits.
Every face of a shape resolves against one shared axis, so the numerals read as one family —
the pole-to-pole swirl an indexed cutting head produces.

**`Polyhedron.faceUp` is promoted, not retired.** It stops being an escape hatch added for
the d10 and becomes the declared **override**: a shape may name the direction its numerals'
tops point, applied as today **without** the snap, and the rule above runs wherever no
override is given. The d10 keeps its override — its kite's answer (the symmetry axis,
apex-ward) is a fact about that shape, not a family convention.

**Binding test.** *Rotating a face's index list — `[a,b,c]` → `[b,c,a]`, and the pentagon
and kite equivalents — must not change that face's glyph-up.* This is exactly the property
the edge rule fails, it is checkable without a renderer, and it makes this class of defect
unable to return. It is a gate failure if it does not hold for every shape.

**Scope.** UVs only. Face count, material groups, `locators`, `hullPoints`, the face→value
remap and `topFaceIndex` are untouched, so the value a die displays cannot change — only the
rotation of the glyph inside its face.

---

### §2 Die proportion: the d4 is not the largest die in the set

**The defect.** `SCALE` multiplies a **unit-normalised** polyhedron, so each entry sets that
die's *circumradius*. The table reads `d4: 0.56, d6: 0.45, d8: 0.52, d10: 0.55, d12: 0.56,
d20: 0.56` — the d4 is joint-largest. A tetrahedron at a given circumradius fills its sphere
far less evenly than an icosahedron does, so it reads as the biggest, sharpest object on the
table rather than as the smallest die in the set.

**Circumradius stays the convention.** It was worth checking, and it survives: in a physical
polyhedral set every die is roughly one overall size, so equal-ish circumradius is a fair
model of how a real set reads at a glance. Sizing by inradius instead would make the d4
enormous (a tetrahedron's inradius is a third of its circumradius, against ~0.79 for an
icosahedron). The convention is right; the numbers are wrong.

**The target ordering, by circumradius**, which a test asserts:

```
d4 ≤ d6 < d8 < d10 ≈ d12 < d20
```

Exact values are tuned by eye against `docs/mockups/dice-preview.html`, which SPEC-020
established as an R3.5-safe tuning surface — it tunes proportion and never feeds geometry.
The d10's `apexZ` is re-checked in the same pass: it went 1.15 → 0.85 to kill a "spike"
reading and may have overshot into squat.

**Non-negotiable.** The d10's `ringZ = apexZ · tan²(π/10)` planarity relation, pinned by an
existing test. `apexZ` is the aspect knob and the only one that may move; `ringZ` is always
derived from it. Setting them independently folds every kite face along its diagonal.

---

### §3 Numerals are incised, not drawn to look incised

`textures.ts` fakes depth with a canvas **emboss pass** — a light and a dark offset copy
under the glyph. It is a fixed fake: the highlight sits where the canvas put it, not where
the key light is, so it contradicts the lighting on roughly half of a tumbling die's faces.

**The change.** Generate a **normal map** alongside each face texture, with the numeral's
strokes cut into it, and hang it on the material as `normalMap`. The numerals are then lit
as geometry — the highlight tracks the key light, and it tracks it correctly as the die
turns. Material parameters (currently roughness ~0.30, metalness ~0.10) are re-tuned against
it, and an environment map is added so the gloss has something to reflect rather than only a
hemisphere and a key light.

**Constraints.** The emboss pass is removed once the normal map replaces it — two depth cues
disagreeing is worse than either alone. `flatShading: true` stays (SPEC-020 §2): a normal map
perturbs within a facet and does not soften its edges. The face texture's **colour** channel
is untouched, so SPEC-031's guarantee is unaffected — a normal map is a separate channel and
cannot reintroduce `pick × texture`. Materials stay cached per `(theme, face, variant,
label)`; the normal map is per-label and cached with them, never rebuilt per roll.

---

### §4 Bevelled edges — last, and only if §3 leaves work to do

Real dice have no sharp edges. The generated set does, and with `flatShading` that reads as
a faceted gem.

**Sequencing is part of this section, not a preference.** Most of a bevel's visual
contribution is the specular highlight along the edge, and §3 produces that highlight with no
geometry change and no contract impact at all. What §3 cannot fix is the **silhouette** — a
d6's corner against a light background stays geometrically sharp. **§4 is therefore not
started until §3 has shipped and been looked at**, and its work item carries that as a
standing constraint. The scope may turn out to be smaller than it looks now.

**The structure (DEC-079).** Value faces keep material-group ids `0 … faceCount-1`, still
1:1 with values. All bevel geometry — every edge strip and corner patch — goes into a single
additional group `faceCount` carrying one untextured body material in the roller's face
colour. `DieGeometry` gains `bodyGroupIndex: number` so the convention is stated in the type
rather than implied by arithmetic. Every consumer iterating `0 … faceCount-1` is correct as
written; the single place that changes is `scene.ts`'s materials array, which grows by one
entry.

**Three consequences, all deliberate.**

- **`flatShading` splits per material.** Face materials keep `true` (crisp facets); the body
  material sets `false` for smooth bevel strips. Any scheme mixing bevel and face geometry
  into one group makes this split impossible.
- **`hullPoints` stays the un-bevelled vertex cloud**, documented as deliberately a hair
  larger than the visible mesh — the safe direction for a collider. **This must be verified
  against §5**, which is why §5 ships first: once dice actually strike one another, a hull
  larger than its mesh shows as a small gap at the moment of contact. If the gap reads, the
  hull is inset to match; the decision is made by looking, not in advance.
- **The seam is the first thing to verify, before any bevel tuning.** The body material is a
  flat colour and the face material is a canvas texture whose background is that same
  colour. They match only if colour management agrees end to end; an sRGB/linear mismatch
  between a `THREE.Color` and a `CanvasTexture` appears as a visible ring where bevel meets
  face.

**Binding test.** `locators.length` equals the value count, and value groups remain
`0 … faceCount-1`, for every shape. That is the guard keeping RULE-013's remap addressing
the right groups.

> **Shipped by WI-097 (2026-09-03), and the two judgements this section deferred are
> made.** The **seam** was checked first, as required, and is clean: `THREE.Color` parses
> a hex into the linear working space and the face's `CanvasTexture` carries
> `SRGBColorSpace`, so the same hex reaches the same linear triple — verified in a
> headless render and pinned by a test that includes `ColorManagement.enabled`. **`hullPoints`
> stays the un-bevelled cloud**: the recession is at most 9.4% of the die's radius (the
> d4's apex; under 6% for every other shape), a face-first contact has no gap at all
> because the inset never moves the face plane, and the worst case the physics can reach —
> a d4 balanced apex-down on a d6 at exactly the hull distance — does not read at the
> renderer's scale. The hull is therefore **not** inset. See `docs/completed/WI-097.md`
> and `README.md` → Dice.

---

### §5 Dice in one roll meet each other

**The collisions are already on.** Stating it plainly, because the request arrived as "add
them": `DiceScene.simulate` puts every die in **one** Rapier world as a
`RigidBodyDesc.dynamic()` with a `ColliderDesc.convexHull`, default collision groups, no
filtering. Rapier resolves die-against-die exactly as it resolves die-against-floor.

**The throw is what suppresses them.** Dice spawn on a ring of radius 1.4–2.6 at independent
random angles, fall from a height of 5.5–7.0 under gravity 18 — about 0.75 s — with an inward
velocity of only `0.7 ×` the spawn radius, so a die travels roughly one unit inward before
landing, inside a tray of radius 4.4. Two dice at unrelated angles simply land apart. They do
not fail to collide; they are thrown so as not to meet.

**The change** is therefore throw tuning inside `simulate()` — a tighter spawn arc, more
inward velocity, a staggered release, a smaller effective tray, or some combination — until
dice in a multi-die roll visibly strike one another. No physics-architecture change, no
collision-group work.

**RULE-013 is unaffected and this must stay true.** The sim runs headlessly first and the
remap is applied to its result, so the die lands on the seeded value however chaotic the
tumble. Cross-client float divergence is already irrelevant — each client pre-rotates against
its own sim — and collisions only amplify a divergence that never mattered.

**Specified, not left to emerge: a die that comes to rest on another die.** The current
settle logic has never had to handle it. The value read stays correct — `topFaceIndex` takes
the most-up locator and the remap guarantees that face carries the right number — but the die
is visibly tilted and may hide the one beneath it. The work item picks and documents one
rule: nudge stacked dice apart during settle, extend the step budget for them, or accept the
stack as a legitimate outcome. It does not ship whatever the physics happens to do.

**Watch `MAX_STEPS`.** More contacts means longer settles. If rolls begin hitting the 300-step
cap — which force-reads whatever is most up — the budget is raised as part of this section.
