## SPEC-050 — Calling for initiative

**Status: Active** — scheduled as WI-134 – WI-137 (2026-09-15).

_(New with the 2026-09-15 initiative-system alignment batch — IN-130 – IN-133. The
encounter/initiative revamp itself never had a spec: it arrived from the Master Plan (R3.6) and
has been documented in `README.md` §§"Encounter board (II.3)" and "Dice (II.6)" ever since,
with `SPEC-008` Completed and deferring to the README. This spec does **not** restate the
revamp; it specifies only the four things the 2026-09-15 investigation found missing. The
README stays the account of present-day behaviour and outranks this file on it.)_

### §1 — A side's slot is `side:{groupId}` (DEC-096)

`initiativeSlotId()` keys a **side**-mode slot `side:{groupId}`, not bare `groupId`.
`firestore.rules` gains one clause: a room member may write
`sharedRoll/current/slots/{slotId}` when `slotId.split(':')[0] == 'side'`, alongside the
existing own-uid-prefix clause. `side` is a **reserved literal**, not a free string.

This is what lets a player stage their own side at all. Before it, a player pressing their
card's die in side mode — the **default** mode — wrote `slots/{groupId}` and was denied,
although `initiative-call.ts` already said a player-owned group means a human stages the slot.

The three slot shapes are now, exhaustively:

| Shape              | Who writes it        | When                                        |
| ------------------ | -------------------- | ------------------------------------------- |
| `{uid}`            | that player, or GM   | an ordinary (non-initiative) shared roll    |
| `{uid}:{tokenId}`  | that player, or GM   | Individual initiative — several per player  |
| `side:{groupId}`   | any member, or GM    | Side initiative — exactly **one** per side  |

**Exactly one slot per side is the point.** The id belongs to the side, not to whoever staged
it, so the first player to roll fills it — Workflow 2's "the first die roll a player triggers
is registered as that group's initiative roll". A scheme carrying the stager's uid would make
two slots for one tracker row whenever a side holds two player-owned tokens, and applying would
need a tie-break no spec states.

`applySharedRollToInitiative`'s side branch looks up `side:{refId}`. `slotOwnerUid` and
`slotTokenId` must not read `side` as a uid or `{groupId}` as a tokenId; callers that
discriminate get the prefix explicitly. Nothing is migrated: `sharedRoll/current` is transient
and `openSharedRoll` clears it on every call.

**Rule tests ship with it (RULE-004):** a member may write `side:{groupId}`; a member still may
**not** write another member's bare-uid slot; the GM may still write any slot id.

### §2 — A call is visible everywhere, and the Caller is room-scoped

**The call.** While `sharedRoll.kind === 'initiative'` is `staging`, every stage says so. The
indicator lives in `TurnStrip` — the one component already mounted on every stage, in
`SessionTab` and `MobileTopBar` — and reads the call's progress ("Initiative called — 2 of 4
ready"). Today the only signal is `combat-staging-note` inside `CombatTracker`, which renders
on the Encounter board alone, so a player on the Map view sees their die button behave
differently with no explanation.

**The Caller.** One caller per **room**, held on the encounter doc's existing
`Encounter.callerSeatId` — not one per group, and not free-mode-only. It renders in
`TurnStrip` for everyone and is settable by the referee from the Encounter board in **all
three** initiative modes.

The Caller is a party spokesperson: it is as useful under side-based initiative, where a whole
side acts as a unit, as it is with no tracker at all. Binding it to `mode === 'free'` is what
made it unreachable — `caller-select` and `caller-rotate` exist today inside `CombatTracker`'s
`free` branch, and `EncounterBoard` never renders the tracker in free mode, so the feature is
intact in code and unreachable in the app.

Nothing here is a schema change: `callerSeatId`, `setCaller` and `rotateCaller` all exist.

**Three stale statements are corrected by the same work item** (RULE-018): `README.md`'s
"free/caller (rotating Caller marker)" as a tracker mode, and the "Phase 4" comments on
`types.ts` (`EncounterMode`, `callerSeatId`) and `CombatTracker.svelte`'s header.

### §3 — A call stops play, and the referee can cancel it (DEC-097)

While a Call for Initiative is `staging`, a die control that is **not** this call's staging path
is **disabled and says why**. That covers the Roll sheet, the dice tray, macros, and the
referee's own `roll-button` and `roll-hidden-button` — **the referee is not exempt**.
`rollOrStage`'s existing divert of actor-bound controls is unchanged; this is a gate around
everything else.

**The referee can cancel a call.** A referee-only Cancel sets the staging doc to `resolved`
**without writing a `Roll`** and without touching the tracker. No new status value enters
`SharedRollStatus`, nothing is migrated, and no `Roll` records a roll that never happened.

Cancel is not optional polish — it is what makes the rest of this section safe. There is no
cancel today, and `combat-roll-initiative` is disabled while `readyCount === 0`, so without it
a call opened by mistake with nobody staged would disable every die in the room with no way out.

### §4 — What the tracker calls a row

`refLabel` shows what faces the players, never an internal id, resolved in this order:

1. **A side row** → the group's `name`. Groups are never unnamed: `commitRename` returns early
   on a blank name and the Unassigned-bin promote is the only creation path.
2. **An actor row for a seat-owned token** → that seat's `displayName`. A seat's token carries
   no `Token.name` **by design** (SPEC-040 §3: "a seat's name is the seat's `displayName`"), so
   the label must consult `players` — which `refLabel(entry, groups, tokens)` cannot do today,
   which is why every player character's row in Individual mode currently reads an id fragment.
3. **An actor row for a named creature** → `Token.name` (SPEC-040 §3).
4. **An actor row for an unnamed creature** → its stored `Token.letter` (SPEC-048), read as a
   creature designation rather than a name.
5. **Neither** → the existing id-fragment fallback, unchanged, as the genuine last resort it
   was designed to be.

**This stores nothing and invents nothing.** Every value above already exists; the gap is that
the label function is not given `players` and never reads `letter`. SPEC-040 §3's rule that the
migration does **not** backfill a generated name is untouched, and WI-087's annotation on
SPEC-040 §5 — that the initiative order is one of the surfaces §5 was actually about — is
satisfied by obeying it rather than by amending it.

### §5 — What must be true when this ships

- A player can stage their own side's initiative in side mode, and one side yields one number.
- A member cannot write another member's bare-uid slot (unchanged, and still rule-tested).
- Every stage shows that initiative has been called, and who the Caller is when one is set.
- No die control outside the call rolls while a call is staging, and the referee can always
  cancel out of one.
- No initiative row displays an internal id for a group, a player character, or a lettered
  creature.
