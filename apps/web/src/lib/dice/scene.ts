import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { RolledDie } from '@osr-vtt/shared';
import { buildDieGeometry, topFaceIndex, type DieGeometry, type DieKind } from './geometry';
import { assignTarget, labelPool, toPhysicalDice, type PhysicalDie } from './resolve';
import { d4FaceMaterial, faceMaterial, resolveDiceTheme, type DiceTheme } from './textures';

/**
 * Dice renderer v2 (Master Plan v2, R3). The seed→result engine is untouched;
 * this module only *presents* an already-decided roll. The core fix (R3.1) is
 * the **no-flip settle**: rather than tumbling and then slerping each die to a
 * corrected orientation (the old approach, which visibly snapped — U1), we
 *
 *   1. build one physics world per roll (so old dice can't persist — U3),
 *   2. simulate the seed-derived throw **headlessly first**, recording every
 *      frame and each die's resting orientation (threshold settle, hard cap),
 *   3. read the landed face with a single locator scan (`topFaceIndex`),
 *   4. **remap** each die's face→value materials so the face that lands up
 *      carries the required value — the die simply lands correct, no flip,
 *   5. replay the recorded frames visually and lock the die at rest.
 *
 * All seven shapes are real polyhedra (R3.2); presentation quality (DPR,
 * hemisphere+key light, faceted bevel, in-frame walls) is R3.3. Per R19.1 the
 * dice float — no tray mesh, no cast shadow.
 */

/** A dropped die (R20.2) renders translucent + desaturated so advantage reads
 * as visibly *doing something* — the kept die stays fully lit beside it. */
const DIM_OPACITY = 0.32;
const DIM_DESATURATE = 0.55; // lerp the face color this far toward grey

const GRAVITY = { x: 0, y: -18, z: 0 };
const TIMESTEP = 1 / 60;
const MAX_STEPS = 300; // ~5s hard cap; force-reads whatever is most-up
const SETTLE_EPSILON = 0.25; // |linvel|+|angvel| below this ⇒ at rest
const TRAY_RADIUS = 4.4;
const WALL_HALF = TRAY_RADIUS * 0.9;

interface Frame {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

let rapierReady: Promise<void> | null = null;
function ensureRapier(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

/** A deterministic per-roll PRNG so the *throw* (spawn, launch, spin) is the
 * same on every client — purely cosmetic; the landed value is fixed by the
 * remap, so cross-client float drift is harmless (R3.1). */
function makeRng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export class DiceScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private geoCache = new Map<DieKind, DieGeometry>();

  /** Live dice for the current roll (cleared on the next roll). */
  private live: THREE.Object3D[] = [];
  /** Per-roll materials that are NOT shared/cached (d4 composites) — disposed
   * on clear so they don't leak. */
  private rollDisposables: THREE.Material[] = [];
  /** Per-roll *clones* of cached materials, made only to apply a seat tint
   * (R3.6.4) without mutating the shared cache. Disposed on clear, but their
   * `.map` texture is NOT — it's the same cached texture the original owns. */
  private tintDisposables: THREE.Material[] = [];

  private rolling = false;
  private queued: { dice: RolledDie[]; seed: string; tints?: (string | undefined)[] } | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 9.5, 4.2);
    this.camera.lookAt(0, 0, 0);

    // R19.2: a single soft key from upper-front gives a gentle specular near
    // the top of each die, with color deepening toward the lower edges via the
    // hemisphere ambient. No harsh rim light.
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x1a2634, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 11, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35);
    fill.position.set(-5, 6, -4);
    this.scene.add(fill);
  }

  /** Returns true if a WebGL context could be created. */
  mount(container: HTMLElement): boolean {
    this.container = container;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return false;
    }
    if (!this.renderer.getContext()) return false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.applySize();
    container.appendChild(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.applySize());
    this.resizeObserver.observe(container);
    this.render();
    return true;
  }

  private applySize(): void {
    if (!this.renderer || !this.container) return;
    const r = this.container.getBoundingClientRect();
    const w = r.width || window.innerWidth || 800;
    const h = r.height || window.innerHeight || 600;
    // updateStyle=true (default): the drawing buffer stays at min(dpr,2) for
    // crisp HiDPI while the canvas element's CSS size fills the host, so it
    // never overflows the viewport.
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Pull the camera back on tall/narrow viewports so the tray stays framed
    // and dice keep a consistent on-screen size (R3.3).
    const portrait = h > w;
    const dist = portrait ? 13 * (h / w) ** 0.25 : 10.4;
    this.camera.position.set(0, dist * 0.9, dist * 0.4);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private getGeometry(kind: DieKind): DieGeometry {
    let g = this.geoCache.get(kind);
    if (!g) {
      g = buildDieGeometry(kind);
      this.geoCache.set(kind, g);
    }
    return g;
  }

  /** Public entry point. Coalesces rapid rolls to at most one pending (latest
   * wins) and resolves when the visible roll has settled (R3.4). `tints`
   * (parallel to `dice`) tints a shared roll's dice per seat color (R3.6.4);
   * absent for a solo roll. */
  async roll(dice: RolledDie[], seed: string, tints?: (string | undefined)[]): Promise<void> {
    this.queued = { dice, seed, tints };
    if (this.rolling) return;
    this.rolling = true;
    try {
      while (this.queued && !this.disposed) {
        const job = this.queued;
        this.queued = null;
        await this.runRoll(job.dice, job.seed, job.tints);
      }
    } finally {
      this.rolling = false;
    }
  }

  private async runRoll(
    dice: RolledDie[],
    seed: string,
    tints?: (string | undefined)[],
  ): Promise<void> {
    this.clear(); // previous dice cleared immediately (R3.4/U3)
    if (!this.renderer) return;
    await ensureRapier();
    if (this.disposed) return;

    const theme = resolveDiceTheme();
    const physical = toPhysicalDice(dice, tints);
    if (physical.length === 0) return;

    const { frames, finals } = this.simulate(physical, seed);

    // R19.1: no tray and no cast shadow — the dice read as floating against the
    // transparent overlay, matching the reference.

    // Build the meshes with remapped materials so each landed face is correct.
    const meshes: THREE.Mesh[] = [];
    physical.forEach((pd, i) => {
      const mesh = this.buildMesh(pd, theme, finals[i]!);
      meshes.push(mesh);
      this.scene.add(mesh);
      this.live.push(mesh);
    });

    const applyFrame = (fi: number) => {
      meshes.forEach((mesh, i) => {
        const f = frames[i]![Math.min(fi, frames[i]!.length - 1)]!;
        mesh.position.set(f.x, f.y, f.z);
        mesh.quaternion.set(f.qx, f.qy, f.qz, f.qw);
      });
    };

    if (prefersReducedMotion()) {
      // Skip the tumble: place the dice at rest and render once (R3.4).
      const last = Math.max(...frames.map((f) => f.length - 1));
      applyFrame(last);
      this.render();
      return;
    }

    const totalFrames = Math.max(...frames.map((f) => f.length));
    for (let fi = 0; fi < totalFrames; fi++) {
      if (this.disposed || this.queued) break; // a newer roll supersedes this one
      applyFrame(fi);
      this.render();
      await nextFrame();
    }
    // Rest lock: pin to the final recorded frame; nothing steps further.
    applyFrame(totalFrames - 1);
    this.render();
  }

  /** Headless pre-sim: one physics world per roll, stepped to a threshold
   * settle (hard-capped), recording every die's per-frame transform and its
   * resting orientation. */
  private simulate(
    physical: PhysicalDie[],
    seed: string,
  ): { frames: Frame[][]; finals: THREE.Quaternion[] } {
    const world = new RAPIER.World(GRAVITY);
    world.timestep = TIMESTEP;

    // Floor.
    const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(TRAY_RADIUS, 0.2, TRAY_RADIUS), floor);
    // Invisible walls keep dice in frame (R3.3).
    const walls = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const wallSpecs: Array<[number, number, number, number, number, number]> = [
      [WALL_HALF, 3, 0.1, 0, 3, WALL_HALF],
      [WALL_HALF, 3, 0.1, 0, 3, -WALL_HALF],
      [0.1, 3, WALL_HALF, WALL_HALF, 3, 0],
      [0.1, 3, WALL_HALF, -WALL_HALF, 3, 0],
    ];
    for (const [hx, hy, hz, x, y, z] of wallSpecs) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z), walls);
    }

    const rng = makeRng(seed);
    const bodies: RAPIER.RigidBody[] = [];
    physical.forEach((pd) => {
      const g = this.getGeometry(pd.kind);
      const angle = rng() * Math.PI * 2;
      const spawnR = 1.4 + rng() * 1.2;
      const px = Math.cos(angle) * spawnR;
      const pz = Math.sin(angle) * spawnR;
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(px, 5.5 + rng() * 1.5, pz)
        .setRotation(randomQuat(rng))
        .setLinearDamping(0.12)
        .setAngularDamping(0.16);
      const body = world.createRigidBody(desc);

      const hull = new Float32Array(g.hullPoints.flatMap((p) => [p.x, p.y, p.z]));
      const collider =
        RAPIER.ColliderDesc.convexHull(hull) ?? RAPIER.ColliderDesc.ball(g.scale * 0.9);
      collider.setRestitution(0.28).setFriction(0.85);
      world.createCollider(collider, body);

      // Throw toward the tray centre (a throw, not a drop), tuned spin band.
      body.setLinvel({ x: -px * 0.7, y: -1.5, z: -pz * 0.7 }, true);
      const spin = 8 + rng() * 8;
      body.setAngvel(
        { x: (rng() - 0.5) * spin, y: (rng() - 0.5) * spin, z: (rng() - 0.5) * spin },
        true,
      );
      bodies.push(body);
    });

    const frames: Frame[][] = physical.map(() => []);
    let settledSteps = 0;
    for (let step = 0; step < MAX_STEPS; step++) {
      world.step();
      let allRest = true;
      bodies.forEach((body, i) => {
        const t = body.translation();
        const r = body.rotation();
        frames[i]!.push({ x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w });
        const lv = body.linvel();
        const av = body.angvel();
        const energy = Math.hypot(lv.x, lv.y, lv.z) + Math.hypot(av.x, av.y, av.z);
        if (energy > SETTLE_EPSILON) allRest = false;
      });
      // Require a few consecutive quiet steps so we don't stop mid-bounce.
      settledSteps = allRest ? settledSteps + 1 : 0;
      if (settledSteps >= 6) break;
    }

    const finals = bodies.map((body) => {
      const r = body.rotation();
      return new THREE.Quaternion(r.x, r.y, r.z, r.w);
    });
    world.free();
    return { frames, finals };
  }

  /** Applies a dropped die's dim treatment to a material owned by this roll
   * (translucent + desaturated). Mutates in place — only ever called on a
   * freshly-built or cloned material, never a shared cache entry. */
  private dim(mat: THREE.MeshStandardMaterial): void {
    mat.transparent = true;
    mat.opacity = DIM_OPACITY;
    mat.color.lerp(new THREE.Color(0x808080), DIM_DESATURATE);
  }

  private buildMesh(pd: PhysicalDie, theme: DiceTheme, finalQuat: THREE.Quaternion): THREE.Mesh {
    const g = this.getGeometry(pd.kind);
    const landed = topFaceIndex(g.locators, finalQuat);
    const pool = labelPool(pd.kind, pd.variant, g.faceCount);

    let materials: THREE.Material[];
    if (pd.kind === 'd4' && g.faceCorners) {
      // d4: value is read at the up-pointing apex. Remap the *vertex* labels
      // so the landed vertex carries the target, then print each face's three
      // corner numbers accordingly.
      const vertexLabels = assignTarget(pool, landed, pd.targetLabel);
      materials = g.faceCorners.map((corners) => {
        const mat = d4FaceMaterial(
          theme,
          corners.map((c) => ({ label: vertexLabels[c.vertex] ?? '', uv: c.uv })),
        );
        // Already exclusively owned by this roll (freshly built, not
        // cached) — tint/dim it in place.
        if (pd.tint) mat.color.multiply(new THREE.Color(pd.tint));
        if (pd.dimmed) this.dim(mat);
        this.rollDisposables.push(mat);
        return mat;
      });
    } else {
      const faceLabels = assignTarget(pool, landed, pd.targetLabel);
      const faceMats = faceLabels.map((label) => faceMaterial(theme, pd.kind, pd.variant, label));
      if (pd.tint || pd.dimmed) {
        // These come from the shared cache — clone before tinting/dimming so a
        // seat's color (or a dropped die's fade) never bleeds into another
        // roll's dice, and track the clones separately so `clear()` never
        // disposes the shared texture.
        const tintColor = pd.tint ? new THREE.Color(pd.tint) : null;
        materials = faceMats.map((mat) => {
          const clone = mat.clone();
          if (tintColor) clone.color.multiply(tintColor);
          if (pd.dimmed) this.dim(clone);
          this.tintDisposables.push(clone);
          return clone;
        });
      } else {
        materials = faceMats;
      }
    }
    return new THREE.Mesh(g.geometry, materials);
  }

  private render(): void {
    if (this.renderer && !this.disposed) this.renderer.render(this.scene, this.camera);
  }

  /** Removes the current roll's dice. Shared cached geometry and
   * atlas materials are left intact; only per-roll composites are disposed. */
  clear(): void {
    for (const obj of this.live) this.scene.remove(obj);
    this.live = [];
    for (const mat of this.rollDisposables) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      mat.dispose();
    }
    this.rollDisposables = [];
    // Tint clones share their `.map` texture with the cached original —
    // dispose only the clone itself, never its (shared) texture.
    for (const mat of this.tintDisposables) mat.dispose();
    this.tintDisposables = [];
    this.render();
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.clear();
    for (const g of this.geoCache.values()) g.geometry.dispose();
    this.geoCache.clear();
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

function randomQuat(rng: () => number): { x: number; y: number; z: number; w: number } {
  // Uniform random unit quaternion (Shoemake).
  const u1 = rng();
  const u2 = rng();
  const u3 = rng();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  return {
    x: s1 * Math.sin(2 * Math.PI * u2),
    y: s1 * Math.cos(2 * Math.PI * u2),
    z: s2 * Math.sin(2 * Math.PI * u3),
    w: s2 * Math.cos(2 * Math.PI * u3),
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
