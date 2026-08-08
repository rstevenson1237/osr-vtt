## SPEC-017 — Settings navigation

**Status: Completed** — standing constraint, easy to regress.

**Binding, and easy to regress.** Section-nav jump-links must be **buttons calling
`el.scrollIntoView({behavior:'smooth'})`**, never raw `<a href="#id">` anchors. The app
uses hash routing (`routes.ts`); `parseHash` matches only `^/r/([^/]+)` and returns
`{name:'lobby'}` for anything else, so a raw anchor sets `location.hash`, fires
`hashchange`, fails the match, and navigates the whole app to the Lobby. With this
fixed, `session-theme-select` (wired to `room.settings.theme` and `applyTheme`) is
reachable and applies live to every client.
