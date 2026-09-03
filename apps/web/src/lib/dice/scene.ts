import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RolledDie } from '@osr-vtt/shared';
import { buildDieGeometry, topFaceIndex, type DieGeometry, type DieKind } from './geometry';
import { assignTarget, labelPool, toPhysicalDice, type PhysicalDie } from './resolve';
import {
  bodyMaterial,
  d4FaceMaterial,
  faceMaterial,
  resolveDiceTheme,
  type DiceTheme,
} from './textures';

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
 * hemisphere+key light, flat-shaded facets, in-frame walls) is R3.3 — with the
 * edges themselves now genuinely bevelled, see below.
 *
 * **The materials array is one entry longer than the value count**
 * (SPEC-045 §4): slots `0 … faceCount-1` are the value faces the remap in step 4
 * addresses, and slot `g.bodyGroupIndex` is the die body — the bevel, one flat
 * untextured fill in the same colour. This is the only place DEC-079's extra
 * group is visible; nothing else in the renderer counts material slots.
 *
 * **Supersedes R19.1's "no cast shadow."** The dice now drop a soft contact
 * shadow onto an otherwise-invisible ground plane (`ShadowMaterial`, so only
 * the shadow renders over the transparent overlay). R19.1's "no tray mesh"
 * still stands — there is no tray, just the shadow that anchors the dice to a
 * surface instead of leaving them floating in the middle of the map.
 *
 * **Dice meet each other (SPEC-045 §5).** Collisions were already on — one
 * Rapier world, default groups, no filtering — but the old throw (independent
 * spawn angles around the full circle, a wide spawn ring, gentle inward
 * velocity) simply never sent dice at each other. The throw is tuned so it
 * does now: a shared roll direction with a tighter spawn arc, a smaller spawn
 * ring, a stronger inward launch. **A die that lands resting on another die is
 * an accepted outcome, not a bug to nudge away** — `topFaceIndex` reads the
 * most-up locator regardless of tilt, so the value is always right even
 * stacked, and Rapier's own restitution/friction already keeps stacks rare
 * and physically plausible. No settle-time separation pass is added.
 */

/** A dropped die (R20.2) renders translucent + desaturated so advantage reads
 * as visibly *doing something* — the kept die stays fully lit beside it. */
const DIM_OPACITY = 0.32;
const DIM_DESATURATE = 0.55; // lerp the face color this far toward grey

const GRAVITY = { x: 0, y: -18, z: 0 };
const TIMESTEP = 1 / 60;
const MAX_STEPS = 360; // ~6s hard cap; force-reads whatever is most-up
const SETTLE_EPSILON = 0.25; // |linvel|+|angvel| below this ⇒ at rest
const TRAY_RADIUS = 4.4;
const WALL_HALF = TRAY_RADIUS * 0.9;
/** Throw tuning (SPEC-045 §5): dice in one roll are meant to strike one
 * another, so the spawn is a tighter, shared arc rather than independent
 * angles around the full circle, the spawn ring itself is smaller, and the
 * inward launch is stronger. Collisions were already on (one Rapier world,
 * default groups) — this is what used to throw dice apart before they could
 * meet. */
const SPAWN_ARC = Math.PI * 0.7; // each die's angle falls within this arc of a shared roll direction
const SPAWN_RADIUS_MIN = 1.1;
const SPAWN_RADIUS_SPAN = 0.9; // spawn ring: 1.1–2.0, tighter than the old 1.4–2.6
const INWARD_VELOCITY = 1.15; // × spawn radius, up from 0.7 — a real throw, not a lob
/** Top surface of the physics floor cuboid — where dice come to rest, and so
 * where the shadow-catcher plane sits. */
const FLOOR_TOP_Y = 0.2;
/** How dark a contact shadow gets at full occlusion. Soft enough to read as a
 * grounding cue over whatever map is behind the transparent overlay. */
const SHADOW_OPACITY = 0.34;

/** Settle emphasis: a brief scale pop as the dice come to rest, so the roll
 * lands with a beat instead of stopping dead. Skipped under reduced motion. */
const POP_MS = 150;
const POP_SCALE = 0.05;

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

  /** Invisible shadow-catcher plane (see the constructor). */
  private ground: THREE.Mesh;
  /** PMREM-baked environment (SPEC-045 §3) — built once at `mount()`, once a
   * renderer exists to bake it with, so the glossy material has something to
   * reflect besides the hemisphere + key light. */
  private envMap: THREE.Texture | null = null;

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
    //
    // All three lights are neutral (white / a barely-tinted grey ground). They
    // used to carry a cool blue bias, which shifted every die away from the
    // hex the player actually picked — the character colour is the one source
    // of truth for a die's colour, so the lighting must not editorialize.
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 11, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-5, 6, -4);
    this.scene.add(fill);

    // Contact shadow. Only the key casts — a second shadow from the fill would
    // read as two light sources and muddy the contact point. The frustum is
    // sized to the tray, not the scene, so the 1k map spends its resolution
    // where dice can actually be.
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const shadowCam = key.shadow.camera;
    shadowCam.left = -TRAY_RADIUS * 1.6;
    shadowCam.right = TRAY_RADIUS * 1.6;
    shadowCam.top = TRAY_RADIUS * 1.6;
    shadowCam.bottom = -TRAY_RADIUS * 1.6;
    shadowCam.near = 1;
    shadowCam.far = 40;
    shadowCam.updateProjectionMatrix();
    // `flatShading` + `DoubleSide` faces are prone to self-shadow acne; the
    // normal bias pushes the sample off the surface without detaching the
    // contact shadow from the die the way a large depth bias would.
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3; // the soft edge, since PCFSoft is gone

    // The catcher is invisible except where a die shadows it, so the overlay
    // stays transparent over the map.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(TRAY_RADIUS * 4, TRAY_RADIUS * 4),
      new THREE.ShadowMaterial({ opacity: SHADOW_OPACITY }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_TOP_Y;
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);
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
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in this Three version (it warns and
    // silently falls back to exactly this); the softness comes from the
    // shadow radius below instead.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyEnvironment(this.renderer);
    this.applySize();
    container.appendChild(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => this.applySize());
    this.resizeObserver.observe(container);
    this.render();
    return true;
  }

  /** Bakes a small procedural room (`RoomEnvironment`) into a PMREM and hangs
   * it on `scene.environment`, which every `MeshStandardMaterial` in the
   * scene picks up automatically — no per-material `envMap` assignment
   * needed. Baked once per mount, not per roll: it doesn't depend on the die
   * geometry or theme, only on having a renderer to bake with. */
  private applyEnvironment(renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();
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
   * (parallel to `dice`) carries each roller's character color (R3.6.4);
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
    await this.settlePop(meshes);
  }

  /** A short scale pop as the dice come to rest — the roll lands with a beat
   * instead of stopping dead. Purely presentational: it runs *after* the rest
   * lock, so the settled transform (and therefore the read value) is already
   * final and untouched. Bails the moment a newer roll supersedes this one. */
  private async settlePop(meshes: THREE.Mesh[]): Promise<void> {
    const start = performance.now();
    for (;;) {
      if (this.disposed || this.queued) break;
      const t = (performance.now() - start) / POP_MS;
      if (t >= 1) break;
      // One half-sine: 1 → 1+POP_SCALE → 1.
      const s = 1 + Math.sin(t * Math.PI) * POP_SCALE;
      for (const mesh of meshes) mesh.scale.setScalar(s);
      this.render();
      await nextFrame();
    }
    for (const mesh of meshes) mesh.scale.setScalar(1);
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
    // A shared throw direction for the roll, so every die's spawn angle
    // clusters within SPAWN_ARC of it instead of scattering around the full
    // circle — dice launched from the same side of the tray cross paths.
    const throwAngle = rng() * Math.PI * 2;
    const bodies: RAPIER.RigidBody[] = [];
    physical.forEach((pd) => {
      const g = this.getGeometry(pd.kind);
      const angle = throwAngle + (rng() - 0.5) * SPAWN_ARC;
      const spawnR = SPAWN_RADIUS_MIN + rng() * SPAWN_RADIUS_SPAN;
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
      body.setLinvel({ x: -px * INWARD_VELOCITY, y: -1.5, z: -pz * INWARD_VELOCITY }, true);
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

    // The roller's character color, or the theme neutral when they haven't
    // picked one. It is baked into the face texture rather than applied as a
    // material tint — `material.color` multiplies the map, so tinting a
    // pre-colored texture never yields the picked hex. See `textures.ts`.
    const face = pd.tint ?? theme.face;

    let materials: THREE.Material[];
    if (pd.kind === 'd4' && g.faceCorners) {
      // d4: value is read at the up-pointing apex. Remap the *vertex* labels
      // so the landed vertex carries the target, then print each face's three
      // corner numbers accordingly.
      const vertexLabels = assignTarget(pool, landed, pd.targetLabel);
      materials = g.faceCorners.map((corners) => {
        const mat = d4FaceMaterial(
          theme,
          face,
          corners.map((c) => ({ label: vertexLabels[c.vertex] ?? '', uv: c.uv })),
        );
        // Already exclusively owned by this roll (freshly built, not cached),
        // so the dropped-die dim can mutate it in place.
        if (pd.dimmed) this.dim(mat);
        this.rollDisposables.push(mat);
        return mat;
      });
    } else {
      const faceLabels = assignTarget(pool, landed, pd.targetLabel);
      const faceMats = faceLabels.map((label) => faceMaterial(theme, face, pd.variant, label));
      if (pd.dimmed) {
        // These come from the shared cache — clone before dimming so a dropped
        // die's fade never bleeds into another roll's dice, and track the
        // clones separately so `clear()` never disposes the shared texture.
        // Color needs no clone: the cache is already keyed on face color.
        materials = faceMats.map((mat) => {
          const clone = mat.clone();
          this.dim(clone);
          this.tintDisposables.push(clone);
          return clone;
        });
      } else {
        materials = faceMats;
      }
    }
    // The body group sits one past the value range, so appending it cannot
    // disturb a single face→value slot (DEC-079).
    materials[g.bodyGroupIndex] = this.bodyMaterialFor(theme, face, pd);
    const mesh = new THREE.Mesh(g.geometry, materials);
    mesh.castShadow = true;
    return mesh;
  }

  /** The bevel's material for one die. Cached and shared like the face atlas;
   * a dropped die gets a clone to dim, which owns no texture of its own, so
   * `tintDisposables` (material only, never its maps) is exactly the right
   * bucket for it. */
  private bodyMaterialFor(theme: DiceTheme, face: string, pd: PhysicalDie): THREE.Material {
    const mat = bodyMaterial(theme, face, pd.variant);
    if (!pd.dimmed) return mat;
    const clone = mat.clone();
    this.dim(clone);
    this.tintDisposables.push(clone);
    return clone;
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
      const m = mat as THREE.MeshStandardMaterial;
      // d4 composites build both maps fresh per roll (textures.ts —
      // `d4FaceMaterial`'s normal map is not cached, unlike the single-number
      // atlas's), so both are this roll's alone to dispose.
      m.map?.dispose();
      m.normalMap?.dispose();
      mat.dispose();
    }
    this.rollDisposables = [];
    // Tint clones share their `.map`/`.normalMap` textures with the cached
    // original — dispose only the clone itself, never its (shared) textures.
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
    this.scene.remove(this.ground);
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.scene.environment = null;
    this.envMap?.dispose();
    this.envMap = null;
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
