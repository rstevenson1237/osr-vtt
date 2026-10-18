import * as PIXI from 'pixi.js';
import type { MapBackground } from '@osr-vtt/shared';
import type { MapSeamDeps } from './map-seam';
import {
  backgroundRect,
  backgroundSpaceScale,
  backgroundTransform,
  liveBackgroundRect as liveRectFor,
  minBackgroundSize,
  nativeAspect as nativeAspectOf,
  settleBackgroundTextures,
  type BackgroundSpace,
} from './background-view';
import {
  backgroundHitTest,
  backgroundRectChanged,
  moveBackground,
  resizeBackground,
  type BgHandle,
  type BgRect,
} from './background-transform';
import { latticeThreshold } from './view-helpers';
import { hexToNumber } from '../theme';
import type { Point } from './vector-tools';

/** Screen-pixel grab radius for the resize handle, converted to the background
 * space (lattice units, or world pixels on a hex map) through the live zoom so
 * it stays the same size on screen. Slightly larger than the drawn handle, the
 * way a hit target should be. */
export const BG_HANDLE_GRAB_PX = 10;

export type BackgroundColorState = { kind: 'color'; color: string } | { kind: 'none' };

export interface MapBackgroundsDeps extends MapSeamDeps {
  /**
   * The one conversion this seam is handed (SPEC-060 §2, RULE-006): a world
   * pixel into the space the map's grid kind declares for its backgrounds —
   * the raw (unsnapped) lattice point on a square map, the world pixel itself
   * on a hex map (SPEC-059 §3). The seam never converts any other way, so it
   * cannot reach a lattice conversion from a hex map.
   */
  toSpace: (worldPx: Point) => Point;
  /** The space this map's backgrounds are drawn and dragged in (SPEC-059 §3). */
  space: () => BackgroundSpace;
  /** The placed backgrounds, lowest `order` painted first. */
  ordered: () => readonly MapBackground[];
  /** A player's Select never sees a background as an object (DEC-063). */
  isGM: () => boolean;
  /** The Pixi layer the sprites live in, or `null` before the engine exists or
   * after it has gone. */
  layer: () => PIXI.Container | null;
  /** The live zoom (`world.scale.x`), or `null` without an engine. */
  zoom: () => number | null;
  /** Hands the renderer's clear colour over (`null` returns it to the theme). */
  setClearColor: (color: number | null) => void;
  /** Loads one background's texture. A rejection means "could not be loaded". */
  loadTexture: (ref: string) => Promise<PIXI.Texture>;
  /** The ids whose image could not be loaded, for the Backgrounds panel's note.
   * Called on every pass, an empty list included. */
  reportBroken: (ids: string[]) => void;
  /** Select picked this background up. The component owns the selection model,
   * so it clears the other picks and holds the id; WI-229 repoints this. */
  onPick: (id: string) => void;
}

interface BackgroundGesture {
  id: string;
  /** `'body'` moves the rect; a `BgHandle` resizes from that handle
   * (SPEC-039 §3 — a corner ratio-locked, an edge free on its one axis). */
  kind: 'body' | BgHandle;
  /** Where the pointer went down, in the background space — a move is measured
   * as a delta from here so the image never jumps to centre on the cursor. */
  from: Point;
  start: BgRect;
  rect: BgRect;
  /** Native width ÷ height of the loaded texture, so a corner resize can
   * restore the true ratio even for a legacy rect that was folded to the whole
   * grid and is therefore stretched. */
  aspect: number;
}

/**
 * The background seam (SPEC-060 §2–§5, WI-227): the sprite lifecycle of the
 * placed background images (SPEC-038 §2), the solid clear colour, and the Select
 * tool's move/resize gesture on an unlocked one (SPEC-039 §2). The gesture
 * follows the pointer by moving the Pixi sprite directly; one settled
 * `setBackgroundTransform` lands on release (RULE-003), never a write per frame.
 *
 * Nothing here is `$state`, as in the component before it: the sprite map and the
 * gesture are per-frame render bookkeeping the layer passes read inside tracking
 * effects, and making them reactive would re-run those effects on every
 * assignment on top of the explicit `invalidate`. The composers read the live
 * rect through `liveRect`, which is pure (SPEC-060 §3).
 */
export class MapBackgrounds {
  readonly #deps: MapBackgroundsDeps;

  /** One sprite per placed background image, keyed by document id. Pixi display
   * objects the render pass owns, like the token sprite cache. */
  readonly #sprites = new Map<string, PIXI.Sprite>();
  #loadSeq = 0;
  #drag: BackgroundGesture | null = null;

  constructor(deps: MapBackgroundsDeps) {
    this.#deps = deps;
  }

  // ---- the clear colour ----

  /** The map's solid clear colour (`GameMap.background`) — the renderer's
   * background, never a `layers.background` sprite (SPEC-029 §2). `none` hands
   * the clear colour back to the room's theme rock, which is what shows
   * anywhere no background image covers. */
  applyColor(bg: BackgroundColorState): void {
    this.#deps.setClearColor(bg.kind === 'color' ? hexToNumber(bg.color) : null);
  }

  // ---- the sprite lifecycle ----

  /**
   * Syncs `layers.background` against the map's placed background images
   * (SPEC-038 §2, amended by SPEC-059 §2): one sprite each, positioned and
   * scaled to its own stored placement — a lattice rect on a square map, the
   * span of its two hex corners on a hex map (SPEC-059 §3.1) — added in `order`
   * so the lowest paints first.
   *
   * Each texture settles on its own (`settleBackgroundTextures`), so one image
   * that will not load draws nothing and never stops the rest of the layer from
   * updating; the failures go to `reportBroken`. A sprite under a local drag
   * keeps the drag's live rect (`liveRect`) rather than snapping back to a
   * stored rect an incoming snapshot carries; the settled write lands on
   * pointer-up.
   *
   * Textures load asynchronously, so `#loadSeq` guards the whole pass — a pass
   * superseded while a texture was in flight drops its results rather than
   * adding sprites for a map (or a background set) that has since been replaced.
   */
  async apply(bgs: readonly MapBackground[], space: BackgroundSpace): Promise<void> {
    if (!this.#deps.layer()) return;
    const seq = ++this.#loadSeq;
    const { loaded, failed } = await settleBackgroundTextures(bgs, (bg) =>
      this.#deps.loadTexture(bg.ref),
    );
    if (seq !== this.#loadSeq) return;

    // Recorded even when the canvas has unmounted mid-pass: the referee who
    // switches straight to Assets is exactly who reads the panel's note.
    for (const bg of failed) {
      console.warn(`[VectorMapView] background image failed to load: ${bg.ref}`);
    }
    this.#deps.reportBroken(failed.map((bg) => bg.id));
    const layer = this.#deps.layer();
    if (!layer) return;

    // A removed background and an unloadable one both lose their sprite.
    const drawn = new Set(loaded.map(({ bg }) => bg.id));
    for (const [id, sprite] of this.#sprites) {
      if (!drawn.has(id)) {
        sprite.destroy();
        this.#sprites.delete(id);
      }
    }
    for (const { bg, texture } of loaded) {
      let sprite = this.#sprites.get(bg.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(texture);
        this.#sprites.set(bg.id, sprite);
      } else if (sprite.texture !== texture) {
        sprite.texture = texture;
      }
      const rect = liveRectFor(bg, this.#drag, space);
      const px = backgroundSpaceScale(space);
      sprite.position.set(rect.x * px, rect.y * px);
      sprite.width = rect.w * px;
      sprite.height = rect.h * px;
      // Re-adding an existing child moves it to the top of the container, so
      // walking the sorted list end to end leaves the layer in `order`.
      layer.addChild(sprite);
    }
  }

  // ---- read side for the `*Inputs()` composers ----

  /** The live rect of a background: the in-progress gesture's if one is running
   * on it, the stored one otherwise. What both the overlay and the sprite are
   * drawn from. Pure. */
  liveRect(bg: MapBackground): BgRect {
    return liveRectFor(bg, this.#drag, this.#deps.space());
  }

  /** Whether a move/resize gesture is in progress. */
  get dragging(): boolean {
    return this.#drag !== null;
  }

  // ---- pointer events (SPEC-060 §4) ----
  // These take the raw world pixel and convert it with the `toSpace` the
  // component handed in. The Select ladder calls `pointerDown` as its
  // lowest-priority pick (SPEC-039 §2), after a vertex handle and every whole
  // object have both missed; on a hex map it is tried before the hex pick.

  /**
   * An unlocked background under the pointer is selected and starts dragging in
   * the same gesture — handle or body, exactly as `#pick` found it, so a press
   * on what will be the resize handle resizes from the first click, with no
   * separate "select, then resize" step. Returns `false` when nothing unlocked
   * is under the pointer, so the caller falls through to the lasso (or the hex
   * pick) exactly as a press on open canvas always has.
   */
  pointerDown(worldPx: Point): boolean {
    if (!this.#deps.isGM()) return false; // DEC-063: never a Select object for a player
    const p = this.#deps.toSpace(worldPx);
    const found = this.#pick(p);
    if (!found) return false;
    const { bg, kind } = found;
    this.#deps.onPick(bg.id);
    const space = this.#deps.space();
    const rect = backgroundRect(bg, space);
    this.#drag = {
      id: bg.id,
      kind,
      from: p,
      start: rect,
      rect,
      aspect: nativeAspectOf(this.#sprites.get(bg.id)?.texture, rect),
    };
    return true;
  }

  /** Repositions the picked image mid-gesture without waiting for the store
   * round-trip — the same "draw the drag, commit on release" pattern the floor
   * tools and token drags use. `false` when no gesture is running. */
  pointerMove(worldPx: Point): boolean {
    const drag = this.#drag;
    if (!drag) return false;
    const p = this.#deps.toSpace(worldPx);
    const space = this.#deps.space();
    drag.rect =
      drag.kind === 'body'
        ? moveBackground(drag.start, p.x - drag.from.x, p.y - drag.from.y)
        : resizeBackground(drag.start, p, drag.kind, drag.aspect, minBackgroundSize(space));
    const sprite = this.#sprites.get(drag.id);
    if (sprite) {
      const px = backgroundSpaceScale(space);
      sprite.position.set(drag.rect.x * px, drag.rect.y * px);
      sprite.width = drag.rect.w * px;
      sprite.height = drag.rect.h * px;
    }
    this.#deps.invalidate('tools');
    return true;
  }

  /** Ends the gesture with its one settled write. `false` when none was running. */
  async pointerUp(): Promise<boolean> {
    const drag = this.#drag;
    if (!drag) return false;
    this.#drag = null;
    // A click that never moved is not a transform — and writing one would spend
    // a Firestore write per stray press on the image. On a hex map this is where
    // the pixel rect becomes two `HexPoint` corners — once, at the settled write
    // (SPEC-059 §3.3).
    if (backgroundRectChanged(drag.start, drag.rect)) {
      await this.#deps.store.setBackgroundTransform(
        this.#deps.roomId,
        this.#deps.mapId,
        drag.id,
        backgroundTransform(drag.rect, this.#deps.space()),
      );
    }
    return true;
  }

  /** Drops the gesture without a write (Escape, a tool change, a cleared
   * selection). The caller redraws — it clears other state in the same breath. */
  cancel(): void {
    this.#drag = null;
  }

  destroy(): void {
    this.#drag = null;
    this.#sprites.clear();
  }

  /** The topmost unlocked background under `p` — highest `order` first, since
   * that is what paints last and so sits visibly on top where two images overlap
   * (SPEC-039 §2) — and what a press on it hits: one of the eight resize handles
   * (corner-before-edge, either before the body — `backgroundHitTest`'s own
   * tie-break) or the body. A locked background offers neither, whatever is
   * under the pointer. */
  #pick(p: Point): { bg: MapBackground; kind: 'body' | BgHandle } | null {
    const space = this.#deps.space();
    const grab = latticeThreshold(
      BG_HANDLE_GRAB_PX,
      this.#deps.zoom(),
      backgroundSpaceScale(space),
    );
    const ordered = this.#deps.ordered();
    for (let i = ordered.length - 1; i >= 0; i--) {
      const bg = ordered[i]!;
      if (bg.locked) continue;
      const hit = backgroundHitTest(backgroundRect(bg, space), p, grab);
      if (hit) return { bg, kind: hit.kind === 'handle' ? hit.handle : 'body' };
    }
    return null;
  }
}
