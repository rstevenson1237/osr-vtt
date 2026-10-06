## SPEC-062 — A `.vttcamp` from a newer build is refused

**Status: Active** — DEC-128 (user, 2026-10-06); scheduled as WI-220.

_(New with IN-072. The forward-direction twin of the older-archive rejection in
`assertSupportedFormatVersion`.)_

### §1 — The reader refuses a newer archive

`archiveToSnapshot` and `readManifest` reject an archive with a `VttCampFormatError` when
either holds:

- `manifest.formatVersion` is greater than `VTTCAMP_FORMAT_VERSION`; or
- the room's `schemaVersion` (the manifest's and the room doc's, whichever is higher) is
  greater than `CURRENT_SCHEMA_VERSION`.

The check runs after the format tag is recognised and **before** `migrateRoom` or any
collection step touches the data. Nothing is written: no room is created in the hosted
build and no file is opened, and so never re-saved, in the local build.

### §2 — The message says what to do

The error text says the file was made by a newer version of the app and that the referee
should update before opening it. When the manifest carries `exportedBy` (§3) the message
names it alongside this build's `VITE_APP_VERSION`; without it, it says "a newer version".
Both existing surfaces (the hosted import in `SessionActivity`, the local lobby) already
show `err.message`, so no UI or `data-testid` changes.

### §3 — Exports record the build that made them

`VttCampManifest` gains an optional `exportedBy?: string`, the exporting build's version
string, passed to `snapshotToArchive` by its caller (the shared package does not read the
Vite env). It is informational only: no reader branches on it, an archive without it stays
valid, and older builds ignore it. `VTTCAMP_FORMAT_VERSION` is not bumped and no migration
is added.

### §4 — Tests

Portability unit tests cover: a newer `formatVersion` is refused; a newer `schemaVersion`
is refused (in the manifest and in the room doc); the current versions still import; the
message names both builds when `exportedBy` is present and falls back without it; an
export round-trips `exportedBy` (RULE-014). A `LocalStore` test asserts `openCampaign`
rejects a newer archive without writing the file.

### §5 — Out of scope

A live hosted room whose `schemaVersion` is newer than a stale open tab is a different
path (`converters.ts` reads it through `migrateRoom`) and is IN-227.
