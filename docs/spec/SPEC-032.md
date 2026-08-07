## SPEC-032 — Creatures are actors: profiles, ownership and selection

**Status: Completed** (2026-08-03) — shipped as WI-054 – WI-057 (IN-030; DEC-034, DEC-035,
DEC-036).

_(New with WI-054; no `R`-number predecessor.)_

### §1 — The problem: selection is keyed to a seat

A creature token has no owning seat, and the selection spine is seat-keyed end to end:
`EncounterBoard.selectCard()` → `onSelectActor(seatId)` → `RoomShell.selectActor(seatId)`
→ `selectedSeatId` → `canSeatActAs(..., targetSeatId, ...)` → `store.setCurrentCharacter`,
after which `CharacterDock` resolves a `ProfileInstance` from that seat. A creature cannot
enter that chain at any point, so its card is not merely unresponsive — `selectable`,
`role="button"` and `tabindex` are all gated on `Boolean(token.ownerSeatId)`, so it is not
focusable and does not advertise itself as clickable either.

The motivating case is an **NPC travelling with the party**: in the group, owned by no
single player, and therefore manipulable by no player at all.

### §2 — The actor key (standing constraint)

`rooms/{roomId}/profiles/{id}` is keyed by an **actor id**, which is either:

- a **seat id** — a character, as today; or
- a **token id** — a creature.

Creatures reuse the room's existing `profileTemplate`. `encounterTemplate` is **not** the
vehicle: it is one instance per room (`Encounter.values`), not per actor.

This is a change to the meaning of a stored document key, so RULE-007 applies in full: a
migration, a migration test, and a `.vttcamp` round-trip test. Existing seat-keyed
documents are unchanged by the migration — what changes is that the key space widens.

**Shipped in WI-054 as schema v21.** `ProfileInstance.seatId` is named `actorId`; the
v20→v21 step is a no-op on the room doc _and_ on every stored profile, because a seat id
is still a valid actor id and the renamed field is the document id, which never reaches
storage. The bump stamps `.vttcamp` archives, as v17→v18 and v19→v20 do.

**The SPEC-031 colour guarantee does not follow the key** (DEC-042). "Every character has
a colour" is a statement about characters; a creature has none behind it, so
`resolveCharacterColor` still takes a **seat** id, `.vttcamp` import backfills only
profiles whose id appears in the archive's own `players` roster, and a creature's colour
is whatever `ProfileInstance.color` actually holds — `undefined` included, exactly as
`Token.color` already works.

**`deleteToken` must enumerate the profile.** It currently deletes the token document and
nothing else, so a token-keyed profile would leak on every creature deletion. This is the
same collection-enumeration duty the vector cutover's M2 imposed on `deleteRoom`.

**`firestore.rules` is unchanged.** `profiles/{seatId}` is already member-writable rather
than own-seat-only — group ownership required that — so a token-keyed document in the same
collection is already governed correctly. This is the decisive argument for widening the
existing collection rather than adding a second one.

### §3 — Ownership for a seatless actor

`canSeatActAs` resolves a character by finding a group that lists me **and** holds a token
whose `ownerSeatId` is the target seat. That inner test can never pass for a seatless
creature.

For a token-keyed actor the rule is one step shorter: **is this token in a group I own.**
The referee's membership stays derived from `Room.gmUid` and is never stored, exactly as
`canSeatActAs` already has it. `canSeatActAs` is **not replaced** — a character is still
reached through its seat; it gains a token-keyed sibling.

**Shipped in WI-055** as three exports from `encounter/ownership.ts`:
`actorIdForToken(token)` (the §2 key rule, in one place), `canActOnToken(...)` keyed by a
token id — what §5's map drag will ask — and `canActOnActor(...)` keyed by an actor id —
what the selection spine carries. Both predicates share one internal, so the two faces
can never drift. An actor id is a creature's **only when a seatless token answers to
it**; every other id, including an unknown one, falls to `canSeatActAs`, which keeps "a
seat may always act as itself" true for a seat that holds no token yet (DEC-043).

WI-055 also re-keyed the selection contract, which §4 depends on and §1 describes as
seat-keyed end to end: `onSelectActor(actorId)`, `RoomShell.selectedActorId` /
`dockActorId`, `EncounterBoard.selectedActorId`, `VectorMapView.selectedActorId` and its
`selected-actor` readout (renamed from `selected-seat`, DEC-044), with `dockReadOnly`
asking `canActOnActor`. The §4 rule that a creature **never** writes
`PlayerSeat.currentCharacterSeatId` is enforced in `selectActor` from that point on. What
WI-055 deliberately did not do is dispatch any creature id: card selectability and the
quick sheet are WI-056, map drag is WI-057.

### §4 — Selection

Every card, player or creature, is selectable — this was already true of every character
card before this spec (gated on `Boolean(token.ownerSeatId)`, unconditionally, never on
group ownership), so a creature's card drops the same gate rather than gaining a
narrower one (DEC-045). A selected creature opens its profile in the quick sheet,
rendered from the same `profileTemplate` as a character's, and subject to the same §2.5
hard rule: the app never interprets a field's value. **Editing** it is the §3 predicate's
job, exactly as it already was for a non-owned character — selection and authority are
different questions, and only the second is ownership-gated.

`PlayerSeat.currentCharacterSeatId` is defined as "the seat whose character this player is
currently playing" and has **no reading for a creature**. Selecting a creature is a view
state, not a change of played character, and must not write that pointer.

**Shipped in WI-056.** `EncounterBoard`'s card drops its `ownerSeatId` gate on
`selectable`/`role`/`tabindex` and dispatches `actorIdForToken(token)` unconditionally;
its pinned-field and roll-shortcut rows resolve the same way, so a creature with a
profile shows both. `CharacterDock` (renamed prop `seatId` → `actorId`) branches on
`actorIdForToken` throughout: a creature has no `resolveCharacterColor` guarantee
(DEC-042) — its swatches start with none selected until one is picked — no "My token"
action (it already is one), and its header name falls back to the same id-derived label
(`creatureLabel`) the board's own card uses, since it has no seat `displayName` to show.

### §5 — Map drag

Token drag on the map is gated on the §3 predicate. Today it is ungated — `syncSprites`
makes every rendered token interactive and `attachDragHandlers` performs no ownership
check at all — so this is a **capability removal**, taken deliberately.

The check belongs **inside** the `pointerdown` handler, which closes over live reactive
`tokens`/`groups` state and therefore re-evaluates on every press. Attaching it at sprite
creation would go stale the moment group membership changed, because sprites are cached in
`spritesByToken`. `sprite.eventMode` and `cursor` are set alongside it in `syncSprites` so
the affordance matches the rule. A collapsed group's anchor is tested by the same
predicate, since dragging it moves every member.

**An ungrouped, seatless token is referee-only** (DEC-036) — scenery, and the single
creature `addCreature` leaves ungrouped. It matches no ownership rule, so it needs a
default, and referee furniture is the honest reading. Reversible in one predicate.

**Shipped in WI-057.** `attachDragHandlers`'s `pointerdown` calls `canActOnToken(groups,
tokens, myUid ?? '', tokenId, isGM)` before starting the drag; selection itself
(`selectedTokenId`, and `onSelectActor` for an owned character) stays unconditional, so a
token this seat may not act on is still inspectable, it simply does not move —
`tokenDragging` never starts, and the move/up handlers already no-op when it is false.
`syncSprites` sets the cursor to the same predicate (`grab`/`pointer`) whenever the token
is not mid-drag; `eventMode` stays `static` for every token regardless, since selection
still needs the pointer events.

### §6 — Out of scope

**Nothing here touches the carve tools.** Floor and wall editing stay open to every room
member, per DEC-001's ratified player-mapping goal. This spec gates who may move and
inspect _actors_, never who may build the map.
