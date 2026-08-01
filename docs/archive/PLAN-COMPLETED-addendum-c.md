# PLAN — completed items · milestone `addendum-c`

**Closed 2026-07-30.** WI-013 – WI-024, plus six follow-on passes that landed without
work-item numbers. The Addendum C polish pack: settings navigation, wall and door type
systems, dimension HUD, labels v3, shell collapse, background management, multi-room
manager, generated tokens, dice v2.1, advantage by mode, token status ring.

Archived from `docs/VTT_Master_Plan.md` Part IV §1 (shipped ledger). Original numbers
were `WI-13`–`WI-24`; they are zero-padded here and are numerically unchanged. Spec
citations are given in both the Master Plan's `R` numbering and the current `SPEC-`
numbering — see the crosswalk at the top of `SPEC.md`.

This file is immutable (RULE-020).

| WI         | Spec (old)    | Spec (new)             | Model             | Effort | What it delivered                                                    |
| ---------- | ------------- | ---------------------- | ----------------- | ------ | -------------------------------------------------------------------- |
| **WI-013** | R16           | SPEC-017               | Sonnet            | low    | Settings section-nav scroll buttons; theme reachability              |
| **WI-014** | R10           | SPEC-011               | `claude-opus-4-8` | high   | Wall line-type system (per-wall style, angled→solid, natural pass)   |
| **WI-015** | R11           | SPEC-012               | `claude-opus-4-8` | high   | Door type system + centered icon overlay pass                        |
| **WI-016** | R12           | SPEC-013               | Sonnet            | low    | Dimension HUD                                                        |
| **WI-017** | R13.1–2       | SPEC-014 §1–§2         | Sonnet            | medium | Labels v3 — inline edit, delete, undoable                            |
| **WI-018** | R14           | SPEC-015               | Sonnet            | medium | Collapse reclaims stage width; snap vs. scale contextualization      |
| **WI-019** | R15           | SPEC-016               | `claude-opus-4-8` | medium | Background/starter map management                                    |
| **WI-020** | R17.2 / R13.3 | SPEC-018 §2 / SPEC-014 §3 | `claude-opus-4-8` | high | Multi-room manager + renumber/reorder                                |
| **WI-021** | R18           | SPEC-019               | Sonnet            | medium | Generate-default token customization                                 |
| **WI-022** | R19           | SPEC-020               | `claude-opus-4-8` | medium | Dice renderer v2.1 — match the reference set                         |
| **WI-023** | R20           | SPEC-021               | `claude-opus-4-8` | medium | Advantage/disadvantage by mode; dropped dice dimmed                  |
| **WI-024** | R21           | SPEC-022               | Sonnet            | low    | Token status ring                                                    |

## Unnumbered follow-on passes

Recorded verbatim from the ledger's closing paragraph. These landed as follow-on passes
rather than numbered items, and are **not** retroactively assigned work-item IDs —
inventing numbers for work that never carried them would create IDs that resolve to
nothing in git history.

> Beyond the ledger, these landed as follow-on passes rather than numbered items: the
> Quick Sheets shell redesign (superseding R1), fog of war rebuilt on the vector system,
> group ownership (R22), map ⇄ character sheet (R23), the tool-group regrouping, and the
> Measure/Pen tools.

In current spec numbering: the Quick Sheets shell redesign supersedes **SPEC-001**;
group ownership is **SPEC-023**; map ⇄ character sheet is **SPEC-024**. Fog of war, the
tool-group regrouping and the Measure/Pen tools have no spec of their own and are
described in `README.md` § "Map system — vector (II.2)".
