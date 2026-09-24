import * as PIXI from 'pixi.js';
import { hexMap, type HexSymbol, type HexTile } from '@osr-vtt/shared';
import { hexToNumber } from '../../theme/map-theme';
import { loadImageElement } from '../../tokens/texture-load';
import { hexTerrainArtPx, hexContentsArtPx } from '../vector-engine';

/**
 * The hex terrain/contents overlay system (SPEC-030 §§2–3, SPEC-047 §13):
 * baking each terrain glyph against its hex silhouette and keeping the
 * per-hex sprite layers in sync. Every square-grid map's engine builds this
 * too, unless it is deferred — a square map (RULES.md RULE-006: "every map
 * that exists today") never paints a hex, so `vector-engine.ts` fetches this
 * module with a dynamic `import()` the first time `renderHexTiles` is called
 * with an actual hex map (SPEC-055 §1), rather than paying for it on every
 * load. `hexTerrainArtPx`/`hexContentsArtPx` stay in `vector-engine.ts` —
 * pure arithmetic, not worth a fetch of their own.
 */

/**
 * The side, in pixels, of the offscreen canvas a terrain overlay is baked onto
 * (SPEC-047 §13). One raster per terrain *kind*, not per painted hex, so this
 * is a handful of textures on the largest map. 256 comfortably covers the box
 * a default hex draws at (`48 * 1.8` = 86 world px) across the zoom range
 * without visible upscaling blur — the same figure and the same reasoning as
 * the token rasteriser's `TOKEN_ART_RASTER_PX`.
 */
const HEX_TERRAIN_BAKE_PX = 256;

/**
 * Composites one terrain glyph against its hex silhouette, returning a canvas
 * whose pixels are already hex-shaped (SPEC-047 §13).
 *
 * `destination-in` is the whole mechanism: the art is drawn to fill the box,
 * then everything outside the hex path is erased from it. What this costs is
 * one canvas per terrain kind at load time; what it buys is that the render
 * pass never clips anything, so the overlay layer stays a single batched draw
 * (WI-122 measured a per-frame `Sprite.mask` at 376 ms/frame against 0.20 for
 * the same picture unclipped).
 *
 * Drawing the source at an explicit size rather than at its own reported one
 * matters for the same reason it does for a token (WI-125): an SVG's
 * DOM-facing `naturalWidth` is a CSS fallback, not a raster, and a canvas is
 * always a well-defined WebGL texture source where the raw element may not be.
 */
function bakeHexClippedArt(img: CanvasImageSource): HTMLCanvasElement {
  const side = HEX_TERRAIN_BAKE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, side, side);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const clip = hexMap.hexTerrainClipPolygon();
  clip.forEach((point, i) => {
    const x = point.x * side;
    const y = point.y * side;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  return canvas;
}

/** One art placement: which file, tinted what, centred where. */
interface HexArtPlacement {
  id: string;
  ref: string;
  tint: number;
  x: number;
  y: number;
}

export interface HexArtDeps {
  hexTerrainGraphics: PIXI.Graphics;
  hexTerrainSprites: PIXI.Container;
  hexContentsSprites: PIXI.Container;
  hexSymbolSprites: PIXI.Container;
  resolveAsset: (ref: string) => string;
  loadCachedTexture: (ref: string) => Promise<PIXI.Texture>;
}

export interface HexArtRenderer {
  renderHexTiles(tiles: readonly HexTile[], size: number): void;
  renderHexSymbols(symbols: readonly HexSymbol[], size: number): void;
}

/** One instance per engine (`vector-engine.ts` creates this once, the first
 * time it needs it, and keeps it for the component's lifetime) — the caches
 * below are scoped to that lifetime, same as before this module split out. */
export function createHexArtRenderer(deps: HexArtDeps): HexArtRenderer {
  const {
    hexTerrainGraphics,
    hexTerrainSprites,
    hexContentsSprites,
    hexSymbolSprites,
    resolveAsset,
    loadCachedTexture,
  } = deps;

  /** One art node per painted hex, keyed by the tile's id (its `axialKey`) and
   * cached across redraws for the same reason the door and symbol sprites are:
   * painting one hex must not rebuild every sprite on the map. Terrain and
   * contents are separate maps because a hex may carry either alone. */
  const hexTerrainNodes = new Map<string, PIXI.Sprite>();
  const hexContentsNodes = new Map<string, PIXI.Sprite>();
  /** One art node per placed symbol, keyed by `HexSymbol.id` rather than by
   * hex — see `hexSymbolSprites`' doc comment (`vector-engine.ts`) for why the
   * id can't be a lattice key. */
  const hexSymbolNodes = new Map<string, PIXI.Sprite>();

  /**
   * The terrain overlays' loader: the same art, composited against its hex
   * silhouette once and cached as an already-clipped texture (SPEC-047 §13).
   * Separate from the door/symbol texture cache because the two hold different
   * pictures of the same file — a contents icon or a symbol wants the raw
   * glyph.
   *
   * Loaded through `loadImageElement` rather than `PIXI.Assets.load` because
   * the bake needs an `HTMLImageElement` to `drawImage`, not a texture whose
   * backing resource has to be reached into. A failed load leaves the sprite
   * non-renderable, which is what it already was — no placeholder slab
   * (see `syncHexArt`).
   */
  const hexClippedTextureCache = new Map<string, Promise<PIXI.Texture>>();
  function loadHexClippedTexture(ref: string): Promise<PIXI.Texture> {
    let pending = hexClippedTextureCache.get(ref);
    if (!pending) {
      pending = loadImageElement(resolveAsset(ref)).then((img) =>
        PIXI.Texture.from(bakeHexClippedArt(img)),
      );
      hexClippedTextureCache.set(ref, pending);
    }
    return pending;
  }

  /** Brings one keyed sprite layer in line with `wanted` — add, retint, resize,
   * move, and destroy whatever is no longer painted. Shared by the terrain
   * overlays and the contents icons, which differ only in box, tint, alpha and
   * which loader prepares their texture (terrain's is baked hex-shaped,
   * SPEC-047 §13; a contents icon fits its hex unaided and is not clipped).
   *
   * A fresh sprite starts non-renderable rather than showing the 1x1 white
   * placeholder the door/symbol layers show: tinted and stretched to a whole
   * hex, that placeholder would flash as a solid coloured slab over the
   * terrain fill, which is a much louder artifact than a symbol's brief
   * one-cell square. */
  function syncHexArt(
    nodes: Map<string, PIXI.Sprite>,
    parent: PIXI.Container,
    wanted: readonly HexArtPlacement[],
    box: number,
    alpha: number,
    load: (ref: string) => Promise<PIXI.Texture> = loadCachedTexture,
  ): void {
    const seen = new Set<string>();
    for (const item of wanted) {
      seen.add(item.id);
      let sprite = nodes.get(item.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.renderable = false;
        parent.addChild(sprite);
        nodes.set(item.id, sprite);
      }
      if (sprite.label !== item.ref) {
        sprite.label = item.ref;
        const forSprite = sprite;
        void load(item.ref)
          .then((tex) => {
            if (nodes.get(item.id) !== forSprite) return;
            // Re-apply size after the texture swap — see `renderDoors`.
            forSprite.texture = tex;
            forSprite.width = box;
            forSprite.height = box;
            forSprite.renderable = true;
          })
          // A kind whose art will not load stays non-renderable rather than
          // showing the placeholder slab this layer exists to avoid; the hex's
          // own `color` fill is still drawn under it.
          .catch((err: unknown) => {
            console.warn(`[vector-engine] hex art failed to load: ${item.ref}`, err);
          });
      }
      sprite.width = box;
      sprite.height = box;
      sprite.tint = item.tint;
      sprite.alpha = alpha;
      sprite.position.set(item.x, item.y);
    }
    for (const [id, sprite] of nodes) {
      if (seen.has(id)) continue;
      sprite.destroy();
      nodes.delete(id);
    }
  }

  function renderHexTiles(tiles: readonly HexTile[], size: number): void {
    // A non-positive size is a square-grid map (or a half-built hex one):
    // nothing here has a multiplier to be drawn at, so the layer empties —
    // the caller (`vector-engine.ts`) has already cleared `hexTerrainGraphics`
    // itself; this still has to run so any already-baked sprites are torn
    // down when a room's active map switches away from a hex map.
    const painted = size > 0 ? tiles : [];
    const terrainArt: HexArtPlacement[] = [];
    const contentsArt: HexArtPlacement[] = [];

    for (const tile of painted) {
      const centre = hexMap.axialToPixel(tile.hex, size);
      if (tile.terrain) {
        // The per-region fill (SPEC-030 §2): this hex's own colour, under this
        // hex only. Each tile contributes one closed path to a single
        // `Graphics`, so the whole terrain plane is one geometry however many
        // colours are on it.
        const entry = hexMap.hexTerrainEntry(tile.terrain);
        hexTerrainGraphics
          .poly(hexMap.hexCorners(tile.hex, size))
          .fill({ color: hexToNumber(entry.color) });
        // `ref`/`ink` are `null` together for a background-only kind
        // (`water` — SPEC-047 §8): no overlay to draw.
        if (entry.ref && entry.ink) {
          terrainArt.push({
            id: tile.id,
            ref: entry.ref,
            tint: hexToNumber(entry.ink),
            x: centre.x,
            y: centre.y,
          });
        }
      }
      if (tile.contents) {
        contentsArt.push({
          id: tile.id,
          ref: hexMap.hexContentsEntry(tile.contents).ref,
          tint: hexToNumber(hexMap.HEX_CONTENTS_TONE),
          x: centre.x,
          y: centre.y,
        });
      }
    }

    syncHexArt(
      hexTerrainNodes,
      hexTerrainSprites,
      terrainArt,
      hexTerrainArtPx(size),
      hexMap.HEX_TERRAIN_OVERLAY_ALPHA,
      loadHexClippedTexture,
    );
    syncHexArt(hexContentsNodes, hexContentsSprites, contentsArt, hexContentsArtPx(size), 1);
  }

  /** Draws every placed hex symbol (SPEC-047 §§2, 4) — the hex-space
   * counterpart of `renderHexTiles`' contents pass, at whatever `HexPoint`
   * each symbol was placed at rather than always a hex's centre (a Free-snap
   * symbol is not one). An empty list clears the layer, like every other hex
   * render pass when `size <= 0`. */
  function renderHexSymbols(symbols: readonly HexSymbol[], size: number): void {
    const placed = size > 0 ? symbols : [];
    const art: HexArtPlacement[] = placed.map((s) => {
      const px = hexMap.hexPointToPixel(s.point, size);
      return {
        id: s.id,
        ref: hexMap.hexContentsEntry(s.kind).ref,
        tint: hexToNumber(hexMap.HEX_CONTENTS_TONE),
        x: px.x,
        y: px.y,
      };
    });
    syncHexArt(hexSymbolNodes, hexSymbolSprites, art, hexContentsArtPx(size), 1);
  }

  return { renderHexTiles, renderHexSymbols };
}
