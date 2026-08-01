# PLAN — completed items · milestone `access-lifecycle`

**Closed 2026-08-01.** WI-025 – WI-027. Access control, presence, and room lifecycle.

Archived from `docs/VTT_Master_Plan.md` Part IV §2 (Upcoming). Original numbers were
`WI-25`–`WI-27`; they are zero-padded here and are numerically unchanged. Spec
citations were `R24`–`R26`, now **SPEC-025**–**SPEC-027** — see the crosswalk at the top
of `SPEC.md`.

The full entries are kept rather than compressed to ledger rows, for the reason the
Master Plan itself gave:

> The entries below are kept in place rather than folded into the shipped ledger
> because their `[HUMAN]` notes, decisions and gate definitions are the record of how
> each was built — the next work item starts a fresh section.

**One item remains open** and did **not** close with this milestone: SPEC-025 §2's
console flip of App Check from monitoring to enforcement. It is tracked as **WI-029**
in `PLAN.md`, and SPEC-025 stays **Active** until it lands.

Dependency spine: **WI-025 → WI-026 → WI-027.** The couplings are soft (WI-026 and
WI-027 depend on WI-025 only for sequencing), but keeping them ordered means the rules
surface changes one work item at a time.

This file is immutable (RULE-020).

---

## WI-025 — Access control gate, App Check & id audit · **`[AGENT]` steps complete**

**Spec:** SPEC-025 (R24) · **Model:** `claude-opus-4-8` · **Effort:** medium

> **Status.** All five `[AGENT]` steps have shipped and the automated half of Gate 25 is
> green (rules · contract · unit · e2e). **The `[HUMAN]` console steps below are still
> outstanding**, and until they are done App Check is inert by construction: no site key
> is configured, so `loadFirebaseEnv` omits the `appCheck` block entirely and
> `createFirebaseClient` never calls `initializeAppCheck`. Registering the app and
> supplying `VITE_FIREBASE_APPCHECK_SITE_KEY` is what turns it on — no code change.
>
> **Consequence discovered during implementation, worth remembering:** an anonymous
> identity can no longer create a room _anywhere_, including in tests. Two suites created
> their fixture rooms anonymously and had to be given real identities — the
> `FirebaseStore` contract suite (which signs in with an emulator-minted Google
> credential; it tests data plumbing, not access control) and the account-recovery test
> (which now links Google _before_ creating, the only order the real flow permits). The
> Playwright specs get the same treatment through `signInAsReferee` in
> `tests/e2e/helpers.ts`, which mints a genuine non-anonymous emulator session over the
> Auth REST API and hands it to the SDK via its own IndexedDB persistence record — the
> `sign_in_provider` claim is real, so the specs exercise the shipped rule rather than
> bypassing it. The app's `linkWithPopup` path could not be driven here because the SDK
> popup loads `apis.google.com`.

**`[HUMAN]` first:** register App Check in the Firebase console (reCAPTCHA v3), obtain
the site key, add authorized hostnames, and set the provider to **monitoring** mode (not
enforcement). Confirm the Google sign-in provider from SPEC-006 §1 is still enabled and
its authorized domains are current.

**`[AGENT]` steps:**

1. `firestore.rules` — add the non-anonymous provider condition to room `create` **only**.
   Rules tests: an anonymous context is denied room creation; a Google-provider context
   succeeds; `update`/`delete` by an existing anonymous GM still succeed (no regression
   for pre-existing rooms).
2. Lobby — the Create Room form renders the sign-in affordance for anonymous visitors
   instead of attempting a write that will fail. Reuses `linkWithGoogle` from SPEC-006 §1.
   Copy explains the _why_, not just the requirement.
3. App Check init in `apps/web/src/lib/firebase/client.ts`, with the debug provider wired
   for dev and emulator so the existing suite and e2e runs are unaffected.
4. Soft room cap (SPEC-025 §3) in the Lobby, with a code comment documenting that this is
   friction, not a boundary.
5. Audit `createRoom`'s id generator against SPEC-025 §4; replace with a CSPRNG-derived id
   if it falls short. Existing ids remain valid.

**`[HUMAN]` after: partially done (2026-08-01).** App Check is registered in the console
(reCAPTCHA v3) and running in **monitoring** mode; the remaining step is watching metrics
through at least one full real session and then flipping to **enforcement**. Nothing in the
codebase changes at that point — the provider is console-side, and the client half is
already wired behind `VITE_FIREBASE_APPCHECK_SITE_KEY`. **Tracked forward as WI-029.**

**Gate 25:** anonymous context denied room creation, Google context succeeds (rules
tests) · **a player still joins an existing room anonymously with zero prompts — Gate
10's e2e re-run green, unmodified** · Lobby offers sign-in rather than erroring for an
anonymous would-be creator · soft cap blocks the 13th GM room · full suite + e2e green
against the emulator with the App Check debug provider.

---

## WI-026 — Presence channel & seat lifecycle · **complete**

**Spec:** SPEC-027 (R26) · **Model:** `claude-opus-4-8` · **Effort:** high · Depends on
WI-025 (soft).

> **Status.** All seven steps have shipped and Gate 26 is green. Behaviour is described in
> `README.md` § "Presence & seat lifecycle (II.10)".
>
> **Two decisions taken during the foundation, both flagged for review:**
>
> - **Mockups live in `docs/mockups/wi26-presence.html`, not `vtt-ui-mockups.html`.** The
>   named file is the retired Activity Shell board set, marked historical; adding
>   current-shell boards to it would contradict that label. Same visual language, new file.
> - **`lastPresentAt` is NOT backfilled**, contrary to SPEC-027 §2's "pre-migration seats get
>   the migration timestamp". It cannot be: `migrateRoom` only ever sees the room doc, and this
>   is a field on `players/{uid}` — the same additive-subcollection shape as v11→v12 and
>   v14→v15. The _intent_ (existing seats must not read as abandoned) is met more robustly
>   by absence itself: `abandonedSeatUids` requires a `lastPresentAt` older than the cutoff,
>   so a seat without one is never offered for pruning, and earns a real value the first
>   time its player connects. The v17→v18 bump is kept as a documented no-op so `.vttcamp`
>   archives are still stamped.

**`[HUMAN]` first — mockup gate: ✅ APPROVED (2026-07-31).** The `PlayersPanel`
present/disconnected treatment, the map token dimming, and the Session → Maintenance
"inactive seats" block are UI-affecting. Mockups are
**`docs/mockups/wi26-presence.html`** (three boards), approved as drawn — including
Board 1's referee-only "inactive" pill, which was flagged on the sheet as the one element
SPEC-027 does not call for. Steps 4–7 are unblocked; build to those boards.

**`[AGENT]` steps:**

1. `database.rules` — `presence/$uid` own-uid-only write, explicit `.read` at the parent
   `presence` node. Rules tests: own-uid write succeeds; another uid's write denied;
   **parent-collection read succeeds** (add to the existing "parent-collection reads"
   describe block); the `$roomId` delete allowance still removes the presence subtree.
2. `CampaignStore` — `publishPresence` / `clearPresence` / `subscribePresence` + the
   `PresenceEntry` type. Implement in `FirebaseStore` (heartbeat + guarded one-time
   `onDisconnect`) and `MemoryStore`. Contract tests on both.
3. `PlayerSeat.lastPresentAt` — schema field, `schemaVersion` bump, migration seeding
   existing seats to the migration timestamp, `.vttcamp` round-trip test.
4. `RoomShell` — publish presence on join/mount, tear down on unmount, thread presence
   through to `PlayersPanel` and the map token renderer.
5. `PlayersPanel` + token dimming per the approved mockups.
6. Session → Maintenance "prune inactive seats" block (SPEC-027 §3), reusing the existing
   seat-removal path including the character-sheet option.
7. e2e: two contexts join, both show present on each other · one context closes, the other
   observes it flip to disconnected within ~2× heartbeat **and the seat doc still
   exists** · it rejoins and flips back to present.

**Gate 26:** all three e2e presence assertions green · rules tests green including the
parent-read and cross-uid-denial cases · contract suite green on both stores · **Gate 10
room-deletion e2e still green (RTDB node fully gone, presence subtree included)** ·
migration round-trips.

---

## WI-027 — Room activity tracking, stale surfacing & RTDB leak closure · **complete**

**Spec:** SPEC-026 (R25) · **Model:** `claude-opus-4-8` · **Effort:** medium · Depends on
WI-026 (sequencing only).

> **Status.** All four `[AGENT]` steps have shipped and Gate 27 is green (throttle unit ·
> dormancy unit · migration · contract · RTDB arming unit · Playwright). Behaviour is
> described in `README.md` § "Room lifecycle & dead data (II.11)". Both `[HUMAN]` items
> below are resolved: the mockup gate was approved as drawn (**after** the build rather
> than before it — recorded as it happened), and the `rolls` TTL check came back "no policy
> exists, and none wanted" (SPEC-026 §4, closed). **WI-027 is complete.**
>
> **Two decisions taken during the build, both worth review:**
>
> - **The activity clock is maintained by the referee's client only.** `firestore.rules`
>   gates room-doc updates on `isGM`, so a player's write is denied. Rather than a room
>   read per client to check, the first denial is the answer: the room enters
>   `activityDenied` and that client stops trying. The alternative — loosening the room
>   rule to admit a `lastActivityAt`-only update from any member — is a real widening of
>   the one authority boundary in the app, for a signal whose whole purpose is "has anyone
>   with authority been here". Not taken.
> - **The v18→v19 migration reads `Date.now()`**, which makes it the first non-deterministic
>   step in the list. That is what "seed the migration timestamp" requires, and since
>   `roomConverter` re-runs the walk on every read, a pre-v19 room simply reads as active
>   until a settled write persists a real value. The migration is idempotent in the way
>   that matters: an existing `lastActivityAt` is never overwritten.

**`[HUMAN]` first — mockup gate: ✅ APPROVED (2026-08-01).** The dormant-room affordance
in My Rooms is UI-affecting. Mockup is **`docs/mockups/wi27-dormant-rooms.html`** (three
boards), approved as drawn, including both notes it raised for sign-off: Keep gives no
feedback beyond the inset vanishing, and every pre-existing room reads as active for the
first `STALE_ROOM_DAYS` after the migration. Approval came **after** the build rather than
before it — recorded here as it happened rather than tidied away.

**`[HUMAN]` also — done (2026-08-01):** the `rolls` TTL policy (SPEC-026 §4) was checked in
the console. No policy exists and none is wanted; the SPEC-006 §4 prune button remains the
only expiry mechanism. See SPEC-026 §4 for why a policy naming `Roll.ts` would not have
worked anyway.

**`[AGENT]` steps:**

1. `Room.lastActivityAt` — schema field, `schemaVersion` bump, migration seeding existing
   rooms to the **migration timestamp** (not zero — a zero seed makes every live campaign
   look abandoned), `.vttcamp` round-trip test.
2. `FirebaseStore` — throttled write on settled-write paths only, with the 5-minute
   in-memory guard. A unit test asserting the throttle actually suppresses (N rapid
   settled writes produce exactly one activity write).
3. My Rooms dormant surfacing (SPEC-026 §2) per the approved mockup, with Export / Delete /
   Keep. Delete reuses `deleteRoom` unchanged. "Keep" stores a dismissal on the user's own
   index entry.
4. RTDB leak closure (SPEC-026 §3): `onDisconnect().remove()` on ping nodes at push time, and
   on drag nodes with the guarded one-time pattern in `publishDrag`.

**Gate 27:** throttle unit test green (rapid settled writes → one activity write) · a room
seeded with an old `lastActivityAt` surfaces as dormant, and Delete from that row removes
every subcollection (reuse the Gate 10 admin-context assertion) · migration seeds existing
rooms to _now_, verified by a test that a freshly migrated room does **not** appear
dormant · ping and drag `onDisconnect` registered exactly once per node · full suite green.

Where each Gate 27 leg is pinned: the throttle and the dormancy rule in
`packages/shared/src/store/room-activity.test.ts` (including the freshly-migrated-room
case, mirrored in `migrations/index.test.ts`); the dormant row, Keep, and Delete-from-that-row
in `apps/web/tests/e2e/room-lifecycle.spec.ts` against the Gate 10 admin REST context; the
`onDisconnect` arming counts in `packages/shared/src/store/rtdb-leaks.test.ts`, which mocks
`firebase/database` because "how many registrations did the SDK receive" is not observable
through a real connection; and the clock's store-level behaviour in the contract suite,
against both implementations.
