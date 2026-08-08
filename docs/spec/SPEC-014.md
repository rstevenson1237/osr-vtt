## SPEC-014 — Labels v3

**Status: Completed**

- **§1 Inline edit.** Double-clicking a placed label opens an inline text editor
  positioned over it (an absolutely-positioned input in the map overlay, **not** a
  modal). Commit on blur or Enter; Escape cancels. Writes a `mapRoom` replace op
  (undoable).
- **§2 Delete.** The inline editor (and a context affordance) exposes Delete →
  `mapRoom` delete op (undoable).
- **§3 Renumber.** The room manager offers drag-to-reorder and direct `key` edit;
  keys must stay unique (`nextMapRoomKey` / a validator). Reordering rewrites affected
  keys in one batch op. Shipped in the Room quick sheet (`README.md` § "Session shell —
  quick sheets (II.1)").
