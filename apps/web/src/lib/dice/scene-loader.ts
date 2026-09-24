/**
 * The one place that `import()`s `./scene` (SPEC-055 §1). `scene.ts` pulls in
 * three.js and the Rapier WASM binary — real weight nobody should pay for
 * until they actually roll or open the tray. Every caller shares this single
 * in-flight fetch rather than racing separate `import()`s of the same module.
 */
let modulePromise: Promise<typeof import('./scene')> | null = null;
let loadedTextures: typeof import('./textures') | null = null;
let signalLoaded: ((mod: typeof import('./scene')) => void) | null = null;
/** Settles whenever `loadDiceSceneModule` is actually called by someone —
 * never on its own. See `diceSceneModuleLoaded` below. */
const loadedSignal = new Promise<typeof import('./scene')>((resolve) => {
  signalLoaded = resolve;
});

export function loadDiceSceneModule(): Promise<typeof import('./scene')> {
  if (!modulePromise) {
    modulePromise = import('./scene').then((mod) => {
      signalLoaded?.(mod);
      return mod;
    });
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
 * Resolves once the dice renderer module has loaded — however that got
 * triggered (a roll, or the tray opening) — but calling this never triggers
 * the fetch itself. `DiceOverlay` awaits it from its own `onMount` (which
 * runs for every client in every room, tray or no tray) so that when
 * something else has already started the fetch, mounting the renderer
 * (`DiceScene.mount` — a synchronous, main-thread-blocking one-time cost:
 * shader compile + a baked PMREM environment map) happens as soon as the
 * code is ready rather than being deferred all the way to the next roll's
 * own critical path. A room that never rolls and never opens the tray still
 * never pays for any of it — this promise simply never settles for it.
 */
export function diceSceneModuleLoaded(): Promise<typeof import('./scene')> {
  return loadedSignal;
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
