## SPEC-036 — Portability test & e2e suite stability

**Status: Completed** (2026-08-09) — WI-070. Crosswalk: none (test-suite spec, no Master
Plan `R` number). It restates the Master Plan's Gate 5 acceptance conditions only to say
how they are proven; what portability _means_ is RULE-014's, and is unchanged.

`apps/web/tests/e2e/portability.spec.ts` was the only quarantined test in the battery
(`test.fixme`, 2026-07-21). This spec states what it must assert and how, so the
quarantine can be lifted without reintroducing the flake.

### §1 — What the portability e2e proves

Four Gate 5 conditions, unchanged in substance:

1. a revealed handout reaches players;
2. two clients editing Notes at once converge with no last-write-wins stomp;
3. `.vttcamp` export → a fresh import yields identical state;
4. the import path runs the archive through `archiveToSnapshot`/`migrateRoom`.

(1) and (2) are **live-sync** properties and need two real browser contexts. (3) and (4)
are **storage** properties and need exactly one client — the exporter/importer.

### §2 — The flake, and the rule that follows from it

The quarantined test was one flow covering all four. To check what had round-tripped it
navigated the imported room's UI, which meant activity-tab clicks against a Pixi/WebGL
stage that the post-import navigation had just torn down and remounted. In headless CI the
tab intermittently went unresponsive and a later click hung until the 180s timeout —
observed at different clicks across runs, always after the import. It was never a
portability failure.

**Rule.** After a navigation that remounts the map stage, a test asserts against
**stored state**, not against the UI. The rendered map has its own coverage in
`map-draw-feedback.spec.ts`, `fog.spec.ts` and `encounter-board-v2.spec.ts`; the
portability test's subject is the data.

### §3 — Deterministic emulator assertions

Stored state is read over the Firestore and RTDB emulators' rules-bypassing admin REST
surface — `Authorization: Bearer owner`, the same "admin context" already used by
`accounts-rooms.spec.ts`, `presence.spec.ts` and `room-lifecycle.spec.ts`. Firestore's
typed REST values (`{stringValue}`, `{mapValue}`, …) are collapsed to plain JS so two
rooms' documents compare with one `toEqual`; `integerValue` normalises to a number, so a
value that survived `.vttcamp`'s JSON round-trip as a double still compares equal to the
integer it started as. The Notes CRDT is read from RTDB `rooms/{id}/yjs/notes` and decoded
through `Y.applyUpdate` → `getText('notes')`, which is the plain markdown `NotesPanel`
stores.

`importRoom` writes every collection back **verbatim, preserving each document's original
id**. Round-trip fidelity is therefore an exact comparison of the two rooms' documents,
not a spot-check: room `name`, `schemaVersion`, `handout` and `profileTemplate`, plus the
whole of `tokens`, `log`, `gmPrivate` and `maps`, plus the decoded Notes text.

Excluded from the comparison, because an import or a live client is _supposed_ to change
them: the room id; `gmUid` (forced to the importer, so Security Rules can never resurrect
the archived GM — covered at the store layer by the `CampaignStore` contract suite's
"importer as gmUid" test); `lastActivityAt`; and the `players` collection, which presence
rewrites on every heartbeat.

No polling is needed for the comparison. `importRoom` commits every write before it
resolves, and it resolves before the app navigates — so the imported room is settled by
the time the URL changes. Polling is used only where a client's publish is genuinely
asynchronous: waiting for the Notes provider to push the CRDT state to RTDB before an
export reads it from there.

### §4 — Shape of the file

Two tests, not one:

- **live sync** — two contexts; handout reveal and concurrent Notes, ending with an admin
  read of the stored CRDT so convergence is proven in storage and not merely in two views
  that agree;
- **portability** — one context; fixture state, export, import, then the document
  comparison of §3, with the browser closed before the comparison so nothing can touch
  the room mid-read.

Splitting them halves the work per test, lets CI's per-test retry recover one without
re-running the other, and means a failure names which property broke.

### §5 — The standing invariant

**The e2e battery carries no quarantined tests.** A test that cannot be made deterministic
is a defect to be specified and fixed, not a `test.fixme` to be left in place. If a flake
cannot be resolved in the session that finds it, it is logged as an intake item with the
observed failure mode, and the quarantine carries that item's id.
