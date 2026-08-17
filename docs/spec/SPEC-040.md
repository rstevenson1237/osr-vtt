## SPEC-040 — Creatures have names, and their symbols read A–Z

**Status: Active**

_(New with the 2026-08-17 batch — IN-064. Extends SPEC-007's default-token model and
SPEC-019's generate-default customization; supersedes neither. No `R`-number predecessor.)_

### §1 — The problem: a creature has no name

`Token` carries no `name` field. Every surface that shows a creature's name — the Encounter
Board card title, the Character quick sheet header (SPEC-032 §4) — calls `creatureLabel()`,
which takes `imageRef`, strips the path and strips the extension. For a generated creature
that ref is `gen:disc:a1:%23aabbcc`, so the "name" the referee reads is a fragment of an
asset URL. That is the generated string IN-064 is about.

The symbol has the mirrored problem. `defaultCreatureRefs` bakes a lowercase **type** letter
plus a within-batch index into the ref — the first creature type in a room gets `a1`, `a2`,
`a3`, the second `b1`, `b2`, `b3` — so the letter identifies the *kind* and the number
identifies the individual. The request inverts that: the **name** identifies the kind and
the **letter** identifies the individual.

### §2 — The flow

The GM presses **+** on a group (or on the map toolbar), chooses **Generate** in the token
picker, and the picker asks for a **name** and a **quantity**. Entering `Goblin` and `3`
creates three tokens in that group:

| Token   | `Token.name` | Symbol |
| ------- | ------------ | ------ |
| first   | `Goblin 1`   | **A**  |
| second  | `Goblin 2`   | **B**  |
| third   | `Goblin 3`   | **C**  |

A quantity of **1** creates one token named `Goblin`, **without** a trailing number — the
number exists to tell several apart, and "Goblin 1" alone reads like there is a Goblin 2
somewhere. Adding a second Goblin to a group that already holds one does **not** retroactively
renumber the first; the new token takes the next free number and the next free letter, and
renaming is a manual edit.

### §3 — `Token.name`

`Token` gains `name?: string` — absent ⇒ fall back to `creatureLabel(token)`, exactly as
today, so a token written before this spec still reads the same. This is a store schema
change and ships schema **v28**, a migration, and a `.vttcamp` round-trip test (RULE-007).

**The migration does not invent names.** It leaves `name` absent on existing tokens rather
than backfilling `creatureLabel`'s output, because that output is the very string the
request calls unacceptable, and freezing it into storage would make it permanent instead of
merely displayed. Absence stays a legitimate state and the fallback stays live — the same
shape `Token.color` already uses (SPEC-031 §5).

`setTokenName(roomId, tokenId, name)` joins the shared contract suite against both
`MemoryStore` and `FirebaseStore` (RULE-001). The name is editable wherever a creature is
already editable — the Character quick sheet's header for a seatless actor — under the
existing `canSeatActAs` ownership predicate (SPEC-032 §3); no new permission.

A player seat's token is unaffected. A seat's name is the seat's `displayName` and always
was; `name` is for actors that have no seat behind them.

### §4 — The symbol: uppercase, per group, restarting at A

The generated disc's label becomes an **uppercase letter, unique within the group, starting
at A** (DEC-072). Three Goblins are A, B, C; three Orcs in their own group are A, B, C
again. Two tokens on the same map may therefore both read "A", which is the accepted cost —
the letter's job is to tell one goblin from another goblin, and the card that shows it
already says which group it belongs to.

`nextCreatureTypeLetter` and `defaultCreatureRefs`
(`apps/web/src/lib/tokens/labels.ts`) are rewritten against the target group's existing
members rather than against every unowned token in the room, and `labels.test.ts` moves with
them. The letter is assigned from the **lowest unused** letter in the group, so removing
"B" and adding a creature reuses B rather than jumping to D. Past Z the scheme continues
`AA`, `AB`, … rather than failing, on the same principle that `letterLabel` already applies
to seats.

**Seat letters are a separate scheme and are untouched.** `seatLetterFor` assigns players A,
B, C by join order across the room; it was already uppercase, already per-room, and nothing
here changes it. The two schemes can collide on a letter, and that is fine — a seat's token
shows the player's name.

The colour of a generated batch is unchanged: one colour per batch, derived through
`genColorToken`, so a group reads as a group.

### §5 — What must be true when this ships

- No surface displays a `gen:disc:` ref, or any fragment of one, as a creature's name.
- A token with no `name` reads exactly as it does today, everywhere.
- The Encounter Board card, the map token's label and the quick sheet header all show the
  same name for the same creature (SPEC-032 §4's agreement rule, now over a stored field
  rather than a derived one).
- A `.vttcamp` round-trips `name` identically (RULE-014).
