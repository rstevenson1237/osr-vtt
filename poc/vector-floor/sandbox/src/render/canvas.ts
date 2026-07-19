/**
 * Canvas2D renderer. The ONLY place lattice units become pixels (SPEC §2.0):
 * screen = (lattice - camera.offset) * camera.scale. Everything above this file
 * is unit-agnostic. Canvas2D (not Pixi) keeps the bundle tiny for the viewable
 * single-file build — polygons/segments/doors don't need a scene graph.
 */
import type { Door, MultiPoly, Point, Segment } from '../geometry/types.js';

export interface Camera {
  offsetX: number; // lattice units at screen origin
  offsetY: number;
  scale: number; // pixels per lattice unit
}

export function makeCamera(): Camera {
  return { offsetX: -2, offsetY: -2, scale: 28 };
}

export function toScreen(cam: Camera, p: Point): Point {
  return { x: (p.x - cam.offsetX) * cam.scale, y: (p.y - cam.offsetY) * cam.scale };
}

export function toLattice(cam: Camera, sx: number, sy: number): Point {
  return { x: sx / cam.scale + cam.offsetX, y: sy / cam.scale + cam.offsetY };
}

export interface Scene {
  floor: MultiPoly;
  walls: Segment[];
  doors: Door[];
  sightSegments: Segment[];
  visibility: Point[] | null;
  eye: Point | null;
  preview: { polys: MultiPoly; segs: Segment[]; points: Point[] } | null;
  /** Select-tool overlay: grabbable handle points and the active element. */
  handles: Point[];
  activeSeg: Segment | null;
  activeVert: Point | null;
}

const COL = {
  bg: '#0f1420',
  grid: '#1c2740',
  gridMajor: '#2b3a5c',
  floor: '#3a5d8f',
  floorEdge: '#7fb2ff',
  hole: '#0f1420',
  wall: '#e8ecf5',
  perim: '#9fb8e0',
  doorOpen: '#4ec98a',
  doorClosed: '#e0a24e',
  doorSecret: '#b06ee0',
  preview: '#ffd24e',
  eye: '#ffe08a',
  light: 'rgba(255, 224, 138, 0.14)',
  shadow: 'rgba(0,0,0,0.45)',
};

export function draw(ctx: CanvasRenderingContext2D, cam: Camera, scene: Scene, showLight: boolean): void {
  const { canvas } = ctx;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, cam, w, h);

  // Floor union with holes (even-odd so inner rings punch through).
  if (scene.floor.length) {
    ctx.beginPath();
    for (const poly of scene.floor) {
      for (const ring of poly) tracePath(ctx, cam, ring);
    }
    ctx.fillStyle = COL.floor;
    ctx.fill('evenodd');
    // outline every ring
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COL.floorEdge;
    for (const poly of scene.floor) for (const ring of poly) strokeRing(ctx, cam, ring);
  }

  // Shadow overlay + lit visibility polygon.
  if (showLight && scene.eye && scene.visibility && scene.visibility.length > 2) {
    ctx.save();
    ctx.fillStyle = COL.shadow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    tracePath(ctx, cam, scene.visibility);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    tracePath(ctx, cam, scene.visibility);
    ctx.fillStyle = COL.light;
    ctx.fill();
  }

  // Walls: perimeter (from sight segments tagged perimeter) + explicit.
  for (const s of scene.sightSegments) {
    strokeSegment(ctx, cam, s, s.source === 'perimeter' ? COL.perim : COL.wall, s.source === 'perimeter' ? 2 : 3.5);
  }

  // Doors on the floating overlay layer.
  for (const d of scene.doors) drawDoor(ctx, cam, d);

  // Eye marker.
  if (scene.eye) {
    const e = toScreen(cam, scene.eye);
    ctx.fillStyle = COL.eye;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Select-tool handles + active element.
  if (scene.activeSeg) strokeSegment(ctx, cam, scene.activeSeg, '#ffd24e', 4, false);
  for (const h of scene.handles) {
    const s = toScreen(cam, h);
    ctx.fillStyle = '#111726';
    ctx.strokeStyle = '#7fb2ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(s.x - 3.5, s.y - 3.5, 7, 7);
    ctx.fill();
    ctx.stroke();
  }
  if (scene.activeVert) {
    const s = toScreen(cam, scene.activeVert);
    ctx.fillStyle = '#ffd24e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // In-progress preview.
  if (scene.preview) {
    for (const poly of scene.preview.polys) {
      for (const ring of poly) {
        strokeRing(ctx, cam, ring, COL.preview, 2, true);
      }
    }
    for (const s of scene.preview.segs) strokeSegment(ctx, cam, s, COL.preview, 3, true);
    ctx.fillStyle = COL.preview;
    for (const p of scene.preview.points) {
      const sp = toScreen(cam, p);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number): void {
  const topLeft = toLattice(cam, 0, 0);
  const botRight = toLattice(cam, w, h);
  const x0 = Math.floor(topLeft.x);
  const x1 = Math.ceil(botRight.x);
  const y0 = Math.floor(topLeft.y);
  const y1 = Math.ceil(botRight.y);
  ctx.lineWidth = 1;
  for (let x = x0; x <= x1; x++) {
    const sx = (x - cam.offsetX) * cam.scale;
    ctx.strokeStyle = x % 5 === 0 ? COL.gridMajor : COL.grid;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  for (let y = y0; y <= y1; y++) {
    const sy = (y - cam.offsetY) * cam.scale;
    ctx.strokeStyle = y % 5 === 0 ? COL.gridMajor : COL.grid;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }
}

function tracePath(ctx: CanvasRenderingContext2D, cam: Camera, ring: Point[]): void {
  ring.forEach((p, i) => {
    const s = toScreen(cam, p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
}

function strokeRing(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  ring: Point[],
  color = COL.floorEdge,
  width = 1.5,
  dashed = false,
): void {
  ctx.save();
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.beginPath();
  tracePath(ctx, cam, ring);
  ctx.stroke();
  ctx.restore();
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  s: Segment,
  color: string,
  width: number,
  dashed = false,
): void {
  const a = toScreen(cam, s.a);
  const b = toScreen(cam, s.b);
  ctx.save();
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawDoor(ctx: CanvasRenderingContext2D, cam: Camera, d: Door): void {
  const a = toScreen(cam, d.a);
  const b = toScreen(cam, d.b);
  const passes = d.type !== 'barred' && d.state === 'open';
  let color = passes ? COL.doorOpen : COL.doorClosed;
  if (d.type === 'secret') color = COL.doorSecret;
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (passes) ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // endpoints
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
