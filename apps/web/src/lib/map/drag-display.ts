/**
 * Live-state substitution for `VectorMapView` (WI-207, from WI-171 §4 item 1).
 *
 * While a Select drag is in progress the stored arrays are left untouched; what
 * the renderer and the hit-testers see instead is "the stored records, with the
 * dragged one swapped for its working copy". Pure on purpose: each function is a
 * function of its arguments — no Pixi, no store, no reactivity — so the
 * substitution can be unit-tested without a canvas.
 */

import type {
  Drawing,
  MapRoom,
  MapSymbol,
  StoredVectorWall,
  VectorDoor,
  VectorFloorRegion,
} from '@osr-vtt/shared';
import { objectBounds, type HandleOwner, type ObjectSelection, type Point } from './vector-tools';

/** The slice of the component's `ActiveDrag` the substitution reads. */
export interface ActiveDragView {
  owner: HandleOwner;
  working: VectorFloorRegion | StoredVectorWall | VectorDoor;
}

/** The slice of the component's `ObjectDrag` the substitution reads. */
export interface ObjectDragView {
  selection: ObjectSelection;
  working: MapSymbol | MapRoom | Drawing;
}

/** Substitutes the in-progress Select-tool drag's working copy for its live
 * counterpart, so a drag previews without mutating the subscribed arrays. */
export function displayState(
  drag: ActiveDragView | null,
  regions: VectorFloorRegion[],
  walls: StoredVectorWall[],
  doors: VectorDoor[],
): {
  regions: VectorFloorRegion[];
  walls: StoredVectorWall[];
  doors: VectorDoor[];
} {
  if (!drag) return { regions, walls, doors };
  if (drag.owner.kind === 'region') {
    const id = drag.owner.id;
    return {
      regions: regions.map((r) => (r.id === id ? (drag.working as VectorFloorRegion) : r)),
      walls,
      doors,
    };
  }
  if (drag.owner.kind === 'wall') {
    const id = drag.owner.id;
    return {
      regions,
      walls: walls.map((w) => (w.id === id ? (drag.working as StoredVectorWall) : w)),
      doors,
    };
  }
  const id = drag.owner.id;
  return {
    regions,
    walls,
    doors: doors.map((d) => (d.id === id ? (drag.working as VectorDoor) : d)),
  };
}

/** Substitutes the in-progress Object-mode drag's working copy for its live
 * counterpart — mirrors `displayState`, for symbols/labels/drawings instead of
 * floor/wall/door geometry. */
export function displayOverlayState(
  drag: ObjectDragView | null,
  symbols: MapSymbol[],
  mapRooms: MapRoom[],
  drawings: Drawing[],
): {
  symbols: MapSymbol[];
  mapRooms: MapRoom[];
  drawings: Drawing[];
} {
  if (!drag) return { symbols, mapRooms, drawings };
  if (drag.selection.kind === 'symbol') {
    const id = drag.selection.id;
    return {
      symbols: symbols.map((s) => (s.id === id ? (drag.working as MapSymbol) : s)),
      mapRooms,
      drawings,
    };
  }
  if (drag.selection.kind === 'mapRoom') {
    const id = drag.selection.id;
    return {
      symbols,
      mapRooms: mapRooms.map((r) => (r.id === id ? (drag.working as MapRoom) : r)),
      drawings,
    };
  }
  const id = drag.selection.id;
  return {
    symbols,
    mapRooms,
    drawings: drawings.map((d) => (d.id === id ? (drag.working as Drawing) : d)),
  };
}

/** The stored drawings plus, while the Pen is mid-stroke, the stroke so far as a
 * `'__live__'` freehand. Unchanged (the same array) when there is nothing live. */
export function annotationsWithLiveStroke(
  source: Drawing[],
  tool: string,
  penPoints: { x: number; y: number }[],
): Drawing[] {
  if (tool !== 'pen' || penPoints.length < 2) return source;
  const live: Drawing = {
    id: '__live__',
    layer: 'mapping',
    kind: 'freehand',
    points: penPoints,
    style: {},
  };
  return [...source, live];
}

/** The highlight box for one selected object. `objectBounds` does the work
 * against the *displayed* records, so a mid-drag object's box tracks its working
 * copy; the label is the one departure — its box follows `labelSize` (the snap
 * step) rather than `pickMapRoomAt`'s whole cell, since that is the precision
 * `placeLabelAt` actually placed it at. Null when nothing's selected or the
 * selected object no longer exists (e.g. deleted by a peer). */
export function objectHighlightBBox(
  sel: ObjectSelection,
  disp: { symbols: MapSymbol[]; mapRooms: MapRoom[]; drawings: Drawing[] },
  doors: VectorDoor[],
  cellSize: number,
  labelSize: number,
): { a: Point; b: Point } | null {
  if (sel.kind === 'mapRoom') {
    const r = disp.mapRooms.find((x) => x.id === sel.id);
    if (!r) return null;
    const a = r.labelAnchor;
    return { a: { x: a.x, y: a.y }, b: { x: a.x + labelSize, y: a.y + labelSize } };
  }
  return objectBounds(sel, { ...disp, doors }, cellSize);
}
