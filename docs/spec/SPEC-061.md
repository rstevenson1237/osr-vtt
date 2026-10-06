## SPEC-061 — Store updates to a missing document

**Status: Active** — DEC-127 (user, 2026-10-06); scheduled as WI-219.

_(New with IN-226, a finding of the IN-067 design. It **generalises** SPEC-059 §1 from the
three background patch methods to the whole `CampaignStore` interface.)_

### §1 — A single-document update to a missing document is a no-op

Every `CampaignStore` method whose write is a partial update of one existing document
**resolves without effect** when that document does not exist, in every store
(`MemoryStore`, `LocalStore`, `FirebaseStore`). This covers the token, map, player-seat,
group, `gmPrivate`, shared-roll-meta and room-doc update methods (`moveToken`,
`resizeToken`, `setToken*`, `renameMap`, `setMap*`, `renamePlayer`, `setPlayerRole`,
`updateGroup`, `revealBlindDraw`, `renameRoom`, `setTheme`, and the rest of the bare
`updateDoc` sites). It never creates the document.

`FirebaseStore` routes these writes through one private helper that treats a `not-found`
rejection as success; any other rejection still propagates. SPEC-059 §1's background
helper becomes a caller of it. Fire-and-forget bookkeeping writes that already catch their
own errors (`touchRoomActivity`, seat presence) are unchanged.

Consequence: a GM who drags, renames or undoes a move on a token another client has just
deleted sees the token disappear and the action do nothing, with no console error.

### §2 — `moveTokens` skips missing tokens

`moveTokens` moves every listed token that exists and skips the rest, in every store.
`FirebaseStore` keeps its single batched commit (RULE-003); only when that commit rejects
`not-found` does it fall back to one §1 update per token.

### §3 — `transferGM` is all-or-nothing and rejects

`transferGM` changes the room's `gmUid` and two seats' roles together. If the room or
either seat is missing it **rejects** and changes nothing, in every store (`MemoryStore`
and `LocalStore` gain the check; `FirebaseStore`'s batch already behaves so).

### §4 — Unchanged, and the contract

Methods that already throw on a missing room (`ensureActiveMap`, `migrateRoomCollections`,
`createBattleMap`'s source map) and the one-shot migration helpers keep their behaviour.

Each guarantee is written on the method's doc comment in `campaign-store.ts` and asserted
by the contract suite against all three stores (RULE-001): create the document, remove it,
call the method, and check that it resolves (or, for `transferGM`, rejects) and the
document stays absent.
