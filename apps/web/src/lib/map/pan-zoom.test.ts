import { describe, expect, it } from 'vitest';
import { clampCameraToBounds, fitCameraToBounds, type CameraBounds } from './pan-zoom';

/**
 * The bounded camera a battle map takes on (SPEC-029 §4). The geometry is
 * pure so it can be asserted without a Pixi canvas — the engine's job is only
 * to write the result back onto `world`.
 *
 * Screen position of a world coordinate `w` is `offset + w * scale`, which is
 * what both predicates below are written in terms of.
 */

const SCREEN = { width: 800, height: 600 };
/** 40 × 30 cells at a cellSize of 40 — 1600 × 1200 world px. Twice the screen
 * in each direction and the same 4:3 aspect, so at any scale above 0.5 it
 * covers the screen and there is real room to pan. */
const BOUNDS: CameraBounds = { minX: 0, minY: 0, maxX: 1600, maxY: 1200 };

const EPS = 1e-9;

/** No part of the screen shows ground outside the rect. Only meaningful while
 * the scaled rect is at least as large as the screen on both axes. */
function screenInsideRect(
  view: { x: number; y: number; scale: number },
  b: CameraBounds,
): boolean {
  return (
    b.minX * view.scale + view.x <= EPS &&
    b.maxX * view.scale + view.x >= SCREEN.width - EPS &&
    b.minY * view.scale + view.y <= EPS &&
    b.maxY * view.scale + view.y >= SCREEN.height - EPS
  );
}

/** The whole rect is on screen — what a fit gives, letterboxing and all. */
function rectFullyVisible(
  view: { x: number; y: number; scale: number },
  b: CameraBounds,
): boolean {
  return (
    b.minX * view.scale + view.x >= -EPS &&
    b.maxX * view.scale + view.x <= SCREEN.width + EPS &&
    b.minY * view.scale + view.y >= -EPS &&
    b.maxY * view.scale + view.y <= SCREEN.height + EPS
  );
}

describe('clampCameraToBounds', () => {
  it('leaves a view already inside the bounds alone', () => {
    const view = { x: -400, y: -300, scale: 1 };
    expect(clampCameraToBounds(view, SCREEN, BOUNDS)).toEqual(view);
  });

  it('stops a pan at the rect edge instead of scrolling off it', () => {
    // Dragging the map right, past the rect's left edge.
    const clamped = clampCameraToBounds({ x: 250, y: 0, scale: 1 }, SCREEN, BOUNDS);
    expect(clamped.x).toBeCloseTo(0); // -minX * scale
    expect(screenInsideRect(clamped, BOUNDS)).toBe(true);
  });

  it('clamps every edge, in both directions', () => {
    for (const [x, y] of [
      [9999, 9999],
      [-9999, -9999],
      [9999, -9999],
      [-9999, 9999],
    ]) {
      const clamped = clampCameraToBounds({ x: x!, y: y!, scale: 1 }, SCREEN, BOUNDS);
      expect(screenInsideRect(clamped, BOUNDS)).toBe(true);
    }
  });

  it('will not zoom out past the whole rect', () => {
    // 800/1600 = 0.5 and 600/1200 = 0.5: half scale shows exactly the rect.
    const clamped = clampCameraToBounds({ x: 0, y: 0, scale: 0.1 }, SCREEN, BOUNDS);
    expect(clamped.scale).toBeCloseTo(0.5);
    expect(rectFullyVisible(clamped, BOUNDS)).toBe(true);
  });

  it('takes the axis needing the most zoom-out as the scale floor', () => {
    // A wide, short rect: the width is what has to be got in, and letterboxing
    // above and below is the cost. Taking the *cover* scale (0.5, the height)
    // instead would make this rect impossible to see whole.
    const wide: CameraBounds = { minX: 0, minY: 0, maxX: 4000, maxY: 1200 };
    const clamped = clampCameraToBounds({ x: 0, y: 0, scale: 0.05 }, SCREEN, wide);
    expect(clamped.scale).toBeCloseTo(800 / 4000); // 0.2, not 600/1200
    expect(rectFullyVisible(clamped, wide)).toBe(true);
  });

  it('centres an axis the scaled rect is too short to fill', () => {
    // Two cells square: fitting it needs 7.5×, at which its 600px height fills
    // the screen exactly and its width leaves 200px of slack.
    const tiny: CameraBounds = { minX: 0, minY: 0, maxX: 80, maxY: 80 };
    const clamped = clampCameraToBounds({ x: 0, y: 0, scale: 1 }, SCREEN, tiny);
    expect(clamped.scale).toBeCloseTo(7.5);
    // The rect's centre lands at the centre of the screen on both axes.
    expect(40 * clamped.scale + clamped.x).toBeCloseTo(SCREEN.width / 2);
    expect(40 * clamped.scale + clamped.y).toBeCloseTo(SCREEN.height / 2);
  });

  it('lets a viewer zoom in past the floor and pan within the rect', () => {
    const zoomed = clampCameraToBounds({ x: -100, y: -100, scale: 2 }, SCREEN, BOUNDS);
    expect(zoomed.scale).toBe(2);
    expect(zoomed).toEqual({ x: -100, y: -100, scale: 2 });
    expect(screenInsideRect(zoomed, BOUNDS)).toBe(true);
  });

  it('leaves the view alone before the canvas has been laid out', () => {
    // Pixi reports a 0 × 0 screen until the host element has a size; snapping
    // the camera to a bound derived from that would only be undone on resize.
    const view = { x: 123, y: 456, scale: 2 };
    expect(clampCameraToBounds(view, { width: 0, height: 0 }, BOUNDS)).toEqual(view);
  });

  it('leaves the view alone for a degenerate rect', () => {
    const view = { x: 123, y: 456, scale: 2 };
    const flat: CameraBounds = { minX: 5, minY: 5, maxX: 5, maxY: 9 };
    expect(clampCameraToBounds(view, SCREEN, flat)).toEqual(view);
  });
});

describe('fitCameraToBounds', () => {
  it('fits the tighter axis exactly and centres the other', () => {
    // Taller, relative to the screen, than it is wide: the height is what must
    // fit, leaving slack across.
    const tall: CameraBounds = { minX: 0, minY: 0, maxX: 800, maxY: 2400 };
    const fit = fitCameraToBounds(SCREEN, tall);
    expect(fit.scale).toBeCloseTo(600 / 2400); // 0.25
    // Height fits exactly: top edge at 0, bottom edge at the screen bottom.
    expect(0 * fit.scale + fit.y).toBeCloseTo(0);
    expect(2400 * fit.scale + fit.y).toBeCloseTo(SCREEN.height);
    // Width is centred: 800 × 0.25 = 200px of an 800px screen.
    expect(400 * fit.scale + fit.x).toBeCloseTo(SCREEN.width / 2);
    expect(rectFullyVisible(fit, tall)).toBe(true);
  });

  it('shows the whole rect wherever it sits in the lattice', () => {
    // A capture taken far from the origin — the case a fresh battle map with
    // no remembered camera would otherwise open at the wrong end of.
    const offset: CameraBounds = { minX: 4000, minY: 3200, maxX: 5600, maxY: 4400 };
    const fit = fitCameraToBounds(SCREEN, offset);
    expect(fit.scale).toBeCloseTo(0.5);
    expect(rectFullyVisible(fit, offset)).toBe(true);
  });

  it('is the resting point of a clamp — zooming out lands on the same view', () => {
    expect(fitCameraToBounds(SCREEN, BOUNDS)).toEqual(
      clampCameraToBounds({ x: 0, y: 0, scale: 0.01 }, SCREEN, BOUNDS),
    );
  });
});
