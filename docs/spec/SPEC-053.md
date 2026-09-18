## SPEC-053 — Verification before the push: session bootstrap and CI shape

**Status: Active**

_(New with the 2026-09-18 introspective — IN-143, IN-144, IN-145; DEC-105, DEC-106. Extends
SPEC-035 §5, which priced turns and made verification one quiet command. It did not price the
two costs below: a suite the session cannot run at all, and a CI wait measured in half-hours.
No `R`-number predecessor.)_

The most expensive failure this project has is **a red CI after the session ended**. The work
item is finished in the agent's account of it, the completion record is written, the pull
request is open — and the defect is found by a runner, with the session's context gone. Every
recent completion record carries the same sentence: _"the emulator battery could not run
locally (no `firebase` CLI in the sandbox)"_. That is not a sandbox limitation to be noted
each time; it is a missing setup step. `firebase-tools` is already a `devDependency` and Java
is present in the image — what is absent is a session that has run `pnpm install`.

### §1 — The session bootstrap

A `SessionStart` hook (DEC-106) brings a fresh sandbox to the point where `pnpm verify:all`
can run:

- `pnpm install --frozen-lockfile`;
- the Firebase emulator jars, pre-fetched into `~/.cache/firebase/emulators` — the same cache
  key CI already warms;
- Playwright's pinned Chromium, unless the sandbox already carries one that
  `playwright.config.ts`'s `resolveChromiumPath` will find;
- `HTTPS_PROXY`/`HTTP_PROXY` unset for those fetches only, per README's proxy trap.

**Constraints, all four load-bearing.** It never edits a tracked file. It never runs the suite
— what to verify and when is the session's decision and the session's allocation to spend. It
is **best-effort**: a failed step prints what failed and leaves the session usable, because a
bootstrap that blocks a docs-only planning session has made the project slower, not faster.
And it is idempotent, because a resumed session runs it again.

**What it must produce**, and the only thing execution should assert: `pnpm verify:all` in a
fresh session returns green or red on its merits, rather than "could not run".

### §2 — CI shape

Measured over the last eight runs before this spec: 28, 33, 33, 34, 35, 35, 27, 33 minutes per
pull request. The cause is not the tests; it is `playwright.config.ts` — `workers: 1`,
`fullyParallel: false`, `retries: 2` on CI — running ~100 emulator-backed flows one at a time
behind a single emulator, plus three jobs that each pay their own `pnpm install`.

The end state:

1. **Playwright shards.** A CI matrix runs `--shard=i/N` (N = 4 to start), each shard inside
   its own `firebase emulators:exec`. The emulator is already per-job, so a shard is today's
   job with a slice of the suite and no new isolation story (DEC-105).
2. **One static job.** `lint`, `typecheck` and `build` become a single job with one
   `pnpm install`, keeping all three steps and running them even when an earlier one fails.
3. **`retries` drops 2 → 1 on CI.** A flow that fails twice is a defect or a flake worth its
   own intake item; a third attempt buys silence, not signal.
4. **Sharding never changes what runs.** The same specs, the same projects (`chromium` and
   `mobile-chromium`), none skipped, quarantined or marked `fixme` to make a shard green. If a
   spec cannot survive running beside its siblings, that is a finding about the spec.

**Target: twelve minutes or less per pull request.** The target is a target; what this spec
fixes is the shape.

§1 before §2 is preferable — a session that can run the suite is what makes a red shard cheap
to reproduce — but neither blocks the other.

### §3 — The harness guard set

`CLAUDE.md` records exactly three `PreToolUse` hooks, added only with a work item and a
`DECISIONS.md` entry (DEC-016, superseded in part by DEC-029). §1 adds a hook on a **different
event**, so the count is read per event: three `PreToolUse` guards, one `SessionStart`
bootstrap, and none added without the same ceremony — DEC-106 is this one's.

Whether `remind-plan-status.sh` remains one of the three is **DEC-102, open**. This section
states the shape either way: the guard set is whatever `CLAUDE.md`'s harness paragraph
enumerates, that paragraph is updated in the same change as the hook, and no guard exists that
the paragraph does not name.
