## SPEC-015 — Shell collapse & token-config contextualization

**Status: Completed**

- **§1** A collapsed rail must shrink its grid track to a thin spine so the stage
  grows. (Satisfied structurally by the Quick Sheets shell, whose docked sheets sit in
  a pointer-transparent margin and whose rail is a fixed 56px.)
- **§2** Snap is a **global drop default** → always visible under a clearly-labeled
  group. Scale is **per-selected-token** → gated behind a selection, showing nothing (or
  a muted "Select a token to resize" hint) when none. (Snap defaults now live on the
  character quick sheet.)
- **§3** `select` holds exactly one token: a new single click clears the prior
  selection. No marquee/multi-select.
