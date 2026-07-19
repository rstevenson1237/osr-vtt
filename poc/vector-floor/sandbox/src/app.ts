/**
 * POC app wiring (SPEC §9.1). Pluggable point-collection input modes feeding one
 * shared geometry pipeline — the spec's central architectural claim, made real:
 *
 *   collection mode (drag-two / multi-click / two-click / single-click)
 *     → primitive shape emission (primitives.ts)
 *       → shared carve pipeline (pipeline.ts: boolean combine + simplify)
 *
 * Walls and doors ride the same input layer but commit to their own overlay
 * lists. LoS is rebuilt every frame from floor+walls+doors (los.ts).
 *
 * No framework, no persistence — all DOM built here so the single-file build
 * stays tiny and the state stays in memory (§9.1).
 */
import { polygonClippingBackend } from './geometry/backend.js';
import { commitCarve, type CommitMetrics } from './geometry/pipeline.js';
import { buildSightSegments, visibilityPolygon } from './geometry/los.js';
import {
  bufferPolyline,
  corridorPoly,
  polygonPoly,
  rectPoly,
  regularPoly,
} from './geometry/primitives.js';
import { snapPoint, type SnapMode } from './geometry/snap.js';
import type { Door, DoorType, MultiPoly, Point, Segment } from './geometry/types.js';
import { MapState, nextDoorId } from './state.js';
import { draw, makeCamera, toLattice, toScreen, type Scene } from './render/canvas.js';

const backend = polygonClippingBackend;

type ToolId = 'select' | 'room' | 'corridor' | 'path' | 'polygon' | 'ngon' | 'wall' | 'door' | 'eye' | 'pan';
type CarveMode = 'add' | 'subtract';
type SelectMode = 'vertex' | 'edge';

interface Options {
  snap: SnapMode;
  carve: CarveMode;
  width: number;
  sides: number;
  tolerance: number;
  doorType: DoorType;
  selectMode: SelectMode;
}

/** A vertex/edge selection handle: the live point refs to move, tagged by what
 * they belong to (for the SPEC §9.2 identity note: floor edits reshape the
 * baked union boundary; doors/walls move as objects). */
interface Handle {
  refs: Point[]; // live references into state (mutated in place)
  a: Point;
  b: Point; // for edge preview (a===b for a vertex handle)
}

const DOOR_TYPES: DoorType[] = ['single', 'double', 'secret', 'trapped', 'oneWay', 'barred'];

const STYLE = `
.vf-root{position:fixed;inset:0;display:flex;flex-direction:column;font:13px/1.4 system-ui,sans-serif;color:#dbe4f5;background:#0f1420}
.vf-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#131a2b;border-bottom:1px solid #24304c}
.vf-bar .sep{width:1px;height:22px;background:#2b3a5c;margin:0 4px}
.vf-btn{border:1px solid #2b3a5c;color:#cdd8ee;padding:5px 9px;border-radius:6px;cursor:pointer;background:#1b2438}
.vf-btn:hover{background:#243150}
.vf-btn.on{background:#3a5d8f;border-color:#7fb2ff;color:#fff}
.vf-btn:disabled{opacity:.4;cursor:default}
.vf-lbl{opacity:.7;margin-left:4px}
.vf-main{flex:1;display:flex;min-height:0}
.vf-canvas-wrap{flex:1;position:relative}
canvas{display:block;width:100%;height:100%;cursor:crosshair}
.vf-side{width:250px;background:#111726;border-left:1px solid #24304c;padding:10px 12px;overflow:auto;font-size:12px}
.vf-side h3{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#7fb2ff}
.vf-side .row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #1a2338}
.vf-side .row b{color:#fff;font-variant-numeric:tabular-nums}
.vf-hint{padding:6px 10px;background:#0c1120;border-top:1px solid #24304c;color:#8fa3c8;font-size:12px}
input[type=range]{vertical-align:middle}
select,input[type=number]{background:#1b2438;color:#cdd8ee;border:1px solid #2b3a5c;border-radius:5px;padding:3px 5px;font:inherit}
`;

const HINTS: Record<ToolId, string> = {
  select:
    'Select — Vertex: drag a single point (reshape). Edge: drag both endpoints of an edge (push a room wall out, or move a whole door). Doors: vertex moves an endpoint, edge moves the door. Snap applies to the drag.',
  room: 'Room — drag two corners. Hold Alt for freeform corners.',
  corridor: 'Corridor — drag start→end for an L-shaped run of fixed Width.',
  path: 'Path — click to add points, double-click to finish. Width-buffered. Use Rock mode to carve an interior divider (may split a region).',
  polygon: 'Polygon — click each vertex, double-click to close.',
  ngon: 'Regular n-gon — drag center→radius. Sides=1 ⇒ circle.',
  wall: 'Wall — click points, double-click to finish. Emits explicit sight+movement segments (dividers or standalone blockers).',
  door: 'Door — click two endpoints on/near a wall. Click an existing door to toggle open/closed. Doors live on the floating layer.',
  eye: 'Eye — click to place the light/vision source and see doors interrupt sight.',
  pan: 'Pan — drag to move the view. Wheel zooms anywhere.',
};

export function mount(root: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  root.classList.add('vf-root');
  root.innerHTML = `
    <div class="vf-bar" id="bar"></div>
    <div class="vf-main">
      <div class="vf-canvas-wrap"><canvas id="cv"></canvas></div>
      <div class="vf-side" id="side"></div>
    </div>
    <div class="vf-hint" id="hint"></div>`;

  const bar = root.querySelector<HTMLDivElement>('#bar')!;
  const side = root.querySelector<HTMLDivElement>('#side')!;
  const hint = root.querySelector<HTMLDivElement>('#hint')!;
  const canvas = root.querySelector<HTMLCanvasElement>('#cv')!;
  const ctx = canvas.getContext('2d')!;

  const state = new MapState();
  const cam = makeCamera();
  const opts: Options = { snap: 'full', carve: 'add', width: 2, sides: 6, tolerance: 0.15, doorType: 'single', selectMode: 'edge' };
  let tool: ToolId = 'room';
  let eye: Point | null = null;
  let lastMetrics: CommitMetrics | null = null;
  let altKey = false;

  // ---- interaction state ----
  let dragging = false;
  let dragStart: Point | null = null;
  let dragCur: Point | null = null;
  let collecting: Point[] = [];
  let panning = false;
  let panScreen: { x: number; y: number } | null = null;

  // select-tool state
  let activeDrag: { refs: { obj: Point; ox: number; oy: number }[]; anchor: Point; vertex: boolean } | null = null;
  let hover: Handle | null = null;

  function effectiveSnap(): SnapMode {
    return altKey ? 'free' : opts.snap;
  }

  function latticeAt(ev: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return toLattice(cam, ev.clientX - rect.left, ev.clientY - rect.top);
  }
  function snapAt(ev: PointerEvent): Point {
    return snapPoint(latticeAt(ev), effectiveSnap());
  }
  function screenAt(ev: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // ---- select-tool hit-testing (doors → walls → floor priority) ----
  function vertexHandles(): Handle[] {
    const out: Handle[] = [];
    for (const d of state.doors) out.push({ refs: [d.a], a: d.a, b: d.a }, { refs: [d.b], a: d.b, b: d.b });
    for (const w of state.walls) out.push({ refs: [w.a], a: w.a, b: w.a }, { refs: [w.b], a: w.b, b: w.b });
    for (const poly of state.floor) for (const ring of poly) for (const p of ring) out.push({ refs: [p], a: p, b: p });
    return out;
  }
  function edgeHandles(): Handle[] {
    const out: Handle[] = [];
    for (const d of state.doors) out.push({ refs: [d.a, d.b], a: d.a, b: d.b });
    for (const w of state.walls) out.push({ refs: [w.a, w.b], a: w.a, b: w.b });
    for (const poly of state.floor)
      for (const ring of poly)
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]!;
          const b = ring[(i + 1) % ring.length]!;
          out.push({ refs: [a, b], a, b });
        }
    return out;
  }
  function pickHandle(ev: PointerEvent): Handle | null {
    const m = screenAt(ev);
    const thr = 9;
    let best: Handle | null = null;
    let bestD = thr;
    if (opts.selectMode === 'vertex') {
      for (const h of vertexHandles()) {
        const s = toScreen(cam, h.a);
        const d = Math.hypot(s.x - m.x, s.y - m.y);
        if (d < bestD) { bestD = d; best = h; }
      }
    } else {
      for (const h of edgeHandles()) {
        const d = distToSeg(m, toScreen(cam, h.a), toScreen(cam, h.b));
        if (d < bestD) { bestD = d; best = h; }
      }
    }
    return best;
  }

  // ---- commit helpers ----
  function commitFloor(strokes: MultiPoly): void {
    if (!strokes.length) return;
    state.checkpoint();
    const res = commitCarve(state.floor, strokes, opts.carve, opts.tolerance, backend);
    state.floor = res.floor;
    lastMetrics = res.metrics;
  }

  function currentFloorStroke(): MultiPoly | null {
    if (tool === 'room' && dragStart && dragCur) return [rectPoly(dragStart, dragCur)];
    if (tool === 'corridor' && dragStart && dragCur)
      return corridorPoly(dragStart, dragCur, opts.width, backend, effectiveSnap() !== 'free');
    if (tool === 'ngon' && dragStart && dragCur) {
      const r = Math.hypot(dragCur.x - dragStart.x, dragCur.y - dragStart.y);
      const p = regularPoly(dragStart, r, opts.sides);
      return p ? [p] : null;
    }
    if (tool === 'path' && collecting.length)
      return bufferPolyline(dragCur ? [...collecting, dragCur] : collecting, opts.width, backend);
    if (tool === 'polygon' && collecting.length >= 2) {
      const p = polygonPoly(dragCur ? [...collecting, dragCur] : collecting);
      return p ? [p] : null;
    }
    return null;
  }

  function previewWallSegs(): Segment[] {
    if (tool === 'wall' && collecting.length) {
      const pts = dragCur ? [...collecting, dragCur] : collecting;
      const segs: Segment[] = [];
      for (let i = 0; i < pts.length - 1; i++)
        segs.push({ a: pts[i]!, b: pts[i + 1]!, source: 'explicit', blocksSight: true, blocksMovement: true });
      return segs;
    }
    if (tool === 'door' && collecting.length === 1 && dragCur)
      return [{ a: collecting[0]!, b: dragCur, source: 'explicit', blocksSight: true, blocksMovement: true }];
    return [];
  }

  function finishMultiClick(): void {
    if (tool === 'path' && collecting.length >= 1) {
      const poly = bufferPolyline(collecting, opts.width, backend);
      commitFloor(poly);
    } else if (tool === 'polygon' && collecting.length >= 3) {
      const p = polygonPoly(collecting);
      if (p) commitFloor([p]);
    } else if (tool === 'wall' && collecting.length >= 2) {
      state.checkpoint();
      for (let i = 0; i < collecting.length - 1; i++)
        state.walls.push({
          a: collecting[i]!,
          b: collecting[i + 1]!,
          source: 'explicit',
          blocksSight: true,
          blocksMovement: true,
        });
    }
    collecting = [];
    dragCur = null;
  }

  // ---- pointer handlers ----
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    const p = snapAt(ev);
    if (tool === 'pan' || ev.button === 1 || (ev.button === 0 && ev.getModifierState('Space'))) {
      panning = true;
      panScreen = { x: ev.clientX, y: ev.clientY };
      return;
    }
    if (tool === 'select') {
      const h = pickHandle(ev);
      if (h) {
        state.checkpoint();
        activeDrag = {
          refs: h.refs.map((pt) => ({ obj: pt, ox: pt.x, oy: pt.y })),
          anchor: p,
          vertex: opts.selectMode === 'vertex',
        };
      }
      render();
      return;
    }
    if (tool === 'room' || tool === 'corridor' || tool === 'ngon') {
      dragging = true;
      dragStart = p;
      dragCur = p;
    } else if (tool === 'path' || tool === 'polygon' || tool === 'wall') {
      collecting.push(p);
      dragCur = p;
    } else if (tool === 'door') {
      const hitId = doorAt(latticeAt(ev), state.doors, cam);
      if (hitId) {
        state.checkpoint();
        const d = state.doors.find((x) => x.id === hitId)!;
        d.state = d.state === 'open' ? 'closed' : 'open';
        render();
        return;
      }
      collecting.push(p);
      if (collecting.length === 2) {
        state.checkpoint();
        state.doors.push({
          id: nextDoorId(),
          a: collecting[0]!,
          b: collecting[1]!,
          type: opts.doorType,
          state: 'closed',
        });
        collecting = [];
      }
      dragCur = p;
    } else if (tool === 'eye') {
      eye = p;
    }
    render();
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (panning && panScreen) {
      cam.offsetX -= (ev.clientX - panScreen.x) / cam.scale;
      cam.offsetY -= (ev.clientY - panScreen.y) / cam.scale;
      panScreen = { x: ev.clientX, y: ev.clientY };
      render();
      return;
    }
    if (tool === 'select') {
      if (activeDrag) {
        const cur = snapAt(ev);
        if (activeDrag.vertex) {
          const r = activeDrag.refs[0]!;
          r.obj.x = cur.x;
          r.obj.y = cur.y;
        } else {
          const dx = cur.x - activeDrag.anchor.x;
          const dy = cur.y - activeDrag.anchor.y;
          for (const r of activeDrag.refs) {
            r.obj.x = r.ox + dx;
            r.obj.y = r.oy + dy;
          }
        }
      } else {
        hover = pickHandle(ev);
      }
      render();
      return;
    }
    dragCur = snapAt(ev);
    render();
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (panning) {
      panning = false;
      panScreen = null;
      return;
    }
    if (activeDrag) {
      activeDrag = null;
      render();
      return;
    }
    if (dragging) {
      dragging = false;
      dragCur = snapAt(ev);
      const stroke = currentFloorStroke();
      if (stroke) commitFloor(stroke);
      dragStart = null;
      dragCur = null;
      render();
    }
  });

  canvas.addEventListener('dblclick', () => {
    if (tool === 'path' || tool === 'polygon' || tool === 'wall') finishMultiClick();
    render();
  });

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const before = toLattice(cam, ev.clientX - rect.left, ev.clientY - rect.top);
    const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
    cam.scale = Math.max(6, Math.min(120, cam.scale * factor));
    const after = toLattice(cam, ev.clientX - rect.left, ev.clientY - rect.top);
    cam.offsetX += before.x - after.x;
    cam.offsetY += before.y - after.y;
    render();
  }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Alt') altKey = true;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) state.redo();
      else state.undo();
      render();
    } else if (ev.key === 'Enter') {
      finishMultiClick();
      render();
    } else if (ev.key === 'Escape') {
      collecting = [];
      dragging = false;
      dragStart = null;
      dragCur = null;
      render();
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.key === 'Alt') altKey = false;
  });

  // ---- toolbar ----
  function buildBar(): void {
    bar.innerHTML = '';
    const tools: [ToolId, string][] = [
      ['select', 'Select'],
      ['room', 'Room'],
      ['corridor', 'Corridor'],
      ['path', 'Path'],
      ['polygon', 'Polygon'],
      ['ngon', 'N-gon'],
      ['wall', 'Wall'],
      ['door', 'Door'],
      ['eye', 'Eye'],
      ['pan', 'Pan'],
    ];
    for (const [id, label] of tools) {
      const b = btn(label, () => {
        tool = id;
        collecting = [];
        dragging = false;
        dragStart = null;
        activeDrag = null;
        hover = null;
        render();
      });
      b.classList.toggle('on', tool === id);
      b.dataset.tool = id;
      bar.appendChild(b);
    }
    sep();
    // Select sub-mode (Vertex reshapes a point; Edge moves both endpoints — e.g.
    // push a room's north wall out, or move a whole door).
    const vtxB = btn('◆ Vertex', () => { opts.selectMode = 'vertex'; hover = null; buildBar(); render(); });
    const edgeB = btn('▬ Edge', () => { opts.selectMode = 'edge'; hover = null; buildBar(); render(); });
    vtxB.classList.toggle('on', tool === 'select' && opts.selectMode === 'vertex');
    edgeB.classList.toggle('on', tool === 'select' && opts.selectMode === 'edge');
    vtxB.disabled = tool !== 'select';
    edgeB.disabled = tool !== 'select';
    bar.appendChild(vtxB);
    bar.appendChild(edgeB);
    sep();
    // Carve/Rock mode
    const modeBtn = btn(opts.carve === 'add' ? 'Mode: Carve' : 'Mode: Rock', () => {
      opts.carve = opts.carve === 'add' ? 'subtract' : 'add';
      buildBar();
    });
    modeBtn.classList.toggle('on', opts.carve === 'subtract');
    bar.appendChild(modeBtn);
    // Snap
    bar.appendChild(labelWrap('Snap', selectEl(['full', 'half', 'free'], opts.snap, (v) => (opts.snap = v as SnapMode))));
    // Width
    bar.appendChild(labelWrap('Width', numEl(opts.width, 0.5, 10, 0.5, (v) => (opts.width = v))));
    // Sides
    bar.appendChild(labelWrap('Sides', numEl(opts.sides, 1, 24, 1, (v) => (opts.sides = v))));
    // Door type
    bar.appendChild(labelWrap('Door', selectEl(DOOR_TYPES, opts.doorType, (v) => (opts.doorType = v as DoorType))));
    sep();
    // Simplify tolerance
    const tolWrap = document.createElement('span');
    tolWrap.className = 'vf-lbl';
    tolWrap.textContent = `Simplify ${opts.tolerance.toFixed(2)} `;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '0.6';
    range.step = '0.01';
    range.value = String(opts.tolerance);
    range.addEventListener('input', () => {
      opts.tolerance = Number(range.value);
      tolWrap.firstChild!.textContent = `Simplify ${opts.tolerance.toFixed(2)} `;
      render();
    });
    tolWrap.appendChild(range);
    bar.appendChild(tolWrap);
    sep();
    const undoB = btn('Undo', () => { state.undo(); render(); });
    const redoB = btn('Redo', () => { state.redo(); render(); });
    undoB.disabled = !state.canUndo();
    redoB.disabled = !state.canRedo();
    bar.appendChild(undoB);
    bar.appendChild(redoB);
    bar.appendChild(btn('Demo', () => { loadDemo(); }));
    bar.appendChild(btn('Reset', () => { state.reset(); eye = null; lastMetrics = null; render(); }));
  }

  function btn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'vf-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function sep(): void {
    const s = document.createElement('span');
    s.className = 'sep';
    bar.appendChild(s);
  }
  function labelWrap(label: string, el: HTMLElement): HTMLElement {
    const w = document.createElement('span');
    w.className = 'vf-lbl';
    w.textContent = label + ' ';
    w.appendChild(el);
    return w;
  }
  function selectEl(vals: string[], cur: string, onChange: (v: string) => void): HTMLSelectElement {
    const s = document.createElement('select');
    for (const v of vals) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      if (v === cur) o.selected = true;
      s.appendChild(o);
    }
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function numEl(cur: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'number';
    i.value = String(cur);
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.style.width = '52px';
    i.addEventListener('change', () => onChange(Number(i.value)));
    return i;
  }

  // ---- render ----
  function resize(): void {
    const wrap = canvas.parentElement!;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    render();
  }

  function render(): void {
    const sight = buildSightSegments(state.floor, state.walls, state.doors);
    const maxDist = (canvas.width + canvas.height) / cam.scale;
    const vis = eye ? visibilityPolygon(eye, sight, maxDist) : null;
    const preview = buildPreview();
    const showHandles = tool === 'select';
    const handles: Point[] = showHandles && opts.selectMode === 'vertex' ? vertexHandles().map((h) => h.a) : [];
    const activeSeg =
      showHandles && hover && opts.selectMode === 'edge' ? { a: hover.a, b: hover.b, source: 'explicit' as const, blocksSight: true, blocksMovement: true } : null;
    const activeVert = showHandles && hover && opts.selectMode === 'vertex' ? hover.a : null;
    const scene: Scene = {
      floor: state.floor,
      walls: state.walls,
      doors: state.doors,
      sightSegments: sight,
      visibility: vis,
      eye,
      preview,
      handles,
      activeSeg,
      activeVert,
    };
    draw(ctx, cam, scene, !!eye);
    updateSide(sight.length);
    hint.textContent = HINTS[tool];
    buildBar();
  }

  function buildPreview(): Scene['preview'] {
    const polys = currentFloorStroke();
    const segs = previewWallSegs();
    const points = collecting.slice();
    if (!polys && !segs.length && !points.length) return null;
    return { polys: polys ?? [], segs, points };
  }

  function updateSide(sightCount: number): void {
    const m = lastMetrics;
    const totalVerts = state.floor.reduce((n, poly) => n + poly.reduce((k, r) => k + r.length, 0), 0);
    side.innerHTML = `
      <h3>Live geometry</h3>
      <div class="row"><span>Floor regions</span><b>${state.floor.length}</b></div>
      <div class="row"><span>Total vertices</span><b>${totalVerts}</b></div>
      <div class="row"><span>Explicit walls</span><b>${state.walls.length}</b></div>
      <div class="row"><span>Doors</span><b>${state.doors.length}</b></div>
      <div class="row"><span>Sight segments</span><b>${sightCount}</b></div>
      <h3 style="margin-top:12px">Last commit (§8)</h3>
      ${
        m
          ? `<div class="row"><span>Regions / holes</span><b>${m.regions} / ${m.holes}</b></div>
             <div class="row"><span>Verts raw→simpl</span><b>${m.verticesRaw}→${m.verticesSimplified}</b></div>
             <div class="row"><span>Bytes raw→simpl</span><b>${m.bytesRaw}→${m.bytesSimplified}</b></div>
             <div class="row"><span>Op time</span><b>${m.opMs.toFixed(2)} ms</b></div>`
          : '<div class="row"><span>—</span><b>no commits yet</b></div>'
      }
      <h3 style="margin-top:12px">Backend</h3>
      <div class="row"><span>Boolean</span><b>${backend.name}</b></div>
      <div style="margin-top:8px;opacity:.6;font-size:11px">Tolerance is live — drag Simplify to see §8.3 vertex vs. fidelity. Swap backend in geometry/backend.ts for §8.1.</div>`;
  }

  // ---- demo scene ----
  function loadDemo(): void {
    state.reset();
    // two rooms
    let f: MultiPoly = [];
    f = commitCarve(f, [rectPoly({ x: 2, y: 2 }, { x: 10, y: 9 })], 'add', opts.tolerance, backend).floor;
    f = commitCarve(f, [rectPoly({ x: 14, y: 3 }, { x: 22, y: 11 })], 'add', opts.tolerance, backend).floor;
    // connecting corridor
    f = commitCarve(f, corridorPoly({ x: 10, y: 5 }, { x: 14, y: 7 }, 2, backend, true), 'add', opts.tolerance, backend).floor;
    // a cave blob
    const cave = regularPoly({ x: 7, y: 15 }, 4, 1);
    if (cave) f = commitCarve(f, [cave], 'add', opts.tolerance, backend).floor;
    // interior rock-carve hole that splits nothing (a pillar)
    f = commitCarve(f, [rectPoly({ x: 17, y: 6 }, { x: 19, y: 8 })], 'subtract', opts.tolerance, backend).floor;
    state.floor = f;
    // a door in the corridor mouth + an explicit wall divider
    state.doors.push({ id: nextDoorId(), a: { x: 10, y: 5 }, b: { x: 10, y: 7 }, type: 'single', state: 'closed' });
    state.walls.push({ a: { x: 18, y: 3 }, b: { x: 18, y: 6 }, source: 'explicit', blocksSight: true, blocksMovement: true });
    eye = { x: 6, y: 6 };
    lastMetrics = null;
    render();
  }

  buildBar();
  window.addEventListener('resize', resize);
  resize();
  loadDemo();
}

/** Hit-test a door by proximity of the click to its segment (screen space). */
function doorAt(p: Point, doors: Door[], cam: { offsetX: number; offsetY: number; scale: number }): string | null {
  const sp = toScreen(cam as never, p);
  for (const d of doors) {
    const a = toScreen(cam as never, d.a);
    const b = toScreen(cam as never, d.b);
    if (distToSeg(sp, a, b) < 8) return d.id;
  }
  return null;
}

function distToSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
