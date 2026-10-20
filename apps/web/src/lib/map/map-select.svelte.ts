import type {
  Drawing,
  MapRoom,
  MapSymbol,
  StoredVectorWall,
  Token,
  VectorDoor,
  VectorFloorRegion,
} from '@osr-vtt/shared';
import { vectorMap } from '@osr-vtt/shared';
import type { MapToolController } from '../shell/map-tool-controller.svelte';
import { displayOverlayState, displayState } from './drag-display';
import type { MapBackgrounds } from './map-backgrounds.svelte';
import type { MapSeamDeps } from './map-seam';
import type { MapSelection } from './map-selection.svelte';
import {
  buildDragOp,
  buildHandleRemovalOp,
  buildObjectRemovalOp,
  findOwnerRecord,
  lassoBBox,
  lassoSelect,
  lassoSelectTokens,
  ownerKey,
  pickObject,
  pickVertexHandle,
  recomputeRegionBBox,
  vertexHandles,
  type Handle,
  type HandleOwner,
  type ObjectCatalog,
  type ObjectSelection,
  type OwnerRecord,
  type Point,
  type VectorEditorOp,
} from './vector-tools';

export interface ActiveDrag {
  owner: HandleOwner;
  before: VectorFloorRegion | StoredVectorWall | VectorDoor;
  working: VectorFloorRegion | StoredVectorWall | VectorDoor;
  ref: Point;
}

type ObjectRecord = MapSymbol | MapRoom | Drawing;

export interface ObjectDrag {
  selection: ObjectSelection;
  working: ObjectRecord;
  /** Offset from the drag anchor to the object's own position field, in that
   * field's native space (lattice for symbol/mapRoom, pixel for drawing —
   * `Drawing.points` are pixel-space, see `pickObject`). */
  offset: { x: number; y: number };
}

export interface SelectionControllerDeps extends MapSeamDeps {
  /**
   * The one conversion this seam is handed (SPEC-060 §2, RULE-006): a world
   * pixel into the snapped square-lattice point. Select's geometry pick is
   * square-lattice only; a hex map's pick is the hex controller's, so this seam
   * is never handed an axial conversion.
   */
  toLatticeSnapped: (worldPx: Point) => Point;
  /** What a click changes: the four slots, written through one model. */
  selection: MapSelection;
  /** The shared tool state: the View lock, and the room the Room quick sheet
   * follows. */
  mapCtrl: Pick<MapToolController, 'mapMode' | 'selectedMapRoomId'>;
  /** The undo funnel (`RoomShell`'s stack); a floor-geometry edit goes through it. */
  applyOp: (op: VectorEditorOp) => Promise<void>;
  /** The background seam's gesture, the lowest-priority pick Select falls
   * through to (SPEC-039 §2). */
  background: Pick<
    MapBackgrounds,
    'dragging' | 'pointerDown' | 'pointerMove' | 'pointerUp' | 'cancel'
  >;
  /** A lasso's token catch reports its last token (today the component sets
   * `selectedTokenId` and `mapCtrl.selectedToken`; IN-199 takes that over). */
  focusToken: (id: string) => void;
  cellSize: () => number;
  /** The one pick radius for this canvas, already in lattice units. */
  pickThreshold: () => number;
  effectiveSnap: () => vectorMap.VectorSnapMode;
  regions: () => VectorFloorRegion[];
  walls: () => StoredVectorWall[];
  doors: () => VectorDoor[];
  symbols: () => MapSymbol[];
  mapRooms: () => MapRoom[];
  drawings: () => Drawing[];
  tokens: () => readonly Token[];
}

/**
 * The Select gesture (SPEC-067 §3, WI-229): one press, one gesture (SPEC-037
 * §1) — a vertex handle, else a whole object, else an unlocked background, else
 * a lasso over open canvas. It writes what is selected through `MapSelection`
 * and holds only the gesture's own state.
 *
 * Nothing here is `$state`, as in the component before it and as in the
 * background seam: the drags, the lasso and the hover ring are per-frame render
 * bookkeeping the layer passes read inside tracking effects, and each move
 * invalidates the layers it touches explicitly. Making them reactive would
 * re-run those effects on every assignment on top of that.
 */
export class SelectionController {
  readonly #deps: SelectionControllerDeps;

  #activeDrag: ActiveDrag | null = null;
  #objectDrag: ObjectDrag | null = null;
  #lasso: { a: Point; b: Point } | null = null;
  #hoverHandle: Handle | null = null;

  constructor(deps: SelectionControllerDeps) {
    this.#deps = deps;
  }

  get activeDrag(): ActiveDrag | null {
    return this.#activeDrag;
  }

  get objectDrag(): ObjectDrag | null {
    return this.#objectDrag;
  }

  /** The in-progress lasso's two corners, or `null` when the Select drag is a
   * single-pick/move rather than a sweep over open canvas. */
  get lasso(): { a: Point; b: Point } | null {
    return this.#lasso;
  }

  get hoverHandle(): Handle | null {
    return this.#hoverHandle;
  }

  /** A vertex or whole-object drag is armed. */
  get busy(): boolean {
    return this.#activeDrag !== null || this.#objectDrag !== null;
  }

  /** The stored records with the in-progress drag's working copy substituted
   * (see `map/drag-display.ts`). */
  displayOverlayState() {
    return displayOverlayState(
      this.#objectDrag,
      this.#deps.symbols(),
      this.#deps.mapRooms(),
      this.#deps.drawings(),
    );
  }

  displayState() {
    return displayState(
      this.#activeDrag,
      this.#deps.regions(),
      this.#deps.walls(),
      this.#deps.doors(),
    );
  }

  /** Drops lasso, object drag and vertex drag without a write (Escape, a map
   * switch, a deleted selection). The caller clears the selection itself. */
  cancel(): void {
    this.#activeDrag = null;
    this.#dropSweep();
  }

  /** The lasso and the whole-object drag. A vertex drag already armed is left
   * to its release, as `deleteSelection` always has. */
  #dropSweep(): void {
    this.#lasso = null;
    this.#objectDrag = null;
  }

  destroy(): void {
    this.cancel();
    this.#hoverHandle = null;
  }

  // ---- pointer events (SPEC-060 §4, SPEC-067 §6) ----

  /** Always consumes: the caller only reaches this on the Select tool. */
  pointerDown(worldPx: Point): boolean {
    this.#beginSelectGesture(this.#deps.toLatticeSnapped(worldPx), worldPx);
    // What a press changes by itself — the picked handle, a lasso's first
    // corner, a background's drag — is all on `tools`; a selection change is
    // reactive and invalidates its own layers. A handle drag armed here
    // draws nothing new until the pointer moves, which is when `floor`
    // first reconciles its preview (WI-193).
    this.#deps.invalidate('tools');
    return true;
  }

  pointerMove(worldPx: Point): boolean {
    const p = this.#deps.toLatticeSnapped(worldPx);
    // Only the layers the move touches (WI-193): the handles, lasso, hover
    // ring and highlights are all on `tools`; a vertex drag also redraws the
    // floor it reshapes (and `overlay`, where a dragged door is drawn); an
    // object drag moves a symbol, label or drawing on `overlay`.
    if (this.#activeDrag) {
      this.#updateSelectDrag(p);
      if (this.#activeDrag.owner.kind === 'door') {
        this.#deps.invalidate('floor', 'overlay', 'tools');
      } else {
        this.#deps.invalidate('floor', 'tools');
      }
    } else if (this.#objectDrag) {
      this.#updateObjectDrag(p);
      this.#deps.invalidate('overlay', 'tools');
    } else if (this.#deps.background.dragging) {
      this.#deps.background.pointerMove(worldPx);
    } else if (this.#lasso) {
      this.#lasso.b = p;
      this.#deps.invalidate('tools');
    } else {
      this.#hoverHandle = pickVertexHandle(p, this.#handles(), this.#deps.pickThreshold());
      this.#deps.invalidate('tools');
    }
    return true;
  }

  async pointerUp(): Promise<boolean> {
    if (this.#activeDrag) await this.#endSelectDrag();
    else if (this.#objectDrag) await this.#endObjectDrag();
    else if (this.#deps.background.dragging) await this.#deps.background.pointerUp();
    else if (this.#lasso) this.#finishLasso();
    this.#deps.invalidate();
    return true;
  }

  // ---- the gesture ----

  /** The Select tool's whole-object catalog, live rather than mid-drag: the
   * lasso sweeps what is committed, not a working copy. */
  #objectCatalog(): ObjectCatalog {
    return {
      symbols: this.#deps.symbols(),
      mapRooms: this.#deps.mapRooms(),
      doors: this.#deps.doors(),
      drawings: this.#deps.drawings(),
    };
  }

  #handles(): Handle[] {
    return vertexHandles(this.#deps.regions(), this.#deps.walls(), this.#deps.doors());
  }

  /**
   * One click, one gesture (SPEC-037 §1). A vertex handle under the pointer
   * wins — the priority the old Vertex mode had — and starts a geometric drag;
   * failing that an object under the pointer is picked and, for the kinds that
   * move, dragged; failing both, an unlocked background under the pointer is
   * picked, lowest priority of everything Select considers (SPEC-039 §2);
   * failing all three, the drag is a lasso over open canvas (§2).
   *
   * A token under the pointer never reaches here — its own sprite intercepts
   * the pointer event first and stops it propagating, the same priority tokens
   * already had over the canvas before multi-select (SPEC-056 §3).
   *
   * Under the View lock (`mapCtrl.mapMode === 'view'`, DEC-109) a handle or
   * object pick still selects — the inspect half of "read-only geometry" —
   * but `#beginHandleDrag`/`#beginObjectDrag` themselves skip arming the actual
   * drag, so nothing here has to know the mode.
   */
  #beginSelectGesture(point: Point, worldPx: Point): void {
    const threshold = this.#deps.pickThreshold();
    const handle = pickVertexHandle(point, this.#handles(), threshold);
    if (handle) {
      this.#deps.selection.selectHandles([handle]);
      this.#beginHandleDrag(handle);
      return;
    }
    const hit = pickObject(point, this.#deps.cellSize(), this.#objectCatalog(), threshold);
    if (hit) {
      this.#beginObjectDrag(hit, point);
      return;
    }
    if (this.#deps.background.pointerDown(worldPx)) return;
    // Open canvas: start sweeping. Nothing is deselected yet — the release
    // decides, so a lasso that catches something replaces the selection and
    // one that catches nothing clears it, both in one place.
    this.#deps.selection.dropBackground();
    this.#lasso = { a: point, b: point };
  }

  #beginHandleDrag(handle: Handle): void {
    // Read-only under the View lock (SPEC-056 §3, DEC-109): the handle is
    // still selected (highlighted, inspectable) by the caller, but nothing
    // here arms a drag to move it.
    if (this.#deps.mapCtrl.mapMode === 'view') return;
    const before = findOwnerRecord(
      handle.owner,
      this.#deps.regions(),
      this.#deps.walls(),
      this.#deps.doors(),
    );
    if (!before) return;
    // The arrays are `$state`, so their entries are Svelte 5 reactive proxies —
    // the native `structuredClone` can't clone those directly (throws "could
    // not be cloned"). `$state.snapshot()` is the documented escape hatch: it
    // unwraps to a plain, clonable object.
    const working = structuredClone($state.snapshot(before));
    this.#activeDrag = { owner: handle.owner, before, working, ref: handle.locate(working) };
  }

  #updateSelectDrag(point: Point): void {
    if (!this.#activeDrag) return;
    this.#activeDrag.ref.x = point.x;
    this.#activeDrag.ref.y = point.y;
  }

  async #endSelectDrag(): Promise<void> {
    const drag = this.#activeDrag;
    if (!drag) return;
    this.#activeDrag = null;
    const after =
      drag.owner.kind === 'region'
        ? recomputeRegionBBox(drag.working as VectorFloorRegion)
        : drag.working;
    await this.#deps.applyOp(buildDragOp(drag.owner, drag.before, after));
  }

  /** Collects everything the released lasso caught (SPEC-037 §2, extended by
   * SPEC-056 §3/DEC-109) — vertex handles and whole objects in one set,
   * unless the sweep caught any token, in which case it selects tokens only
   * (Backspace never deletes a token, so a mixed catch would otherwise be
   * asymmetric about what a following Backspace removes). A sweep that
   * caught nothing at all clears the selection, matching a click on open
   * canvas. */
  #finishLasso(): void {
    const rect = lassoBBox(this.#lasso!.a, this.#lasso!.b);
    this.#lasso = null;
    const caughtTokenIds = lassoSelectTokens(rect, this.#deps.tokens(), this.#deps.cellSize());
    if (caughtTokenIds.length) {
      this.#deps.selection.selectTokens(caughtTokenIds);
      this.#deps.focusToken(caughtTokenIds[caughtTokenIds.length - 1]!);
      return;
    }
    const caught = lassoSelect(rect, this.#handles(), this.#objectCatalog(), this.#deps.cellSize());
    this.#deps.selection.selectGeometry(caught.handles, caught.objects);
    // Publish a lassoed room label the same way a click on one does, so the
    // Room quick sheet follows either gesture.
    const room = caught.objects.length === 1 ? caught.objects[0]! : null;
    if (room?.kind === 'mapRoom') this.#deps.mapCtrl.selectedMapRoomId = room.id;
  }

  // ---- whole objects ----

  #beginObjectDrag(hit: ObjectSelection, point: Point): void {
    this.#deps.selection.selectObjects([hit]);
    this.#objectDrag = null;
    // Picking a room label is also what drives the Room quick sheet's
    // "currently selected room" (Shell UI Redesign) — publish it before the
    // drag bookkeeping below, which returns early for some kinds.
    if (hit.kind === 'mapRoom') this.#deps.mapCtrl.selectedMapRoomId = hit.id;
    // Read-only under the View lock (SPEC-056 §3, DEC-109): still selected
    // for inspect (the Room quick sheet publish above included), just never
    // armed to move.
    if (this.#deps.mapCtrl.mapMode === 'view') return;
    if (hit.kind === 'door') return; // doors: select-only here
    const cellSize = this.#deps.cellSize();
    if (hit.kind === 'symbol') {
      const orig = this.#deps.symbols().find((s) => s.id === hit.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      this.#objectDrag = {
        selection: hit,
        working,
        offset: { x: working.cell.x - point.x, y: working.cell.y - point.y },
      };
    } else if (hit.kind === 'mapRoom') {
      const orig = this.#deps.mapRooms().find((r) => r.id === hit.id);
      if (!orig) return;
      const working = structuredClone($state.snapshot(orig));
      this.#objectDrag = {
        selection: hit,
        working,
        offset: { x: working.labelAnchor.x - point.x, y: working.labelAnchor.y - point.y },
      };
    } else {
      const orig = this.#deps.drawings().find((d) => d.id === hit.id);
      if (!orig || !orig.points.length) return;
      const working = structuredClone($state.snapshot(orig));
      const anchorPx = { x: point.x * cellSize, y: point.y * cellSize };
      this.#objectDrag = {
        selection: hit,
        working,
        offset: { x: working.points[0]!.x - anchorPx.x, y: working.points[0]!.y - anchorPx.y },
      };
    }
  }

  #updateObjectDrag(point: Point): void {
    const drag = this.#objectDrag;
    if (!drag) return;
    if (drag.selection.kind === 'symbol') {
      const s = drag.working as MapSymbol;
      s.cell = vectorMap.anchorCellFor(
        { x: point.x + drag.offset.x, y: point.y + drag.offset.y },
        this.#deps.effectiveSnap(),
      );
    } else if (drag.selection.kind === 'mapRoom') {
      // No rounding — labels are placed at whatever precision the current
      // snap mode gives (see `MapLabels.place`), not forced to whole cells.
      const r = drag.working as MapRoom;
      r.labelAnchor = { x: point.x + drag.offset.x, y: point.y + drag.offset.y };
    } else {
      const d = drag.working as Drawing;
      const cellSize = this.#deps.cellSize();
      const anchorPx = { x: point.x * cellSize, y: point.y * cellSize };
      const target = { x: anchorPx.x + drag.offset.x, y: anchorPx.y + drag.offset.y };
      const dx = target.x - d.points[0]!.x;
      const dy = target.y - d.points[0]!.y;
      d.points = d.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    }
  }

  async #endObjectDrag(): Promise<void> {
    const drag = this.#objectDrag;
    this.#objectDrag = null;
    if (!drag) return;
    const { store, roomId, mapId } = this.#deps;
    if (drag.selection.kind === 'symbol') {
      await store.placeSymbol(roomId, mapId, drag.working as MapSymbol);
    } else if (drag.selection.kind === 'mapRoom') {
      await store.upsertMapRoom(roomId, mapId, drag.working as MapRoom);
    } else {
      await store.writeDrawing(roomId, mapId, drag.working as Drawing);
    }
  }

  // ---- the verbs ----

  /** Rotate whatever Object mode has picked. Symbols cycle through the four
   * cardinal orientations (`MapSymbol.rotation`, already stored and rendered);
   * a door has no rotation field — its angle is derived from `a`→`b` — so it
   * flips end-for-end, which is the 180° the art needs. Like the other overlay
   * edits (`#endObjectDrag`) this writes straight to the store rather than
   * through the floor-geometry undo stack. */
  async rotateSelectedObject(): Promise<void> {
    // Read-only under the View lock (SPEC-056 §3, DEC-109) — rotate is a
    // geometry edit like any other; the Rotate/Flip button's own visibility
    // only tracks *what* is selected, not the lock, so this is where that's
    // enforced.
    if (this.#deps.mapCtrl.mapMode === 'view') return;
    const sel = this.#deps.selection.object;
    if (!sel) return;
    const { store, roomId, mapId } = this.#deps;
    if (sel.kind === 'symbol') {
      const orig = this.#deps.symbols().find((s) => s.id === sel.id);
      if (!orig) return;
      await store.placeSymbol(roomId, mapId, {
        ...structuredClone($state.snapshot(orig)),
        rotation: (orig.rotation + 90) % 360,
      });
    } else if (sel.kind === 'door') {
      const orig = this.#deps.doors().find((d) => d.id === sel.id);
      if (!orig) return;
      const flipped = structuredClone($state.snapshot(orig));
      await store.setDoor(roomId, mapId, { ...flipped, a: flipped.b, b: flipped.a });
    }
    this.#deps.invalidate();
  }

  /**
   * Backspace/Delete over the whole current selection (SPEC-037 §3,
   * SPEC-056 §2.2).
   *
   * Two halves, because the two kinds of member are removed two different
   * ways — but both go through the undo stack as one combined entry, so one
   * Backspace is one Ctrl+Z. Selected **vertices** are a geometric edit on
   * committed floor geometry — a floor vertex re-stitches its ring where it
   * can (§4), a wall or door endpoint takes its whole segment. Selected
   * **objects** (symbol, label, door, drawing) are removed and re-created
   * whole, the same `from`/`to: null` shape a door endpoint already used.
   */
  async deleteSelection(): Promise<void> {
    const { selection } = this.#deps;
    const handles = selection.handles;
    const objects = selection.objects;
    if (!handles.length && !objects.length) return;
    selection.clear();
    this.#dropSweep();
    this.#deps.background.cancel();

    const regions = this.#deps.regions();
    const walls = this.#deps.walls();
    const doors = this.#deps.doors();

    // Snapshot only the records the handles actually name — `from` is what
    // undo writes back, and the live proxies are about to be deleted out from
    // under it.
    const records = new Map<string, OwnerRecord>();
    for (const h of handles) {
      const key = ownerKey(h.owner);
      if (records.has(key)) continue;
      const rec = findOwnerRecord(h.owner, regions, walls, doors);
      if (rec) records.set(key, structuredClone($state.snapshot(rec)));
    }
    const handleOp = buildHandleRemovalOp(handles, records);

    // A door caught both as an object and by one of its endpoints is already
    // gone via `handleOp`; removing it twice would be a wasted write and a
    // duplicate undo entry.
    const removedDoors = new Set(
      handles.filter((h) => h.owner.kind === 'door').map((h) => h.owner.id),
    );
    const objectRecords = new Map<string, MapSymbol | MapRoom | VectorDoor | Drawing>();
    for (const sel of objects) {
      const key = `${sel.kind}:${sel.id}`;
      if (objectRecords.has(key)) continue;
      const rec =
        sel.kind === 'symbol'
          ? this.#deps.symbols().find((s) => s.id === sel.id)
          : sel.kind === 'mapRoom'
            ? this.#deps.mapRooms().find((r) => r.id === sel.id)
            : sel.kind === 'door'
              ? doors.find((d) => d.id === sel.id)
              : this.#deps.drawings().find((d) => d.id === sel.id);
      if (rec) objectRecords.set(key, structuredClone($state.snapshot(rec)));
    }
    const objectOp = buildObjectRemovalOp(objects, removedDoors, objectRecords);

    const ops = [handleOp, objectOp].filter((o): o is VectorEditorOp => o !== null);
    if (ops.length) {
      await this.#deps.applyOp(ops.length === 1 ? ops[0]! : { kind: 'batch', ops });
    }
    this.#deps.invalidate();
  }
}
