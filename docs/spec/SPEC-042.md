## SPEC-042 — Packaging and distributing a local build

**Status: Active**

_(New with the 2026-08-17 batch — IN-066. **Blocked on SPEC-041**: there is nothing to
package until the local runtime exists. Its work item, WI-090, is an **investigation** —
this spec states the shape and the constraints; the findings fill in the rest. No `R`-number
predecessor.)_

### §1 — The shape

A local release is a **self-contained static bundle plus a launcher script**, distributed as
a zip attached to a GitHub release (DEC-075). No Electron, no Tauri, no installer, no new
runtime dependency.

Why a launcher at all, rather than "open `index.html`": the app needs an HTTP origin. ES
modules and the File System Access API both refuse `file://`, so without a launcher "run
locally" still means "know how to serve a directory", which excludes exactly the audience
the request is trying to include.

Why not a desktop app: Tauri or Electron would give native file dialogs and a double-
clickable icon — genuinely better for "open my campaign file" — at the cost of a Rust or
Chromium toolchain, per-platform builds and a signing story, all of which become permanent
maintenance on a project whose premise is having no infrastructure to maintain. Revisit as a
fresh intake item once local mode has been played with, not before.

### §2 — The artefact

- `pnpm build:local` — a Vite mode that builds `apps/web` with local mode on and **no
  Firebase configuration of any kind**.
- The launcher: one command that serves the bundle on `localhost` and opens a browser. Its
  exact form is a finding (§4), constrained only by "no new runtime dependency the user must
  install first".
- A distribution `README` covering: what local mode is and is not (SPEC-041 §§1, 3), the
  browser-support split for file access (SPEC-041 §2 — Chromium autosaves, others save
  explicitly), that URL-referenced assets need the network and bundled ones do not
  (SPEC-041 §4), and where the campaign file lives and why backing it up is the user's job.

### §3 — The load-bearing constraint

**The local bundle must contain no Firebase code and no identifier belonging to this
project** — no API key, no project id, no app id, no auth domain, no database URL, no
`.firebaserc` value, in any built file, sourcemaps included. This is the entire meaning of
"no tie-ins to our existing firebase project" and it is the one thing here that must be
mechanically checked in CI rather than reviewed by eye. A grep over the build output is
enough, and it is worth more than the rest of this spec combined.

Deriving from that: the local build must not import `apps/web/src/lib/firebase/client.ts`'s
Firebase branch, and the store selection in that file must be statically analysable so the
bundler can drop it. If the selection is dynamic, the SDK ships whether or not it runs.

### §4 — What the investigation must answer

1. **The launcher, concretely.** What one command, on Windows, macOS and Linux, serves a
   directory with no prior install? Candidates: a `node` script (node is plausible for a
   self-hoster but is still an install), a small prebuilt static-server binary per platform
   (no install, three artefacts to ship), a documented one-liner per platform (zero
   artefacts, most friction). Pick one and say why.
2. **Does the strip actually strip?** Build it and grep it. Report the real bundle size and
   the real list of what survived, not the intended one.
3. **How the release is produced.** Manually, or a CI job on tag? Whether the hosted
   deployment pipeline is touched at all (it must not be).
4. **What breaks when it is actually run** from a zip, by someone who did not build it, on
   a machine with no toolchain. This is the finding that matters most and the one that
   cannot be reasoned out in advance.
5. **Versioning.** How a user knows which build they have, and what happens when they open
   a `.vttcamp` written by a newer one (SPEC-041 §2 rejects older archives; the reverse
   direction needs an answer too).

Each finding that needs code becomes its own intake item (DEC-027), not an edit inside the
investigation.
