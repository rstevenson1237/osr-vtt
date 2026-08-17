## SPEC-041 — Local mode: the `.vttcamp` is the live document

**Status: Active**

_(New with the 2026-08-17 batch — IN-065. **Blocked on WI-088**, the standalone RULE-009
amendment (RULE-017, DEC-074): this spec describes a build with no backend, which RULE-009
as written does not admit. No `R`-number predecessor.)_

### §1 — What local mode is

A second build of the same app in which `CampaignStore` is backed by a **file** instead of a
backend. The user opens or creates a `.vttcamp` in the lobby, plays, and the campaign is
saved back to that file. There is no Firebase project, no network call, no account, and no
second player. One person, one file.

This is not an offline mode, a cache, or a sync layer. There is nothing to sync **to**, and
adding one later would be a different spec.

### §2 — `LocalStore`

`LocalStore` is a third `CampaignStore` implementation, built on `MemoryStore` — which
already passes `campaign-store.contract.ts` in full — plus persistence (DEC-073).

- **Load.** The chosen file's bytes go through the existing `archiveToSnapshot`
  (`packages/shared/src/portability/vttcamp.ts`), which is already pure and already carries
  the migration-on-import path, and the resulting `CampaignSnapshot` seeds the in-memory
  state. An archive older than `VTTCAMP_FORMAT_VERSION` is rejected with the same
  "unsupported schema" error the hosted import gives (RULE-014); it is not silently opened.
- **Save.** Every mutation marks the campaign dirty; a **debounced** write-back serialises
  the snapshot through `snapshotToArchive` and writes the whole file. Debounced and whole-
  file, not incremental — RULE-003's write discipline exists because Firestore writes cost
  money and quota, and neither applies here, but a file write per drag frame would still be
  wrong for a different reason.
- **Crash safety.** The write-back is atomic at the file level (write, then replace), and
  the app never leaves the file in a half-written state. A campaign is hours of work and
  there is no server-side copy of it.
- **The contract.** `LocalStore` joins the contract suite beside `MemoryStore` and
  `FirebaseStore` (RULE-001). If it cannot pass that suite, local mode is a fork rather than
  a backend, and that is the line this spec will not cross.

**File access.** `showOpenFilePicker` / `showSaveFilePicker` where they exist — Chromium —
giving a real handle and a silent write-back. Where they do not, the build falls back to the
`.vttcamp` download plus file-input path the app already ships (`Lobby.svelte`,
`SessionActivity.svelte`), with **Save** as an explicit action that downloads the file. The
fallback must say so in the UI: a user who thinks their campaign is autosaving when it is
not will lose it.

### §3 — Single user, and what that removes

A local build has one actor: the referee, who is also the only seat and is always GM
(DEC-074). Anything whose meaning is "another person" is **absent from the UI**, not
present-but-broken:

Multiplayer and room join · additional player seats · presence and the disconnect badges ·
live cursors · pings · drag frames and in-progress carve strokes (RULE-003's whole RTDB
half) · shared rolls and roll readiness · GM transfer · account linking, sign-in, and the
rooms list.

Everything that is a property of the campaign rather than of the session is **kept,
unchanged**: maps and every piece of vector geometry, backgrounds, hex tiles, tokens,
groups, profiles and templates, the encounter board, dice (RULE-013's authority is the seed
and is client-side already, so rolls work identically), the log, handouts, notes and random
tables.

Features are removed by **not rendering them**, decided from the build's mode at the same
place the store is chosen. There is no per-feature runtime capability negotiation and no
`if (isLocal)` scattered through components.

### §4 — Assets

The `AssetStore` in a local build resolves bundled refs (which ship in the bundle) and URL
refs (which need the network, and simply fail without it, visibly). Cloud Storage uploads
are off, as they are in every build today (SPEC-034). A `.vttcamp` carries `assetRefs` but
not pixels, so a campaign that leans on URL refs is not fully portable offline — that is a
known limit of the format, not of this mode, and it belongs in the distribution README
(SPEC-042).

### §5 — The lobby

The lobby in a local build offers exactly two things: **Open campaign…** (a `.vttcamp` file
picker) and **New campaign…** (a name, then a fresh room seeded the same way `createRoom`
seeds one today, including the starter profile template). Recently-opened files may be
remembered by handle where the platform allows it. No sign-in, no rooms list, no join code.

### §6 — The build boundary

`apps/web/src/lib/firebase/client.ts` is the only concrete-store touchpoint in the app
(RULE-001), and it is where the implementation is chosen from the build mode. **A local
build must not contain the Firebase SDK or any project identifier at all** — that is what
"circumventing Firebase as a dependency" means, and it is a build-output assertion checked
in CI, not a claim made in a comment. It is the single most important testable statement in
this spec.

The hosted build is unchanged in every respect. Local mode adds a build, it does not
modify one.

### §7 — What must be true when this ships

- `LocalStore` passes the full `CampaignStore` contract suite.
- A `.vttcamp` written by the hosted build opens in a local build, and one written locally
  imports into a hosted room, both round-tripping identically (RULE-014). In local mode the
  archive is the database, so a round-trip that drops a field drops the user's campaign.
- A local build's output contains no Firebase code and no project identifiers.
- The hosted build's behaviour, bundle and tests are unchanged.
- Nothing in §3's removed list is reachable in a local build, and nothing in §3's kept list
  is missing from one.
