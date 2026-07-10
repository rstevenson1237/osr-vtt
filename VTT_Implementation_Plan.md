# Minimalist OSR/Custom VTT — Master Implementation Plan (Firebase Edition)

**Purpose:** Hand-off spec for Claude Code. Decisions are locked; open items carry a stated default. Sections marked **[HUMAN]** or **[OTHER AGENT]** are not for Claude Code — step-by-step in §10.

**Locked decisions:**
- **Trust model:** all players trusted (your own group). No anti-cheat / no authoritative server needed. Security Rules enforce GM-hidden info only.
- **Backend:** none. **Firebase serverless** — clients are the app; the database *is* the shared state and the realtime sync layer.
  - **Firestore** = durable state. **Realtime Database (RTDB)** = high-frequency ephemeral state. **Firebase Auth** (Anonymous) = identity. **Firebase Hosting** = serves the app + bundled assets.
- **Plan tier:** **Spark (free, no credit card)** for everything in v1. Cloud Storage (image uploads) is deferred because it requires Blaze — see §6.
- **Language:** TypeScript throughout. Svelte 5 + Vite frontend; PixiJS v8 map; Three.js + Rapier dice.
- **Dev loop:** Firebase Emulator Suite in Google Cloud Shell; deploy to the real project only when sharing. Codebase on GitHub.
- **First deliverable:** Phase 0 vertical slice touching the map path and the theater-of-mind / dice / character path end-to-end, running against the emulators.
- **Build target:** a **static bundle** (Vite build output — no server runtime). Deployable to **Firebase Hosting *or* GitHub Pages** from the same output. Firebase is the *backend* (DB/Auth); the static host is independent of it. Uses **hash routing** + a configured `base` path for GitHub Pages compatibility.
- **No game mechanics (HARD LIMIT):** the app stores and displays data but **never interprets it** — no stat tracking, calculation, validation, or value-triggered behavior. Character data = referee-defined **Profiles** (§2.5), pure dumb data.

---

## 1. Architecture Overview

### 1.1 Monorepo layout (pnpm workspaces) — no server package
```
/packages
  /shared        # TS types, Zod schemas, roll-resolution logic, Firestore data converters
/apps
  /web           # Svelte 5 + Vite; PixiJS map; Three.js/Rapier dice; Firebase SDK data layer
/firebase
  firestore.rules
  database.rules.json      # RTDB rules
  firestore.indexes.json
  firebase.json            # emulators + hosting config
/infra                     # GitHub Actions
```
There is no `/apps/server`. The "backend" is Firebase config + Security Rules.

### 1.2 Authority model (serverless, trust-based)
- **No server validates writes.** Integrity of *hidden* GM information is enforced by **Firestore Security Rules** (players' clients cannot read GM-only documents). Integrity of *player actions* relies on the trust assumption.
- **Dice are client-authored:** the rolling client computes seed + params + result, writes a roll doc; all clients re-simulate the seed in Rapier purely for the animation. The written result is the source of truth for the log.
- **Optimistic by nature:** Firestore/RTDB local writes apply instantly and reconcile automatically.

### 1.3 Data-access abstraction (relocated Repository Pattern)
All Firebase reads/writes go through a typed data layer in `/packages/shared`, so a later swap to self-hosted **PocketBase** or **Supabase** (if you ever want to leave Google) is a driver change, not a rewrite:
```ts
interface CampaignStore {
  subscribeRoom(roomId, cb): Unsubscribe;
  moveToken(roomId, tokenId, pos): Promise<void>;
  writeRoll(roomId, roll): Promise<void>;
  // ...
}
```
Ship one impl for v1: `FirebaseStore`. Keep Firebase SDK calls out of Svelte components — components call the interface.

---

## 2. Firebase Project & Data Model

### 2.1 Firestore (durable) — one document tree per room
```
rooms/{roomId}
  (fields) name, gmUid, schemaVersion, difficultyDie, dangerDie, createdAt, profileTemplate[]
  players/{uid}            displayName, seatId, role: "gm"|"player"|"viewer"
  profiles/{seatId}        values{fieldId: value}, portraitRef   # instance of profileTemplate (§2.5); mechanics-agnostic
  tokens/{tokenId}         pos{x,y}, size, layer, groupId, imageRef, ownerSeatId?
  groups/{groupId}         name, memberTokenIds[], showMap, showBoard, active
  drawings/{strokeId}      layer, kind, points[], style
  log/{entryId}            ts, authorUid, type, text, resultClass
  rolls/{rollId}           ts, authorUid, seed, params, dice[], mode, results[]
  tables/{tableId}         name, rows[]                 # referee random tables
  gmPrivate/{docId}        # GM-ONLY: hidden layers, blind-drawer results, unrevealed fog
```

### 2.2 Realtime Database (ephemeral, high-frequency — keeps Firestore write count low)
```
/rooms/{roomId}/cursors/{uid}     {x,y,ts}      # live pointer positions
/rooms/{roomId}/dragging/{id}     {x,y}         # in-progress token drag frames
/rooms/{roomId}/pings/{pingId}    {x,y,ts}
```
**Rule of thumb:** if it updates many times per second, it goes in RTDB, not Firestore. Firestore commits are the "settled" values (drag *ends* → one Firestore write).

### 2.3 Auth & identity
- **Anonymous Auth** gives every client a stable UID with no login. Firebase persists the session locally, so a refresh keeps identity.
- **Referee** = room creator; `gmUid` is set to their UID at creation. (Optional v1.1: a one-time recovery code to reclaim GM on a new device.)
- **Players** write `players/{uid}` with their chosen display name on join. This replaces the cookie-seat scheme from the server design.

### 2.4 Build Target & Hosting
The Vite build emits a **static bundle** (HTML/CSS/JS + WASM + bundled assets) — **no server runtime**. Serve it from **either**:
- **Firebase Hosting** (free on Spark: 10 GB stored, 360 MB/day transfer), or
- **GitHub Pages** (static; "already on GitHub").

The static host is **independent of the Firebase backend** — the app talks to Firestore/RTDB/Auth from the browser no matter where its files live. For GitHub Pages the build MUST use **hash routing** (`/#/r/{roomId}` — no server rewrites) and set Vite `base: '/<repo>/'`; add `<user>.github.io` to Firebase Auth authorized domains. CI can publish to both targets from one build.

### 2.5 Profiles (mechanics-agnostic character data)
**Hard rule: the app never interprets a profile value** — no calculation, tracking, validation, or triggers. Fields are stored and shown; nothing more. "HP", "Move", "AC" are just labels on values.
- **Profile Template** — GM-defined **per room** (`profileTemplate[]` on the room doc): an ordered list of `{ id, label, type, default? }`. The GM may add/remove/reorder fields anytime; instances tolerate changes (new field = empty, removed field = hidden).
- **Profile Instance** — `profiles/{seatId}`: a `{fieldId: value}` map each player fills for their own character. **Publicly visible at the table** (shown in the dock) for ease of play.
- **Field types (small fixed set — recommended over raw key-value):**
  - `text` · `longtext` (notes/inventory) · `number` (plain displayed value)
  - `counter` — integer with +/− steppers (at-table HP/torches/ammo); stores an int, means nothing to the app
  - `checkbox` — a flag (e.g. a condition); pure display
  - `roll` — stores a die expression (`d6`, `2d6`); tapping it **stages that die in the dice tray** (a UI shortcut, not a mechanic)
- Only `roll` touches other UI (hands a die to the tray). Raw key-value text is the fallback if even this set is unwanted.

---

## 3. Security Rules = the Authority Layer

With no server, rules are load-bearing. Minimum viable set:
- Any authenticated user may **read** most room subcollections (players must see tokens, log, drawings, groups, profiles).
- `rooms/{id}/gmPrivate/**`: `allow read, write: if request.auth.uid == get(/rooms/{id}).data.gmUid;` — players' clients physically cannot read GM secrets. **All hidden information lives here or is gated by this pattern.**
- `profiles/{seatId}`: writable by the owning seat's UID or the GM. The `profileTemplate` (room field) is GM-writable only.
- `tokens`, `drawings`, `groups`, `log`, `rolls`: writable by any authenticated member of the room (trust model). GM-only fields (e.g., a token's hidden notes) go in `gmPrivate`.
- **Fog of War hidden regions:** default v1 (trust) — fog state is player-readable and clients simply honor it. Hardening option (later) — keep unrevealed fog in `gmPrivate` and write only revealed cells to a player-readable doc. Given the trust assumption, v1 default is acceptable.

Rules are tested with the emulator (§9). Treat a rules change like a code change: PR + tests.

---

## 4. Sync Patterns & Cost Discipline

- **Reads:** components subscribe via `onSnapshot` (Firestore) / `.on('value')` (RTDB). Firebase pushes deltas; no polling.
- **The one discipline that keeps you free:** never stream high-frequency data through Firestore. Cursors and in-progress drags → RTDB. A drag produces *one* Firestore write on drop, not one per frame. This keeps you far under 20k Firestore writes/day.
- **Dice:** write `rolls/{rollId}` = `{seed, params, dice, mode, results}`; every client's `onSnapshot` fires, they run the deterministic Rapier sim from `seed`, and the log line uses `results` + `resolveSeparate()`.
- **Reconnection is free:** `onSnapshot` re-hydrates full state on reconnect automatically — no custom resync code.

---

## 5. Persistence & `.vttcamp`

- **Persistence is automatic** — Firestore *is* the save file. No `state.json` flushing.
- **`.vttcamp` export:** read a room's document tree → serialize to JSON (+ a manifest of asset refs) → zip. **Import:** write the tree under a fresh `roomId`.
- **`schemaVersion`** lives on the room doc; a `migrations/` module upgrades an imported/loaded room if its version is behind. Build this in from Phase 0 so schema drift never orphans a saved campaign.

---

## 6. Asset Handling (the only card-vs-no-card decision)

Firestore/RTDB/Auth/Hosting are free with **no card**. **Firebase Cloud Storage requires the Blaze plan (card on file)** to provision a bucket, even though its Always-Free allowance means $0 bills for a home game. So asset *upload* is the sole trigger for a card. Isolate it:

```ts
interface AssetStore { resolve(ref: string): string; /* -> URL */ upload?(file: File): Promise<string>; }
```
- **v1 default (card-free):** `BundledAssetStore` + `UrlRefAssetStore`. A referee either picks from a **bundled starter pack served off Firebase Hosting** (tokens, grid textures, a few maps committed to the repo) or **pastes an external image URL**. No uploads, no bucket, no card. `.vttcamp` just stores the URLs/refs.
- **v1.1 (when you want in-app uploads):** add `FirebaseStorageAssetStore` behind the same interface. Requires: upgrade the project to Blaze, keep buckets in a US Always-Free region, set a budget alert. This unlocks drag-to-upload + client-side WebP compression + the 5 MB cap from the original outline.

Claude Code builds v1 only; the interface makes v1.1 a drop-in.

---

## 7. Phase Plan

> The entire networking/relay/deploy phase from the server design is **gone**. Groups still moves early (it spans map, board, initiative).
>
> **Phase 1 and Phase 4 must be built against `VTT_Map_Tooling_Spec.md`**, which defines every drawing/wall/door/symbol/text tool, the layer model, and the interaction semantics (overlap, snapping, doors, LoS↔fog). Do not improvise map-tool behavior — that spec is authoritative.
>
> **Phases 0, 2, 3 & 4 (the Encounter Board) must be built against `VTT_Encounter_Screen_Spec.md`**, which defines theater-of-the-mind play, initiative modes, the roll strip, the Caller, and the Difficulty/Danger tension widgets — all mechanics-agnostic. Do not infer combat rules; that spec is authoritative.

- **Phase 0 — Vertical slice** (against emulators). Detailed in §8.
- **Phase 1 — Canvas/Map depth:** PixiJS v8 layer stack (Background → Player Mapping → GM/Hidden → Tokens → FoW); drawing tools + undo/redo; grid snapping + measurement ruler; live cursors/pinging via RTDB; manual FoW eraser; token scale slider (1×1–3×3). **Default: square grid; hex later.**
- **Phase 2 — Groups + visibility + combat tracker:** Groups model; toggles `[Map][Board][Active]`; initiative pool; combat tracker with **side-based group initiative (OSE)** + individual mode; round counter.
- **Phase 3 — Dice engine + Profiles:** dynamic tray, modifiers, adv/dis, **Summed (OSE)** + **Separate** resolution; saved macros. **Profile system (§2.5, mechanics-agnostic):** GM builds a per-game profile *template* (field types text/longtext/number/counter/checkbox/roll); each player fills their instance; the dock renders it; `roll` fields stage their die in the tray. **No stat logic whatsoever.** Instances persist per seat (automatic via Firestore).
- **Phase 4 — Referee engine + FoW line-of-sight:** Blind Drawer (writes to `gmPrivate`, reveal → copies to `log`); CSV/JSON table runner with nested rolls; global Difficulty + Danger Die widgets; 2D raycasting LoS from vector walls; `.uvtt` import for walls.
- **Phase 5 — Portability + polish:** `.vttcamp` export/import; schema migrations exercised; handout / "reveal image" flow; **Yjs** for concurrent Notes + drawing (layer it over Firestore, or use RTDB as the Yjs transport); optional `FirebaseStorageAssetStore` (Blaze).
- **Phase 6 — Hardening:** e2e coverage; CI green-gate; Chromebook performance validation; a second `CampaignStore` impl (PocketBase or emulator-backed) proving the abstraction holds.

---

## 8. Phase 0 Vertical Slice — Detailed Task List (for Claude Code)

**Goal:** two browser tabs (Anonymous Auth) join the same room; referee drops/moves a token on the Map View and the Encounter Board; player adjusts a counter and rolls a Combat die; both tabs see the same token move, the same 3D roll, and the same flagged log line; refresh restores everything — all against the Firebase emulators.

1. **Scaffold** pnpm monorepo; TS strict; Vite + Svelte 5; ESLint/Prettier; Vitest in `/packages/shared` + `/apps/web`; Playwright in `/apps/web`; `firebase.json` wired for Firestore + RTDB + Auth + Hosting emulators.
2. **`/packages/shared`:** `CampaignState` types, Zod schemas, Firestore data converters, `resolveSeparate(die): 'success'|'complication'|'failure'` (4+/2–3/1), and the `CampaignStore` + `AssetStore` interfaces.
3. **`FirebaseStore` impl:** Anonymous Auth bootstrap; room create (sets `gmUid`); `players/{uid}` join; `onSnapshot` subscriptions for tokens/profiles/log/rolls; RTDB cursor channel.
4. **Security Rules (v0):** GM-only `gmPrivate`; authed read/write on room subcollections; emulator rules tests for "player cannot read gmPrivate."
5. **Lobby:** "Create room as Referee" (name + optional room password field stored for later) vs "Join" (display name). Shareable room link (`/r/{roomId}`).
6. **Main Stage toggle:** *Map View* (PixiJS: pan/zoom, one bundled background, drop + drag one token — drag frames via RTDB, settle via Firestore) and *Encounter Board* (one portrait/index card).
7. **Active Character Dock (Profile system, minimal):** seed the room `profileTemplate` with a `text` (Name), one `counter`, and one `roll` field (d6); the player fills their `profiles/{seatId}` instance; the dock renders it generically from the template; tapping the `roll` field stages its die. Proves the mechanics-agnostic profile pipeline end to end.
8. **Dice overlay:** adapt Owlbear's MIT Three.js/Rapier roller; clicking the chip writes a `rolls` doc; all clients re-simulate `seed` and post the `resolveSeparate` result to the log.
9. **Action Log (left):** text-only; `.success/.complication/.failure` classes.
10. **schemaVersion + migrations scaffold** on the room doc.
11. **`AssetStore` = BundledAssetStore** only; commit a tiny starter pack (1 map, 2 tokens) under `/apps/web/public/assets/`.

**Acceptance (Playwright, two contexts, emulators):** GM moves token → player sees it on both stage modes < ~200 ms; the dock renders generically from the template and a `roll` field stages its die; player rolls → both render the same face + same log class; reload player tab → tokens/profile values/log restore; a rules test proves a player context cannot read a `gmPrivate` doc.

---

## 9. Testing & CI

- **Unit (Vitest):** `/packages/shared` — resolution rules, converters, migrations.
- **Rules tests:** `@firebase/rules-unit-testing` against the emulator — every GM-only protection has a test.
- **e2e (Playwright):** the two-context flow against emulators (`firebase emulators:exec`).
- **CI (GitHub Actions):** lint + typecheck + unit + rules + e2e on PR; block merge on red. Deploy job publishes the static build to **GitHub Pages** and/or runs `firebase deploy` (hosting + rules) on push to `main` (rules always deploy via `FIREBASE_TOKEN`/service-account). **[HUMAN]** setup in §10.

---

## 10. Tasks That Are NOT Claude Code's — Do These Yourself

### 10.1 [HUMAN] GitHub repo
1. Create private repo `osr-vtt`; protect `main` (require PR + checks).

### 10.2 [HUMAN] Create the Firebase project (Spark, no card)
1. console.firebase.google.com → Add project (reuse your Google account).
2. Build → **Firestore** → Create database (production mode, a US region).
3. Build → **Realtime Database** → Create (US region).
4. Build → **Authentication** → Sign-in method → enable **Anonymous**.
5. Build → **Hosting** → get started (don't deploy yet).
6. Project settings → Your apps → **Web app** → copy the config object. **Note:** this web config (apiKey, projectId, etc.) is *not secret* — it's a public identifier and is safe to commit. Security comes from Rules, not from hiding it.
7. Leave the plan on **Spark**. Do **not** enable Cloud Storage (that would force Blaze) — assets are bundled in v1.

### 10.3 [HUMAN] Cloud Shell dev environment
1. Open shell.cloud.google.com (or the Cloud Shell icon in the Firebase console).
2. `git clone <repo>` into your persistent `$HOME`.
3. `npm i -g firebase-tools pnpm` (re-run if a fresh Cloud Shell session drops global installs).
4. `firebase login --no-localhost`; `firebase use <projectId>`.
5. Dev loop: `pnpm dev` (Vite) + `firebase emulators:start` → open the Vite port via **Web Preview**. This is solo dev testing only; sharing with players comes later via Hosting.

### 10.4 [HUMAN] CI secret
1. Create a CI credential: `firebase login:ci` (or a service account with Hosting + Rules deploy perms).
2. Add it to GitHub Actions secrets as `FIREBASE_TOKEN` (or `GOOGLE_APPLICATION_CREDENTIALS_JSON`).

### 10.5 [HUMAN, deferred] Enable uploads (only when you want in-app image upload)
1. Firebase console → upgrade project to **Blaze**; set a **budget alert** (e.g., $1) immediately.
2. Enable **Storage**; create the bucket in a US Always-Free region.
3. Tell Claude Code to activate `FirebaseStorageAssetStore` (Phase 5). Until then, stay on Spark, card-free.

### 10.6 [HUMAN] Licensing call
- Default = **pure engine** (no bundled OSE/SRD text; tables are user-imported). Confirm or decide otherwise. → affects what Claude Code may include.

### 10.7 [HUMAN] Chromebook playtest each phase
- Load a map + ~20 tokens; roll 6 dice; check FPS. If dice tank, have Claude Code move physics to a Web Worker + OffscreenCanvas / enable a 2D fallback.

### 10.8 [OTHER AGENT, optional]
- Visual identity pass (frontend-design) before Phase 1 UI hardens.
- Content session to author starter `.csv`/`.json` random tables (needed by Phase 4).

---

## 11. Assumed Defaults (override anytime)
- Square grid only (hex later) · pure-engine content · **no game mechanics — profiles are referee-defined dumb data (§2.5), typed field set** · trust-based rules (no Cloud Functions) · **static build → Firebase Hosting or GitHub Pages (hash routing, `base` path)** · profiles persist per seat · voice out-of-scope (use Discord) · dice assets = Owlbear's MIT models · assets bundled/URL-ref in v1 (uploads deferred to Blaze).

---

## 12. First Message to Claude Code
> Read `VTT_Implementation_Plan.md`. This is a Firebase-serverless project (no backend server). Scaffold the Phase 0 monorepo per §1.1 and implement the Phase 0 vertical slice per §8, running against the Firebase Emulator Suite, including the Vitest + Playwright + rules tests from §9 and the `schemaVersion`/migrations scaffold from §5. Put all Firebase SDK calls behind the `CampaignStore`/`AssetStore` interfaces (§1.3, §6); components never call the SDK directly. Use `BundledAssetStore` only. Vendor Owlbear's MIT dice assets into `/apps/web/public/assets/dice/` with attribution. Do not enable Cloud Storage. Open a PR against `main`. Stop after the Phase 0 acceptance test passes; do not start Phase 1.
