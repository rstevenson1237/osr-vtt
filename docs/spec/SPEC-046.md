## SPEC-046 — The view tools are transient, and can be aimed

**Status: Active**

The Eye and the Ping are the two View tools that leave a mark. Neither is committed to a
document and neither makes an undo entry, but both currently behave as though the referee
will tidy up after them: a ping vanishes without warning at a fixed three seconds, and an
eye stays exactly where it was clicked until something else clears it. This spec says how
long each mark lives, how it says so, and — in §2 — what it may be aimed at.

Two independent sections, both now specified. §1 shipped alone (WI-099, 2026-09-03); §2 was
reserved while DEC-084 was open and was written once that closed (user, 2026-09-07), so the
two halves of the same request keep one spec between them.

**What does not move, in either section.** A ping stays on RTDB (RULE-003 — it updates many
times per second across a table and is never durable state), keeps its per-node
`onDisconnect().remove()` (SPEC-026 §3), and stays a `push()` id per ping so there is
nothing to de-duplicate. Neither tool gains an undo entry or writes to Firestore. Both stay
in the View group (`VIEW_TOOL_IDS`) and remain available on a battle map and a hex crawl,
where the View tools are the whole palette.

---

### §1 Both marks expire, and both show that they are expiring

**The defect, in two halves.**

**The ping already expires and does not look like it.** `PING_TTL_MS = 3000` is enforced
identically in `firebase-store.ts` and `memory-store.ts`, and `subscribePings`' contract
comment already promises "self-expires from RTDB". But `renderPings` draws
`circle(0, 0, 14)` at a constant stroke and full opacity for the whole three seconds and
then removes the node. The mark gives the table no notice, so a player who looks up a
second late sees nothing and cannot tell whether they missed a ping or none was sent.

**The eye does not expire at all.** `eye` is a `$state<Point | null>` in `VectorMapView`,
set on click and cleared only by clicking elsewhere or changing tool. A referee who checks
a sightline and moves on leaves a translucent visibility polygon and a dot on the map for
the rest of the session.

**The behaviour.**

1. **Both marks carry a lifetime and animate it.** The remaining life is legible from the
   mark itself — opacity, radius, or both — so that "this is about to go" is visible
   without a number. The ping's ring reads as counting down rather than merely fading out
   of existence.
2. **The ping's lifetime stays 3s** and stays enforced where it is enforced now, in the
   store implementations. §1 changes what `renderPings` draws over that window, not how
   long the RTDB node lives. If the constant does move it moves in **both**
   implementations together, and `rtdb-leaks.test.ts` covers the Firebase one.
3. **The eye gets a lifetime of its own,** enforced client-side in `VectorMapView` — it is
   local state that no other client ever sees, so there is nothing to expire from a store.
   It clears itself, and the visibility polygon goes with it.
4. **The eye's countdown does not strand the fog reveal.** `MapToolController.canRevealFromEye`
   is true exactly while an eye is placed and fog is on, and it is the sole gate on "reveal
   what the eye can see". An eye that clears itself turns that action off underneath a
   referee who is deciding whether to use it.

   **The rule: the eye's countdown does not run while `canRevealFromEye` is true.** The eye
   expires when it is decoration; while it is an input to a pending action it stays until
   the referee acts or moves on. This is stated here rather than left to whatever the timer
   does, because "the button disappeared while I was reaching for it" is the failure the
   countdown would otherwise introduce.
5. **Nothing about placement changes.** The eye is still placed by a click, the ping is
   still published by a click, and both still take the raw pointer position.

**Testids.** No `data-testid` moves, is renamed, or is removed (RULE-005). The Eye and Ping
palette buttons keep theirs.

> **Work item: WI-099.**

---

### §2 A mark may be aimed at a token

The request (IN-087) is that either tool may pick a token rather than open floor, so that the
thing becomes the focus rather than the patch of map it happens to be standing on — and, the
user's own question, that a ping on a token has a visual that says so.

**DEC-084 answers it (b), with a drop-on-move rider** (user, 2026-09-07). The section below is
that answer stated as behaviour.

**Nothing is published about the target.** `publishPing(roomId, pos)` keeps its signature and
`PingPos` keeps its `{ id, uid, x, y, ts }` shape. Aiming is resolved at **click time**: the
tool hit-tests the pointer, and if a token is under it the ping is published at **that token's
current position** instead of the raw pointer position. A ping on open floor is unchanged.
**No store contract changes**, `campaign-store.contract.ts` is untouched, and the RTDB path,
the `PING_TTL_MS` timeout and the `onDisconnect().remove()` crash path are all as they were.

**The mark is dropped when the token moves.** A ping aimed at a token means *this one*, and it
means it only while the token stays put; a mark that trails a moving token is a different
feature. So:

- On first seeing a ping, **each client** hit-tests its own token state at the ping's point and
  remembers what it found. This is local render state, keyed by the ping's `id`, and is never
  published.
- While a remembered token stays within the mark, the ping draws as below. Once that token has
  moved off, the client **stops drawing that ping** for the remainder of its life.
- A ping that resolved to no token on first sight is a floor ping and is never dropped early —
  it lives its full `PING_TTL_MS` as §1 specifies.
- The RTDB node is **not** removed early. Dropping is a render decision, not a write; the node
  still expires on its own unchanged timeout.

**Clients may disagree, and that is accepted.** Because nothing is published, two clients can
resolve the same ping differently — a token dragged at the moment of the ping may be caught by
one and missed by another. This is bounded by the three-second life, breaks no state, and sits
inside RULE-008 (all players are trusted; there is no authoritative server). It is the same
posture RULE-013 takes when every client derives dice faces locally rather than reading
published ones.

**The visual: the same gesture, aimed.** A token ping must not read as a new kind of mark.

- The ring is drawn **concentric with the token**, at the token's radius plus a small gap, so it
  sits outside the SPEC-022 status ring rather than competing with it.
- It **pulses inward** — collapsing toward the token over the mark's life — where §1's floor
  ping expands outward from its point. Converging says *this one*; diverging says *here*.
- The pinging player's colour and the existing stroke weight are unchanged, so the two read as
  one feature.
- **The status ring is untouched.** A ping is transient and a status is not; overloading the
  status ring would make a three-second mark look like a state change.

**The Eye needs no visual of its own.** Its half is local state either way: the eye dot is
placed at the token's position at click time. Under this section it does not track a moving
token, for the same reason the ping does not.

**What this section deliberately does not do.**

- **It does not target map objects.** DEC-084 (d) — targeting rooms, symbols or doors — needs a
  single id space that does not exist, and stays deferred. Note it is **no longer additive**
  from here: since nothing about the target is published, widening later is a fresh design
  rather than a new optional field.
- **It does not follow a moving token.** That was DEC-084's own recommendation (a) and was not
  taken; reviving it means reopening DEC-084, because it requires a published target id.
- **It stores nothing new.** No schema, no migration, no rules change, no `.vttcamp` coverage.

> **Work item: WI-112.** Independent of §1, which has already shipped (WI-099).
