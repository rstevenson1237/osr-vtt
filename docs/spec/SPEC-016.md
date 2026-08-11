## SPEC-016 — Background management

**Status: Superseded** by SPEC-038 (2026-08-11) on the single-background model and the
management location. Kept for the record, per RULE-019 — never deleted.

The background is a managed room/map property, not a hard-coded sprite:
`GameMap.background` is either an image ref or a solid `#rrggbb` colour, rendered by
the `background` layer. GM controls (Assets view + Session settings) offer **Change
background** (picking from Bundled / Saved URL via the asset picker) and **Remove
background**. There is no selection-on-canvas of the background sprite — management
lives in the GM UI, which avoids accidental drags.

> **Superseded 2026-08-11 (IN-053/IN-054, SPEC-038).** `GameMap.background` narrows to
> `{ color } | null` only; images move to a `backgrounds` subcollection supporting
> multiple, independently positioned and resized assets (SPEC-038 §1). Management moves
> out of Session settings into the Assets activity (SPEC-038 §5) — Session settings no
> longer carries a background control. On-canvas selection is introduced for the first
> time, gated GM-only (DEC-063), which is this spec's "avoids accidental drags" concern
> answered by permission rather than by removing canvas interaction.
