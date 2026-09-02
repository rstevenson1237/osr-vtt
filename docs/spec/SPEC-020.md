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

> **⚠️ §5's edge rule superseded (2026-09-02) — the U axis is no longer derived from
> `pts[0]→pts[1]`.** Which edge that was came from the order a vertex-index list happened to
> carry in `geometry.ts`'s hand-written tables, and those orders are incoherent across a
> shape's faces, so each numeral's rotation was arbitrary (IN-079). Successor:
> `docs/spec/SPEC-045.md` §1 — a die-local axis projected onto each face and snapped to the
> face's own symmetry, with `Polyhedron.faceUp` promoted from the d10's exemption to the
> declared override. Per DEC-078. **§5's other clauses stand:** single-digit face font ~0.50,
> two-digit ~0.38, 6/9 underlined, and the d4 corner-glyph inboard anchoring of §6.

> **⚠️ §4's `SCALE` values superseded (2026-09-02).** The ~10% reduction §4 records did
> happen; what it left behind is a table in which `d4` and `d20` share a circumradius, so the
> d4 reads as the largest die in the set (IN-080). Successor: `docs/spec/SPEC-045.md` §2.
> **The circumradius convention itself stands** — only the per-kind numbers move, and the
> d10's `ringZ = apexZ·tan²(π/10)` planarity relation is untouched and still pinned by test.
