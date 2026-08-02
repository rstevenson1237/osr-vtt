# RULES

**Hard rules defining project structure.** Source: `docs/VTT_Master_Plan.md` Part I
(archived verbatim at `docs/archive/VTT_Master_Plan.ORIGINAL.md`).

These rules must not be violated. An agent that needs to violate a rule must:
(1) stop work immediately, (2) flag the conflict to the user with the reason,
the impact of the violation, and the alternatives, (3) obtain explicit user
approval, (4) amend this file in a separate, standalone change, and (5) only
then resume the original work. Amending a rule and acting on the amendment in
the same turn is prohibited. Rule amendments are never bundled into a work
item's implementation commit.

A commit that touches this file must carry a `RULE-AMENDMENT:` prefix in its
message. A `PreToolUse` hook enforces this (see `.claude/hooks/`).

Rule IDs are permanent and are **never reused**. A retired rule keeps its number
and is marked retired in place rather than deleted.

These are binding on every change. A work item that would weaken one must **stop
and flag** rather than proceed.

---

## Golden rules

### RULE-001 — Store abstraction only

All Firebase access goes through `CampaignStore`/`AssetStore`
(`packages/shared/src/store/`). Components never touch the Firebase SDK.
`apps/web/src/lib/firebase/client.ts` is the sole concrete-store touchpoint.
**Any new store method must be added to the shared contract suite
(`campaign-store.contract.ts`) and pass against both `MemoryStore` and
`FirebaseStore`.** This is what keeps a backend swap (e.g. PocketBase) cheap, and
it is proven, not aspirational.

### RULE-002 — No game mechanics (hard limit)

The app stores and displays data but never interprets it. No stat logic, no
value-triggered behaviour, ever. Character data is referee-defined Profiles; field
types are `text · longtext · number · counter · checkbox · roll`; only `roll`
touches other UI (it stages a die in the tray). A test asserts no value-derived
logic exists — keep it green.

### RULE-003 — Write discipline

If it updates many times per second it rides **RTDB** (cursors, drag frames,
pings, in-progress carve strokes); **Firestore** gets one settled write (drag-end,
stroke release, batched commits). Target: comfortably inside 20k Firestore
writes/day.

### RULE-004 — Security rules are tested code

Rule changes ship with rule tests (`packages/shared/src/rules/`). The rules enforce
exactly one boundary: GM-hidden information (`gmPrivate/**`, readable/writable only
by `gmUid`) — plus the own-uid/own-seat write guards enumerated in `README.md`.

### RULE-005 — Preserve `data-testid`s

The Playwright e2e suite depends on stable testids; moving a control must carry its
testid with it, or update the spec in the same change.

### RULE-006 — Vector map coordinate space

All floor/wall/door geometry is stored in **lattice (cell) units as floats**.
`cellSize` is a render-time-only multiplier applied once at the render/LoS-build
boundary. Never store pixel coordinates.

### RULE-007 — Migrations for schema changes

Any `GameMap`/`Room`/store schema change ships a migration + migration test
(`packages/shared/src/migrations/`) and a `.vttcamp` round-trip test. Seed
backfilled timestamp fields to the **migration timestamp**, never to zero.

> **Ratified exception (map schema only).** A map whose schema tag does not match
> the current system gets simple error handling — "unsupported map schema" — and is
> neither read nor transformed. There is no dual-read path and no migration scaffold
> for pre-vector maps. RULE-007 governs changes _within_ the vector schema. See
> `README.md` → "Schema versioning — error, don't migrate", and `DECISIONS.md`
> (locked default: Map schema mismatch).

---

## Trust & backend model

### RULE-008 — Trust model

All players are trusted; no anti-cheat, no authoritative server. The population is
friends and acquaintances, not attackers.

### RULE-009 — Backend

Firebase serverless on the **Spark** tier. Firestore = durable state; RTDB =
high-frequency ephemeral; Anonymous Auth (+ optional Google link) = identity; static
hosting (Firebase Hosting or GitHub Pages) with hash routing and Vite `base`
configured.

### RULE-010 — No Cloud Functions, no billing card

Every mechanism in this plan is Security Rules, client-side, or Firebase console
configuration. On Spark, quota exhaustion **denies requests rather than generating a
bill** — the downside of abuse is an outage for the group, not a charge. Tune for
availability and containment, not cryptographic guarantees.

### RULE-011 — Players join anonymously with zero prompts

Nothing may introduce a login wall on the join path. (Sign-in is load-bearing in
exactly one place: _creating_ a room — see `SPEC.md` SPEC-025 §1.)

### RULE-012 — "The roomId is the capability"

Room reads are `signedIn()`, not membership-gated, because a listener denied at
subscribe time never recovers. Room-id entropy is therefore the only barrier against
a stranger reading an arbitrary room (`SPEC.md` SPEC-025 §4). Membership-gating reads
is open work (`DECISIONS.md` → Postponed).

### RULE-013 — Dice authority is the seed

The rolling client writes `{seed, dice[], modifier, advantage, mode, total?}`; every
client derives the same faces from the seed (`hashSeed` + `mulberry32`). Animation is
decorative and never load-bearing.

### RULE-014 — Portability

`schemaVersion` on the room doc; `.vttcamp` export/import must round-trip
identically. `VTTCAMP_FORMAT_VERSION = 2`; pre-vector archives are rejected with an
"unsupported schema" error.

---

## Process rules

These govern how changes reach this repository. They are recorded here, rather than
only in `CLAUDE.md`, because violating them is a stop-and-flag event like any other
rule breach.

### RULE-015 — No out-of-chain changes

Every change to this repository originates from a work item in `PLAN.md` that has
cleared its approval gate. There are no side fixes, no opportunistic cleanups, and no
"while I was in there" edits.

**The one exception:** if a change is genuinely required to unblock the current work
item, make it, and record it in that work item's completion summary under
**Deviations**. Anything else gets logged as a new intake item in `PLAN.md` and waits
its turn.

### RULE-016 — One session, one work item

A session executes exactly one work item. A session that finds itself doing two has
violated the chain and must stop, report, and log the second as a new intake item.

### RULE-017 — Rule amendments are standalone

Amending `RULES.md` and acting on the amendment in the same turn is prohibited. A
rule amendment is its own change, its own commit (prefixed `RULE-AMENDMENT:`), and
its own approval. It is never bundled into a work item's implementation commit.

### RULE-018 — Docs and code move together

Any code change updates the affected documents — `RULES.md`, `README.md`, `SPEC.md`,
`PLAN.md`, `DECISIONS.md` — in the same pull request. Documentation and implementation
are reviewable together in a single diff.

### RULE-019 — IDs are never reused

`RULE-`, `SPEC-`, `WI-` and `IN-` identifiers are permanent. A retired, superseded or
abandoned entry keeps its identifier and is annotated in place. A new entry always
takes the next unused number.

### RULE-020 — The archive is immutable

`docs/archive/**` is written once and never edited. It is the reconciliation
reference. A `PreToolUse` hook blocks edits to it.
