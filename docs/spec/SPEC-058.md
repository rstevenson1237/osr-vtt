## SPEC-058 — Disconnected: a banner and a read-only room

**Status: Active** — DEC-121 (user, 2026-09-27); scheduled as WI-201.

_(New with IN-219, the reversal out of WI-186; absorbs IN-215. It **replaces**
SPEC-054 §10's second bullet (the Reconnecting… banner) and SPEC-056 §4 (the offline cache
and its "Offline — changes will sync" banner). No `R`-number predecessor.)_

### §1 — A connectivity read on the store (RULE-001)

`CampaignStore` gains `subscribeConnection(cb: (connected: boolean) => void): Unsubscribe`.

- `FirebaseStore` reads RTDB `.info/connected`, passing each value through.
- `MemoryStore` and `LocalStore` call `cb(true)` once and never again.
- The contract suite pins, on all three stores: the first callback fires once; after
  unsubscribe no callback fires. The Firebase half additionally pins that the first
  settled value against a running emulator is `true`.

Firestore keeps the SDK's default memory cache. No `persistentLocalCache` is configured.

### §2 — Disconnected (hosted build)

`RoomShell` subscribes once per room. After the client has reported `false` **continuously
for 2 s**, the room is **disconnected**; the first `true` ends it immediately.

While disconnected:

1. A banner reading **Disconnected — reconnecting…** shows over the stage, with the lobby
   link and Sign out reachable from it (`data-testid="connection-banner"`).
2. The rest of the shell is `inert`: visible at its last snapshot, but no pointer, focus or
   text input reaches it. The global keyboard handlers in `RoomShell` and the map view
   return early.
3. Nothing in flight is cancelled: a write already issued before the drop is left to the
   SDK's queue and flushes on reconnect (still one settled write each, RULE-003).
4. RTDB ephemera (cursor, drag frames, pings) are not special-cased; they resume on
   reconnect as today.

The local build's store is always connected, so it never shows the banner or locks
(RULE-009).

### §3 — Tests

- Contract: §1's cases on all three stores.
- Unit: the 2 s debounce and the immediate unlock, as a pure helper with a fake clock.
- e2e: the banner and the inert shell are driven through a test-only override of the
  connection signal (the emulator cannot be dropped per-page); the local-build e2e asserts
  the banner never appears.
