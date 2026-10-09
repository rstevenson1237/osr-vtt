## SPEC-066 — Hex authoring is a controller that exists only on hex maps

**Status: Draft** — the boundary in §2 waits on DEC-133.

_(New with IN-201, WI-171 §4 item 6. Follows SPEC-060's seam protocol; no `R`-number
predecessor.)_

### §1 — What leaves `VectorMapView`

Everything that turns a pointer on a hex map into an axial coordinate, and everything that
acts on the result, moves to one controller, `HexAuthoringController`, in
`apps/web/src/lib/map/map-hex.svelte.ts`:

- **Conversions.** `hexAt`, `hexSymbolPointFor`, `hexLinePointFor`.
- **Select's pick.** `handleHexPointerDown`, `selectedHexTile`, and the effect that drops a
  player's selected hex when it is fogged.
- **The click tools.** `placeHexSymbolAt` (SPEC-047 §4), `handleHexLabelClick` (§5),
  `placeHexTerrainAt` (§7).
- **Road/River.** `hexCollecting`, `hexHoverPx`, `addHexLineVertex`, `hexLinePreview`
  (§12), and the `road`/`river` branch of `finishMultiClick`.
- **Per-hex notes.** `hoverHexNote`, `hoverHexNoteText`, `updateHoverHexNote` (SPEC-030 §4).
- **The hex-tile sheet's handlers.** `mapCtrl.onSetHexTerrain`/`onSetHexContents`/
  `onSetHexNote` (SPEC-030 §5).
- **Hex fog** (SPEC-056 §9, added to these lines by WI-188 after the finding was written).
  `hexRevealed`, `hexHiddenFromMe`, `hexFogAllowed`, the stroke (`startHexFogAt`,
  `extendHexFogAt`, `commitHexFogStroke`, `settleHexFogPending`, `hexFogStroke`,
  `hexFogPending`), and the hex halves of `revealAll`/`resetFog`.
- **The hex data.** `hexTiles`, `hexSymbols`, `hexLines` and the three subscriptions that
  fill them, which the component already opens only on a hex map.

What stays: the `*Inputs()` composers (SPEC-060 §3), the markup and every testid, the
camera's open-on-origin rule, `gridInputs`, and `mapCtrl.setHexMap`.

### §2 — The axial boundary (DEC-133)

The controller is **constructed in `onMount` only when the map's grid kind is hex**; on a
square map the component holds `null`. A map's grid kind is fixed at creation (RULE-006),
and the component already makes the subscription decision once on the same test, so this
moves an existing decision rather than adding one.

- The controller is handed `hexSize` and converts with `hexMap.pixelToAxial`/
  `pixelToHexPoint`/`snapHexPoint` itself. It is the only place a pointer becomes an
  axial coordinate. It is never handed `toLatticeRaw`, `toLatticeSnapped` or `cellSize`.
- No square seam is handed the controller. A square-lattice consumer therefore cannot
  reach axial code, nor axial code a square-lattice one, because on any given map one of
  the two does not exist. Today that guarantee is a `if (!hexGrid)` at the top of each
  function; after this it is the construction.
- **The one dual-space reader is Measure** (SPEC-049 §1). Its path is lattice on every map
  and its hex count needs `pixelToAxial`. It is handed `hex?.hexAt ?? null` and nothing
  else of the controller. This is the case SPEC-060 §2's "never both" already tolerates
  today, stated rather than left implicit.

### §3 — What it is handed

Per SPEC-060 §2: `invalidate`, the store, `roomId`, `mapId`, `mapCtrl`, `hexSize`, and
`toScreen` from the engine (for the note anchor). The component's reactive values it reads
— `tool`, `isGM`, `selecting`, `gestureActive`, `dragging`, `isCoarsePointer`,
`effectiveSnap()`, and whether the map's fog is on — are handed as getters, not copied, so
a change is seen on the next call.

### §4 — Composers and markup read controller fields

`floorInputs` reads `hex?.tiles ?? []`; `overlayInputs` reads `hex?.symbols`/`hex?.lines`;
`fogInputs`' `hex` block reads the controller's revealed set and stroke preview;
`toolsInputs` reads `hex?.linePreview()` and `mapCtrl.selectedHex`; `revealedAt` reads
`hex?.revealed`. The `map-hex-*` and `map-selected-hex` testids read the same fields. All of
these are `$state`/`$derived` on the class, so the tracking effects follow them with no new
wiring, and every getter is pure (SPEC-060 §3 constraint 1).

### §5 — Pointer events

`pointerDown(worldPx): boolean` takes `handleHexPointerDown`'s place in
`wireStagePointerEvents` and also consumes the `hexSymbol`, `road`/`river`, `hexLabel`,
`hexTerrain` and `hexFog` branches. That merges branches without reordering any outcome:
those five tools and Select's hex pick are mutually exclusive with each other and with the
square `label`/`symbol`/`text` branches between them, and the note dot and collab handlers
still run first. `pointerMove(worldPx): boolean` records the preview point, updates the
note hover, and consumes the event only while a fog stroke is open. `pointerUp(): Promise<boolean>`
commits an open fog stroke. `pointerOut()`, `cancel()` (from `cancelStroke`) and
`finishLine()` (from the double-click) complete the set.

### §6 — What this does not change

Identical outputs (SPEC-060 §5). No store method, schema, rule, layer, testid or
coordinate-space meaning changes; every write is the same store call with the same
arguments. The oracle is the existing hex Playwright specs unchanged, plus unit tests that
construct the controller with a fake `invalidate` and a `MemoryStore` and drive each tool
from world pixels.
