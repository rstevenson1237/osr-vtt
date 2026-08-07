## SPEC-012 — Door type system

**Status: Completed**

```ts
DoorType = 'none' | 'single' | 'double' | 'secret' | 'trapped' | 'oneWay' | 'barred';
```

`secret` is a **type**, not a flag. `facing` is meaningful only for `oneWay`.
`type: 'none'` is the removal sentinel. The Door tool does not cycle a fixed sequence:
clicking opens a type picker (or uses the palette's selected type) and sets it centered
on the nearest segment. State (open/closed) is a separate toggle.

**Rendering:** draw the wall stroke as normal, then stamp a **centered** type glyph at
the segment midpoint — single = door leaf; double = two leaves; secret = "S"; trapped =
hazard mark; one-way = arrow along `facing`; barred = double bar. Icons come from theme
tokens; no external art.

**LoS:** `open` passes; `closed`, `secret`, `barred`, `trapped(closed)` block. `oneWay`
blocks like a normal door for sight — per-side blocking is out of scope; the arrow is a
GM annotation.

> **Amended:** in the vector system doors are free-endpoint overlay objects with their
> own geometry, reconciled against walls at build time (`README.md` § "Map system —
> vector (II.2)"), not flags on a grid edge. Every door renders identically to every
> viewer — no `isGM`-gated branch (`DECISIONS.md` → vector map decision log, D5). The
> type/state/facing model above is unchanged.
