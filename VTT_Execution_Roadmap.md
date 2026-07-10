# VTT Execution Roadmap (Runbook) — Firebase Edition

**Companion to `VTT_Implementation_Plan.md`.** That doc is the *reference*; this is the *order of operations*. Follow top to bottom. Each stage has an owner, one action, and an **exit gate**. Do not start the next stage until the current gate is checked.

## Golden Rules (these prevent partial implementations)
1. **One phase per prompt.** Never "do Phases 1–3."
2. **Every prompt ends with a stop condition** ("Stop after the gate; do not start the next phase") — baked into each below.
3. **Merge green before the next prompt.** A phase is done only when its PR passes CI and merges to `main`.
4. **All Firebase access stays behind the `CampaignStore`/`AssetStore` interfaces.** Components never call the SDK directly. This is what keeps a future PocketBase/Supabase swap cheap.
5. **If a gate fails, you fix that phase — you never move on with it broken.**

---

## STAGE 0 — Decisions, accounts & dev box · Owner: YOU · ~45 min · before any code

- [ ] **0.1 Confirm licensing:** pure engine (no bundled OSE/SRD). → Plan §10.6
- [ ] **0.2 Confirm defaults:** square grid only, trust-based rules, uploads deferred (card-free). Override now if desired. → Plan §11
- [ ] **0.3 GitHub repo** `osr-vtt`, private, branch protection on `main`. → Plan §10.1
- [ ] **0.4 Firebase project on Spark** — create it; enable **Firestore**, **Realtime Database**, **Anonymous Auth**, **Hosting**; copy the web config; **do not** enable Storage. → Plan §10.2
- [ ] **0.5 Cloud Shell dev env** — clone repo, install `firebase-tools` + `pnpm`, `firebase login`, `firebase use <projectId>`. → Plan §10.3
- [ ] **0.6 CI credential** — `firebase login:ci`; paste token into GitHub secret `FIREBASE_TOKEN`. → Plan §10.4

**GATE 0:** decisions written · repo protected · Firebase project live on Spark with the four services on · Cloud Shell can run `firebase emulators:start` · CI secret set.

---

## STAGE 1 — Phase 0 build (vertical slice, on emulators) · Owner: CLAUDE CODE

**Prompt:** *(use the §12 message from the plan verbatim)*

**Acceptance gate — Cloud Shell, two browser-preview tabs against the emulators:**
- [ ] Both tabs join the same room (Anonymous Auth); one is Referee (`gmUid` set).
- [ ] GM drops/moves a token — the player tab sees it on **both** Map View and Encounter Board (< ~200 ms).
- [ ] The dock renders generically from the room's `profileTemplate`; a `roll` field stages its die and rolls it — **both** tabs render the same face; the log line carries the same `.success/.complication/.failure` class.
- [ ] Refresh the player tab — tokens, profile values, and log restore (automatic via `onSnapshot`).
- [ ] **Rules test passes:** a player context is denied read on a `gmPrivate` doc.
- [ ] Room doc carries `schemaVersion`; migration scaffold runs.

**GATE 1:** all boxes checked · PR merged to `main`.

---

## STAGE 2 — First real deploy (share-ready) · Owner: YOU · ~10 min

The build is a static bundle, so "how do I share this" is a one-liner either way. Pick a host (you can do both):
- [ ] **2.1a (Firebase Hosting):** `firebase deploy --only hosting,firestore:rules,database`, **or**
- [ ] **2.1b (GitHub Pages):** repo Settings → Pages → Source = **GitHub Actions**; the deploy workflow publishes the static build. Confirm Vite `base` = `/<repo>/` and add `<user>.github.io` to Firebase Auth authorized domains. Room links are hash-routed (`.../#/r/{roomId}`).
- [ ] **2.2** Note: **Firestore rules + RTDB rules always deploy via Firebase** regardless of where the app is hosted (`firebase deploy --only firestore:rules,database`).
- [ ] **2.3** Open the public URL on a **second device**; join the room the Cloud Shell tab created.

**GATE 2:** the two-context acceptance gate from Stage 1 passes **over the public URL, across two real devices** — your "zero-config for players" proof and your sharing story, done.

---

## STAGE 3 — Lock the CI green-gate · Owner: CLAUDE CODE, then YOU

**Prompt:**
> Add a GitHub Actions workflow that runs lint, typecheck, Vitest unit tests, Firebase rules tests, and Playwright e2e (all against the emulator via `firebase emulators:exec`) on every PR to `main`, blocking merge on failure. Add a deploy job on push to `main` that (a) always deploys Firestore + RTDB rules via `firebase deploy --only firestore:rules,database` using the `FIREBASE_TOKEN` secret, and (b) publishes the static build to **GitHub Pages** (and/or Firebase Hosting). Ensure Vite `base` is set to `/<repo>/` and routing is hash-based. Do not modify game logic. Open a PR.

- [ ] **3.1 [YOU]** Confirm branch protection now requires the CI check before merge; enable Pages (Source = GitHub Actions) if using it.

**GATE 3:** a red test blocks merge; a green merge deploys rules + the static app.

---

## STAGE 4 (optional) — Visual identity pass · Owner: OTHER AGENT
- [ ] Design session (frontend-design) → token set, typography, pane styling spec for Claude Code to apply during Phase 1. Skip and revisit if you prefer.

---

## STAGE 5 — Phases 1 → 6, one at a time

**Pattern every phase:** send prompt → review PR → check the gate → run the §10.7 Chromebook playtest → merge green → only then send the next phase's prompt.

### Phase 1 — Canvas/Map depth · CLAUDE CODE
> Implement Phase 1 per §7: PixiJS v8 layer stack (Background → Player Mapping → GM/Hidden → Tokens → FoW), drawing tools with undo/redo, grid snapping + measurement ruler, live cursors/pinging **via RTDB**, manual FoW eraser, token scale slider 1×1–3×3. Square grid only. All data access through `CampaignStore`; high-frequency data through RTDB per §4. Add Vitest + Playwright coverage. Open a PR. **Stop after the Phase 1 gate; do not start Phase 2.**

**Gate 1:** all five layers render and sync · draw→undo→redo syncs · ruler measures in grid units · a ping shows on the other client · GM's FoW eraser reveals only where erased · a token scales to 2×2/3×3 · cursor updates ride RTDB, not Firestore (verify Firestore write count stays low). → §10.7 playtest. Merge green.

### Phase 2 — Groups + visibility + combat tracker · CLAUDE CODE
> Implement Phase 2 per §7: Groups model; per-group toggles `[Map][Board][Active]`; initiative pool; combat tracker with side-based group initiative (OSE) and individual mode, round counter, current-turn highlight. All access via `CampaignStore`. Add tests. Open a PR. **Stop after the Phase 2 gate; do not start Phase 3.**

**Gate 2:** toggling each switch shows/hides on the correct surface and adds/removes from initiative · a full side-based group-initiative round advances correctly with a working round counter. → §10.7 playtest. Merge green.

### Phase 3 — Dice engine + Profiles · CLAUDE CODE
> Implement Phase 3 per §7 and the Profile spec in §2.5: dynamic tray, flat modifiers, advantage/disadvantage, Summed mode (OSE) and Separate mode (per-die flagging), saved macros. **Profile system, mechanics-agnostic — the app must never compute, validate, or trigger on any field value.** GM builds a per-room `profileTemplate` with field types text/longtext/number/counter/checkbox/roll; the dock renders any template generically; each player fills their `profiles/{seatId}` instance; `roll` fields stage their die in the tray. All access via `CampaignStore`. Add tests, including one asserting no value-derived logic exists (e.g. a `counter` never auto-changes another field). Open a PR. **Stop after the Phase 3 gate; do not start Phase 4.**

**Gate 3:** Summed totals correctly · Separate flags each die · adv/dis + modifiers apply · a saved macro replays · the GM can add/remove template fields and the dock re-renders generically · a `roll` field rolls its die · a profile survives a full reload unchanged · **no field value drives any other behavior**. → §10.7 playtest. Merge green.

### Phase 4 — Referee engine + FoW line-of-sight · CLAUDE CODE
> **[YOU first]** add a sample `.uvtt`/`.dd2vtt` map and one nested `.csv`/`.json` table for testing.
>
> Implement Phase 4 per §7: Blind Drawer writing to `gmPrivate` with a reveal→`log` action; CSV/JSON table runner with nested rolls; global Difficulty + Danger Die widgets; 2D raycasting line-of-sight from vector walls; `.uvtt` import for walls/lights. All access via `CampaignStore`; hidden data in `gmPrivate` per §3. Add tests (including a rules test that players can't read Blind-Drawer results pre-reveal). Open a PR. **Stop after the Phase 4 gate; do not start Phase 5.**

**Gate 4:** a Blind-Drawer roll stays unreadable by players until revealed · a nested table resolves and pushes to chat · Difficulty/Danger widgets update for all · an imported `.uvtt` blocks vision behind walls. → §10.7 playtest. Merge green.

### Phase 5 — Portability + polish · CLAUDE CODE
> Implement Phase 5 per §7: `.vttcamp` export/import (Firestore tree ↔ zip); exercise a schema migration on an old export; handout / "reveal image to players" flow; upgrade Notes + drawing to Yjs for concurrent editing. Leave `FirebaseStorageAssetStore` behind the `AssetStore` interface but **disabled** unless I've upgraded to Blaze (§10.5). All access via the interfaces. Add tests. Open a PR. **Stop after the Phase 5 gate; do not start Phase 6.**

**Gate 5:** export → new import yields identical state · a migration upgrades an older export · a revealed image reaches players · two clients edit Notes at once with no stomp. → §10.7 playtest. Merge green.

### Phase 6 — Hardening · CLAUDE CODE
> Implement Phase 6 per §7: broaden e2e coverage; ensure the CI green-gate is comprehensive; add a second `CampaignStore` implementation (PocketBase or an emulator-backed driver) that passes the *same* contract tests as `FirebaseStore`, proving the abstraction. Open a PR. **Stop after the Phase 6 gate.**

**Gate 6:** CI fully green · both `CampaignStore` impls pass identical contract tests · final §10.7 Chromebook run within budget.

---

## STAGE 6 — Recurring / as-needed inputs from YOU
- **Every phase:** run the §10.7 Chromebook playtest before merging. Dice tanking FPS → tell Claude Code to move physics to a Web Worker + OffscreenCanvas / 2D fallback.
- **Before Phase 4:** provide a test `.uvtt` map + one nested random table (or hand table authoring to a content session).
- **When you want in-app image uploads:** do the Blaze upgrade + budget alert (§10.5), then have Claude Code enable `FirebaseStorageAssetStore`. Until then you stay card-free.
- **If you ever leave Google:** the `CampaignStore` abstraction lets you swap `FirebaseStore` → self-hosted PocketBase (single Go binary — your original "self-host" wish) without touching UI code.

---

## One-screen sequence
```
STAGE 0  YOU        decisions + repo + Firebase(Spark) + Cloud Shell + CI secret   → GATE 0
STAGE 1  CLAUDE     Phase 0 slice on emulators                                     → GATE 1 (local accept + rules test)
STAGE 2  YOU        firebase deploy; join from a 2nd device                        → GATE 2 (accept over public URL)
STAGE 3  CLAUDE/YOU CI green-gate (emulator tests) + branch protection             → GATE 3
STAGE 4  (opt)      design pass before UI hardens
STAGE 5  CLAUDE     Phase 1→2→3→4→5→6, ONE prompt each, merge green between        → GATE per phase
STAGE 6  YOU        Chromebook playtest each phase; UVTT+tables @ P4; Blaze only if uploads
```
