## SPEC-063 — One container per token

**Status: Draft** — DEC-130 (user, 2026-10-07); WI-221 gate cleared (user, 2026-10-07).

_(New with IN-113. Supersedes the "How the parts stay together" convention in SPEC-048 §4
for **where a token's parts are positioned**; what §4 says is drawn is unchanged.)_

### §1 — A token is one container

Each token on the `tokens` layer is drawn as one `PIXI.Container`, keyed by token id in a
single map that replaces `spritesByToken`, `backgroundsByToken`, `ringsByToken`,
`lettersByToken`, `awayBadgesByToken` and `brokenImageBadgesByToken`. Its children, back to
front: the colour disc, the art sprite, the letter, the away badge, the broken-image badge,
and the status ring.

- **The container owns the position.** It is placed at `token.pos` (pixel space, as today)
  except while the token is being dragged, when the drag writes the container's position
  instead of the sprite's. Every child sits at a fixed local offset: `0,0` for the disc,
  sprite, letter and ring; `(±0.72r, +0.72r)` for the two corner badges, as today.
- **Nothing re-syncs a token's parts during a drag.** `resyncTokenDecorations` (WI-118) is
  deleted: moving the container moves every child. A seventh per-token drawing added later
  joins by being added to the container, with no drag code to remember.
- **Per-child look is unchanged.** Alpha, tint and visibility stay on the children that
  carry them today: the sprite's alpha and tint, the disc and letter copying the sprite's
  alpha and visibility, the ring taking visibility only. The container itself is not dimmed,
  so the ring and badges do not start dimming with the art.
- **Sizes are unchanged.** `sprite.width/height` stay `TOKEN_PX * token.size`; the
  container is not scaled.

### §2 — Rings draw above all token art

The status ring and the collapsed-group count badge stay children of their token's
container (so they move with it by construction) and are **rendered** in one Pixi
`RenderLayer` attached to the `tokens` layer above every token container. Result: a ring
or count badge is never covered by another token's art, whatever order the tokens were
created in.

This replaces today's behaviour, which is an accident of creation order: rings of tokens
created in the same pass sit above all of their art, but a token created later is appended
after them and can cover an earlier token's ring.

The count badge of a collapsed group becomes a child of its **anchor** token's container,
at the anchor's `(+0.7r, −0.7r)` offset as today, and moves when the anchor's container
moves. `syncCollapsedBadges` therefore no longer runs on each pointer move.

### §3 — Pointer events

The sprite stays the only hit target. The container takes `eventMode = 'passive'` (it does
not receive events but lets its children receive them); every other child keeps
`eventMode = 'none'`. The sprite keeps its drag handlers, `cursor` and `eventMode = 'static'`,
so hit testing, `stopPropagation` and the `grab`/`grabbing`/`pointer` cursors behave
exactly as today. The drag handler reads and writes the **container's** position wherever
it reads or writes `sprite.position` today, including the other members of a dragged
group.

### §4 — Export

`export-layers.ts` exports the `tokens` layer as one object and does not walk tokens
individually; the PNG export must still include the rings and count badges rendered
through the §2 render layer. The executor verifies this with an export of a map with a
selected token, and records the result.

### §5 — What this does not change

No store method, schema, security rule, coordinate meaning or `data-testid`. The `tokens`
layer's position in the engine's layer order is unchanged; only its contents change shape
(per-token containers instead of loose objects), which is why this is Deceptive under
RULE-006. Token art, disc, letter, ring colour and badge drawing are unchanged. The move of
this code out of `VectorMapView` into a `TokenLayerController` is IN-199, which runs after
this so that it extracts one map rather than six.
