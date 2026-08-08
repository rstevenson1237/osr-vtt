## SPEC-016 — Background management

**Status: Completed**

The background is a managed room/map property, not a hard-coded sprite:
`GameMap.background` is either an image ref or a solid `#rrggbb` colour, rendered by
the `background` layer. GM controls (Assets view + Session settings) offer **Change
background** (picking from Bundled / Saved URL via the asset picker) and **Remove
background**. There is no selection-on-canvas of the background sprite — management
lives in the GM UI, which avoids accidental drags.
