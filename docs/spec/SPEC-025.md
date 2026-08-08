## SPEC-025 — Access control & abuse containment

**Status: Completed** — §2's console flip from monitoring to enforcement landed via
`PLAN.md` → WI-029 (2026-08-02). §5's quota headroom monitoring remains a standing
`[HUMAN]` console practice, not a discrete outstanding item.

**Motivation:** widening the release from private testing to a friends-and-acquaintances
group. Three exposures, in priority order: unbounded room creation by anonymous uids; no
signal distinguishing a live room from an abandoned one; no presence model at all.

**Threat model (stated explicitly, because it bounds every decision here):** the
population is friends and acquaintances, not attackers. The realistic failure is
_accidental_ quota exhaustion and accumulated dead data, not a determined adversary. On
Spark, quota exhaustion denies requests rather than generating a bill — **the downside
is an outage for the group, not a charge.** Tune for availability and containment, not
cryptographic guarantees.

### SPEC-025 §1 — GM creation gate (non-anonymous provider)

Room creation currently succeeds for a freshly-minted anonymous uid, so any browser that
loads the app can create unlimited rooms, at no cost and with no attribution. Require a
non-anonymous sign-in provider **on the room-create rule only**:

```
match /rooms/{roomId} {
  allow create: if signedIn()
    && request.auth.token.firebase.sign_in_provider != 'anonymous'
    && request.resource.data.gmUid == request.auth.uid;
  // read / update / delete unchanged
}
```

This converts "any browser" into "any Google account", which is what makes every
downstream containment measure meaningful — an abusive creator becomes identifiable and
blockable in the console.

**It does not touch the join path.** SPEC-006 §1 already builds the full
`linkWithGoogle` / `signInWithGoogle` / `signOutToAnonymous` flow; this only requires a
would-be _GM_ to use it. The zero-prompt anonymous join invariant (RULE-011) stays
green.

**Lobby UX consequence:** the Create Room form must handle the anonymous case. An
anonymous visitor sees the Create control with an inline "Sign in with Google to create
a room" affordance rather than a failed write. Joining via link, and My Rooms for an
already-linked account, are unaffected. This is the one place in the app where sign-in
is load-bearing rather than optional, and **the copy should say why** (rooms are yours,
they follow your account across devices) rather than presenting it as a gate.

**Migration note:** any existing room whose `gmUid` is an unlinked anonymous uid keeps
working — the gate is on `create`, not on `update`/`delete`. Those GMs should be nudged
to link via the existing SPEC-006 §1 affordance, but nothing breaks if they don't.

### SPEC-025 §2 — App Check enforcement

The highest-leverage anti-abuse lever available without Cloud Functions. App Check
(reCAPTCHA v3 provider) attests that requests originate from your actual app, and
enforcement on Firestore and RTDB is **free — it does not require Blaze.**

- **[HUMAN]** register the app in the Firebase console under App Check, obtain the
  reCAPTCHA v3 site key, add the Pages/Hosting hostnames.
- **[HUMAN]** run in _monitoring_ mode first and watch the metrics for at least one full
  session with real players before switching to enforcement — enforcing early will lock
  out legitimate clients that haven't shipped the SDK yet.
- **[AGENT]** initialize App Check in `apps/web/src/lib/firebase/client.ts` (the sole
  concrete-store touchpoint, per RULE-001) with a debug token path for local
  development and the emulator suite.
- Emulator and e2e runs must continue to work — the debug provider is set when
  `import.meta.env.DEV` or the emulator host is configured.

§1 handles attribution; §2 handles volume, blocking the scripted-client vector
that could actually exhaust quota.

### SPEC-025 §3 — Soft room cap (client-side, deliberately not rules-enforced)

**A rules-enforced per-user cap is not achievable here, and this plan does not pretend
otherwise.** Any counter document the user can write, the user can forge; any counter
they cannot write cannot be maintained without a trusted writer. A real cap means App
Check plus a Cloud Function, which crosses the no-functions/no-card line (RULE-010).

Given the threat model, the correct response is a **soft cap in the Lobby**: once a
user's My Rooms index holds `MAX_ROOMS_SOFT` (default **12**) entries with
`role: 'gm'`, the Create form disables with "You have 12 rooms. Delete or export one to
make space." It is honest friction for honest users, which is the entire population.

Document the limitation in the code comment so a future reader doesn't mistake it for a
security boundary — the same way the `password` field is documented as unenforced and
group ownership is documented as client-side-only.

### SPEC-025 §4 — Room id entropy audit

The trust model is "the roomId is the capability" (RULE-012) — room reads are
`signedIn()`, not membership-gated — and that cannot change until the pre-join subscribe
problem is solved (documented at length in `firestore.rules` and
`firestore.rules.test.ts`: a listener denied at subscribe time never recovers, which
previously left clients with empty groups, permanently revealing hidden tokens). Room id
entropy is therefore **the only barrier against a stranger reading an arbitrary room.**
Audit what `createRoom` generates.

- **Required:** ≥ 128 bits of CSPRNG-derived entropy (`crypto.getRandomValues`),
  rendered in a URL-safe alphabet. Firestore auto-ids qualify (20 chars, 62-symbol
  alphabet ≈ 119 bits) and are acceptable.
- **Unacceptable:** anything sequential, timestamp-derived, `Math.random()`-derived, or
  short enough to enumerate.

If the current generator falls short, replacing it is in scope for WI-025; existing rooms
keep their ids (no migration — old ids stay valid, new ones are stronger).

### SPEC-025 §5 — Quota headroom monitoring

- **[HUMAN]** in the Firebase console, confirm the Spark daily quotas and note the
  current steady-state consumption per active session. Target remains "comfortably
  inside 20k Firestore writes/day".
- **[HUMAN]** set a calendar reminder to check usage after the first wide session. The
  console _is_ the admin UI (SPEC-006 §4); no custom panel.
