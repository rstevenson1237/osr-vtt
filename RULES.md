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

**Never store pixel coordinates.** Geometry is stored in the abstract units of
its map's grid, and a screen-space multiplier is applied once, at the
render/LoS-build boundary.

**A map has exactly one coordinate space, fixed by its grid kind.** Spaces are
never mixed inside a single map, and no consumer may assume a space its map's
grid kind does not declare.

- **Square-grid maps** store all floor/wall/door geometry in **lattice (cell)
  units as floats**. `cellSize` is the render-time-only multiplier.
- **Hex-grid maps** (`SPEC.md` SPEC-030 §1) store hex geometry in **axial hex
  coordinates**, with `0,0` at the map's centre. The hex size is the
  render-time-only multiplier.

Axial coordinates are **not** lattice units: neighbours, distance and the floor
union do not carry over. A square-lattice consumer — LoS, `pointInFloorUnion`,
token snapping — is undefined on a hex map and must not be reached from one.

> **Amended by WI-037 (2026-08-13).** The rule previously guaranteed one
> canonical space for every map — square-cell lattice units, floats. SPEC-030's
> hex crawl needs a second, so the guarantee is now **per grid kind** rather
> than global: still exactly one space per map, still never pixels, but which
> space a map uses is a property of the map. Nothing changes for square-grid
> maps, which is every map that exists today.

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

### RULE-009 — Backend, per build

The project ships **two builds of the same app**, and this rule states what each one's
backend is. The **hosted** build is the default and is unchanged. The **local** build has
no backend at all.

**Hosted build (the default).** Firebase serverless on the **Spark** tier. Firestore =
durable state; RTDB = high-frequency ephemeral; Anonymous Auth (+ optional Google link) =
identity; static hosting (Firebase Hosting or GitHub Pages) with hash routing and Vite
`base` configured.

**Local build.** No backend, no identity provider, and no network: the campaign is a
`.vttcamp` file on the user's disk and the store is backed by that file (`SPEC.md`
SPEC-041). No Firebase project, no account, no second player — one referee, one file. A
local build **must not contain the Firebase SDK or any project identifier**, and that is a
build-output assertion rather than a claim made in a comment. It is not an offline mode, a
cache or a sync layer; admitting one would be a further amendment, not a reading of this
one. RULE-010 is unaffected either way — it constrains the hosted build, and a local build
has no server to put a function on.

**What the split scopes.** Four rules describe Firebase services or a join path that a
local build does not have, and this amendment **scopes them to the hosted build**:
RULE-003 (write discipline) and RULE-004 (security rules are tested code) govern
Firestore/RTDB and Security Rules; RULE-011 (no login wall on the join path) and RULE-012
("the roomId is the capability") govern a join path that does not exist locally. None of
them is weakened, and none may be relaxed in a hosted build on the grounds that some other
build does not reach it.

**What the split strengthens.** Two rules bind harder locally, not softer. **RULE-001** —
the local store is a third `CampaignStore` implementation and passes the same contract
suite as `MemoryStore` and `FirebaseStore`; if it cannot, local mode is a fork rather than
a backend, and this rule does not admit a fork. **RULE-014** — locally the `.vttcamp` is
not an export format but the database itself, so a round-trip that drops a field drops the
user's campaign.

> **Amended by WI-088 (2026-08-18).** The rule previously stated the backend as a single
> fact — "Firebase serverless on the **Spark** tier … Anonymous Auth (+ optional Google
> link) = identity" — so a build with no Firebase contradicted it as written, and IN-065's
> local mode was rule-blocked before it could be designed (DEC-074). The statement is now
> made **per build**: the hosted build's backend is restated word for word and a second,
> backend-less build is admitted beside it. The heading gains "per build" for the same
> reason. Nothing changes for the hosted build, which is every build that exists today, and
> no other rule is amended here — the four rules above are scoped by this amendment rather
> than altered in place.

### RULE-010 — No Cloud Functions

Every mechanism in this plan is Security Rules, client-side, or Firebase console
configuration. **No Cloud Functions**, on any tier. There is no trusted writer, so
anything that needs one — aggregate quotas, rate limits, signed upload tokens,
content scanning — is out of scope until this rule is amended again.

**What the tier changes.** On **Spark**, quota exhaustion denies requests rather than
generating a bill: the downside of abuse is an outage for the group, not a charge, and
containment may be tuned for availability rather than for guarantees. On **Blaze** that
is false. Usage bills, so the downside of abuse is a charge, and the containment
premise is replaced by these three, which hold whether or not uploads ever ship:

1. **Per-write containment is the only in-app boundary.** Security Rules bound what any
   single request may do — object size, content type, path shape, membership. **No
   aggregate quota is enforceable in-app** (bytes per room, bytes per user, objects or
   reads per day), because a running total needs a trusted writer this rule forbids.
   Client-side caps are friction and must be labelled as such, never as boundaries.
2. **App Check enforcement stops being optional.** It is wired but inert for want of a
   reCAPTCHA site key (`SPEC.md` SPEC-025 §2). It is the highest-value lever against an
   outsider holding a leaked room id, and enabling it is `[HUMAN]` console work.
3. **The backstop is outside this repository, and it warns rather than caps.** A Cloud
   Billing budget with alerts plus a `[HUMAN]` runbook (`SPEC.md` SPEC-034 §3). GCP has
   no hard spend ceiling; early warning is what this rule buys, not a guarantee.

**The exposure is not only Storage.** Firestore reads and RTDB bandwidth bill too, so
RULE-012's "the roomId is the capability" hands a cost lever to anyone holding a leaked
id the moment the project is on Blaze — independently of uploads.

> **Amended by WI-065 (2026-08-14).** The rule previously stated one economic premise —
> "quota exhaustion denies requests rather than generating a bill" — as though it were
> tier-independent. Blaze inverts it. Per DEC-049 (answered (c), user, 2026-08-03) the
> **no-Cloud-Functions clause stands unchanged**; only the economic premise is replaced,
> now stated per tier. The heading drops "no billing card" for the same reason: the card
> was the Spark-era mechanism for the premise, not the rule.

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
