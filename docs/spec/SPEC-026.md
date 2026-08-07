## SPEC-026 — Room lifecycle & dead data

**Status: Completed**

### SPEC-026 §1 — `lastActivityAt` on the room doc

**The missing input to every automatic cleanup decision.** Today nothing can distinguish
a live room from an abandoned one. `users/{uid}/rooms/{roomId}.lastSeenAt` exists but is
per-user, self-owned, rules-denied to every other user, and explicitly best-effort —
nothing can scan it.

Add `lastActivityAt: number` to the room doc (`schemaVersion` bump + migration +
round-trip test, per RULE-007).

**Write policy — this must not undermine write discipline:**

- Written only on **settled** writes (the same moments that already produce a Firestore
  write: drag-end, stroke release, roll resolution, profile save, token add/remove).
- **Throttled client-side to at most once per 5 minutes per client**
  (`ROOM_ACTIVITY_THROTTLE_MS`). An in-memory timestamp guard in `FirebaseStore`, not a
  stored one.
- Never written from RTDB paths, never from cursor movement, never on a timer
  independent of real activity.

Net cost is at most 12 additional writes per client-hour, and in practice far fewer.

**Migration:** pre-migration rooms get `lastActivityAt` seeded to the **migration
timestamp**, not to zero — otherwise every existing room appears instantly abandoned and
the reaper offers to delete a live campaign.

### SPEC-026 §2 — Stale-room surfacing + GM-run reaper

With §1 in place, add to the Lobby's My Rooms section: entries where `role === 'gm'`
and `lastActivityAt` is older than `STALE_ROOM_DAYS` (default **90**) render with a
"dormant" affordance offering **Export**, **Delete**, or **Keep** (dismiss for another
90 days, stored in the user's own index entry).

This is a _surface_, not an automatic deletion. **Nothing deletes a room without the GM
pressing the button.** It reuses the existing, well-tested `deleteRoom` recursive delete
(SPEC-006 §3) and the existing export path — no new destructive code.

Rooms where the user is a player, not GM, are out of scope: they aren't the user's to
delete, and a dangling entry already renders as a "room gone — remove?" row
(SPEC-006 §2).

### SPEC-026 §3 — RTDB leak closure

Two concrete leaks in the ephemeral layer, both the exact class `onDisconnect` exists
for:

1. **Pings** self-expire via `setTimeout(() => remove(pingRef), PING_TTL_MS)`. If the tab
   closes inside that 3-second window the timer dies with it and the node leaks
   permanently. **Fix:** arm `onDisconnect(pingRef).remove()` at push time, alongside the
   existing timeout. The timeout stays as the normal path; `onDisconnect` is the crash
   path.
2. **Drag frames** are cleared by an explicit `clearDrag`, with no fallback. A client
   that crashes or closes mid-drag leaves the node behind. **Fix:** arm
   `onDisconnect(dragRef).remove()` in `publishDrag`, guarded per room+token with the
   same `Set`-based one-time pattern `publishCursor` already uses for cursors — the hot
   per-frame path must arm it only once.

### SPEC-026 §4 — Firestore TTL on `rolls` — verification · **✅ VERIFIED (2026-08-01): no policy, and none wanted**

> **Outcome.** The console was checked: **no TTL policy exists on `rolls`**, and the
> decision is to leave it that way (outcome 1 below). The SPEC-006 §4 prune button
> (`pruneEntriesBefore`, Session → Maintenance) stays the only expiry mechanism —
> referee-driven, visible, and already tested. §4 is closed; nothing further to
> configure and no code to write.
>
> Anyone reopening this must read the finding below first: pointing a policy at `Roll.ts`
> would be accepted by the console and then silently delete nothing.

SPEC-006 §4 lists a TTL policy on a `ts`-derived field as optional belt-and-braces,
console-only setup. **[HUMAN]** verify in the console whether this was ever actually
configured. If not, configure it now (behind the SPEC-006 §4 prune button, which remains
the primary mechanism).

> **Finding (WI-027).** As shipped, **a TTL policy cannot be pointed at `Roll.ts`**:
> Firestore TTL requires the named field to be of type **Timestamp**, and `Roll.ts` is a
> plain `number` (epoch ms) — the same representation every other `ts` in the schema uses,
> chosen so the dice engine's determinism and the log pager's `where('ts', '<', …)`
> comparisons work on ordinary numbers. A policy naming a non-Timestamp field is accepted
> by the console and then silently deletes nothing, which is worse than no policy at all.
>
> So §4's verification has three possible outcomes, and the choice is a `[HUMAN]` one:
>
> 1. **No policy exists → leave it that way.** The SPEC-006 §4 prune button
>    (`pruneEntriesBefore`, Session → Maintenance) already deletes log and roll docs older
>    than a chosen date, is referee-driven, and is the documented primary mechanism. TTL
>    was only ever belt-and-braces.
> 2. **No policy exists → make TTL possible.** That is a code change, not a console one: add
>    a companion `expiresAt: Timestamp` written alongside `ts` in `writeRoll`, point the
>    policy at it, and accept that existing roll docs (which have no such field) are never
>    swept and remain the prune button's job.
> 3. **A policy already exists naming `ts`.** Then it has been deleting nothing since the day
>    it was created and should be removed, to avoid the standing false belief that rolls
>    expire on their own.
