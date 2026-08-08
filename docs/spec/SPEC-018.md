## SPEC-018 — Asset removal & multi-room management

**Status: Completed**

- **§1 Removal — resolved, no work needed.** The saved-asset ✕ per tile (with a
  confirm) is sufficient. Bundled starter assets stay non-removable by design.
- **§2 Multi-room manager.** A **Rooms** panel listing every `MapRoom` (key, name,
  cell-count) with rename, renumber/reorder (feeding SPEC-014 §3), jump-to (center the
  viewport) and delete, reading the existing `mapRooms` subscription and writing
  undoable `mapRoom` ops. Shipped as the Room quick sheet, which also gained per-room
  players' notes (`README.md` § "Session shell — quick sheets (II.1)").
