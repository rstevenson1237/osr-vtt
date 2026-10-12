## SPEC-070 — A room a newer build has opened stops the stale tab

**Status: Draft** — DEC-137 (user, 2026-10-12); to be implemented by WI-233.

_(New with IN-231. Covers IN-229, IN-230, IN-231 and IN-232 together, per
`docs/completed/WI-225.md` §6. The live-room twin of SPEC-062, which refuses a newer
`.vttcamp`.)_

### §1 — What counts as a newer room

A room doc is **newer** when, read from the **raw stored data** before `migrateRoom` or
`RoomSchema` touches it, either number is greater than this build's
`CURRENT_SCHEMA_VERSION`:

- `schemaVersion` (the build that created or imported the room); or
- `collectionsMigratedTo` (stamped by the referee tab of every build above the stamp, so the
  high-water mark of the newest referee to open the room).

A field that is missing or not a number counts as `0`. The check runs before the parse, so
it also catches a room whose newer shape no longer parses (IN-232).

`schemaVersion` is never re-stamped by this item: the stored doc stays in its creation
shape and every read relies on `migrateRoom` walking it forward from that number.

### §2 — What the store delivers (contract change, RULE-001)

- `subscribeRoom`'s callback may receive a third kind of value, `NewerRoom`
  (`{ newer: number }`, the higher of the two numbers in §1), in place of a `Room`. The
  subscription stays open: if a later snapshot is not newer it delivers a `Room` again.
- `getRoom` rejects with a `NewerRoomError` carrying the same number.
- A doc that is not newer but still fails `RoomSchema` keeps today's behaviour; this item
  does not change how a malformed same-version room is handled.

`MemoryStore` and `LocalStore` implement the same check on the doc they hold. They only
ever hold rooms their own build wrote, so in practice they never deliver `NewerRoom`, but
the contract suite drives a seeded newer doc through all three stores
(`campaign-store.contract.ts`).

### §3 — The room view stops

When `RoomShell` receives `NewerRoom` it unmounts the room view and renders a stop panel in
its place: "This room was updated by a newer version of the app. Reload to continue." with
a Reload button (`location.reload()`). Every write path WI-225 §2 lists is reached from
inside the room view, so unmounting it stops them all. New `data-testid`s:
`newer-room-panel` and `newer-room-reload` (additive, RULE-005).

The panel names this build's `VITE_APP_VERSION` only when it is not `'dev'` (IN-233). The
room does not record the newer build's version string, so the panel never names it.

### §4 — Accepted gap

A newer **player** tab never stamps the room (room writes are GM-only, RULE-004), so until a
newer referee opens the room a stale referee tab has no signal. The data a player can create
in that window is mostly their own macros and drawings (WI-225 §3, inferred). Closing this
gap needs a rules change and is not part of this spec.

### §5 — Tests

Contract cases for `subscribeRoom` and `getRoom` on a newer doc (each number alone, both,
and a doc that would fail `RoomSchema`), plus the return to a `Room` when the stamp is not
newer. A converter unit test asserts `migrateRoom` is not called for a newer doc. A
component or e2e test renders the stop panel and its Reload button.
