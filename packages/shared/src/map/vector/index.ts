/**
 * Vector Map System — pure geometry (WI-A). SPEC/DECISIONS live in
 * `docs/VectorMapSystem_Spec.md`/`docs/VectorMapSystem_Decisions.md`. This is
 * the graduation of the original (since-deleted) `poc/vector-floor/` §9.1
 * sandbox's `geometry/` layer into `packages/shared`: pure, unit-tested,
 * lattice-space geometry with no store, rules, render, or app dependencies.
 * WI-B/WI-C/WI-D build on it.
 *
 * Re-exported from the package root under the `vectorMap` namespace (see
 * `packages/shared/src/index.ts`) so its `Point`/`Segment`/`Door` names never
 * collide with the existing cellular map system.
 */
export * from './types.js';
export * from './backend.js';
export * from './snap.js';
export * from './simplify.js';
export * from './tolerance.js';
export * from './primitives.js';
export * from './pipeline.js';
export * from './region.js';
export * from './point-in-floor.js';
export * from './los.js';
