## SPEC-048 — The token letter is stored data

**Status: Active**

A token's letter — the "A" that tells one goblin from another — does not exist as data today.
It is a substring of `Token.imageRef`, inside a `gen:disc:{label}:{colorToken}` recipe that
`AssetStore.resolve` renders to an SVG data URI. That is a deliberate design, and
`usedGroupLetters` states it:

> Reads them back out of each member's `gen:disc:{LABEL}:` ref, **which is where the symbol
> actually lives — there is no separate stored letter, and adding one would be a second source
> of truth for something the art already encodes.**

This spec reverses it. The letter becomes a stored field, it is drawn **over** whatever art a
token has rather than baked into art of its own, and the ref scheme that carried it is retired.

**What this supersedes, and what it does not.** It rewrites **SPEC-040 §4**, which is the text
that placed the letter in the ref. It does **not** reopen **DEC-072**: uppercase, unique within
the group, restarting at A — that answer survives untouched, because it ruled on *what the
letter is*, never on *where it lives*. **DEC-086** and **DEC-087** are this spec's two inputs.

Five sections. §1 is the data and everything else reads it; §§2–5 run in order, and each leaves
the app in a shippable state — no section may land a build where a token that had a letter has
stopped showing one.

**What does not move, in any section.** A letter is display only: nothing reads it, compares it,
or derives behaviour from it (RULE-002). Seat letters stay a separate room-wide scheme
(`seatLetterFor`) and may still collide with group letters freely. `Token.color` keeps its
meaning and format.

---

### §1 The letter is a field

`Token` gains **`letter?: string`** beside `name` and `color`, which are the two precedents for
exactly this move — an optional display field whose absence is a legitimate state.
`ProfileInstance` gains the same pair it needs to draw a portrait without a ref: **`letter?`**
and, where it has none, `color?`.

**`Token.imageRef` becomes optional.** It is required today (`imageRef: string`), and a token
whose identity is a letter has no art. After this spec `imageRef` means **real art only** — a
bundled ref, a saved URL, an upload — and its absence means "draw the letter on the colour".

**The render cap stays 3.** `GEN_TOKEN_LABEL_CAP` is unchanged (user, 2026-09-08 — *"make the
render cap 3 globally so we aren't changing the existing standard"*). Every surface that accepts
a letter accepts up to 3 glyphs, counted in Unicode code points as it is today, so one emoji is
one glyph.

**Store methods.** Setting a letter is a new call on the `CampaignStore` contract, added here
with the field. It goes in `campaign-store.contract.ts` and passes against `MemoryStore`,
`FirebaseStore` **and** `LocalStore` (RULE-001, and RULE-009's amendment makes the local store a
third implementation rather than a fork). One settled write per change — a letter is typed, not
dragged, so RULE-003 is not in play.

---

### §2 The migration, and the three things it must decide

Schema **v30**, with a migration, migration tests and a `.vttcamp` round-trip (RULE-007,
RULE-014 — and RULE-009 makes that file the database in a local build, so a dropped letter is a
lost campaign, not a lost export).

**The migration backfills; it does not clear.** Every stored `gen:disc:{label}:{color}` ref —
`Token.imageRef` **and** `ProfileInstance.portraitRef` — is parsed, and its label and colour are
written into the new fields. **`imageRef` is left exactly as it is.** Nothing changes visibly at
this step: the old ref still resolves and still draws, and the new fields sit unread. Clearing
the refs is §5's job, after §4 has given the letter somewhere else to be drawn.

This is what keeps every intermediate state shippable, and it is the whole reason the work
splits the way it does.

**The three questions DEC-087 handed here, answered.**

1. **`hsl()` → `#rrggbb`.** A ref bakes an `hsl(...)` paint value; `Token.color` is validated
   hex, the format `GameMap.background` and `MapBackground` already use. The migration converts,
   and the converted value is what both the disc and any later colour pick use — the two must
   never diverge, which is the failure `parseGenTokenRef` exists to prevent today.
2. **`imageRef` optional.** Carried by the same version bump, per §1.
3. **Pre-v28 `a1`/`a2` refs migrate verbatim.** They render as "a1" today and, being lowercase,
   **never consumed a group letter** (`CREATURE_GEN_RE` is uppercase-only). Their label is copied
   into `letter` unchanged — so a referee sees exactly what they saw — and §3's assignment
   continues to skip them. **Nothing a referee is looking at changes, and no existing map's
   lettering shifts.** The alternative, normalising them to uppercase, would have renumbered
   live groups, which is precisely the silent change RULE-007 exists to force into the open.

---

### §3 Assignment reads the field

`usedGroupLetters` stops parsing `/^gen:disc:([A-Z]+):/` out of `imageRef` and reads
`Token.letter`. `nextCreatureLetters` and `defaultCreatureRefs` are unchanged in behaviour and
change in mechanism: they still hand out the **lowest unused uppercase letter within the
group**, still restart at A per group, still continue AA, AB past Z.

**The exclusions survive, and now have to be stated rather than implied by a regex.** Three
kinds of member do not consume a letter, and each keeps its reason:

| Skipped | Why |
| --- | --- |
| a token with an `ownerSeatId` | seat letters are a separate room-wide scheme (SPEC-040 §4) |
| a token whose `letter` is absent | bundled art, a saved URL, an upload — it has no letter to hold |
| a token whose `letter` is not a plain uppercase run | hand-typed labels and the migrated `a1`/`a2` refs, as §2 rules |

The last row is the one the old regex did for free. Written as data it needs an explicit
predicate, and `labels.test.ts` pins all three.

**`defaultCreatureRefs` is renamed for what it now returns** — letters and one shared colour,
not refs. The batch colour is unchanged: one colour per batch, seeded from the creature's name
through `creatureBatchColor`, so a second batch of Goblins matches the first.

---

### §4 The letter is drawn over any art

The letter becomes a **render pass on the token layer** — the first text ever drawn on a token —
instead of a shape inside the token's texture. This is what makes the request's headline true: a
token with an uploaded image can carry a letter, because the letter is no longer competing for
the `imageRef` slot.

**The two-tone rule (DEC-086, answered (a)).** The colours key off whether the token has a seat:

| Token | Reads as | Letter |
| --- | --- | --- |
| has an `ownerSeatId` | somebody's character | **white text, black outline** |
| no `ownerSeatId` | a creature or scenery | **black text, white outline** |

**The rule is named for what it tests.** It answers *"is this somebody's character?"* — **not**
*"who created it"*, which nothing records. `createToken` stores no author, and `tokens` is
`isMember() || isGM()`, so a player may create a creature; that creature reads as a creature.
This is accurate for the question a referee scanning a map is asking and inaccurate about
authorship, and the spec says so rather than letting the code imply otherwise.

**The outline is load-bearing, not decoration.** Because the text colour no longer consults the
disc's lightness — this rule *replaces* `discStyle`'s contrast flip (R7.1, `README.md` §II.7)
rather than extending it — black-on-a-dark-disc and white-on-a-light-disc are both reachable.
The outline is the only thing keeping the glyph legible, so it must be a **genuine stroke on the
glyph**: stroked text with paint-order, or a second offset draw. **The disc's existing ring does
not count**, and a build that ships the two-tone rule without a real glyph outline has worse
legibility than the one it replaced. DEC-086's alternative (d) — keep the lightness flip, add
only the outline — was offered to the user and declined, so this cost is chosen, not overlooked.

The status ring (SPEC-022) is untouched: it is state, the letter is identity, and neither
borrows the other's channel.

---

### §5 The scheme is retired

The last section removes what the first four replaced.

- **Writers stop producing refs.** `TokenPickerDialog`'s Generate-default tab and
  `CharacterDock`'s colour pick write `letter` and `color` as fields. `CharacterDock` gains the
  **letter input** the request asked for, beside `token-color-control`, capped at 3 per §1 — a
  new `data-testid`, not a moved one (RULE-005).
- **`imageRef` is cleared** for tokens and portraits whose art was only ever a `gen:disc:` recipe.
  After this, `imageRef` present means real art, exactly as §1 defines it.
- **`resolveGenTokenRef` and the `gen:` branch of `AssetStore.resolve` are deleted**, along with
  `parseGenTokenRef` and `buildGenTokenRef`.
- **`renderGenTokenSvg(label, color)` survives, demoted.** It stops being a ref resolver and
  becomes an ordinary pure function called **from stored fields**. Every surface that needs a
  resolvable image still gets one: `EncounterBoard`'s `<img>`, the picker preview, and
  `export-layers.ts`'s PNG path. Throwing it away (DEC-087 (c)) would have made the export path
  invent its own substitute.

**The deletion is the acceptance test.** DEC-087 (a) is satisfied only when the `gen:` branch is
gone — a branch kept alive for old data means the mechanic was hidden rather than removed. If §2's
migration is right, nothing needs it.

**The character sheet reaches only the player's own token.** Referee creatures are lettered from
the Generate-default tab and the encounter board; giving the referee a retype surface for a
creature's letter is out of scope here and would be its own item.
