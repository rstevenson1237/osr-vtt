## SPEC-013 — Dimension HUD

**Status: Completed**

While dragging a shape, show a centered readout of the size that updates live and
disappears on commit — no persistence, no draft doc, purely local like the ruler label.
Shipped as `strokeMeasureText` → `ToolPreviewInput.measure`, in the map's `RoomMeasure`
units (`w × h`, or `radius:` for the N-gon), reused by the Measure tool via
`measureSpanText`.
