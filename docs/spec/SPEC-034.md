## SPEC-034 — Upload containment on Blaze

**Status: Completed.** DEC-049 was answered **alternative (c)** (user, 2026-08-03): the
no-Cloud-Functions clause of RULE-010 stands and only its economic premise is replaced, so
this spec's content is settled. **The amendment landed with WI-065 (2026-08-14)**,
standalone and `RULE-AMENDMENT:`-prefixed (RULE-017), and **WI-066 landed the same day**
with §§2–4: `firebase/storage.rules` and its rule tests, the client-side usage readout and
soft cap, the room-delete object sweep, and the `[HUMAN]` runbook. Both ran **after** the
Battle Map and Hex Crawl series (user, 2026-08-03).

> **What "Completed" does and does not mean here.** Every layer this spec asks for exists
> in the repository, and every one of them is off. Uploads need
> `VITE_ENABLE_STORAGE_UPLOADS=true`, and that flag must not be set before the `[HUMAN]`
> console work in **`docs/runbooks/blaze-billing.md`** — the Blaze upgrade, a Cloud
> Billing budget with alerts, and App Check **enforcement**, in that order. §3.3's
> backstop is a procedure, not code, and it is not done until a human does it.

_(New with WI-065; no `R`-number predecessor. Unblocks the in-app-uploads item standing in
`DECISIONS.md` → Postponed.)_

### §1 — The rule conflict, stated first

RULE-010 does not merely say "no Cloud Functions". It states an economic premise:

> On Spark, quota exhaustion **denies requests rather than generating a bill** — the
> downside of abuse is an outage for the group, not a charge. Tune for availability and
> containment, not cryptographic guarantees.

Blaze inverts that premise. The downside of abuse becomes a charge, and "tune for
availability, not guarantees" stops being the safe default it was written as. Every
containment decision in the app — the soft room cap as friction rather than a boundary
(SPEC-025 §3), "the roomId is the capability" (RULE-012), all players are trusted
(RULE-008) — was taken under a premise that no longer holds for the one service that bills
per byte stored and per byte served.

**RULE-010 has now been amended** (WI-065, 2026-08-14), in its own standalone change with
a `RULE-AMENDMENT:` prefix (RULE-017). Its economic premise is stated per tier: the
Spark reasoning is kept as Spark-only, and on Blaze it is replaced by per-write
containment as the only in-app boundary, non-optional App Check, and a billing budget
that warns rather than caps. The no-Cloud-Functions clause stands, which is why §5 below
still holds.

### §2 — What Security Rules can and cannot do

Enforceable in `storage.rules`, with no trusted writer:

- **Per-object size** — `request.resource.size < LIMIT`.
- **Content type** — a `contentType` allowlist (images only).
- **Path shape** — objects live at a path that binds each one to a room and to the uid
  that wrote it, so an object is always attributable and always deletable with its room.
- **Membership** — a cross-service `firestore.get()` against the room's `players`
  collection, so an uploader must already hold a seat.
- **App Check** — enforceable on the bucket, which is the single highest-value lever
  against an outsider with a stolen room id. It is already wired in the client and is off
  only because no reCAPTCHA site key is configured (SPEC-025 §2).

**Not enforceable, and this must not be papered over:** any _aggregate_ quota — bytes per
room, bytes per user, objects per day — and any rate limit. Both need a running total that
only a trusted writer can maintain, and RULE-010 forbids the only mechanism that could.

### §3 — Therefore: three layers, and only one of them is a boundary

1. **Rules are the boundary.** Per-object size, MIME, path shape, membership, App Check.
   They bound the blast radius of any single write and they are testable code (RULE-004,
   so this ships rule tests like every other rules change).
2. **The client is friction, not a boundary.** A per-room usage readout and a client-side
   refusal past a soft cap — the same shape and the same honesty as `MAX_ROOMS_SOFT`,
   which `README.md` and SPEC-025 §3 both already label "client-side friction, explicitly
   not a security boundary". It must be labelled that way here too.
3. **The real backstop is outside this repository.** A Cloud Billing budget with alerts,
   and — since a budget alert notifies rather than caps — a documented `[HUMAN]` runbook
   for what to do when one fires. This is console configuration, which is exactly what
   RULE-010's second clause already contemplates.

### §4 — Deletion is part of containment

Uploaded objects must be enumerated and removed by the room's existing recursive delete,
the same duty the vector cutover's M2 imposed on `deleteRoom` for new collections and
SPEC-032 §2 imposed on `deleteToken`. Storage that nothing ever deletes is a bill that
only grows, and an orphaned object has no room left to authorize a read against.

### §5 — Out of scope

Anything needing a trusted writer: server-side quotas, rate limiting, virus/content
scanning, and signed upload tokens. If any of those turn out to be required, that is a
Cloud Functions conversation and therefore a second RULE-010 amendment, not a widening of
this one.
