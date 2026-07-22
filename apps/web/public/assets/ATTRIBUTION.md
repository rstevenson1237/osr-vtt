# Bundled asset pack — attribution

All assets under `public/assets/` are **original works authored for this
project** (plain SVG, generated programmatically). None are derived from or
redistribute any third-party asset pack.

## Why not Owlbear Rodeo's dice assets?

The implementation plan's assumed default was "Owlbear's MIT dice models."
That assumption turned out to be incorrect: `owlbear-rodeo/dice` (the actual
3D dice roller repo, including its `.glb` models and textures) is licensed
**GPL-3.0**, not MIT — confirmed from its `LICENSE` file, `package.json`
`license` field, and git history. Owlbear's `sdk` repo is MIT, but their
actual extensions (`dice`, `initiative-tracker`, `dynamic-fog`, etc.) are all
GPL-3.0. Vendoring GPL-3.0 assets into this repo under an "MIT" label would
have been both inaccurate and could obligate this project to GPL-3.0 terms if
ever distributed. Per user decision, Phase 0 ships original assets instead;
see `dice/d6/`.

## `dice/d6/face-{1..6}.svg` — retired in WI-4
These original pip-face SVGs were the only bundled dice textures. WI-4 (dice
renderer v2, Master Plan v2 R3.2) replaced them: all seven die shapes are real
polyhedra generated at runtime, and their number faces are drawn on a canvas
from theme tokens — nothing is loaded from disk. The files were removed. Per
R3.5, no geometry, textures, or other assets were copied or traced from any
third-party (GPL-3.0 or otherwise) dice renderer; the whole pipeline is
generated in-repo.

## `maps/starter-room.svg`
Original starter map background (Plan §8.11): a square-grid dungeon room,
64px-per-square grid matching the default token scale, procedurally
generated. License: same as this repository.

## `tokens/fighter.svg`, `tokens/goblin.svg`
Two original starter tokens (Plan §8.11): simple circular badges. License:
same as this repository.

## `symbols/*.svg`, `doors/*.svg`
73 dungeon-map symbol icons and 13 door variants, supplied by the project
owner as a pre-made SVG pack ("Classic Dungeon Map Symbols") to replace the
earlier procedural glyph/line-graphics rendering. **TODO: source/license not
yet recorded** — the archive carried no license file or provenance metadata.
Get the pack's license/attribution from the project owner and fill in this
section (author, source URL, license) before any public release/distribution
build. File-to-kind-id mapping is in
`packages/shared/src/map/vector/symbol-catalog.ts`.
