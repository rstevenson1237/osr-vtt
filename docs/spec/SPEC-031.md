## SPEC-031 — Character colour is always set

**Status: Completed** (2026-08-03) — shipped as WI-050 (IN-025, DEC-033, DEC-040).

_(New with WI-050; no `R`-number predecessor.)_

### §1 — The rule

**Every character has a colour. There is no unset state.** A roll never renders without a
colour associated with the seat that made it.

### §2 — What "absent" used to mean, and what it means now

`ProfileInstance.color` and `Token.color` are both optional, and absent was a _meaningful_
value: the die rendered one theme-wide neutral (`--dice-face`) rather than a per-seat
colour, and a letter token kept its auto-assigned `gen:disc:` fill. Under this spec absent
stops being a choice and becomes only a **provenance marker** — "written before this rule,
needs backfill".

That is a change to the meaning of a stored field, so RULE-007 applies in full: a
migration, a migration test, and a `.vttcamp` round-trip test.

### §3 — Assignment

- A seat gets a colour **at creation**, drawn at random. The existing
  `CHARACTER_COLOR_PALETTE` is the source, so an auto-assigned colour is indistinguishable
  from a chosen one and no new vocabulary is introduced. `joinRoom` writes it, on the first
  join for a uid only, and never over a colour that is already there.
- Existing profiles are **backfilled**, deterministically from the seat id rather than
  randomly, so every client and every re-run agrees on the same colour for the same seat.
- The colour continues to mirror onto the owner's `Token.color` and to rebuild a letter
  token's baked `gen:disc:` ref exactly as `setMyColor` already does.

**Where the backfill actually runs** (WI-050, DEC-040). The v19→v20 step is a no-op on the
room doc, because `migrateRoom` only ever sees the room doc and `color` lives on
`profiles/{seatId}`. Rewriting documents would not have been sufficient in any case: a seat
may have **no profile document at all**, since one is created lazily by the first
sheet/portrait/colour write. So the backfill is expressed twice, in the two places that
between them cover every read:

- **`assignedCharacterColor(seatId)`** (`packages/shared/src/character-color.ts`) — the
  deterministic derivation, applied at resolution time by `resolveCharacterColor`, which is
  what `characterDiceColor` and the quick sheet both call. This covers the no-document case.
- **`migrateProfile(doc, seatId)`** (`packages/shared/src/migrations/`) — the same
  derivation applied to stored documents at the one boundary where documents are genuinely
  rewritten, `.vttcamp` import (`archiveToSnapshot`). Idempotent, so re-importing an archive
  never repaints anybody.

**The store contract narrows.** `setProfileColor(roomId, seatId, color: string)` no longer
accepts `undefined`; that overload was the only path to the unset state and went with it.
`setTokenColor` keeps its clearing overload — a creature or a piece of scenery has no
character behind it and so has no colour to always have.

### §4 — What goes away

- The **Clear** button (`token-color-clear`) is removed from the Character quick sheet.
  With no unset state to return to, it has nothing to do.
- `dice-overlay.spec.ts` no longer clicks it; the spec is rewritten in the same change,
  per RULE-005's "or update the spec in the same change".

### §5 — What stays

The `--dice-face` neutral is **not** deleted. It remains the fallback for any die with no
seat behind it. What changes is that no _seat_ can reach it any more.

### §6 — Knowingly given up

Once the backfill runs, the distinction between "deliberately chose no colour" and "never
chose one" is gone — both become an assigned colour. Accepted: the user's framing is that
the unset state should not exist, not that it needs preserving.
