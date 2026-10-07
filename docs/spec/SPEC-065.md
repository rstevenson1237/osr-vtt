## SPEC-065 — The Yjs transport ships the edit, not the document

**Status: Draft** — DEC-132 (a), user, 2026-10-07; WI-223 awaiting its gate.

_(New with IN-210, from WI-174's finding. Changes what `rooms/{roomId}/yjs/{docName}` holds and
what one `subscribeYState` callback means; the `.vttcamp` format is unchanged.)_

### §1 — The problem

Today the RTDB node `rooms/{roomId}/yjs/{docName}` is one base64 string: the full merged Yjs
state. `mergeYUpdate` rewrites it in a transaction and `subscribeYState` is an `onValue` on it,
so every listener downloads the **whole document** on every edit (WI-174: ~67 KB per edit for a
50 KB doc, against an edit of tens of bytes). WI-208's coalescing cut how _often_ that happens;
this spec cuts what each one costs.

### §2 — Node shape: a snapshot plus an update log

`rooms/{roomId}/yjs/{docName}` becomes an object with two children:

| Child     | Holds                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `s`       | base64 of a merged Yjs state (`Y.mergeUpdates` of everything compacted so far). Absent until the first compaction. |
| `u/{key}` | one base64 Yjs update per `mergeYUpdate` call, keyed by RTDB `push()` id.                                          |

The document's state is `mergeUpdates([s, ...u])`, in any order: Yjs updates are commutative and
idempotent, so neither the order nor a duplicate changes the result.

- **`mergeYUpdate`** is a `push()` of one update under `u`. No transaction: appends never
  conflict, so concurrent writers no longer serialise. It stays RTDB (RULE-003): a coalesced
  burst is still many small writes per minute, and no Firestore write is added.
- **`subscribeYState`** attaches `onValue` to `s` and `onChildAdded` to `u`. The first callbacks
  deliver the snapshot and the existing log; after that, each new edit arrives as **its own
  update only**. `onChildRemoved` (compaction) is ignored: removed entries are already in `s`.
- **`getYState`** reads the node once and returns `mergeUpdates([s, ...u])`. `exportRoom` and
  therefore `.vttcamp` are unchanged (RULE-014).

### §3 — Compaction

The log is folded into the snapshot by an RTDB transaction on the whole `yjs/{docName}` node
that sets `s = mergeUpdates([s, ...u])` and removes `u`. The transaction makes it safe against
a concurrent push (RTDB retries it) and against a second compactor (the loser re-runs on the
already-compacted node and finds nothing to do).

A `FirebaseStore` compacts a doc when either holds:

1. **On subscribe**, the initial log it receives has **≥ `COMPACT_AT` entries** (default 50).
2. **On write**, it has pushed `COMPACT_AT` updates to that doc since its own last compaction.

Each compaction ships the full snapshot to every listener **once**, through `s`. With WI-208's
coalescing that is one full download per ~50 typing bursts, instead of one per burst.

### §4 — The `subscribeYState` contract (RULE-001)

The signature is unchanged. The doc comment's guarantee changes from "each callback is the live
merged state" to:

> Each callback carries a Yjs update. Applying every callback received since subscribing, in
> the order received, to an empty `Y.Doc` yields the doc's current state. A store may deliver
> the full state each time (a full state is a valid update) or only what changed. `cb(null)`
> until the doc has ever been written.

`MemoryStore` and `LocalStore` keep delivering the full state: it satisfies the new guarantee
and they have no transport cost. `YRoomProvider` already applies every callback with
`Y.applyUpdate`, so it is unchanged.

The contract suite (`collab.contract.ts`) stops treating one callback as the whole state: the
concurrent-merge test applies every callback into one `Y.Doc` and asserts on that. It runs
against all three stores as today.

### §5 — Existing rooms: the lazy shape migration (RULE-007)

A room written before this change holds a bare string at `yjs/{docName}`. Writing a child under
a string would replace it and lose the notes, so before its first push or subscribe on a doc,
a `FirebaseStore` runs one **ensure-shape** transaction on the node: a string becomes
`{ s: <that string> }`; an object or an absent node is left as it is. The transaction is
idempotent and runs once per doc per store instance. A migration test seeds a legacy string on
the emulator and asserts its text survives a subscribe, a push and a compaction.

No `schemaVersion` bump: the node is RTDB, not the room document, and the `.vttcamp` snapshot
(`yjs: Record<string, string>` of merged states) does not change.

**A tab still running the previous build** after a deploy reads the new object where it expects
a string: its notes fail to load or save until it reloads. Nothing is lost, since its failed
transaction writes nothing. Accepted; the stale-tab question in general is IN-227.

### §6 — What does not change

- **Rules** (RULE-004): `rooms/$roomId/yjs/$docName` grants `.write` to any signed-in user and
  RTDB write grants cascade to descendants, so `s` and `u/*` need no new rule.
- **Room deletion** removes `yjs/` with the rest of the room's RTDB subtree, as today.
- **Consumers**: `YRoomProvider`, `RoomNotesDoc`, `NotesPanel` and `.vttcamp` import/export.

### §7 — Tests

- Contract (`collab.contract.ts`, all three stores): concurrent merges converge when every
  callback is applied; `listeners.contract.ts`'s single-listener check still passes.
- `FirebaseStore`, emulator: after a doc holds ~50 KB, one small `mergeYUpdate` reaches a second
  client's subscriber as a callback **smaller than 1 KB**; the log compacts at `COMPACT_AT` and
  the text survives; two clients compacting at once lose no edit; the legacy-string migration
  of §5.
- `portability.spec.ts` reads the Notes CRDT from RTDB directly (SPEC-036): it decodes `s` plus
  every `u` entry instead of one string.
