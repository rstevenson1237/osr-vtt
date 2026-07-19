/**
 * Synthetic stress run for §8.2 (doc-size ceiling) and §8.4 (perf). Applies N
 * random carve + interior-rock ops to one map and reports worst-case vertex
 * count, estimated bytes, and per-op timing — with and without simplification.
 * These are the numbers the spec asks the POC to bring back.
 */
import { polygonClippingBackend as B } from './src/geometry/backend.js';
import { commitCarve } from './src/geometry/pipeline.js';
import { rectPoly, regularPoly } from './src/geometry/primitives.js';
import { countVertices } from './src/geometry/simplify.js';
import { estimateBytes } from './src/geometry/pipeline.js';
import type { MultiPoly, Poly } from './src/geometry/types.js';

function run(tolerance: number, N: number): void {
  let f: MultiPoly = [];
  let maxVerts = 0;
  let maxBytes = 0;
  let totalMs = 0;
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < N; i++) {
    const cx = rand() * 60;
    const cy = rand() * 40;
    const mode = rand() < 0.75 ? 'add' : 'subtract';
    const shape: Poly =
      rand() < 0.5
        ? rectPoly({ x: cx, y: cy }, { x: cx + 2 + rand() * 6, y: cy + 2 + rand() * 6 })
        : regularPoly({ x: cx, y: cy }, 1 + rand() * 4, 1 + Math.floor(rand() * 8))!;
    const t0 = performance.now();
    const res = commitCarve(f, [shape], mode, tolerance, B);
    totalMs += performance.now() - t0;
    f = res.floor;
    maxVerts = Math.max(maxVerts, res.metrics.verticesSimplified);
    maxBytes = Math.max(maxBytes, res.metrics.bytesSimplified);
  }
  console.log(
    `  tol=${tolerance.toFixed(2)}  regions=${f.length}  maxVerts=${maxVerts}  ` +
      `maxBytes≈${(maxBytes / 1024).toFixed(1)}KiB  totalVerts=${countVertices(f)}  ` +
      `totalBytes≈${(estimateBytes(f) / 1024).toFixed(1)}KiB  avgOp=${(totalMs / N).toFixed(3)}ms`,
  );
}

const N = 300;
console.log(`Stress: ${N} random carve/rock ops on one map (deterministic RNG)`);
run(0, N);
run(0.1, N);
run(0.25, N);
console.log('(maxBytes = worst-case single-region JSON estimate; Firestore limit is 1024 KiB)');
