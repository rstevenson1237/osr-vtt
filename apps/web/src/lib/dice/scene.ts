import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { assetStore, DICE_FACE_REF } from '../assets';

/**
 * Three.js + Rapier dice overlay (Plan §1.2, §8.8): a physics-driven tumble
 * animation, re-simulated identically (well, near-identically — see
 * `seed.ts`'s header comment) on every client from the roll's `seed`. The
 * face each die visually lands on is *corrected* to match the precomputed
 * `results` from `seed.ts` at the end of the tumble, so "both clients render
 * the same face" never depends on cross-platform float-identical physics.
 *
 * Material slot -> face-value mapping on the cube (standard opposite-faces-
 * sum-to-7 convention): +X=1, -X=6, +Y=2, -Y=5, +Z=3, -Z=4.
 */

const FACE_NORMALS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(1, 0, 0),
  6: new THREE.Vector3(-1, 0, 0),
  2: new THREE.Vector3(0, 1, 0),
  5: new THREE.Vector3(0, -1, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
};

const UP = new THREE.Vector3(0, 1, 0);
const DIE_SIZE = 1;
const STEPS_PER_ROLL = 90; // 1.5s of physics at 60Hz
const SETTLE_MS = 350;

let rapierReady: Promise<void> | null = null;
function ensureRapier(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

function quaternionForFace(face: number, spinSeed: number): THREE.Quaternion {
  const normal = FACE_NORMALS[face] ?? FACE_NORMALS[1]!;
  const upright = new THREE.Quaternion().setFromUnitVectors(normal, UP);
  const spin = new THREE.Quaternion().setFromAxisAngle(UP, spinSeed * Math.PI * 2);
  return spin.multiply(upright);
}

function seedToUnitFloats(seed: string, count: number): number[] {
  // Cheap, deterministic per-die variety derived from the seed string —
  // purely cosmetic (initial throw impulse / spin), never used for the
  // authoritative result.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push(h / 0xffffffff);
  }
  return out;
}

export class DiceScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private textureLoader = new THREE.TextureLoader();
  private disposed = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 6, 6);
    this.camera.lookAt(0, 0, 0);
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(3, 8, 4);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  }

  /** Returns true if a WebGL context could be created. Callers should fall
   * back to a non-3D presentation if this returns false — headless/software
   * rendering environments aren't guaranteed to support WebGL. */
  mount(container: HTMLElement): boolean {
    this.container = container;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return false;
    }
    const rect = container.getBoundingClientRect();
    this.renderer.setSize(rect.width || 300, rect.height || 200);
    container.appendChild(this.renderer.domElement);
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer || !this.container) return;
      const r = this.container.getBoundingClientRect();
      this.renderer.setSize(r.width || 300, r.height || 200);
      this.camera.aspect = (r.width || 300) / (r.height || 200);
      this.camera.updateProjectionMatrix();
    });
    this.resizeObserver.observe(container);
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  private async buildDie(): Promise<THREE.Mesh> {
    const materials: THREE.MeshStandardMaterial[] = [];
    // Material order matches THREE.BoxGeometry's face order: +X -X +Y -Y +Z -Z
    const faceForSlot = [1, 6, 2, 5, 3, 4];
    for (const face of faceForSlot) {
      const tex = await this.textureLoader.loadAsync(assetStore.resolve(DICE_FACE_REF(face)));
      materials.push(new THREE.MeshStandardMaterial({ map: tex }));
    }
    const geometry = new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE);
    return new THREE.Mesh(geometry, materials);
  }

  /** Tumbles one die per entry in `results`, each landing on its precomputed
   * face value. Resolves once every die has visually settled. */
  async roll(seed: string, results: number[]): Promise<void> {
    await ensureRapier();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.1, 6), groundBody);

    const spins = seedToUnitFloats(seed, results.length * 3);
    const dice: { mesh: THREE.Mesh; body: RAPIER.RigidBody; targetQuat: THREE.Quaternion }[] = [];

    for (let i = 0; i < results.length; i++) {
      const mesh = await this.buildDie();
      const startX = (i - (results.length - 1) / 2) * 1.5;
      mesh.position.set(startX, 3, 0);
      this.scene.add(mesh);

      const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(startX, 3 + i * 0.05, 0);
      const body = world.createRigidBody(bodyDesc);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);

      const [sx, sy, sz] = [spins[i * 3]!, spins[i * 3 + 1]!, spins[i * 3 + 2]!];
      body.setAngvel({ x: (sx - 0.5) * 12, y: (sy - 0.5) * 12, z: (sz - 0.5) * 12 }, true);
      body.setLinvel({ x: (sz - 0.5) * 2, y: 1, z: (sx - 0.5) * 2 }, true);

      const targetQuat = quaternionForFace(results[i]!, sy);
      dice.push({ mesh, body, targetQuat });
    }

    for (let step = 0; step < STEPS_PER_ROLL; step++) {
      world.step();
      for (const { mesh, body } of dice) {
        const t = body.translation();
        const r = body.rotation();
        mesh.position.set(t.x, t.y, t.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
      this.render();
      await nextFrame();
    }

    await this.settle(dice);
    world.free();
  }

  private async settle(dice: { mesh: THREE.Mesh; targetQuat: THREE.Quaternion }[]): Promise<void> {
    const start = dice.map((d) => d.mesh.quaternion.clone());
    const startTime = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / SETTLE_MS);
        dice.forEach((d, i) => {
          d.mesh.quaternion.copy(start[i]!).slerp(d.targetQuat, t);
        });
        this.render();
        if (t < 1 && !this.disposed) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      tick();
    });
  }

  private render(): void {
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  }

  clear(): void {
    for (const child of [...this.scene.children]) {
      if (child instanceof THREE.Mesh) {
        this.scene.remove(child);
        child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) m.dispose();
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.clear();
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
