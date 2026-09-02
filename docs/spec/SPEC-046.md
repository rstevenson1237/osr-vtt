## SPEC-046 — The view tools are transient, and can be aimed

**Status: Active**

The Eye and the Ping are the two View tools that leave a mark. Neither is committed to a
document and neither makes an undo entry, but both currently behave as though the referee
will tidy up after them: a ping vanishes without warning at a fixed three seconds, and an
eye stays exactly where it was clicked until something else clears it. This spec says how
long each mark lives, how it says so, and — in §2 — what it may be aimed at.

Two independent sections. §1 ships alone; §2 is blocked on DEC-084 and is reserved here so
the two halves of the same request keep one spec between them.

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

### §2 A mark may be aimed at a token — _reserved, blocked on DEC-084_

The request (IN-087) is that either tool may pick a token or an object rather than open
floor, so that the thing becomes the focus rather than the patch of map it happens to be
standing on — and, the user's own question, that a ping on a token has a visual that says
so.

**This section is deliberately empty of specified behaviour.** Its content is what DEC-084
decides: what a ping carries (an optional target id resolved at render, versus the target's
point resolved at click time), whether the target may be any pickable object or tokens
only, what happens when the target is deleted or its group collapses mid-ping, and the
visual language for a ping that is attached to a token rather than to a point.

**What is already fixed, whatever DEC-084 answers.** The Eye's half is local state and
changes no contract. The Ping's half changes `publishPing`'s signature and `PingPos`'s
shape, which is a `CampaignStore` contract change: RULE-001 requires it in
`campaign-store.contract.ts`, passing against `MemoryStore`, `FirebaseStore` **and**
`LocalStore` (RULE-009's amendment makes the local store a third implementation of the same
contract, not a fork). The store it writes to does not change — RULE-003 keeps a ping on
RTDB.

> **No work item.** Scheduled only after DEC-084 is answered.
