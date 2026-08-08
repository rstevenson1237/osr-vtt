## SPEC-027 — Presence & seat lifecycle

**Status: Completed**

### SPEC-027 §1 — RTDB presence channel

There is currently **no presence model.** `players/{uid}` is a durable Firestore doc with
no liveness field, removed only by explicit GM action. The only liveness signal in the
system is the cursor node, and it is unusable as presence: cursors publish on pointer
movement over the map, so a player reading their character sheet for ten minutes is
indistinguishable from one who closed the tab.

Add a proper channel at `rooms/{roomId}/presence/{uid} = { uid, name, ts }`.

- **RTDB, not Firestore** — high-frequency ephemeral state, exactly what RULE-003
  assigns to RTDB. It costs nothing meaningful.
- **Heartbeat every 45 s** (`PRESENCE_HEARTBEAT_MS`), refreshing `ts`.
- **`onDisconnect(presenceRef).remove()` armed once per room+uid**, using the same
  guarded one-time pattern as `publishCursor`.
- Armed on join and on room re-entry; torn down on `RoomShell` unmount.

**Rules** (`database.rules`) mirror the cursor guards exactly:

- `rooms/$roomId/presence/$uid` — write only where `$uid === auth.uid`; the own-uid-only
  guard is the whole point and must have a test asserting a client cannot write someone
  else's presence.
- **An explicit `.read` at the parent `presence` collection node.** This is the
  documented trap: `onValue()` listens at the parent, RTDB rules cascade _down_ and not
  up, so a `.read` declared only on the `$uid` wildcard leaves `subscribePresence`
  silently never firing. `database.rules.test.ts` already has a "parent-collection reads"
  describe block — add `presence` to it.
- The existing `$roomId` delete-only allowance (`.write: !newData.exists()`) must
  continue to cover the presence subtree so `deleteRoom` still removes the whole node.
  The Gate 10 e2e assertion that the RTDB node is gone after deletion must stay green.

**Store interface** (contract tests on both `MemoryStore` and `FirebaseStore`, per
RULE-001):

```ts
/** Live presence for a room (SPEC-027 §1). Own-uid-only writes, RTDB-backed,
 *  self-cleaning via onDisconnect. Heartbeat is managed internally. */
publishPresence(roomId: string, name: string): void;
clearPresence(roomId: string): void;
subscribePresence(roomId: string, cb: (present: PresenceEntry[]) => void): Unsubscribe;
```

### SPEC-027 §2 — Two distinct states: disconnected vs. abandoned

The critical distinction — conflating these leads either to seats vanishing mid-session
or to seats never being cleaned up at all.

| State            | Signal                                                                         | Effect                                                                                             | Reversible                   |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Present**      | presence node exists, `ts` within 2× heartbeat                                 | normal                                                                                             | —                            |
| **Disconnected** | presence node absent (or `ts` stale)                                           | row dimmed in `PlayersPanel`; token rendered at reduced opacity on the map; **seat doc untouched** | yes, instantly, on reconnect |
| **Abandoned**    | seat exists and has had no presence for `ABANDONED_SEAT_DAYS` (default **30**) | listed in Session → Maintenance for GM review                                                      | via GM action only           |

Disconnection is a _display_ state and carries **no data consequence whatsoever**. A
player who closes their laptop for a week and comes back finds their seat, their
character, and their tokens exactly as they left them.

**Tracking "abandoned" requires a durable field**, since presence itself is ephemeral by
construction: add `lastPresentAt: number` to the `PlayerSeat` doc, written on the _first_
presence publish of a session and then at most once per hour thereafter (same throttle
discipline as SPEC-026 §1). Seeded on join. Pre-migration seats get the migration
timestamp, not zero.

> **⚠️ Amended in implementation (WI-026).** `lastPresentAt` is **not** backfilled,
> contrary to the sentence above. It cannot be: `migrateRoom` only ever sees the room
> doc, and this is a field on `players/{uid}`. The _intent_ (existing seats must not read
> as abandoned) is met more robustly by absence itself. Successor: `README.md` §
> "Presence & seat lifecycle (II.10)".

### SPEC-027 §3 — Prune inactive seats (GM)

New block in Session → Maintenance, alongside the existing prune and delete-room
controls: lists seats whose `lastPresentAt` exceeds `ABANDONED_SEAT_DAYS`, with per-seat
checkboxes and a confirm step. Reuses the existing seat-removal path, including its "also
delete character sheet" option — a player who has been gone a month may still have a
character the GM wants to keep.

**Never automatic. Always GM-confirmed. Never touches a seat with live presence.**
