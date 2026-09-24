/**
 * The one place that `import()`s `./scene` (SPEC-055 §1). `scene.ts` pulls in
 * three.js and the Rapier WASM binary — real weight nobody should pay for
 * until they actually roll or open the tray. Every caller shares this single
 * in-flight fetch rather than racing separate `import()`s of the same module.
 */
let modulePromise: Promise<typeof import('./scene')> | null = null;
let loadedTextures: typeof import('./textures') | null = null;

export function loadDiceSceneModule(): Promise<typeof import('./scene')> {
  if (!modulePromise) {
    modulePromise = import('./scene');
    // `./textures` is already a static dependency of `./scene`, so this is
    // not a second fetch — it just gets `clearDiceMaterialCacheIfLoaded`
    // below a synchronous reference once loading finishes.
    void import('./textures').then((mod) => {
      loadedTextures = mod;
    });
  }
  return modulePromise;
}

/**
 * Drops the baked dice material/texture caches when the room theme changes
 * (`RoomShell`). A no-op before the renderer has ever loaded — there is
 * nothing baked yet, and importing `./textures` just to find that out would
 * undo the point of the lazy load.
 */
export function clearDiceMaterialCacheIfLoaded(): void {
  loadedTextures?.clearDiceMaterialCache();
}
