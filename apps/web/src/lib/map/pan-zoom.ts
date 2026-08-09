import * as PIXI from 'pixi.js';

/**
 * Pan/zoom for a Pixi world container — cursor-anchored wheel zoom, right-click/
 * Alt/Space drag pan, and two-finger touch pan+pinch. Extracted from the
 * cellular `engine.ts` (Master Plan v2, R1.8/U12/U17) so the Vector Map editor
 * (WI-D) can share it instead of re-implementing gesture handling.
 */

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 6;

/**
 * A rectangle the camera may not leave, in **world pixels** (lattice ×
 * `cellSize`) — the space `world`'s children are drawn in.
 *
 * The ordinary vector map has no such rectangle: the floor is unbounded, so
 * the camera is too. A battle map is the one bounded case (SPEC-029 §4): it is
 * a cut-out of another map, and panning off the captured rect would show empty
 * space the snapshot does not own.
 */
export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** `world`'s transform, which is translation + uniform scale only. */
export interface CameraView {
  x: number;
  y: number;
  scale: number;
}

/**
 * The nearest view to `view` that keeps the camera on `bounds`.
 *
 * Two things are clamped, in this order.
 *
 * **Scale** has a floor: the scale at which the whole rect is on screen.
 * Zooming out stops there rather than letting the rect shrink into the middle
 * of a field of nothing. It is deliberately the *fit* scale (the smaller of
 * the two axis ratios) and not the *cover* scale (the larger): a capture whose
 * aspect differs from the viewer's canvas would otherwise be impossible to see
 * whole, which is the one thing a referee starting a fight wants first. The
 * cost is letterboxing on the looser axis at full zoom-out, which is honest —
 * the rect is what exists, and the ground beside it is not part of this map.
 *
 * **Pan** is then clamped per axis: where the scaled rect is longer than the
 * screen its edges are held at or beyond the screen's, so nothing past them
 * can be scrolled to; where it is shorter, it is centred, because no pan on
 * that axis would keep the whole screen inside the rect anyway.
 *
 * Pure — no Pixi — so the geometry is unit-testable; the engine applies the
 * result to `world`.
 */
export function clampCameraToBounds(
  view: CameraView,
  screen: { width: number; height: number },
  bounds: CameraBounds,
): CameraView {
  const rectW = bounds.maxX - bounds.minX;
  const rectH = bounds.maxY - bounds.minY;
  // A degenerate rect, or a canvas that has not been laid out yet, has no
  // meaningful clamp — leaving the view alone beats snapping it somewhere
  // arbitrary that the next resize would have to undo.
  if (!(rectW > 0) || !(rectH > 0) || !(screen.width > 0) || !(screen.height > 0)) return view;

  const fit = Math.min(screen.width / rectW, screen.height / rectH);
  const lo = Math.max(MIN_ZOOM, fit);
  // `Math.max(MAX_ZOOM, lo)` rather than MAX_ZOOM: a rect small enough that
  // fitting it needs more than MAX_ZOOM still has to be allowed to fit.
  const scale = Math.min(Math.max(view.scale, lo), Math.max(MAX_ZOOM, lo));

  return {
    scale,
    x: clampAxis(view.x, screen.width, bounds.minX, bounds.maxX, scale),
    y: clampAxis(view.y, screen.height, bounds.minY, bounds.maxY, scale),
  };
}

/** One axis of the pan clamp. Screen position of a world coordinate `w` is
 * `offset + w * scale`, so "the rect covers the screen" is
 * `min * scale + offset <= 0` and `max * scale + offset >= screenLen`. */
function clampAxis(
  offset: number,
  screenLen: number,
  min: number,
  max: number,
  scale: number,
): number {
  const lo = screenLen - max * scale;
  const hi = -min * scale;
  // The rect is shorter than the screen on this axis: no offset satisfies both
  // ends, so centre it rather than jamming it against one.
  if (lo > hi) return (screenLen - (min + max) * scale) / 2;
  return Math.min(Math.max(offset, lo), hi);
}

/** The view showing the whole of `bounds`: one axis fits exactly, the other is
 * centred with slack either side. Expressed as a clamp from a scale of zero,
 * because "as far out as the bound allows" is precisely the scale floor
 * `clampCameraToBounds` already computes. */
export function fitCameraToBounds(
  screen: { width: number; height: number },
  bounds: CameraBounds,
): CameraView {
  return clampCameraToBounds({ x: 0, y: 0, scale: 0 }, screen, bounds);
}

/** Scale `world` by `factor` while keeping the world point currently under the
 * screen coordinate `(sx, sy)` fixed (cursor/pinch-anchored zoom). The world
 * has only translation + uniform scale, so `globalX = world.x + localX*scale`
 * inverts cleanly without touching the transform matrix. */
export function zoomWorldAt(world: PIXI.Container, factor: number, sx: number, sy: number): void {
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, world.scale.x * factor));
  if (clamped === world.scale.x) return;
  const local = world.toLocal({ x: sx, y: sy } as PIXI.PointData);
  world.scale.set(clamped);
  world.x = sx - local.x * clamped;
  world.y = sy - local.y * clamped;
}

/** True when the currently-focused element would consume a literal space
 * keystroke (typing) rather than meaning "hold to pan" (Master Plan v2, R1.8
 * space-drag pan / U12). */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

export function setupPanZoom(
  application: PIXI.Application,
  worldContainer: PIXI.Container,
  onGesture: (active: boolean) => void,
  /** True while the dedicated Pan tool is the active map tool — makes a
   * plain left-drag pan without needing a modifier key, alongside the
   * existing right-click/Alt/Space paths (which stay available regardless
   * of the active tool). */
  isPanTool: () => boolean = () => false,
  /** Temporarily override the canvas cursor for the duration of a gesture,
   * or restore it (`null`). The engine owns the *base* cursor (one per active
   * tool, see `setCursor`), so space-drag can't just clear `style.cursor`
   * back to `''` — that would drop the tool's cursor until the next tool
   * change. */
  setOverrideCursor: (css: string | null) => void = () => {},
  /** Re-apply the engine's camera bounds after this module has moved or
   * scaled `world` (SPEC-029 §4). Every gesture below writes the transform
   * directly, so the bound has to be re-imposed at each of those writes
   * rather than checked once; unbounded maps pass the default no-op and are
   * unaffected. */
  clampCamera: () => void = () => {},
): () => void {
  application.stage.eventMode = 'static';
  application.stage.hitArea = application.screen;

  let panning = false;
  let lastX = 0;
  let lastY = 0;
  // Space-drag pan (Master Plan v2, R1.8 / U12): holding Space turns a plain
  // left-drag into a pan, same as the existing right-click/Alt path.
  let spacePressed = false;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !isEditableElement(document.activeElement)) {
      spacePressed = true;
      setOverrideCursor('grab');
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      spacePressed = false;
      setOverrideCursor(null);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  application.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    if (e.target !== application.stage) return;
    if (e.pointerType === 'touch') return; // touch pan/zoom handled below
    if (e.button === 2 || e.altKey || (e.button === 0 && (spacePressed || isPanTool()))) {
      panning = true;
      lastX = e.global.x;
      lastY = e.global.y;
      // Same "a gesture superseded the active tool" signal touch pinch/pan
      // already sends (MapView cancels/blocks tool strokes while active).
      onGesture(true);
    }
  });
  application.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
    if (!panning) return;
    worldContainer.x += e.global.x - lastX;
    worldContainer.y += e.global.y - lastY;
    lastX = e.global.x;
    lastY = e.global.y;
    clampCamera();
  });
  const stopPan = () => {
    if (!panning) return;
    panning = false;
    onGesture(false);
  };
  application.stage.on('pointerup', stopPan);
  application.stage.on('pointerupoutside', stopPan);

  application.canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      // Cursor-anchored bounded zoom (Master Plan v2, R1.8 / U17) — reuses
      // the same `zoomWorldAt` the touch-pinch path already relies on.
      const rect = application.canvas.getBoundingClientRect();
      zoomWorldAt(worldContainer, factor, e.clientX - rect.left, e.clientY - rect.top);
      clampCamera();
    },
    { passive: false },
  );
  application.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- Touch (Master Plan v2, R1.8): one finger = the active tool (handled by
  // MapView's federated pointer wiring); two fingers = pan; pinch = zoom. Track
  // raw touch pointers on the canvas so we can distinguish 1- vs 2-finger and
  // anchor the pinch at the gesture centroid. `touch-action: none` stops the
  // browser from stealing the gesture for page scroll/zoom. ----
  const canvas = application.canvas;
  canvas.style.touchAction = 'none';
  const touches = new Map<number, { x: number; y: number }>();
  let prev: { cx: number; cy: number; dist: number } | null = null;

  function canvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function centroid(): { cx: number; cy: number; dist: number } {
    const pts = [...touches.values()];
    const cx = (pts[0]!.x + pts[1]!.x) / 2;
    const cy = (pts[0]!.y + pts[1]!.y) / 2;
    const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
    return { cx, cy, dist };
  }

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, canvasPoint(e));
    if (touches.size === 2) {
      onGesture(true); // cancel any single-finger tool stroke already begun
      prev = centroid();
    }
  });
  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, canvasPoint(e));
    if (touches.size === 2 && prev) {
      const cur = centroid();
      worldContainer.x += cur.cx - prev.cx; // two-finger drag = pan
      worldContainer.y += cur.cy - prev.cy;
      if (prev.dist > 0) zoomWorldAt(worldContainer, cur.dist / prev.dist, cur.cx, cur.cy);
      clampCamera();
      prev = cur;
    }
  });
  const releaseTouch = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.delete(e.pointerId)) return;
    prev = null;
    if (touches.size === 0) onGesture(false);
  };
  canvas.addEventListener('pointerup', releaseTouch);
  canvas.addEventListener('pointercancel', releaseTouch);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
