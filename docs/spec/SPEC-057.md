## SPEC-057 — Reversals from the 2026-09-18 introspective

**Status: Active**

_(New with the Shape A items of the 2026-09-18 introspective — IN-156, IN-162, IN-165,
IN-174, IN-175, IN-187 — each decided by the user on 2026-09-23 as DEC-114 – DEC-119. Every
section reverses or narrows an earlier entry, which is named. No `R`-number predecessor.)_

### §1 — Edit/View lasts for the tab session (IN-156; DEC-114, supersedes DEC-064 in part)

`MapToolController.mapMode` is read from and written to `sessionStorage` under a per-room
key. A reload, a map switch or a view switch keeps the mode; a new browser session starts in
`'view'`. Storage access is wrapped; any failure means `'view'`. Still per-viewer client
state, never a store write.

### §2 — The referee during a call (IN-162; DEC-115, supersedes DEC-097 in part)

**Amends SPEC-050 §3.**

1. While a Call for Initiative is staging, **players'** die controls outside the call stay
   disabled and say why. **The referee's are not**: their rolls publish as ordinary `Roll`s.
2. **Resolve now** (referee only, `combat-resolve-now`) resolves the call with the staged
   seats, exactly as the ordinary resolve does, leaving unstaged seats out of the order. It
   is enabled once at least one seat has staged; Cancel remains for a call with none. The
   app rolls nothing on anyone's behalf (RULE-002).

### §3 — The room password is removed (IN-165; DEC-116, retires a Postponed entry)

- The create form loses its password field; `Room.password` leaves `RoomSchema` and both
  stores' `createRoom` input.
- A room-doc migration (next schema version) deletes any stored `password`. `.vttcamp`
  import drops the key before validation.
- Ships a migration test and a `.vttcamp` round-trip test (RULE-007). No rules change.

### §4 — Render cost: measure, then maybe build (IN-175; DEC-118, reopens a Postponed entry)

1. **Measure** (after WI-171). Extend WI-122's `apps/web/bench/` with a large dungeon
   fixture (floor, walls, doors, fog, 50+ symbols) and a scripted vertex drag; record frame
   time against the budget stated in `README.md`, in `README.md` and on the Postponed entry.
2. **Build, only if (1) is over budget.** A `MapRenderer` with `invalidate(layer)` and one
   `requestAnimationFrame`-coalesced flush; effects invalidate a layer rather than calling
   `renderAll()`; a vertex drag rebuilds LoS on release, not per move. Layer order and what
   each layer means are unchanged (RULE-006). If (1) is within budget, this step's work item
   is denied at its gate with the number as the reason.

### §5 — `CampaignStore` by domain (IN-174; DEC-117)

After WI-184. `RoomStore`, `MapStore`, `EncounterStore`, `DiceStore`, `PresenceStore` and
`CollabStore` are declared separately and composed into `CampaignStore`; every method keeps
its signature and guarantee, and no caller changes. The contract splits into per-domain files
under `packages/shared/src/store/contract/`, each imported and run by
`campaign-store.contract.ts` against `MemoryStore`, `FirebaseStore` and `LocalStore` — so
RULE-001 holds as written.

### §6 — Portrait images in Firestore (IN-187; DEC-119, narrows a Postponed entry)

- `rooms/{roomId}/images/{id}`: `{ bytes: string (base64), mime: 'image/webp', w, h, by: uid }`.
  The client resizes to at most 256×256 WebP before writing.
- A ref `img:<id>` is accepted wherever a portrait ref is (`ProfileInstance.portraitRef`,
  `Token.imageRef`) and resolves to a data URL from the collection. No field changes type.
- Store methods to put, read/subscribe and remove an image, added to the contract suite
  and passing against all three stores (RULE-001). `LocalStore` carries images in the
  `.vttcamp`; export/import round-trips them (RULE-014).
- **Rules** (RULE-004, with rule tests): any member may create; `mime == 'image/webp'`;
  `w` and `h` integers ≤ 256; `bytes` a string of at most ~100 KB; `by == request.auth.uid`; no other keys; update and
  delete by the creator or the referee. Per-write containment only — **no aggregate quota
  exists** (RULE-010 §1), and any client-side cap is labelled as friction.
- **Stop condition.** If a containment rule on Firestore is read as a boundary RULE-004 does
  not enumerate, stop and log a standalone RULE-004 amendment before shipping rules.
- Backgrounds and handouts stay URL-only; Storage uploads stay postponed.
