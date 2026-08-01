# PLAN — completed items · milestone `v2-core`

**Closed 2026-07-19.** WI-000 – WI-012 (15 entries, including WI-004b / WI-005a /
WI-005b). The v2 Master Plan build-out: shell, dice, cellular map tooling, session
config, log, encounter board, assets, accounts, PNG export, hardening.

Archived from `docs/VTT_Master_Plan.md` Part IV §1 (shipped ledger). Original numbers
were `WI-0`–`WI-12`; they are zero-padded here and are numerically unchanged. Spec
citations are given in both the Master Plan's `R` numbering and the current `SPEC-`
numbering — see the crosswalk at the top of `SPEC.md`.

This file is immutable (RULE-020).

| WI          | Spec (old)    | Spec (new)                   | Model             | Effort | What it delivered                                                                        |
| ----------- | ------------- | ---------------------------- | ----------------- | ------ | ---------------------------------------------------------------------------------------- |
| **WI-000**  | —             | —                            | `[HUMAN]`         | —      | Adopt the plan; tag `v1-complete`; retire four v1 docs; lock shell Option A              |
| **WI-001**  | R2            | SPEC-002                     | Sonnet            | medium | Design tokens, `data-theme`, `readMapTheme()`/`setTheme()`, two themes, migration        |
| **WI-002**  | R1            | SPEC-001                     | `claude-opus-4-8` | high   | The Activity Shell (later replaced by the Quick Sheets shell); Dialog primitives         |
| **WI-003**  | R1.8          | SPEC-001 §8                  | Sonnet            | medium | Mobile/tablet mode; touch input in the Pixi engine; mobile Playwright project            |
| **WI-004**  | R3            | SPEC-003                     | `claude-opus-4-8` | high   | Dice renderer v2 — no-flip settle, real polyhedra, quality bar, overlay lifecycle        |
| **WI-004b** | R3.6          | SPEC-003 §6                  | Sonnet            | high   | Shared rolls — staging doc, `Roll.parts`, seat-sorted expansion, apply-to-initiative     |
| **WI-005a** | R9.2/9.3/9.5  | SPEC-009 §2/§3/§5            | Sonnet            | medium | Wall drag-runs, labels, measurement units, space-pan, cursor-anchored bounded zoom       |
| **WI-005b** | R9.4/9.6/9.7  | SPEC-009 §4/§6/§7            | `claude-opus-4-8` | high   | Organic walls, half-grid, shape carves, token snapping                                   |
| **WI-006**  | R4            | SPEC-004                     | Sonnet            | medium | Session Configuration + player management (rename/role/remove/GM-transfer)               |
| **WI-007**  | R5            | SPEC-005                     | Sonnet            | medium | Log activity + chat, `listLogBefore` pagination, `/r` command                            |
| **WI-008**  | R8            | SPEC-008                     | Sonnet            | high   | Encounter Board v2 — cards, group boxes, Unassigned bin, collapse + `moveTokens`         |
| **WI-009**  | R7            | SPEC-007                     | Sonnet            | medium | Assets activity, `gen:` token scheme, add-creature / My-token flows                      |
| **WI-010**  | R6            | SPEC-006                     | `claude-opus-4-8` | high   | Google linking, My Rooms, `deleteRoom` recursive delete, prune button                    |
| **WI-011**  | R9.8          | SPEC-009 §8                  | Sonnet            | low    | Map PNG export                                                                           |
| **WI-012**  | —             | —                            | Sonnet            | medium | Hardening & closeout; contract parity; Chromebook + phone playtest                       |
