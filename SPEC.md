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

| Status         | Meaning                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Active**     | Governs work not yet fully discharged. Something in it is still outstanding.                          |
| **Completed**  | The behaviour it specifies has shipped. Present-day behaviour is described in `README.md`.            |
| **Superseded** | Replaced. Retained permanently, marked superseded, naming its successor. Never deleted, never reused. |

A **Completed** spec may still carry a clause marked _standing constraint_ — a rule
that binds future work even though the spec itself has shipped (SPEC-003 §5's licence
discipline is the clearest case).

## Crosswalk — Master Plan `R` numbers → `SPEC` IDs

The Master Plan cited specs as `R1`–`R26`. Those citations still appear in git history,
PR titles and code comments. IDs are never reused; this table is the permanent mapping.

| Old | New          | Old | New          | Old | New          |
| --- | ------------ | --- | ------------ | --- | ------------ |
| R1  | **SPEC-001** | R10 | **SPEC-011** | R19 | **SPEC-020** |
| R2  | **SPEC-002** | R11 | **SPEC-012** | R20 | **SPEC-021** |
| R3  | **SPEC-003** | R12 | **SPEC-013** | R21 | **SPEC-022** |
| R4  | **SPEC-004** | R13 | **SPEC-014** | R22 | **SPEC-023** |
| R5  | **SPEC-005** | R14 | **SPEC-015** | R23 | **SPEC-024** |
| R6  | **SPEC-006** | R15 | **SPEC-016** | R24 | **SPEC-025** |
| R7  | **SPEC-007** | R16 | **SPEC-017** | R25 | **SPEC-026** |
| R8  | **SPEC-008** | R17 | **SPEC-018** | R26 | **SPEC-027** |
| R9  | **SPEC-009** | R18 | **SPEC-019** |     |              |
| R9′ | **SPEC-010** |     |              |     |              |

Sub-numbers are preserved: `R24.1` → `SPEC-025 §1`, `R13.3` → `SPEC-014 §3`, and so on.

## Index

| ID       | Title                                                | Status         |
| -------- | ---------------------------------------------------- | -------------- |
| SPEC-001 | The Activity Shell                                   | **Superseded** |
| SPEC-002 | Design tokens & theming                              | Completed      |
| SPEC-003 | Dice renderer v2                                     | Completed      |
| SPEC-004 | Session configuration & player management            | Completed      |
| SPEC-005 | Log activity & chat                                  | Completed      |
| SPEC-006 | Accounts, out-of-session management & maintenance    | Completed      |
| SPEC-007 | Asset management & default tokens                    | Completed      |
| SPEC-008 | Encounter Board v2                                   | Completed      |
| SPEC-009 | Map geometry & tooling pack (cellular)               | **Superseded** |
| SPEC-010 | Vector Map System                                    | Completed      |
| SPEC-011 | Wall line-type system                                | Completed      |
| SPEC-012 | Door type system                                     | Completed      |
| SPEC-013 | Dimension HUD                                        | Completed      |
| SPEC-014 | Labels v3                                            | Completed      |
| SPEC-015 | Shell collapse & token-config contextualization      | Completed      |
| SPEC-016 | Background management                                | Completed      |
| SPEC-017 | Settings navigation                                  | Completed      |
| SPEC-018 | Asset removal & multi-room management                | Completed      |
| SPEC-019 | Generate-default token customization                 | Completed      |
| SPEC-020 | Dice renderer v2.1                                   | Completed      |
| SPEC-021 | Advantage/disadvantage by mode                       | Completed      |
| SPEC-022 | Token status ring                                    | Completed      |
| SPEC-023 | Group ownership                                      | Completed      |
| SPEC-024 | Map ⇄ character sheet                                | Completed      |
| SPEC-025 | Access control & abuse containment                   | Completed      |
| SPEC-026 | Room lifecycle & dead data                           | Completed      |
| SPEC-027 | Presence & seat lifecycle                            | Completed      |
| SPEC-028 | Snap-aware carve tool geometry                       | **Active**     |
| SPEC-029 | Battle Map                                           | **Active**     |
| SPEC-030 | Hex Crawl map type                                   | **Active**     |
| SPEC-031 | Character colour is always set                       | Completed      |
| SPEC-032 | Creatures are actors: profiles, ownership, selection | Completed      |
| SPEC-033 | Mobile viewport, touch, full-screen, and credits     | Completed      |
| SPEC-034 | Upload containment on Blaze                          | **Active**     |
| SPEC-035 | Process & context-loading strategy                   | Completed      |

Each spec's full text lives in `docs/spec/SPEC-nnn.md`. Read only the cited one.
