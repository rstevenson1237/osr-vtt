## SPEC-001 — The Activity Shell

**Status: Superseded** (2026-07-24) — successor: `README.md` §
"Session shell — quick sheets (II.1)", which is authoritative.
**Retained clauses still in force: §4 (colour groups), §5 (layering), §6 (dialog
primitives).**

> **⚠️ Structure superseded (2026-07-24) by the Quick Sheets shell** — see
> `README.md` § "Session shell — quick sheets (II.1)", which is authoritative. The
> seven-activity, four-rail shell (§1–§4, §7, §8) is gone: the Activities rail, Tools
> rail, Log drawer and mini-cards no longer exist.
> **§5 (layering), §6 (dialog primitives) and §4's colour palette still stand.**

**§1–§3 (retired).** The room UI was a near-fullscreen stage hosting one Activity
at a time, framed by four slim edge tabs (top Session, left Activities rail with
colour-coded group boxes and mini-cards, right context-sensitive Tools rail, bottom
Chat/Log tab). Each rail tab moved `collapsed` → `mini-card` → `stage`; exactly one
mini-card open per rail; shell state persisted per room in `localStorage`. The
registry (`ActivityDef` with `id/title/icon/group/stage/miniCard/tools/availability`)
registered Map, Encounter, Dice, Characters, Assets, Log, Session. Existing panels were
re-housed, never rewritten. **WI-000 locked Option A (docked flyouts)** as the shell
choice.

**§4 Colour groups & icons (still in force).** Groups and their design-token colours:
**world** (Map, Assets) — map blue; **play** (Encounter, Dice) — rust red; **records**
(Log/Chat, Characters/Notes) — moss green; **referee** (Session) — violet, GM-only.
Icons are simplistic single-colour stroke SVGs drawn as `currentColor`.

**§5 Layering (still in force).** Z-order, top last: stage → rails/flyouts → bottom
drawer → **dice overlay** → dialogs/toasts. The dice overlay canvas is
`position:fixed`, full-viewport, `pointer-events:none`.

**§6 Dialog primitives (still in force).** A shell-owned `<Dialog>` (focus-trapped,
Esc-dismiss, token-styled). **Every `window.prompt`/`confirm` is retired.** (The
companion `<Popover>` was later deleted with the mini-card model.)

**§7 Keyboard map.** Revised by `README.md` § "Session shell — quick sheets (II.1)" —
see the current shortcut list there.

**§8 Mobile / tablet mode.** Trigger: viewport `< 900px` **or** a coarse-pointer
media query. The bottom activity bar and touch input survive; the tool bottom-sheet
became "any quick sheet, as a bottom sheet". Touch: one-finger = active tool,
two-finger drag = pan, pinch = zoom.
