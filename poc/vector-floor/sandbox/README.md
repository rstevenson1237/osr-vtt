# sandbox/ — §9.1 in-memory POC harness (BUILT)

The single-user, in-memory drawing showcase from [`../SPEC.md`](../SPEC.md) §9
step 1. No Firestore, no `CampaignStore`, no security rules — all state lives in
browser memory. Nothing here is imported by `apps/` or `packages/`; proven logic
graduates to WI-A by re-implementation with tests, never by import.

Findings and evidence: [`../FINDINGS.md`](../FINDINGS.md).

## Run

```bash
cd poc/vector-floor/sandbox
npm install
npm run dev        # interactive sandbox (Vite)
npm run check      # tsc --noEmit + 11 geometry assertions (verify.ts)
npm run smoke      # headless-browser UI smoke (playwright-core, saves dist/screenshot.png)
npm run artifact   # bundle to dist/artifact.html (single self-contained page)
node dist/stress.mjs  # §8.2/§8.4 stress numbers (after: npx esbuild stress.ts --bundle --platform=node --format=esm --outfile=dist/stress.mjs)
```

## What's implemented

- **Five floor primitives** (§2.5): Room, Corridor, Path, Polygon, Regular n-gon —
  with per-point **snap / half / free** (hold **Alt** for temporary freeform).
- **Carve / Rock mode** toggle — Rock = subtract, the §2.4 interior rock-carve;
  a full bisection splits a region in two automatically.
- **Wall tool** (§3.1): explicit sight+movement segments (dividers or standalone
  blockers).
- **Door tool** (§3.2): two-click placement on the floating overlay layer; click a
  door to toggle open/closed; **build-time reconciliation** (§3.3) — open door
  clips a gap in sight, closed door blocks.
- **Eye tool**: movable vision source rendering a live visibility polygon.
- **Live metrics** (§8): regions, vertices, sight segments, per-commit raw→simplified
  vertex/byte counts, op timing; **live simplify-tolerance slider** (§8.3).
- **Snapshot undo/redo** (§8.5), Demo scene, Reset, pan/zoom (wheel + Pan tool).

## Layout (geometry/ is what WI-A ports)

```
src/geometry/   types, backend (swap seam §8.1), snap, simplify,
                primitives (5 shapes + polyline buffer), pipeline (combine+simplify+metrics),
                los (perimeter derivation + door reconciliation + visibility polygon)
src/render/     canvas (the ONLY lattice→pixel boundary)
src/input+state app wiring, snapshot undo, in-memory MapState
verify.ts       11 geometry assertions (spec-critical behaviors)
smoke.mjs       headless UI check
stress.ts       §8.2/§8.4 synthetic stress
```

## ⚠️ Known POC stand-in (SPEC §5.2 / REVIEW M6)
`bufferPolyline` fakes polygon offsetting by unioning per-segment quads — robust
because the *union* is the library's, but not a true offset. **WI-A must use a
real offset routine** (Clipper2 `ClipperOffset`). This is the M6 finding, live.
