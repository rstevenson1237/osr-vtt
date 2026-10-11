/**
 * Small view helpers lifted out of `VectorMapView` (WI-207, from WI-171 §4
 * item 1): the screen-px → lattice conversion and the Road/River ghost — plus
 * the saved camera's view rect (SPEC-059 §3.4). Pure.
 */

import { hexMap } from '@osr-vtt/shared';
import type { HexLinePreview } from './vector-engine';
import { buildHexLinePreviewPoints } from './vector-tools';

/** A distance in screen pixels as lattice units, through the live zoom
 * (`worldScaleX`, `null` before the engine exists) so a pick radius stays the
 * same size on screen. */
export function latticeThreshold(
  screenPx: number,
  worldScaleX: number | null,
  cellSize: number,
): number {
  if (worldScaleX === null) return screenPx / cellSize;
  return screenPx / (worldScaleX * cellSize);
}

/** The Road/River ghost for this frame (SPEC-047 §12), or `null` when there is
 * nothing to show — any other tool, a square map, or a run too short to commit.
 * Derived entirely from live tool state and written nowhere. `pointFor` resolves
 * the hover pixel through the same call the click will, and is only called once
 * the tool and grid check out. */
export function hexLinePreview(
  tool: string,
  hasHexGrid: boolean,
  hexHoverPx: { x: number; y: number } | null,
  hexCollecting: readonly hexMap.HexPoint[],
  pointFor: (worldPx: { x: number; y: number }) => hexMap.HexPoint | null,
  width: number,
): HexLinePreview | null {
  if (!hasHexGrid || (tool !== 'road' && tool !== 'river')) return null;
  const pointer = hexHoverPx ? pointFor(hexHoverPx) : null;
  const points = buildHexLinePreviewPoints(hexCollecting, pointer);
  if (points.length < 2) return null;
  return {
    kind: tool,
    points,
    // The same values `finishMultiClick` will hand `addHexLine`, read from the
    // same controller state — which is what makes this a preview of the commit
    // rather than a sketch beside it. The shade is the width (SPEC-047 §14,
    // WI-129): there is no separate shade selection to read.
    shade: width,
    width,
    join: hexMap.hexLineEntry(tool).join,
  };
}

/** A map's camera as `VectorMapView` leaves it on unmount
 * (`MapToolController.camera`): the world container's screen position and
 * scale, plus the canvas's screen size at that moment. */
export interface MapCamera {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

/**
 * The world-pixel rect a saved camera had on screen — what "the current view"
 * means to the Backgrounds panel, which is never on stage beside the canvas
 * (SPEC-059 §3.4). With no saved camera (the map has not been opened in this
 * session) it is the view a hex map opens on: `0,0` at the centre of a
 * `fallback`-sized canvas at scale 1 (SPEC-030 §1).
 */
export function cameraViewRect(
  camera: MapCamera | undefined,
  fallback: { width: number; height: number },
): { x: number; y: number; w: number; h: number } {
  if (!camera || !(camera.scale > 0)) {
    return {
      x: -fallback.width / 2,
      y: -fallback.height / 2,
      w: fallback.width,
      h: fallback.height,
    };
  }
  return {
    x: -camera.x / camera.scale,
    y: -camera.y / camera.scale,
    w: camera.width / camera.scale,
    h: camera.height / camera.scale,
  };
}
