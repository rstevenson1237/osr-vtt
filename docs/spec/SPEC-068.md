## SPEC-068 — The token layer is a controller that owns its own sprites' input

**Status: Draft** — DEC-135 open; lands with WI-230.

_(New with IN-199, WI-171 §4 item 8. Follows SPEC-060's seam protocol and adds the one
input shape it does not cover; no `R`-number predecessor. Written against the code as
WI-221 (SPEC-063) and WI-229 (SPEC-067) leave it, both of which run first.)_

### §1 — What leaves `VectorMapView`

Everything that draws, loads, drags or places a token moves to one controller,
`TokenLayerController`, in `apps/web/src/lib/map/token-layer.svelte.ts`:

- **The sprite lifecycle.** SPEC-063's per-token container map and `syncSprites` with the
  badge, ring, letter and collapsed-group-badge passes it runs; `badgesByGroup`;
  `refsByToken` and `textureKey`; `loadTokenTexture`, `rasterizeTokenImage`,
  `brokenImageTexture` and its cache; `brokenImageIds`; `createCountBadge`.
- **The drag.** `attachDragHandlers` and everything it closes over: `draggingIds`, the
  pickup offsets, the set drag, the drag-distance chip, the snap on drop, and
  `moveTokenUndoable`/`moveTokensUndoable`.
- **Placement.** `addCreature` (with `addingCreature`) and the quick-sheet DOM drop
  (`onCanvasDragOver`, `onCanvasDrop`).
- **The focused token.** `selectedTokenId` and the `mapCtrl.selectedToken` mirror,
  written by one `focus(id)` method. This is the `focusToken` SPEC-067 §3 hands the
  Select controller, which "later belongs to IN-199".
- **The test mirrors.** `brokenTokenCount`, `tokenLetterText_` and `lastBatchMoveCount`,
  as `$state` fields the markup reads.

What stays in the component: the visibility derivations (`mapVisibleIds`,
`renderableTokens`, `currentTurnIds`, `collapsedGroups`, `hiddenCollapsedIds`,
`hiddenTokenIds`), because the `token-current-*`/`token-ring-*` readouts and the layer's
tracking effect both read them; `revealedAt` and `isAway` (IN-198's pure helpers);
`handleResizeToken`; the markup and every testid; and the tracking `$effect` itself, which
now ends in `tokenLayer.sync(renderableTokens)` instead of `syncSprites(renderableTokens)`.

### §2 — The token layer is not a render pass

`map/map-renderer.ts` already says it: `background` and `tokens` keep their own sprite
lifecycles and are not passes. That stays true. The controller mutates Pixi display
objects directly, as the component does today, and Pixi's own ticker paints them; it is
not handed `invalidate` and nothing about the `tokens` layer joins `RENDER_LAYERS`. The
sync stays driven by the component's one tracking `$effect` (§1), whose dependency list
does not change.

### §3 — Input: the controller owns its sprites' handlers (DEC-135)

A token is not picked by the stage. Each token's art sprite is its own Pixi hit target
(`eventMode = 'static'`, SPEC-063 §3) and stops propagation, so the stage's
`wireStagePointerEvents` ladder never sees a pointer that lands on a token. The
controller keeps that: it attaches the sprite handlers when it creates a container and
owns everything they do.

This is a **second input shape** beside SPEC-060 §4's `pointerDown/Move/Up(worldPx)`: a
seam whose hit targets are its own display objects takes their events directly and
implements no stage hook. The token controller therefore has no branch in the ladder and
none in IN-204's router. The ordering this preserves is Pixi's: a sprite's `pointerdown`
fires, and stops, before the stage's handler would have run.

### §4 — What it is handed

Per SPEC-060 §2: the store, `roomId`, `mapCtrl`, `selection` (SPEC-067 §2), the engine
(`layers.tokens`, `world`, `app.canvas`), the shared undo stack's `push`, `dialogs` (for
`addCreature`'s token picker) and `assets.resolve`. The component's reactive values it
reads are getters, not copies: `tokens`, `groups`, `tool`, `isGM`, `myUid`,
`presentSeatIds`, `currentTurnIds`, `hiddenTokenIds`, `collapsedGroups`, `map.measure`,
`cellSize`, `hexGrid?.size`.

**Coordinate space.** `Token.pos` is pixel space on every map, as today. The controller
moves its two existing grid-kind-dependent calls unchanged: `snapFor('token', …)`, which
already takes `cellSize` and `hexSize` and picks by grid kind, and the drag chip's
`measureSpanText`, which reads `pos / cellSize`. It is handed no `toLatticeRaw`,
`toLatticeSnapped`, `hexAt` or `pixelToHexPoint`, and gains no new conversion
(RULE-006).

**The View tools.** A token clicked with Ping publishes the ping (`store.publishPing`, as
today). A token clicked with Eye calls a handed `aimEye(pos)`, which the component (or
whichever seam owns the Eye by then) implements; the controller never writes the eye's
state.

**Selection.** A click or Shift-click writes `selection.selectTokens(…)` (SPEC-067 §4,
which leaves this handler in the component "until IN-199"), then `focus(id)`. Raising the
owner's sheet stays a handed `onSelectActor`.

### §5 — Teardown

`destroy()` clears the controller's maps and sets, the job the component's `onDestroy`
does for the six token maps today; the Pixi nodes themselves still go with
`engine.destroy()`. Map switch keeps calling it in the same place it clears `draggingIds`
today.

### §6 — What this does not change

Identical outputs (SPEC-060 §5). No store method, schema, rule, layer, layer order,
testid or coordinate-space meaning changes; every write is the same store call with the
same arguments, and every undo entry is pushed exactly as before. The oracle is the
existing Playwright specs that reach tokens (`select-tokens.spec.ts`,
`token-image-load.spec.ts`, `group-ownership.spec.ts`, `presence.spec.ts` and every other
spec that drags, letters or drops a token) unchanged, plus unit tests that construct
the controller with a stub engine, a `MemoryStore` and a recording undo `push`, and drive
`sync`, the drop and `addCreature` without a browser.
