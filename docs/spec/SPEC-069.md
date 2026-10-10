## SPEC-069 — Stage pointer dispatch is a router over the seams

**Status: Draft** — DEC-136 answered (a); lands with WI-231.

_(New with IN-204, WI-171 §4 item 9. Completes SPEC-060 §4, which left the dispatch order
in `wireStagePointerEvents` "until IN-204 turns the ladder into a loop". Written against
the code as WI-218, WI-226 – WI-230 leave it, all of which run first. No `R`-number
predecessor.)_

### §1 — What is left of the ladder

After WI-218 (labels), WI-226 (draw), WI-227 (backgrounds), WI-228 (hex), WI-229 (select)
and WI-230 (tokens), `wireStagePointerEvents` calls three stage controllers and then the
component's own tools:

| Phase | Today (in this order)                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| down  | guards (`gestureActive`, non-primary button, Alt) → note dot → collab → hex → label/symbol/text clicks → `onPointerDown` (Select, then the stroke tools, Eye) |
| move  | cursor publish, label hover, hex note hover, hex preview point (all always) → hex fog stroke → collab → `onPointerMove`                                       |
| up    | hex fog commit → collab → `onPointerUp` (awaited in turn)                                                                                                     |
| out   | label hover cleared, hex note hover cleared                                                                                                                   |

Tokens never appear: their sprites take their own input (SPEC-068 §3, DEC-135). The
background gesture is reached from inside Select (SPEC-067 §3) and is not a ladder entry.
The stroke tools (Room, Corridor, N-gon, Capture, Carve, Path, Polygon, Wall, Door), the
square Symbol and Text clicks and the Eye stay in the component: WI-171 §5 ruled them
"what the vector editor _is_", not a seam.

### §2 — `MapPointerRouter` (DEC-136)

A plain class in `apps/web/src/lib/map/map-pointer-router.ts`. It is not a seam: it holds
no map state, is handed no store and no coordinate conversion, and never draws.

- **Construction.** `new MapPointerRouter(handlers, { gestureActive })`, where `handlers`
  is the ordered list of stage inputs and `gestureActive` a getter. Null entries are
  dropped, so the hex controller (constructed only on hex maps, DEC-133) is listed as
  `hex` and simply absent on a square map.
- **`attach(engine)`** wires the stage's `pointerdown`, `pointermove`, `pointerup`,
  `pointerupoutside` and `pointerout`, converts each event once with `engine.toWorld`, and
  hands every handler the same **raw world pixels** (SPEC-060 §4). `detach()` removes
  them; `destroy()` from the component's `onDestroy` calls it.
- **Down.** Returns early under the guards in §1, then offers the event to each handler's
  `pointerDown(worldPx)` in order until one returns `true`.
- **Move.** First calls every handler's `hover(worldPx)` — an observation that never
  consumes — then offers `pointerMove(worldPx)` in order until one returns `true`.
- **Up.** Offers `pointerUp(worldPx)` in order, awaiting each, until one resolves `true`.
- **Out.** Calls every handler's `pointerOut()`.
- **Cancel.** `cancel()` calls every handler's `cancel()`; `cancelStroke` becomes that
  call plus its one `renderAll()` and readout sync.

Every hook is optional. A handler with no `pointerDown` is skipped on down, and so on.

### §3 — The stage-input shape: one hook added to SPEC-060 §4

SPEC-060 §4's `pointerDown/Move/Up(worldPx): boolean` stands. This spec adds
**`hover(worldPx): void`** beside it, and the set is named `StageInput` in
`map/map-seam.ts`:

```ts
interface StageInput {
  hover?(worldPx: Vec2): void;
  pointerDown?(worldPx: Vec2): boolean;
  pointerMove?(worldPx: Vec2): boolean;
  pointerUp?(worldPx: Vec2): boolean | Promise<boolean>;
  pointerOut?(): void;
  cancel?(): void;
}
```

`hover` exists because a move is not a first-consumer-wins event today: the cursor
publish and both hovers run on every move, before anything can consume it. With only a
consuming hook, whichever handler sat first would starve the hovers behind it — a pen
stroke would freeze the label tooltip, a hex fog stroke would stop publishing the cursor.
Splitting observation from consumption keeps every move's side effects regardless of who
consumes it. What moves into `hover`:

- **draw** (WI-226): the throttled cursor publish.
- **labels** (WI-218): the label hover.
- **hex** (WI-228): the hex note hover and the Road/River preview point, which SPEC-066
  §5 put in `pointerMove`; its `pointerMove` keeps only the fog stroke.

### §4 — The order is one list, in the component

The component constructs the router in `onMount`, after the controllers, with:

```ts
[labels, hex, draw, editor];
```

The ordering comments that justify each position move from the ladder onto this list.
Down and up keep today's outcomes: the note dot still runs first, and the remaining
consumers are mutually exclusive by tool at any one event (hex: Select on a hex map and
the five hex tools; draw: Ping, Pen, Measure; the label tool's click, wherever WI-218 left
it; everything else falls to `editor`). Move keeps today's consumption order too: the hex
fog stroke before collab before the editor. Hex sits ahead of draw for that reason — it
is the order of today's move and up, and down cannot tell the difference. The hover
calls run in list order rather than today's (cursor, label, hex); they are independent
writes to independent state, so the order between them is not observable.

### §5 — `editor`: the component's own stage input

`editor` is an object literal in `VectorMapView` implementing `StageInput` over the code
that stays (§1). It is the only handler that converts with `toLatticeSnapped`/
`toLatticeRaw`, exactly where the ladder's tail does today:

- **down:** the square Symbol and Text clicks (raw lattice and raw world pixels, as
  today), then `onPointerDown(toLatticeSnapped(w), toLatticeRaw(w))` and
  `syncMeasureReadout()`; returns `true`.
- **move/up:** `onPointerMove`/`onPointerUp` with the same two conversions, then
  `syncMeasureReadout()`.
- **cancel:** the stroke-state reset that `cancelStroke` does today.

The Select controller (WI-229) stays where SPEC-067 §6 puts it — inside `onPointerDown`,
after `hoverRaw` is assigned and before the stroke tools — so `hoverRaw` is assigned on
exactly the events it is assigned today. It is not a separate list entry.

### §6 — What stays out of the router

- **The double-click and the keys.** The canvas `dblclick` (Measure's finish, else the
  multi-click finish) and `onKeyDown`/`onKeyUp` stay in the component. Enter finishes a
  multi-click line but not a Measure path, and the double-click does both; routing them
  through one fan-out would either merge the two or carry a flag for the difference.
  Escape calls `cancelStroke`, which now fans out through the router.
- **Tokens** (SPEC-068 §3) and the **gesture listener**, which keeps setting
  `gestureActive` and calling `cancelStroke`.

### §7 — Coordinate space (RULE-006)

The router converts nothing: every handler gets the same raw world pixels, and each
converts with the functions SPEC-060 §2 handed it. The hex controller is in the list only
on a hex map. The square-lattice conversions are called only by `editor` and by the
square seams, as today. No consumer is reached on a map whose grid kind it does not
declare that is not reached today.

### §8 — What this does not change

Identical outputs (SPEC-060 §5). No store method, schema, rule, layer, testid or
coordinate-space meaning changes. The oracle is the Playwright suite unchanged. New unit
tests drive `MapPointerRouter` with a fake stage and recording handlers: the guards; first
consumer wins on down, move and up; every `hover` runs before any `pointerMove`, including
when the first handler consumes; up awaits each handler in turn; null entries are dropped;
`pointerOut` and `cancel` reach every handler; `detach` removes every listener.
