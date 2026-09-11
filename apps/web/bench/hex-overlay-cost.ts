/**
 * WI-122 / SPEC-047 §9 — what the per-hex clip costs per frame.
 *
 * DEC-090 answered (a) *conditional on cost*: the 1.8× box is approved only if
 * masking each glyph to its own hex pays for itself, and the work item falls
 * back to the largest box that still fits unclipped (≈1.4×) if it does not.
 * There is no `Sprite.mask` anywhere else in `vector-engine.ts` to inherit a
 * cost expectation from, so this page measures it.
 *
 * It rebuilds the painted-hex layers the engine builds — one `Graphics` holding
 * every per-region fill, one tinted `Sprite` per terrain overlay at
 * `HEX_TERRAIN_OVERLAY_ALPHA`, one per contents icon — and renders them under
 * three variants:
 *
 *   - `1.1x-unmasked`   what shipped before WI-122
 *   - `1.22x-unmasked`  DEC-090 (b), the largest box that still fits unclipped
 *   - `1.8x-unmasked`   the 1.8× fill with no clip, to price the fill alone
 *   - `1.1x-masked`     the old box *with* a clip, to price the stencil alone
 *   - `1.8x-masked`     DEC-090 (a), the approved approach
 *
 * Each variant is timed twice: **at rest**, with the world transform untouched
 * between frames, and **under pan/zoom**, with it changed every frame — the case
 * the mask was suspected in, since a stencil mask is re-rendered into the
 * stencil buffer on every frame either way.
 *
 * Frames are rendered back to back rather than through `requestAnimationFrame`
 * (which would just report the vsync interval on any variant with headroom), and
 * each batch ends with a `gl.finish()` so the GPU work is inside the measured
 * window rather than queued past it.
 *
 * Drive it with `node apps/web/bench/run.mjs`; the numbers it produced are
 * recorded in `docs/completed/wi-122/render-cost.md`.
 */
import { hexMap } from '@osr-vtt/shared';
import * as PIXI from 'pixi.js';
import { hexContentsArtPx } from '../src/lib/map/vector-engine';

/** The hexagon a masked variant clips each glyph to, relative to the hex's own
 * centre — the same `hexCorners` the fill underneath is drawn with. Built here
 * rather than imported, because the shipped engine has no clip to import. */
function clipPolygon(size: number): number[] {
  return hexMap.hexCorners({ q: 0, r: 0 }, size).flatMap((corner) => [corner.x, corner.y]);
}

/** Hex sizes and painted-hex counts to sweep. `48` is
 * `DEFAULT_HEX_GRID_CONFIG.size`; the counts bracket a plausible region map
 * (an 8×8 block) and a large one (a 20×20 block — 400 painted hexes is already
 * a bigger region than a referee paints in one sitting). A 900-tile sweep was
 * dropped after the masked variant failed to finish 48 frames of it in fifteen
 * minutes of GPU time; see `docs/completed/wi-122/render-cost.md`. */
const HEX_SIZE = 48;
const TILE_COUNTS = [64, 400];
/** Frames per timed batch, and the untimed frames before it that let texture
 * upload and shader compilation settle. */
const FRAMES = 40;
const WARMUP = 8;
/** Roughly a third of hexes carry a contents icon on a real map. */
const CONTENTS_EVERY = 3;

/** Real pack art, so the texture count and sizes are the real ones. */
const TERRAIN_REFS = [
  '/assets/hex/terrain/forest.svg',
  '/assets/hex/terrain/hills.svg',
  '/assets/hex/terrain/mountains.svg',
  '/assets/hex/terrain/swamp.svg',
];
const CONTENTS_REFS = ['/assets/hex/contents/castle.svg', '/assets/hex/contents/city.svg'];

interface Variant {
  name: string;
  box: (size: number) => number;
  masked: boolean;
}

const VARIANTS: Variant[] = [
  { name: '1.1x-unmasked', box: (s) => s * 1.1, masked: false },
  { name: '1.22x-unmasked', box: (s) => s * 1.22, masked: false },
  { name: '1.8x-unmasked', box: (s) => s * 1.8, masked: false },
  // The same 1.1× box the layer shipped at, clipped: isolates what the stencil
  // costs from what the bigger fill costs.
  { name: '1.1x-masked', box: (s) => s * 1.1, masked: true },
  { name: '1.8x-masked', box: (s) => s * 1.8, masked: true },
];

interface Result {
  variant: string;
  tiles: number;
  restMs: number;
  moveMs: number;
}

/** A square block of axial hexes — the shape a referee paints a region in. */
function block(count: number): { q: number; r: number }[] {
  const side = Math.round(Math.sqrt(count));
  const out: { q: number; r: number }[] = [];
  for (let q = 0; q < side; q++) for (let r = 0; r < side; r++) out.push({ q, r });
  return out;
}

/** Builds one variant's scene under `world`, mirroring `renderHexTiles`. */
function build(world: PIXI.Container, variant: Variant, tiles: { q: number; r: number }[]): void {
  const fills = new PIXI.Graphics();
  const terrain = new PIXI.Container();
  const contents = new PIXI.Container();
  terrain.eventMode = 'none';
  contents.eventMode = 'none';
  world.addChild(fills, terrain, contents);

  const terrainBox = variant.box(HEX_SIZE);
  const contentsBox = hexContentsArtPx(HEX_SIZE);
  const clip = clipPolygon(HEX_SIZE);

  tiles.forEach((hex, i) => {
    const centre = hexMap.axialToPixel(hex, HEX_SIZE);
    fills.poly(hexMap.hexCorners(hex, HEX_SIZE)).fill({ color: 0x3c5a3c });

    const sprite = new PIXI.Sprite(PIXI.Assets.get(TERRAIN_REFS[i % TERRAIN_REFS.length]!));
    sprite.anchor.set(0.5);
    sprite.width = terrainBox;
    sprite.height = terrainBox;
    sprite.tint = 0x1e3a1e;
    sprite.alpha = hexMap.HEX_TERRAIN_OVERLAY_ALPHA;
    sprite.position.set(centre.x, centre.y);
    terrain.addChild(sprite);

    if (variant.masked) {
      const mask = new PIXI.Graphics().poly(clip).fill(0xffffff);
      mask.position.set(centre.x, centre.y);
      terrain.addChild(mask);
      sprite.mask = mask;
    }

    if (i % CONTENTS_EVERY === 0) {
      const icon = new PIXI.Sprite(PIXI.Assets.get(CONTENTS_REFS[i % CONTENTS_REFS.length]!));
      icon.anchor.set(0.5);
      icon.width = contentsBox;
      icon.height = contentsBox;
      icon.tint = 0x000000;
      icon.position.set(centre.x, centre.y);
      contents.addChild(icon);
    }
  });
}

/** Milliseconds per frame over `FRAMES` back-to-back renders. `move` changes the
 * world transform between frames, which is what a pan or a zoom does. */
function time(app: PIXI.Application, world: PIXI.Container, move: boolean): number {
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  const step = (i: number): void => {
    if (!move) return;
    world.position.set(-((i * 7) % 400), -((i * 5) % 400));
    world.scale.set(0.8 + ((i % 40) / 40) * 0.5);
  };
  for (let i = 0; i < WARMUP; i++) {
    step(i);
    app.renderer.render(app.stage);
  }
  gl?.finish();
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++) {
    step(i);
    app.renderer.render(app.stage);
  }
  gl?.finish();
  const elapsed = performance.now() - t0;
  world.position.set(0, 0);
  world.scale.set(1);
  return elapsed / FRAMES;
}

async function main(): Promise<void> {
  const app = new PIXI.Application();
  await app.init({
    width: 1280,
    height: 800,
    background: 0x1b1b1b,
    antialias: true,
    preference: 'webgl',
    autoStart: false,
  });
  document.body.appendChild(app.canvas);
  await PIXI.Assets.load([...TERRAIN_REFS, ...CONTENTS_REFS]);

  const results: Result[] = [];
  for (const count of TILE_COUNTS) {
    const tiles = block(count);
    for (const variant of VARIANTS) {
      const world = new PIXI.Container();
      app.stage.addChild(world);
      build(world, variant, tiles);
      // Rest first: an untouched transform, the case a map sits in most of the
      // time. Then the moving one, which is what DEC-090 asked about.
      const restMs = time(app, world, false);
      const moveMs = time(app, world, true);
      results.push({ variant: variant.name, tiles: tiles.length, restMs, moveMs });
      console.warn(
        `${variant.name} @${tiles.length}: rest ${restMs.toFixed(2)}ms  move ${moveMs.toFixed(2)}ms`,
      );
      world.destroy({ children: true });
    }
  }

  const renderer = (app.renderer as unknown as { context?: { webGLVersion?: number } }).context;
  const out = {
    userAgent: navigator.userAgent,
    webGLVersion: renderer?.webGLVersion ?? null,
    frames: FRAMES,
    hexSize: HEX_SIZE,
    results,
  };
  (window as unknown as { __benchResult?: unknown }).__benchResult = out;
  document.getElementById('out')!.textContent = JSON.stringify(out, null, 2);
}

void main();
