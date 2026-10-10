## SPEC-067 — The selection is one model; the Select gesture is a controller over it

**Status: Draft** — DEC-134 answered (a); lands with WI-229.

_(New with IN-205, WI-171 §4 item 10. Follows SPEC-060's seam protocol; no `R`-number
predecessor.)_

### §1 — Why the selection is not just the gesture's state

IN-205 was written as "the Select gesture is 313 lines". Since WI-181 (SPEC-056 §3) the
selection it writes is shared with two other seams. Four slots are mutually exclusive:

| Slot                   | Written today by                                                                 |
| ---------------------- | -------------------------------------------------------------------------------- |
| `selectedHandles`      | the Select gesture (handle pick, lasso), `clearSelection`, `deleteSelection`     |
| `selectedObjects`      | the Select gesture (object pick, lasso), `clearSelection`, `deleteSelection`     |
| `selectedTokenIds`     | the token sprite's pointer handler (click, Shift-click), the lasso's token catch |
| `selectedBackgroundId` | `beginBackgroundGesture` (WI-227 moves it to the background controller)          |

Each writer keeps the exclusion by clearing the other three **by name**, in five places,
and one of them (the token click) does not resync `selectionCount_`. Once the gesture,
the background code (WI-227) and the token layer (IN-199) are three controllers, a
writer can no longer name another seam's variables. Something has to own the exclusion.

### §2 — `MapSelection`: what is selected (DEC-134)

A small class in `apps/web/src/lib/map/map-selection.svelte.ts`, constructed by the
component before any seam and handed to every seam that selects.

- **State.** `handles` and `objects` (`$state.raw` — a `Handle` carries a `locate`
  closure and is compared by `sameHandle`, so a reactive proxy buys nothing), `tokenIds`
  and `backgroundId` (`$state`).
- **Writers.** `selectHandles(h)`, `selectObjects(o)`, `selectGeometry(h, o)` (the lasso's
  mixed catch), `selectTokens(ids)`, `selectBackground(id)` and `clear()`. Each writer
  sets its own slot(s) and empties the rest, so the exclusion SPEC-037 §2 and SPEC-056 §3
  state lives in one place. A Shift-click toggle is `selectTokens` with the toggled list.
- **Reads.** `object` (the single selected object, or `null` — Rotate, the Room quick
  sheet publish and the `selected-object` readout are single-target) and `count` (the
  handles, plus the objects, plus one for a background that is still selectable: the
  `selection-count` readout). `count` takes a handed `backgroundSelectable(id)` getter so
  it never resolves a background itself.
- **No store, no engine, no coordinates.** It is a pure state holder; unit tests construct
  it with nothing.

`count` is `$derived`, replacing the hand-called `syncSelectionCount`. That fixes the one
place the readout goes stale today (a token click after a geometry pick leaves it nonzero
until the next pointer event). The readout sits behind `VITE_E2E_READOUTS` (SPEC-055 §3);
no spec asserts the stale value. It is the only output this item changes, and it is a
test mirror, not a user-visible one.

### §3 — `SelectionController`: the Select gesture

A SPEC-060 controller in `apps/web/src/lib/map/map-select.svelte.ts`, holding:

- **Gesture state.** `activeDrag` (vertex), `objectDrag` (whole object), `lasso`,
  `hoverHandle`.
- **The gesture.** `beginSelectGesture`, `beginHandleDrag`, `updateSelectDrag`,
  `endSelectDrag`, `beginObjectDrag`, `updateObjectDrag`, `endObjectDrag`, `finishLasso`.
- **The verbs.** `rotateSelectedObject` (via `mapCtrl.onRotateSelection`) and
  `deleteSelection` (the Backspace/Delete key handler calls it).
- **The drag previews' inputs.** `displayState()`/`displayOverlayState()` keep calling
  `dragStateFor`/`overlayStateFor` (`map/drag-display.ts`) with the controller's drag
  fields.

**What it is handed** (SPEC-060 §2): `invalidate`, `selection` (§2), the store, `roomId`,
`mapId`, `mapCtrl`, `applyOp` (the undo funnel, owned by `RoomShell`), and the square
conversions `toLatticeRaw`/`toLatticeSnapped` plus `cellSize` — Select's geometry pick is
square-lattice only; the hex pick is WI-228's controller (SPEC-066 §1), so this one is
never handed an axial conversion (RULE-006). Reactive reads — `regions`, `walls`, `doors`,
`symbols`, `mapRooms`, `drawings`, `tokens`, `effectiveSnap()` — are getters. The
background pick it falls through to is a handed `pickBackground(raw): boolean` (the
background controller's own gesture start), and a lasso's token catch reports its last
token through a handed `focusToken(id)`, which today sets `selectedTokenId` and
`mapCtrl.selectedToken` in the component and later belongs to IN-199.

`busy` (`activeDrag || objectDrag`) replaces the two free-variable reads in the
component's gesture guard and `vertexAttraction`.

### §4 — Who else writes through `MapSelection`

- The token sprite's pointer handler calls `selection.selectTokens(…)` in place of its
  three named clears. It stays in the component until IN-199.
- The background controller (WI-227) calls `selection.selectBackground(id)` on a pick.
  Whatever WI-227 hands it to report a pick is repointed at `MapSelection`; if WI-227
  keeps `selectedBackgroundId` inside the controller, that one field moves here.
- Map switch and `cancelStroke` call `selection.clear()` plus the controller's
  `cancel()` (drops `lasso`, `objectDrag`, `activeDrag`) and the background controller's
  own drag reset, as `clearSelection` does today.

### §5 — Composers and markup

`toolsInputs` reads `selection.handles`, `select.hoverHandle`, `select.lasso` and
`selection.objects`; `floorInputs`/`overlayInputs` read the drag previews through the
controller. `selected-object`, `selection-count` and `selected-token-count` read
`selection.object`, `selection.count` and `selection.tokenIds.length`. The
`rotatableSelection` mirror effect reads `selection.object`. Every getter is pure
(SPEC-060 §3 constraint 1).

### §6 — Pointer events

`pointerDown(worldPx)`, `pointerMove(worldPx)` and `pointerUp()` take the Select branch's
place in the ladder (SPEC-060 §4), at the same position. `pointerMove` also owns the
hover-handle update it does today. The order of outcomes inside the gesture — handle,
then object, then background, then lasso — is unchanged.

### §7 — What this does not change

Identical outputs (SPEC-060 §5) apart from §2's readout timing. No store method, schema,
rule, layer, testid or coordinate-space meaning changes; every write is the same store
call or `applyOp` op with the same arguments. The oracle is `select-tokens.spec.ts`,
`backgrounds.spec.ts` and the Select specs unchanged, plus unit tests for `MapSelection`
(every writer empties the other slots; `count` and `object`) and for the controller
driven with a fake `invalidate`, a `MemoryStore` and a recording `applyOp`.

**Ordering.** WI-171 put IN-205 last, after IN-204. With `MapSelection` in place, IN-199's
token controller and IN-204's router are both handed a settled selection rather than
reaching into the component for it, so this item now runs **before** both.
