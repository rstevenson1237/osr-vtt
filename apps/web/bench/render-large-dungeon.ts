/**
 * WI-192 / SPEC-057 §4.1 — what a large dungeon costs per frame, at rest and
 * under a vertex drag.
 *
 * DEC-118 reopened the "full-viewport-diff rendering" watch item: `renderAll()`
 * redraws every layer on every change, and a vertex drag rebuilds the LoS scene
 * on every pointer move. Per-layer dirty tracking (WI-193) is built only if this
 * measurement is over the budget stated in `README.md`.
 *
 * `renderAll` lives inside `VectorMapView.svelte` and cannot be imported, so this
 * page drives the *real* `createVectorMapEngine` through the same call sequence
 * `renderAll` makes (grid → scene → doors → overlay objects → annotations → fog →
 * tool preview with the Select tool's `vertexHandles`). The inputs are a
 * synthetic large dungeon: `ROOMS_PER_SIDE`² rooms joined by corridors, each with
 * a partition wall and two doors, `SYMBOLS` placed symbols, room labels, and fog
 * that has revealed half the rooms.
 *
 * Each case is split into **CPU** (the JS the view runs for the change,
 * including any `buildVectorScene`) and **GPU** (`renderer.render()` bracketed
 * by `gl.finish()`):
 *
 *   - `rest`          every layer redrawn and one frame, geometry unchanged —
 *                     `renderer.invalidate()` with no argument, the old
 *                     `renderAll`
 *   - `drag-rebuild`  the WI-192 vertex drag: one vertex moved, the whole LoS
 *                     scene rebuilt, every layer redrawn, frame
 *   - `drag`          the same drag under WI-193's dirty tracking: the scene
 *                     reconciled incrementally (`createDragSight`), and only the
 *                     `floor` and `tools` passes run
 *   - `hover`         a Select-tool pointer move over the map: the `tools` pass
 *                     alone (it redrew every layer before WI-193)
 *   - `pan`           the world transform changed and a frame rendered, no pass
 *                     at all — the baseline that already skips it
 *
 * Drive it with `node apps/web/bench/run.mjs render-large-dungeon`; the figures are
 * recorded in `docs/completed/WI-192.md`, `docs/completed/WI-193.md` and
 * `README.md`.
 */
import {
  buildVectorScene,
  vectorMap,
  type MapRoom,
  type MapSymbol,
  type StoredVectorWall,
  type VectorDoor,
  type VectorFloorRegion,
} from '@osr-vtt/shared';
import { createDragSight } from '../src/lib/map/drag-sight';
import {
  createVectorMapEngine,
  type RenderedScene,
  type VectorMapEngine,
} from '../src/lib/map/vector-engine';
import { vertexHandles } from '../src/lib/map/vector-tools';
import type { MapTheme } from '../src/lib/theme/map-theme';

const CELL = 70; // DEFAULT_GRID_CONFIG.cellSize
const ROOMS_PER_SIDE = 12;
const PITCH = 14; // cells between room origins
const ROOM = 9; // room edge, cells
const SYMBOLS = 60;
const STEPS = 60; // drag steps / frames per case
const WARMUP = 10;

const THEME: MapTheme = {
  rock: 0x1b1b1b,
  floor: 0xd9cfb8,
  wall: 0x222222,
  door: 0x8a5a2b,
  secretDoor: 0xb0302b,
  doorHazard: 0xd08a00,
  doorOneWay: 0x2b6cb0,
  fog: 0x000000,
  grid: 0x999999,
  selection: 0xffd700,
  ping: 0xff4444,
  rulerText: 0xffffff,
  battleCapture: 0x00ccff,
};

const KINDS = vectorMap.SYMBOL_CATALOG.map((e) => e.kind);

function rectRing(x: number, y: number, w: number, h: number): vectorMap.Ring {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function region(id: string, ring: vectorMap.Ring): VectorFloorRegion {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return {
    id,
    rings: [ring],
    bbox: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

interface Dungeon {
  regions: VectorFloorRegion[];
  walls: StoredVectorWall[];
  doors: VectorDoor[];
  symbols: MapSymbol[];
  mapRooms: MapRoom[];
}

function buildDungeon(): Dungeon {
  const regions: VectorFloorRegion[] = [];
  const walls: StoredVectorWall[] = [];
  const doors: VectorDoor[] = [];
  const symbols: MapSymbol[] = [];
  const mapRooms: MapRoom[] = [];
  for (let gy = 0; gy < ROOMS_PER_SIDE; gy++) {
    for (let gx = 0; gx < ROOMS_PER_SIDE; gx++) {
      const n = gy * ROOMS_PER_SIDE + gx;
      const x = gx * PITCH;
      const y = gy * PITCH;
      // Every fourth room is a 16-gon (a "round" room), the rest are rectangles.
      const ring =
        n % 4 === 3
          ? vectorMap.regularPoly({ x: x + ROOM / 2, y: y + ROOM / 2 }, ROOM / 2, 16)![0]!
          : rectRing(x, y, ROOM, ROOM);
      regions.push(region(`room-${n}`, ring));
      // Corridors east and south, so the union is one connected dungeon.
      if (gx < ROOMS_PER_SIDE - 1)
        regions.push(region(`ce-${n}`, rectRing(x + ROOM - 1, y + 4, PITCH - ROOM + 2, 2)));
      if (gy < ROOMS_PER_SIDE - 1)
        regions.push(region(`cs-${n}`, rectRing(x + 4, y + ROOM - 1, 2, PITCH - ROOM + 2)));
      walls.push({
        id: `w-${n}`,
        a: { x: x + 2, y: y + 6 },
        b: { x: x + 7, y: y + 6 },
        source: 'explicit',
        blocksSight: true,
        blocksMovement: true,
      });
      doors.push(
        {
          id: `de-${n}`,
          a: { x: x + ROOM, y: y + 4 },
          b: { x: x + ROOM, y: y + 6 },
          type: n % 5 === 0 ? 'secret' : 'single',
          state: n % 2 ? 'open' : 'closed',
        },
        {
          id: `ds-${n}`,
          a: { x: x + 4, y: y + ROOM },
          b: { x: x + 6, y: y + ROOM },
          type: 'double',
          state: 'closed',
        },
      );
      mapRooms.push({
        id: `mr-${n}`,
        key: String(n + 1),
        name: `Room ${n + 1}`,
        bbox: { x, y, w: ROOM, h: ROOM },
        labelAnchor: { x: x + ROOM / 2, y: y + 1 },
        wallStyle: 'solid',
      });
    }
  }
  for (let i = 0; i < SYMBOLS; i++) {
    const n = (i * 7) % (ROOMS_PER_SIDE * ROOMS_PER_SIDE);
    symbols.push({
      id: `sym-${i}`,
      cell: {
        x: (n % ROOMS_PER_SIDE) * PITCH + 1 + (i % 6),
        y: Math.floor(n / ROOMS_PER_SIDE) * PITCH + 1,
      },
      kind: KINDS[i % KINDS.length]!,
      rotation: 0,
    });
  }
  return { regions, walls, doors, symbols, mapRooms };
}

interface Inputs {
  regions: readonly VectorFloorRegion[];
  walls: readonly StoredVectorWall[];
  doors: readonly VectorDoor[];
}

/** The engine calls `VectorMapView`'s five layer passes make for a square-grid
 * map with the Select tool active, in the same order. Hex, background-alignment
 * and Eye-tool calls clear (or are absent on) this map. */
function drawGrid(engine: VectorMapEngine): void {
  engine.renderGrid(CELL, false);
}
function drawFloor(engine: VectorMapEngine, scene: RenderedScene): void {
  engine.renderHexTiles([], 0);
  engine.renderScene(scene, CELL);
}
function drawOverlay(engine: VectorMapEngine, dungeon: Dungeon, inp: Inputs): void {
  engine.renderHexSymbols([], 0);
  engine.renderHexLines([], 0);
  engine.renderDoors(inp.doors, CELL);
  engine.renderOverlayObjects(dungeon.symbols, dungeon.mapRooms, CELL, null, new Set());
  engine.renderAnnotations([]);
}
function drawFog(engine: VectorMapEngine, fog: vectorMap.MultiPoly): void {
  engine.renderFog({ enabled: true, revealed: fog, cellSize: CELL, mode: 'gm', hex: null });
}
function drawTools(engine: VectorMapEngine, inp: Inputs): void {
  engine.renderHexLinePreview(null, 0);
  engine.renderHexSelection(null, 0);
  engine.renderBackgroundAlignment(null, CELL, 1, false);
  engine.renderToolPreview(
    {
      strokePolys: null,
      captureRect: null,
      strokeSubtract: false,
      previewSegs: [],
      collecting: [],
      vertexHandles: vertexHandles(inp.regions, inp.walls, inp.doors),
      hoveredHandle: null,
      selectedHandles: [],
      lasso: null,
      coarsePointer: false,
      visibility: null,
      eye: null,
      eyeAlpha: 1,
      measure: null,
      ruler: null,
      cursorSnap: null,
      cursorSnapKind: 'select',
      cursorCell: null,
      cursorBand: null,
      objectHighlights: [],
    } as unknown as Parameters<VectorMapEngine['renderToolPreview']>[0],
    CELL,
  );
}

/** Every layer — `renderer.invalidate()` with no argument, i.e. the old
 * `renderAll`. */
function renderAll(
  engine: VectorMapEngine,
  dungeon: Dungeon,
  fog: vectorMap.MultiPoly,
  inp: Inputs,
  scene: RenderedScene,
): void {
  drawGrid(engine);
  drawFloor(engine, scene);
  drawOverlay(engine, dungeon, inp);
  drawFog(engine, fog);
  drawTools(engine, inp);
}

interface Stat {
  case: string;
  cpuMs: number;
  gpuMs: number;
  totalMs: number;
  p95TotalMs: number;
}

function summarise(name: string, cpu: number[], gpu: number[]): Stat {
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const totals = cpu.map((c, i) => c + gpu[i]!).sort((a, b) => a - b);
  return {
    case: name,
    cpuMs: mean(cpu),
    gpuMs: mean(gpu),
    totalMs: mean(totals),
    p95TotalMs: totals[Math.floor(totals.length * 0.95)]!,
  };
}

async function main(): Promise<void> {
  const host = document.getElementById('host')!;
  const engine = await createVectorMapEngine(host, {
    theme: THEME,
    resolveAsset: (ref) => `/assets/${ref}`,
  });
  // Frames are rendered explicitly below; the app's own ticker would add its own.
  engine.app.ticker.stop();
  const gl = (engine.app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;

  const dungeon = buildDungeon();
  // Fog has revealed the first half of the rooms.
  const fog: vectorMap.MultiPoly = dungeon.regions
    .filter((_, i) => i % 2 === 0)
    .map((r) => r.rings)
    .filter((p) => p.length > 0);

  const baseScene = buildVectorScene(dungeon.regions, dungeon.walls, dungeon.doors);
  const base: Inputs = {
    regions: dungeon.regions,
    walls: dungeon.walls,
    doors: dungeon.doors,
  };
  // Load every symbol texture and settle shader compilation before timing.
  for (let i = 0; i < WARMUP; i++) {
    renderAll(engine, dungeon, fog, base, baseScene);
    engine.app.renderer.render(engine.app.stage);
  }
  await new Promise((r) => setTimeout(r, 1500));
  renderAll(engine, dungeon, fog, base, baseScene);
  engine.app.renderer.render(engine.app.stage);

  const frame = (): number => {
    const t = performance.now();
    engine.app.renderer.render(engine.app.stage);
    gl?.finish();
    return performance.now() - t;
  };

  const stats: Stat[] = [];
  let dragSceneMs = 0;
  let dragSetupMs = 0;

  // rest — geometry unchanged, the scene reused as `renderAll` does when nothing is dragging.
  {
    const cpu: number[] = [];
    const gpu: number[] = [];
    for (let i = 0; i < STEPS; i++) {
      const t = performance.now();
      renderAll(engine, dungeon, fog, base, baseScene);
      cpu.push(performance.now() - t);
      gpu.push(frame());
    }
    stats.push(summarise('rest', cpu, gpu));
  }

  const target = dungeon.regions[0]!;
  /** One region vertex nudged, as a drag's pointer move does. */
  const movedRing = (i: number) =>
    target.rings[0]!.map((p, k) =>
      k === 0 ? { x: p.x - 0.5 + (i % 10) * 0.1, y: p.y - 0.5 + (i % 7) * 0.1 } : p,
    );

  // drag-rebuild — the WI-192 path: LoS scene rebuilt per move, every layer.
  {
    const cpu: number[] = [];
    const gpu: number[] = [];
    const sceneMs: number[] = [];
    for (let i = 0; i < STEPS; i++) {
      const t = performance.now();
      const moved: VectorFloorRegion = { ...target, rings: [movedRing(i)] };
      const regions = [moved, ...dungeon.regions.slice(1)];
      const ts = performance.now();
      const scene = buildVectorScene(regions, dungeon.walls, dungeon.doors);
      sceneMs.push(performance.now() - ts);
      renderAll(engine, dungeon, fog, { ...base, regions }, scene);
      cpu.push(performance.now() - t);
      gpu.push(frame());
    }
    stats.push(summarise('drag-rebuild', cpu, gpu));
    dragSceneMs = sceneMs.reduce((a, v) => a + v, 0) / sceneMs.length;
  }

  // drag — WI-193: the working copy mutated in place (as `updateSelectDrag`
  // does), the scene reconciled incrementally, only `floor` and `tools` drawn.
  // The one-off `createDragSight` setup is the drag's pointer-down cost, timed
  // separately.
  {
    const cpu: number[] = [];
    const gpu: number[] = [];
    const working: VectorFloorRegion = structuredClone(target);
    const ts = performance.now();
    const live = createDragSight(base, { kind: 'region', id: target.id });
    dragSetupMs = performance.now() - ts;
    for (let i = 0; i < STEPS; i++) {
      const t = performance.now();
      working.rings[0] = movedRing(i);
      const regions = [working, ...dungeon.regions.slice(1)];
      drawFloor(engine, live(working));
      drawTools(engine, { ...base, regions });
      cpu.push(performance.now() - t);
      gpu.push(frame());
    }
    stats.push(summarise('drag', cpu, gpu));
    // Back to the committed geometry for the cases after this one.
    drawFloor(engine, baseScene);
    drawTools(engine, base);
  }

  // hover — a Select-tool pointer move with nothing held: `tools` alone.
  {
    const cpu: number[] = [];
    const gpu: number[] = [];
    for (let i = 0; i < STEPS; i++) {
      const t = performance.now();
      drawTools(engine, base);
      cpu.push(performance.now() - t);
      gpu.push(frame());
    }
    stats.push(summarise('hover', cpu, gpu));
  }

  // pan — transform only, no renderAll: the baseline.
  {
    const cpu: number[] = [];
    const gpu: number[] = [];
    for (let i = 0; i < STEPS; i++) {
      const t = performance.now();
      engine.world.position.set(-((i * 7) % 400), -((i * 5) % 400));
      cpu.push(performance.now() - t);
      gpu.push(frame());
    }
    engine.world.position.set(0, 0);
    stats.push(summarise('pan', cpu, gpu));
  }

  const out = {
    userAgent: navigator.userAgent,
    viewport: '1280x800',
    fixture: {
      regions: dungeon.regions.length,
      walls: dungeon.walls.length,
      doors: dungeon.doors.length,
      symbols: dungeon.symbols.length,
      mapRooms: dungeon.mapRooms.length,
      vertices: vertexHandles(dungeon.regions, dungeon.walls, dungeon.doors).length,
      sightSegments: baseScene.sight.length,
    },
    steps: STEPS,
    /** Mean of the `buildVectorScene` call inside `drag-rebuild`'s CPU figure. */
    dragSceneBuildMs: dragSceneMs,
    /** The once-per-drag `createDragSight` setup behind `drag` (WI-193). */
    dragSetupMs,
    stats,
  };
  (window as unknown as { __benchResult?: unknown }).__benchResult = out;
  document.getElementById('out')!.textContent = JSON.stringify(out, null, 2);
}

void main();
