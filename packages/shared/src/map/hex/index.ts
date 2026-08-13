/**
 * Hex Crawl coordinate space (SPEC-030 §1) — pure, store-free axial hex
 * geometry, the hex-grid sibling of `map/vector/`'s square lattice.
 *
 * Re-exported from the package root under its own `hexMap` namespace (see
 * `packages/shared/src/index.ts`), alongside `vectorMap`. The two namespaces
 * are the import-site expression of RULE-006's per-grid-kind rule: a module
 * reaching for `hexMap.axialDistance` on a square map, or `vectorMap.pointIn
 * FloorUnion` on a hex map, is visibly asking for a space its map does not
 * have.
 */
export * from './axial.js';
