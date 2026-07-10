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

## `dice/d6/face-{1..6}.svg`
Original pip-face textures for the d6 die mesh used by the Three.js/Rapier
dice overlay (`apps/web/src/lib/dice/scene.ts`). Plain geometric SVG (rounded
square + circular pips), authored for this project. License: same as this
repository.

## `maps/starter-room.svg`
Original starter map background (Plan §8.11): a square-grid dungeon room,
64px-per-square grid matching the default token scale, procedurally
generated. License: same as this repository.

## `tokens/fighter.svg`, `tokens/goblin.svg`
Two original starter tokens (Plan §8.11): simple circular badges. License:
same as this repository.
