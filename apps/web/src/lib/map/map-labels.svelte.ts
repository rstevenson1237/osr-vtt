import { tick } from 'svelte';
import type { MapRoom } from '@osr-vtt/shared';
import type { SquareSeamDeps } from './map-seam';
import { nextVectorId, pickMapRoomAt, pickNoteDotAt, pickObject, type Point } from './vector-tools';

/** Canvas-relative pixels a tooltip is anchored on, plus the room it describes. */
export interface LabelTooltipAt {
  id: string;
  x: number;
  y: number;
}

export interface MapLabelsDeps extends SquareSeamDeps {
  mapRooms: () => readonly MapRoom[];
  /** The players' note behind a label; `''` when it has none. */
  noteText: (roomId: string) => string;
  isCoarsePointer: () => boolean;
  cellSize: () => number;
  /** The one pick radius for this canvas, already in lattice units. */
  pickThreshold: () => number;
  /** True while the pointer is busy with another gesture (pan, drag, lasso…). */
  isBusy: () => boolean;
  /** Snaps a raw lattice point to the active snap mode's cell. */
  snapCell: (raw: Point) => Point;
  /** Edge length of that snap cell, in lattice units. */
  snapCellSize: () => number;
  /** Lattice-to-canvas-pixels; `null` until the engine exists. */
  toScreen: (world: Point) => Point | null;
}

/**
 * The room-label seam (SPEC-060 §2–§5, WI-218): the in-canvas name editor, the
 * hover and pinned tooltip, the coarse-pointer note dot, and the anchor maths
 * they share. State is `$state` on the class, so the component's `*Inputs()`
 * composers and its template read it as plain fields and the layer effects
 * track it with no further wiring — which is why nothing here calls
 * `invalidate`.
 */
export class MapLabels {
  readonly #deps: MapLabelsDeps;

  // ---- inline label name editor ----
  editingId = $state<string | null>(null);
  editingText = $state('');
  editingPos = $state({ x: 0, y: 0 });
  /** Bound by the template's `<textarea>`. */
  inputEl = $state<HTMLTextAreaElement | undefined>();
  /** A not-yet-created label being named for the first time (created on commit). */
  #pending: { id: string; key: string; anchor: Point } | null = null;

  // ---- tooltip ----
  hover = $state<LabelTooltipAt | null>(null);
  /** The coarse-pointer half (SPEC-033 §4, DEC-059): a tap on a note dot pins
   * the tooltip open, because a finger has no hover to hold it there. Separate
   * from `hover` so the pointer events around a tap cannot clear it. */
  pinned = $state<LabelTooltipAt | null>(null);

  constructor(deps: MapLabelsDeps) {
    this.#deps = deps;
  }

  /** Mirrors the renderer's label size (half a cell, floor 9px) so the editor
   * reads as the label itself, in place. */
  readonly fontPx = $derived.by(() => Math.max(9, this.#deps.cellSize() / 2));

  /** Pinned wins: it was asked for explicitly, and on a coarse pointer the
   * hover slot is only ever filled by the incidental moves around a tap. */
  readonly active = $derived(this.pinned ?? this.hover);
  readonly activeText = $derived.by(() => (this.active ? this.#deps.noteText(this.active.id) : ''));
  /** Nothing to say, nothing to show; also hidden while that label is renamed
   * so the tooltip never covers the editor. */
  readonly showTooltip = $derived(
    !!this.active && this.activeText.trim().length > 0 && this.editingId !== this.active.id,
  );
  /** What the shared popover renders for a room label, or `null`. */
  readonly tooltip = $derived(
    this.showTooltip && this.active
      ? { x: this.active.x, y: this.active.y, text: this.activeText }
      : null,
  );

  /** The rooms drawing a note dot, and so the rooms whose dot a tap can hit
   * (SPEC-033 §4). Coarse pointers only, and only where the tooltip would have
   * something to say. */
  readonly noteDotRooms = $derived.by(() =>
    this.#deps.isCoarsePointer()
      ? this.#deps.mapRooms().filter((r) => this.#deps.noteText(r.id).trim().length > 0)
      : [],
  );
  readonly noteDotRoomIds = $derived(new Set(this.noteDotRooms.map((r) => r.id)));

  /** Canvas-relative pixels for a room's tooltip, anchored on the label's cell
   * centre — shared by the hover and pinned paths. */
  tooltipAnchor(room: MapRoom): { x: number; y: number } {
    const cellSize = this.#deps.cellSize();
    return (
      this.#deps.toScreen({
        x: (room.labelAnchor.x + 0.5) * cellSize,
        y: (room.labelAnchor.y + 0.5) * cellSize,
      }) ?? { x: 0, y: 0 }
    );
  }

  // ---- pointer events (SPEC-060 §4) ----

  /** A tap inside a note dot pins that room's tooltip; a second tap on the same
   * dot closes it. Returns whether the tap was consumed — `false` leaves it for
   * the active tool. */
  pointerDown(worldPx: Point): boolean {
    if (!this.#deps.isCoarsePointer()) return false;
    const room = pickNoteDotAt(
      this.#deps.toLatticeRaw(worldPx),
      this.noteDotRooms,
      this.#deps.pickThreshold(),
    );
    if (!room) {
      // Anywhere else on the stage dismisses a pinned tooltip, but does not
      // consume the tap: the tool the user has in hand still gets it.
      this.pinned = null;
      return false;
    }
    if (this.pinned?.id === room.id) {
      this.pinned = null;
      return true;
    }
    this.pinned = { id: room.id, ...this.tooltipAnchor(room) };
    return true;
  }

  /** Hover half of the tooltip. Never consumes the event. */
  pointerMove(worldPx: Point): boolean {
    // Hover is a fine-pointer affordance; on a coarse pointer the note dot is
    // the only way to the tooltip (SPEC-033 §4). A touch still emits
    // `pointermove` around a tap and the dot sits inside the cell
    // `pickMapRoomAt` tests, so honouring those would fill the hover slot for
    // the very room being tapped and leave a tooltip that will not close.
    if (this.#deps.isCoarsePointer()) {
      this.hover = null;
      return false;
    }
    // A gesture in progress (including a space/right-drag pan, which sweeps
    // across labels wholesale) means the pointer is busy with something else.
    if (this.#deps.isBusy()) {
      this.hover = null;
      return false;
    }
    const room = pickMapRoomAt(this.#deps.toLatticeRaw(worldPx), this.#deps.mapRooms());
    if (!room) {
      this.hover = null;
      return false;
    }
    if (this.hover?.id === room.id) return false; // already showing; don't jitter it
    this.hover = { id: room.id, ...this.tooltipAnchor(room) };
    return false;
  }

  /** The pointer left the stage. */
  pointerOut(): void {
    this.hover = null;
  }

  /** Drops both tooltips. Their positions are captured in screen pixels, so
   * anything that moves the camera invalidates them (SPEC-033 §4). */
  dismissTooltips(): void {
    this.hover = null;
    this.pinned = null;
  }

  // ---- label editor ----

  /** The Label tool's click: land on an existing label and rename it in place;
   * otherwise start a new one. */
  toolClick(worldPx: Point): void {
    const raw = this.#deps.toLatticeRaw(worldPx);
    const mapRooms = this.#deps.mapRooms();
    const hit = pickObject(
      raw,
      this.#deps.cellSize(),
      { symbols: [], mapRooms: [...mapRooms], doors: [], drawings: [] },
      this.#deps.pickThreshold(),
    );
    if (hit?.kind === 'mapRoom') {
      const room = mapRooms.find((r) => r.id === hit.id);
      if (room) {
        this.open(room.id, room.labelAnchor);
        return;
      }
    }
    this.place(raw);
  }

  /** Opens the editor for a new label at `raw`: the keyed MapRoom is created
   * once, with the typed name, on commit — no empty-name intermediate doc. */
  place(raw: Point): void {
    const anchor = this.#deps.snapCell(raw);
    this.#pending = {
      id: nextVectorId('room'),
      key: String(this.#deps.mapRooms().length + 1),
      anchor,
    };
    this.open(this.#pending.id, anchor);
  }

  open(id: string, latticePoint: Point): void {
    const room = this.#deps.mapRooms().find((r) => r.id === id);
    // A label entering its editor dismisses its pinned tooltip (SPEC-033 §4) —
    // the editor is a DOM textarea over the same spot.
    if (this.pinned?.id === id) this.pinned = null;
    this.editingId = id;
    this.editingText = room?.name ?? '';
    // The renderer centres a label on its cell's interior (`labelAnchor + half a
    // cell`), so the editor must too. `toScreen` returns canvas-relative pixels.
    const half = this.#deps.snapCellSize() / 2;
    const cellSize = this.#deps.cellSize();
    const at = this.#deps.toScreen({
      x: (latticePoint.x + half) * cellSize,
      y: (latticePoint.y + half) * cellSize,
    });
    if (at) this.editingPos = at;
    void tick().then(() => this.inputEl?.focus());
  }

  async commit(): Promise<void> {
    const id = this.editingId;
    const pending = this.#pending;
    this.editingId = null;
    this.#pending = null;
    if (!id) return;
    const name = this.editingText.trim();
    const { store } = this.#deps;
    const existing = this.#deps.mapRooms().find((r) => r.id === id);
    if (existing) {
      await store.upsertMapRoom(this.#deps.roomId, this.#deps.mapId, { ...existing, name });
    } else if (pending && pending.id === id && name) {
      // First commit for a brand-new label — create the MapRoom with its name.
      // An empty name is treated as a cancel (no stray unnamed room).
      await store.upsertMapRoom(this.#deps.roomId, this.#deps.mapId, {
        id,
        key: pending.key,
        name,
        bbox: { x: pending.anchor.x - 1, y: pending.anchor.y - 1, w: 2, h: 2 },
        labelAnchor: { x: pending.anchor.x, y: pending.anchor.y },
        wallStyle: 'masonry',
      });
    }
  }

  cancel(): void {
    this.editingId = null;
    this.#pending = null;
  }

  // Commit on Enter or Tab (not on blur): right after placement the Pixi canvas
  // steals focus back, so an `onblur` commit would close the editor before the
  // user could type. Escape cancels.
  keydown(e: KeyboardEvent): void {
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault();
      void this.commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    }
  }

  destroy(): void {
    this.dismissTooltips();
    this.cancel();
  }
}
